// @ts-nocheck
// Order fulfillment core — the single source of truth for turning a *paid*
// Stripe PaymentIntent into a real order. Used by BOTH the Stripe webhook and
// the client-driven /api/checkout/confirm route, so an order is created even if
// one of those two paths fails (e.g. the webhook is not reachable on the host).
// Every write is idempotent on orders.stripe_payment_intent_id.
import { createClient } from "@supabase/supabase-js";
import { toCountryCode } from "@/lib/geo/country-codes";

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}

type Finalized = { orderId: string; orderNumber: string; created: boolean };

// Create (or return the existing) order for a succeeded PaymentIntent.
export async function finalizeStripeOrder(
  paymentIntent: any,
  opts: { shippingAddress?: any } = {}
): Promise<Finalized> {
  const s = admin();
  const piId = paymentIntent.id;

  const md = paymentIntent.metadata || {};
  // Shipping address: prefer the caller's (confirm route), else the copy stored
  // in the PaymentIntent metadata at create-intent (so the webhook path has it too).
  const shippingAddress = opts.shippingAddress || (() => { try { return md.ship ? JSON.parse(md.ship) : null; } catch { return null; } })();

  // Idempotency: never create two orders for the same intent. If the order was
  // created by the other path without an address, backfill it now.
  const { data: existing } = await s.from("orders").select("id, order_number, shipping_address").eq("stripe_payment_intent_id", piId).maybeSingle();
  if (existing) {
    const hasAddr = existing.shipping_address && existing.shipping_address.country;
    if (!hasAddr && shippingAddress) await s.from("orders").update({ shipping_address: shippingAddress }).eq("id", existing.id).then(() => {}, () => {});
    return { orderId: existing.id, orderNumber: existing.order_number, created: false };
  }

  const userId = md.userId && md.userId !== "guest" ? md.userId : null;
  const parsedItems: Array<{ pid: string; vid: string | null; qty: number; price: number }> =
    (() => { try { return JSON.parse(md.items || "[]"); } catch { return []; } })();

  const subtotal = Number(md.subtotal || 0);
  const shippingCost = Number(md.shippingCost || 0);
  const discount = Number(md.discount || 0);
  const total = typeof paymentIntent.amount === "number" ? paymentIntent.amount / 100 : subtotal + shippingCost - discount;
  const orderNumber = `AS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const { data: order, error: orderErr } = await s
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: userId,
      status: "confirmed",
      payment_status: "paid",
      subtotal,
      shipping_cost: shippingCost,
      discount,
      total,
      payment_method: "stripe",
      stripe_payment_intent_id: piId,
      ...(shippingAddress ? { shipping_address: shippingAddress } : {}),
    })
    .select("id, order_number")
    .single();

  // A concurrent path (webhook vs confirm) may have inserted between our check
  // and insert — the unique index rejects the duplicate; fetch and return it.
  if (orderErr) {
    const { data: raced } = await s.from("orders").select("id, order_number").eq("stripe_payment_intent_id", piId).maybeSingle();
    if (raced) return { orderId: raced.id, orderNumber: raced.order_number, created: false };
    throw new Error(`Order creation failed: ${orderErr.message}`);
  }

  if (parsedItems.length > 0) {
    await s.from("order_items").insert(
      parsedItems.map((it) => ({ order_id: order.id, product_id: it.pid, variant_id: it.vid, quantity: it.qty, price: it.price }))
    );
  }

  // Record the payment (idempotent on the intent id via merchant_reference).
  await s.from("payments").insert({
    order_id: order.id,
    user_id: userId,
    gateway: "stripe",
    amount: total,
    currency: (paymentIntent.currency || "usd").toUpperCase(),
    status: "completed",
    transaction_id: piId,
    merchant_reference: orderNumber,
    idempotency_key: piId,
    webhook_verified: true,
    webhook_received_at: new Date().toISOString(),
    gateway_response: { id: piId, amount: paymentIntent.amount, status: paymentIntent.status },
  }).then(() => {}, () => {});

  // Clear the server-side cart for signed-in buyers.
  if (userId) await s.from("cart_items").delete().eq("user_id", userId).then(() => {}, () => {});

  return { orderId: order.id, orderNumber: order.order_number, created: true };
}

// Retry automatic dispatch for paid orders that were never successfully placed
// at the supplier (no supplier order id yet). Called by the scheduled sync so a
// transient CJ failure self-heals with no manual step. Idempotent per order.
export async function retryPendingDispatches(limit = 50): Promise<{ attempted: number }> {
  let attempted = 0;
  try {
    const s = admin();
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    const { data: orders } = await s
      .from("orders")
      .select("id")
      .eq("payment_status", "paid")
      .is("supplier_external_id", null)
      .in("fulfillment_status", ["unfulfilled", "error"])
      .gte("created_at", since)
      .limit(limit);
    for (const o of orders || []) { await dispatchSupplierOrders(o.id); attempted++; }
  } catch (err) {
    console.error("retryPendingDispatches failed:", err);
  }
  return { attempted };
}

// Resolve the exact CJ variant id (vid) for one ordered line, following the
// real chain: order_items.variant_id → product_variants.sku → CJ variantSku →
// external_variant_id. Falls back to the single variant of a one-variant product.
// Returns { vid } or { error } so multi-variant orders never ship the wrong item.
function resolveCjVariant(mapping: any, ourSku: string | null): { vid?: string; error?: string } {
  const variants: any[] = mapping?.raw?.variants || mapping?.raw?.data?.variants || [];
  const vidOf = (v: any) => v?.external_variant_id || v?.raw?.vid || v?.vid || null;
  const skuOf = (v: any) => v?.sku || v?.raw?.variantSku || null;
  if (ourSku) {
    const match = variants.find((v) => skuOf(v) && String(skuOf(v)).toUpperCase() === String(ourSku).toUpperCase());
    if (match && vidOf(match)) return { vid: vidOf(match) };
  }
  // No SKU (product with no chosen variant) but the product is single-variant → unambiguous.
  if (variants.length === 1 && vidOf(variants[0])) return { vid: vidOf(variants[0]) };
  return { error: `No CJ variant match for SKU ${ourSku || "(none)"}` };
}

// Automatic dispatch to dropshipping suppliers (CJ) after payment. NEVER throws —
// a supplier/credential failure must not affect the customer order. Idempotent:
// an order that already has a CJ order id is never dispatched twice. Failures are
// recorded on the order (fulfillment_status='error' + fulfillment_error) and in
// supplier_orders so the admin sees exactly what went wrong.
export async function dispatchSupplierOrders(orderId: string): Promise<void> {
  const s = (() => { try { return admin(); } catch { return null; } })();
  if (!s) { console.error("dispatchSupplierOrders: service role not configured"); return; }
  try {
    const { data: order } = await s.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (!order) return;
    if (order.supplier_external_id) return; // already placed at CJ — idempotent no-op

    const { data: oItems } = await s.from("order_items").select("product_id, variant_id, quantity, price").eq("order_id", orderId);
    if (!oItems?.length) return;

    // CJ product mapping for the ordered products.
    const productIds = [...new Set(oItems.map((i) => i.product_id).filter(Boolean))];
    const { data: mappings } = await s
      .from("supplier_products")
      .select("external_id, imported_product_id, raw")
      .eq("supplier_id", "cj").eq("imported", true)
      .in("imported_product_id", productIds);
    if (!mappings?.length) return; // no CJ-sourced items → nothing to dispatch
    const mapByProduct = new Map(mappings.map((m) => [m.imported_product_id, m]));

    // Our variant SKUs + direct CJ ids for the ordered lines.
    const variantIds = oItems.map((i) => i.variant_id).filter(Boolean);
    const { data: pvs } = variantIds.length
      ? await s.from("product_variants").select("id, sku, external_variant_id").in("id", variantIds)
      : { data: [] as any[] };
    const pvById = new Map((pvs || []).map((v: any) => [v.id, v]));

    // Resolve every CJ-sourced line to its exact CJ vid. Prefer the authoritative
    // product_variants.external_variant_id (set by import / variant sync); fall
    // back to matching the SKU inside the cached CJ raw.
    const items: any[] = [];
    const errors: string[] = [];
    for (const it of oItems) {
      const m = mapByProduct.get(it.product_id);
      if (!m) continue; // not a CJ product — skip (e.g. mixed cart)
      const pv = it.variant_id ? pvById.get(it.variant_id) : null;
      const ourSku = pv?.sku ?? null;
      const directVid = pv?.external_variant_id ?? null;
      if (directVid) { items.push({ external_variant_id: directVid, quantity: it.quantity, sku: ourSku }); continue; }
      const r = resolveCjVariant(m, ourSku);
      if (r.error) { errors.push(r.error); continue; }
      items.push({ external_variant_id: r.vid, quantity: it.quantity, sku: ourSku });
    }
    if (!items.length && !errors.length) return; // nothing CJ to do

    const addr = order.shipping_address || {};
    const countryCode = toCountryCode(addr.country);
    if (items.length && !countryCode) errors.push(`Unrecognized shipping country "${addr.country || ""}" (need ISO code for CJ)`);

    // Any resolution/validation error → do NOT ship. Record it clearly.
    if (errors.length) {
      const message = errors.join("; ");
      await s.from("supplier_orders").insert({ supplier_id: "cj", order_id: orderId, status: "failed", total: order.total || 0, error: message }).then(() => {}, () => {});
      await s.from("orders").update({ fulfillment_status: "error", fulfillment_error: message }).eq("id", orderId);
      return;
    }

    const shipping = {
      countryCode, province: addr.state || null, city: addr.city || null,
      address: addr.address || null, name: [addr.firstName, addr.lastName].filter(Boolean).join(" ") || null,
      zip: addr.postalCode || null, phone: addr.phone || null,
    };

    const { createSupplierOrder } = await import("@/lib/suppliers/engine");
    const res = await createSupplierOrder({ supplierId: "cj", order: { ...order, shipping }, items, actor: null });

    if (res?.ok && res.external_order_id) {
      // Order status stays 'confirmed' (allowed set: pending/confirmed/shipped/
      // delivered/cancelled). CJ progress is tracked via fulfillment_status.
      await s.from("orders").update({
        fulfillment_status: "submitted", supplier_external_id: String(res.external_order_id),
        fulfillment_error: null,
      }).eq("id", orderId);
    } else {
      await s.from("orders").update({ fulfillment_status: "error", fulfillment_error: res?.message || "CJ order creation failed" }).eq("id", orderId);
    }
  } catch (err: any) {
    // Swallow — dispatch must never break the customer order.
    console.error("dispatchSupplierOrders (non-blocking) failed:", err);
    try { await s.from("orders").update({ fulfillment_status: "error", fulfillment_error: String(err?.message || err) }).eq("id", orderId); } catch {}
  }
}
