// @ts-nocheck
// Authoritative, non-fixed shipping cost — the fix for a real problem: a fixed
// $9.99/$19.99/$39.99 shipping fee has no relationship to what CJdropshipping
// actually charges (which is driven by real product/variant weight + real
// destination). Charging a flat fee that's lower than the real CJ freight is a
// guaranteed per-order loss. This module asks CJ for the REAL freight price
// (via the existing getLogisticOptions, itself calling CJ's official
// /logistic/freightCalculate) whenever it can, and only falls back to a
// deliberately conservative, weight-tiered estimate when CJ can't be reached —
// never a number invented out of thin air, and never silently: a fallback
// quote always comes back flagged needsReview so an admin double-checks
// before/after the sale rather than the loss going unnoticed.
import { createClient as createAnon } from "@supabase/supabase-js";
import { getAdapter } from "@/lib/suppliers/registry";
import { toCountryCode } from "@/lib/geo/country-codes";

function svc() {
  return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
}

export type ShippingQuoteItem = { productId: string; variantId: string | null; quantity: number };
export type ShippingAddress = { country?: string; postalCode?: string; city?: string; state?: string };

export type ShippingQuoteResult = {
  ok: true;
  cost: number;
  source: "cj_live" | "cj_fallback" | "flat_non_supplier";
  needsReview: boolean;
  etaDays: string | null;
  cjRealFreight: number | null; // the real CJ price this was based on (for the admin margin report), before our safety margin
  message?: string;
};

// Safety margin added on top of the real (or fallback) CJ freight so a small
// swing in CJ's own pricing between quote-time and order-time never flips an
// order into a loss. Kept as one constant so it's trivial to tune later —
// this is the "marge de sécurité" the margin/pricing strategy calls for.
const SHIPPING_SAFETY_MARGIN_PCT = 12; // %
const SHIPPING_SAFETY_MARGIN_MIN = 1.5; // $ floor, so tiny freights still get a buffer
const FALLBACK_DEFAULT_WEIGHT_KG = 0.6; // used only when a CJ item's weight is entirely unknown

// Legacy flat rate — kept ONLY for items that aren't CJ-sourced (locally
// stocked / other suppliers) or as the absolute last resort when nothing at
// all about the shipment can be determined.
function flatRate(shippingMethod: string, subtotal: number): number {
  if (shippingMethod === "express") return 19.99;
  if (shippingMethod === "overnight") return 39.99;
  return subtotal >= 100 ? 0 : 9.99;
}

// Deliberately conservative — this is what protects against a loss when the
// real CJ price can't be fetched. Tiers are total shipment weight, worst case.
function fallbackFreightByWeight(totalWeightKg: number): number {
  const w = totalWeightKg;
  let base: number;
  if (w <= 0.5) base = 14.99;
  else if (w <= 1) base = 21.99;
  else if (w <= 2) base = 32.99;
  else if (w <= 3) base = 44.99;
  else if (w <= 5) base = 64.99;
  else base = 64.99 + (w - 5) * 10;
  return +base.toFixed(2);
}

function withSafetyMargin(cjRealFreight: number): number {
  const margin = Math.max(SHIPPING_SAFETY_MARGIN_MIN, cjRealFreight * (SHIPPING_SAFETY_MARGIN_PCT / 100));
  return +Math.ceil((cjRealFreight + margin) * 2) / 2; // round up to nearest $0.50
}

function parseAgingDays(aging: string | null): number {
  if (!aging) return 999;
  const m = String(aging).match(/(\d+)/);
  return m ? Number(m[1]) : 999;
}

// Short-lived in-process cache so repeated quote requests for the same
// cart/destination (address autosave, re-renders, retries) don't hammer CJ's
// API. o2switch runs one long-lived Node process, so this survives across
// requests within that process; it's cleared on restart, which is fine — a
// quote is re-fetched, never trusted stale beyond its TTL.
const CACHE_TTL_MS = 10 * 60 * 1000;
const quoteCache = new Map<string, { at: number; result: ShippingQuoteResult }>();

function cacheKey(items: ShippingQuoteItem[], addr: ShippingAddress, shippingMethod: string) {
  const norm = items.map((i) => `${i.productId}:${i.variantId || ""}:${i.quantity}`).sort().join(",");
  return `${norm}|${addr.country || ""}|${addr.postalCode || ""}|${shippingMethod}`;
}

/**
 * The single source of truth for what shipping actually costs. Used by every
 * order-creation path (Stripe create-intent, orders/create for other payment
 * methods) so none of them can independently invent a cheaper number.
 */
export async function getAuthoritativeShippingCost({
  items, shippingAddress, shippingMethod, subtotal,
}: {
  items: ShippingQuoteItem[];
  shippingAddress: ShippingAddress;
  shippingMethod: string;
  subtotal: number;
}): Promise<ShippingQuoteResult> {
  const method = shippingMethod || "standard";
  const key = cacheKey(items, shippingAddress || {}, method);
  const cached = quoteCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result;

  const result = await computeQuote({ items, shippingAddress, shippingMethod: method, subtotal });
  quoteCache.set(key, { at: Date.now(), result });
  return result;
}

async function computeQuote({ items, shippingAddress, shippingMethod, subtotal }: {
  items: ShippingQuoteItem[]; shippingAddress: ShippingAddress; shippingMethod: string; subtotal: number;
}): Promise<ShippingQuoteResult> {
  const s = svc();
  const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))];
  const variantIds = items.map((i) => i.variantId).filter(Boolean) as string[];

  const [supplierRes, variantRes] = await Promise.all([
    s.from("supplier_products").select("imported_product_id, supplier_id, weight").in("imported_product_id", productIds).eq("supplier_id", "cj").eq("imported", true),
    variantIds.length
      ? s.from("product_variants").select("id, product_id, external_variant_id, weight").in("id", variantIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const supplierByProduct = new Map((supplierRes.data || []).map((sp: any) => [sp.imported_product_id, sp]));
  const variantById = new Map((variantRes.data || []).map((v: any) => [v.id, v]));

  const cjItems: { external_variant_id: string; quantity: number; weight: number }[] = [];
  const nonCjItems: ShippingQuoteItem[] = [];
  let unresolvedCjItem = false;

  for (const it of items) {
    const sp = supplierByProduct.get(it.productId);
    if (!sp) { nonCjItems.push(it); continue; }
    const v = it.variantId ? variantById.get(it.variantId) : null;
    const vid = v?.external_variant_id;
    const weight = (v?.weight ?? sp.weight ?? null);
    if (!vid) { unresolvedCjItem = true; continue; }
    cjItems.push({ external_variant_id: vid, quantity: it.quantity, weight: Number(weight) || FALLBACK_DEFAULT_WEIGHT_KG });
  }

  // Nothing CJ-sourced in this cart at all → the old flat rate is honest (we
  // have no supplier freight to under-quote against).
  if (cjItems.length === 0 && nonCjItems.length === items.length) {
    return { ok: true, cost: flatRate(shippingMethod, subtotal), source: "flat_non_supplier", needsReview: false, etaDays: null, cjRealFreight: null };
  }

  const nonCjFlat = nonCjItems.length ? flatRate(shippingMethod, subtotal) : 0;
  const totalWeightKg = cjItems.reduce((a, i) => a + i.weight * i.quantity, 0);

  const countryCode = toCountryCode(shippingAddress?.country);
  const canCallCj = countryCode && !unresolvedCjItem && cjItems.length > 0;

  if (canCallCj) {
    try {
      const adapter = getAdapter("cj");
      const r = await adapter.getLogisticOptions({
        fromCountryCode: process.env.CJ_FROM_COUNTRY_CODE || "CN",
        toCountryCode: countryCode,
        zip: shippingAddress?.postalCode,
        products: cjItems.map((i) => ({ external_variant_id: i.external_variant_id, quantity: i.quantity })),
      });
      if (r.ok && r.options && r.options.length) {
        const byPrice = r.options.slice().sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
        const byAging = r.options.slice().sort((a, b) => parseAgingDays(a.aging) - parseAgingDays(b.aging));
        const chosen = shippingMethod === "overnight" ? byAging[0]
          : shippingMethod === "express" ? (byAging[1] || byAging[0])
          : byPrice[0];
        if (chosen && chosen.price != null) {
          const cost = +(withSafetyMargin(Number(chosen.price)) + nonCjFlat).toFixed(2);
          return { ok: true, cost, source: "cj_live", needsReview: false, etaDays: chosen.aging || null, cjRealFreight: Number(chosen.price) };
        }
      }
    } catch {
      // fall through to the conservative fallback below
    }
  }

  // Real CJ quote unavailable (API down, country unmapped, variant not yet
  // resolved) — never invent a cheap number. Use the deliberately padded
  // weight-tiered estimate and flag the order for manual verification.
  const fallback = fallbackFreightByWeight(totalWeightKg || FALLBACK_DEFAULT_WEIGHT_KG);
  const cost = +(fallback + nonCjFlat).toFixed(2);
  return {
    ok: true, cost, source: "cj_fallback", needsReview: true, etaDays: null, cjRealFreight: null,
    message: "Real-time CJ freight unavailable — used a conservative weight-based estimate. Verify actual CJ cost before/at manual fulfillment.",
  };
}

export type ShippingOptionPreview = {
  method: "standard" | "express" | "overnight";
  label: string;
  cost: number;
  etaDays: string | null;
  source: "cj_live" | "cj_fallback" | "flat_non_supplier";
  needsReview: boolean;
};

const OPTION_LABELS: Record<string, string> = {
  standard: "Standard Shipping",
  express: "Express Shipping",
  overnight: "Overnight Shipping",
};

// For the checkout UI: show the three tiers side by side with real CJ prices
// when available. Each tier is cached independently (see quoteCache), so a
// repeat request for the same cart/destination doesn't re-hit CJ at all.
export async function getShippingOptionsPreview({
  items, shippingAddress, subtotal,
}: { items: ShippingQuoteItem[]; shippingAddress: ShippingAddress; subtotal: number }): Promise<ShippingOptionPreview[]> {
  const methods: Array<"standard" | "express" | "overnight"> = ["standard", "express", "overnight"];
  const results = await Promise.all(
    methods.map((m) => getAuthoritativeShippingCost({ items, shippingAddress, shippingMethod: m, subtotal }))
  );
  return methods.map((m, i) => ({
    method: m, label: OPTION_LABELS[m], cost: results[i].cost, etaDays: results[i].etaDays,
    source: results[i].source, needsReview: results[i].needsReview,
  }));
}
