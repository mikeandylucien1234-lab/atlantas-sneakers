// @ts-nocheck
// Supplier engines: Import (supplier product -> real Atlanta Sneakers product +
// variants + images, with pricing rules & category mapping), Order (place a
// supplier order when a customer buys), and Sync (inventory/price/tracking).
import { createClient as createAnon } from "@supabase/supabase-js";
import { getAdapter } from "./registry";
import { applyPricingRule, suggestComparePrice } from "./adapter";
import { toCountryCode } from "@/lib/geo/country-codes";

function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
function slugify(s) { return (s || "product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }
async function slog(s, row) { try { await s.from("supplier_logs").insert(row); } catch {} }

// Convert a supplier's HTML description into clean, readable plain text:
// drop embedded images, turn block tags into line breaks, strip the rest,
// decode common entities.
function cleanDescription(html) {
  if (!html) return "";
  let t = String(html);
  t = t.replace(/<\s*(img|script|style)[^>]*>[\s\S]*?<\/\s*(script|style)\s*>/gi, "");
  t = t.replace(/<\s*img[^>]*>/gi, "");
  t = t.replace(/<\s*br\s*\/?>/gi, "\n");
  t = t.replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n");
  t = t.replace(/<[^>]+>/g, "");
  t = t.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/g, "'");
  t = t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "");
  return t;
}

// Download each supplier image and upload it to the product-images bucket,
// returning the public Storage URLs. Any image that can't be fetched/uploaded
// keeps its original URL so nothing is silently dropped.
async function rehostImages(s, urls) {
  const list = Array.isArray(urls) ? urls.filter(u => typeof u === "string" && u.trim()) : [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    let url = list[i].trim();
    if (url.startsWith("//")) url = "https:" + url;
    if (url.includes(".supabase.co/storage/")) { out.push(url); continue; } // already hosted
    if (!/^https?:\/\//i.test(url)) { continue; } // skip local/file URLs
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "Mozilla/5.0", Referer: "" } });
      if (!res.ok) { out.push(url); continue; }
      const ct = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
      if (!ct.startsWith("image/")) { out.push(url); continue; }
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : ct.includes("gif") ? "gif" : ct.includes("avif") ? "avif" : "jpg";
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) { out.push(url); continue; }
      const path = `products/cj-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await s.storage.from("product-images").upload(path, buf, { contentType: ct, upsert: false });
      if (error) { out.push(url); continue; }
      const { data: pub } = s.storage.from("product-images").getPublicUrl(path);
      out.push(pub?.publicUrl || url);
    } catch { out.push(url); }
  }
  return out;
}

async function defaultPricingRule(s, supplierId) {
  const { data } = await s.from("supplier_pricing_rules").select("*").eq("supplier_id", supplierId).eq("enabled", true).order("is_default", { ascending: false }).order("priority").limit(1);
  return (data || [])[0] || { rule_type: "markup_percent", value: 35, rounding: "0.99" };
}
async function mapCategory(s, supplierId, externalCategory) {
  if (!externalCategory) return null;
  const { data } = await s.from("supplier_categories").select("mapped_category_id").eq("supplier_id", supplierId).eq("external_category", externalCategory).maybeSingle();
  return data?.mapped_category_id || null;
}

// Import one supplier product into the live catalog. `overrides` lets the wizard
// override name/price/category/etc. Returns the created product id.
export async function importProduct({ supplierId, externalId, overrides = {}, actor, db }) {
  // Prefer an explicit (authenticated admin) client so imports work via RLS even
  // when SUPABASE_SERVICE_ROLE_KEY is not configured on the host. Falls back to
  // the service client otherwise.
  const s = db || svc();
  const adapter = getAdapter(supplierId);
  // Prefer a cached supplier_products row; otherwise fetch live.
  let sp = null;
  const { data: cached } = await s.from("supplier_products").select("*").eq("supplier_id", supplierId).eq("external_id", externalId).maybeSingle();
  if (cached) sp = { ...cached, product: cached.raw };
  // Use, in order: a cached supplier_products row, the detail the Import Wizard
  // already loaded (passed in overrides.detail — lets publish work without a
  // second live API call), then a fresh live fetch as a last resort.
  let detail = overrides.refresh ? null : (cached?.raw || overrides.detail);
  if (!detail) {
    const r = await adapter.getProduct(externalId);
    if (!r.ok) return { ok: false, error: r.message };
    detail = r.product;
  }

  const rule = await defaultPricingRule(s, supplierId);
  const cost = Number(overrides.supplier_price ?? detail.supplier_price) || 0;
  const price = overrides.price != null ? Number(overrides.price) : applyPricingRule(cost, rule);
  const comparePrice = overrides.compare_price != null ? Number(overrides.compare_price) : suggestComparePrice(price);
  const name = overrides.name || detail.name;
  const rawImages = overrides.images || detail.images || (detail.main_image ? [detail.main_image] : []);
  // Download every supplier image and re-host it in our own Storage so products
  // never depend on the supplier's hotlink-protected CDN (which next/image also
  // refuses to render). Falls back to the original URL only if re-hosting fails.
  const images = await rehostImages(s, rawImages);
  const categoryId = overrides.category_id || await mapCategory(s, supplierId, detail.category_external);

  // Supplier descriptions are raw HTML with embedded <img> tags — clean them to
  // readable plain text so the storefront never shows markup.
  const description = cleanDescription(overrides.description || detail.description) || name;
  const metaDesc = (overrides.meta_description && cleanDescription(overrides.meta_description)) || description.slice(0, 160);

  // Create the real product
  const { data: product, error } = await s.from("products").insert({
    name, slug: overrides.slug || slugify(name) + "-" + Math.random().toString(36).slice(2, 6),
    description,
    price, compare_price: comparePrice, images,
    category_id: categoryId || null, brand_id: overrides.brand_id || null,
    status: overrides.status || "draft", is_featured: !!overrides.is_featured, is_new: overrides.is_new !== false,
    is_trending: !!overrides.is_trending, is_best_seller: !!overrides.is_best_seller,
    is_quickship: !!overrides.is_quickship,
    local_stock: overrides.local_stock != null ? Number(overrides.local_stock) : null,
    delivery_hours: overrides.delivery_hours != null ? Number(overrides.delivery_hours) : null,
    tags: overrides.tags || null, meta_title: overrides.meta_title || name, meta_description: metaDesc,
  }).select("id").single();
  if (error) return { ok: false, error: error.message };

  // Optional: add the imported product to Flash Sales (30-day window).
  if (overrides.flash_sale) {
    const now = new Date();
    const ends = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    await s.from("flash_deals").insert({ product_id: product.id, deal_price: price, starts_at: now.toISOString(), ends_at: ends.toISOString(), is_active: true }).then(() => {}, () => {});
  }

  // Variants
  const variants = overrides.variants || detail.variants || [];
  for (const v of variants) {
    await s.from("product_variants").insert({ product_id: product.id, size: v.size || null, color: v.color || null, color_hex: v.color_hex || null, sku: v.sku || null, stock: v.stock ?? 0, image_url: v.image || v.variantImage || null, external_variant_id: v.external_variant_id || null }).then(() => {}, () => {});
  }
  // Image records (source stored; local re-hosting/webp is an optional enhancement)
  for (let i = 0; i < images.length; i++) {
    await s.from("supplier_images").insert({ supplier_product_id: sp?.id || null, source_url: images[i], stored_url: images[i], position: i }).then(() => {}, () => {});
  }
  // Warranty Management: attach the CJ default warranty (if one is configured)
  // to every product imported from a supplier. Best-effort — never blocks import.
  try {
    const { data: cjWarranty } = await s.from("warranties").select("id").eq("cj_default", true).eq("status", "active").limit(1).maybeSingle();
    if (cjWarranty?.id) {
      await s.from("warranty_products").upsert(
        { warranty_id: cjWarranty.id, product_id: product.id, source: "cj" },
        { onConflict: "warranty_id,product_id", ignoreDuplicates: true }
      );
    }
  } catch {}
  // Upsert the supplier_products cache and mark imported
  await s.from("supplier_products").upsert({
    supplier_id: supplierId, external_id: externalId, name: detail.name, description: detail.description,
    category_external: detail.category_external, supplier_price: cost, recommended_price: price,
    main_image: detail.main_image, images: detail.images || [], videos: detail.videos || [],
    weight: detail.weight, dimensions: detail.dimensions, specs: detail.specs || {}, processing_time: detail.processing_time,
    raw: detail, imported: true, imported_product_id: product.id,
  }, { onConflict: "supplier_id,external_id" });
  await s.from("supplier_inventory").upsert({ supplier_id: supplierId, external_id: externalId, product_id: product.id, stock: variants.reduce((a, v) => a + (v.stock || 0), 0), supplier_price: cost, synced_at: new Date().toISOString() }, { onConflict: "supplier_id,external_id,variant_sku" }).then(() => {}, () => {});
  await slog(s, { supplier_id: supplierId, action: "import", status: "ok", actor_id: actor?.id, actor_name: actor?.full_name || actor?.email, error: null });
  return { ok: true, product_id: product.id, price, comparePrice };
}

// Sync full CJ variant data (vid, variantSku, colour, size, image) onto our
// product_variants. STRICTLY NON-DESTRUCTIVE: never deletes a variant, never
// overwrites correct data with empty, only fills/updates the CJ mapping + missing
// fields. Runs where the CJ API is reachable (e.g. o2switch). Pass a productId to
// sync one product, or omit to sync every imported CJ product.
export async function syncProductVariants({ supplierId = "cj", productId = null, limit = 500, actor = null } = {}) {
  const s = svc();
  const adapter = getAdapter(supplierId);
  let q = s.from("supplier_products")
    .select("id, external_id, imported_product_id, raw, images")
    .eq("supplier_id", supplierId).eq("imported", true).not("external_id", "is", null);
  if (productId) q = q.eq("imported_product_id", productId);
  const { data: prods } = await q.limit(limit);

  let synced = 0, failed = 0, variantsUpdated = 0, variantsInserted = 0;
  const errors = [];
  for (const sp of prods || []) {
    try {
      const res = await adapter.getProduct(sp.external_id);
      if (!res.ok || !res.product) {
        failed++; errors.push({ pid: sp.external_id, error: res.message || "getProduct failed" });
        await slog(s, { supplier_id: supplierId, action: "sync_variants", status: "error", error: res.message || "getProduct failed" });
        continue;
      }
      const detail = res.product;
      const variants = detail.variants || [];
      for (const v of variants) {
        if (!v.sku) continue;
        const { data: existing } = await s.from("product_variants")
          .select("id, image_url, color, size, color_hex, external_variant_id")
          .eq("product_id", sp.imported_product_id).eq("sku", v.sku).maybeSingle();
        if (existing) {
          const patch = {};
          if (v.external_variant_id) patch.external_variant_id = v.external_variant_id; // authoritative CJ id (non-empty only)
          if (v.image && !existing.image_url) patch.image_url = v.image;             // fill, never blank out
          if (v.color && !existing.color) patch.color = v.color;
          if (v.size && !existing.size) patch.size = v.size;
          if (v.color_hex && !existing.color_hex) patch.color_hex = v.color_hex;
          if (Object.keys(patch).length) { await s.from("product_variants").update(patch).eq("id", existing.id); variantsUpdated++; }
        } else {
          // CJ variant we didn't have yet → additive insert (never a delete).
          await s.from("product_variants").insert({
            product_id: sp.imported_product_id, sku: v.sku, external_variant_id: v.external_variant_id || null,
            color: v.color || null, size: v.size || null, color_hex: v.color_hex || null,
            image_url: v.image || null, stock: v.stock ?? 0,
          }).then(() => {}, () => {});
          variantsInserted++;
        }
      }
      // Enrich the cached raw (only when the detail actually carries variants), so
      // the raw-based fallback path also works. Never clears existing images.
      if (variants.length) {
        await s.from("supplier_products").update({
          raw: detail,
          images: (detail.images && detail.images.length ? detail.images : sp.images),
          updated_at: new Date().toISOString(),
        }).eq("id", sp.id).then(() => {}, () => {});
      }
      synced++;
      await slog(s, { supplier_id: supplierId, action: "sync_variants", status: "ok", error: `${variants.length} variants`, actor_id: actor?.id, actor_name: actor?.full_name });
      await new Promise((r) => setTimeout(r, 250)); // gentle throttle for the CJ API
    } catch (e) {
      failed++; errors.push({ pid: sp.external_id, error: e.message });
    }
  }
  return { ok: true, products: (prods || []).length, synced, failed, variantsUpdated, variantsInserted, errors: errors.slice(0, 25) };
}

// Resolve, WITHOUT sending anything to CJ, the exact data a dispatch would use:
// CJ product id, CJ variant id, selected variant, shipping country + ISO code,
// fromCountryCode, and the real CJ logistics options. Powers the admin
// "Order Sync Details" panel. Never invents values.
export async function previewSupplierOrder({ supplierId = "cj", orderId }) {
  const s = svc();
  const { data: order } = await s.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return { ok: false, error: "Order not found" };
  const { data: oItems } = await s.from("order_items").select("product_id, variant_id, quantity").eq("order_id", orderId);
  const productIds = [...new Set((oItems || []).map(i => i.product_id).filter(Boolean))];
  const { data: maps } = await s.from("supplier_products").select("external_id, imported_product_id")
    .eq("supplier_id", supplierId).eq("imported", true).in("imported_product_id", productIds.length ? productIds : ["_none_"]);
  const mapByProduct = new Map((maps || []).map(m => [m.imported_product_id, m]));
  const variantIds = (oItems || []).map(i => i.variant_id).filter(Boolean);
  const { data: pvs } = variantIds.length
    ? await s.from("product_variants").select("id, sku, color, size, external_variant_id").in("id", variantIds)
    : { data: [] };
  const pvById = new Map((pvs || []).map(v => [v.id, v]));

  const items = (oItems || []).map(it => {
    const m = mapByProduct.get(it.product_id);
    const pv = it.variant_id ? pvById.get(it.variant_id) : null;
    return {
      product_id: it.product_id, cj_product_id: m?.external_id || null,
      cj_variant_id: pv?.external_variant_id || null, sku: pv?.sku || null,
      color: pv?.color || null, size: pv?.size || null, quantity: it.quantity,
      resolved: !!(m && pv?.external_variant_id),
    };
  });

  const addr = order.shipping_address || {};
  const country = addr.country || null;
  const countryCode = toCountryCode(country);
  const fromCountryCode = process.env.CJ_FROM_COUNTRY_CODE || "CN";

  // Prefer the supplier order that actually has a CJ id (the placed one).
  const { data: soWithId } = await s.from("supplier_orders").select("*").eq("order_id", orderId).not("external_order_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: soLatest } = await s.from("supplier_orders").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const so = soWithId || soLatest;

  // Live CJ payment/fulfillment state (read-only — never triggers a payment).
  let cj_order_status = null, cj_payment_date = null, cj_amount_to_pay = null;
  if (so?.external_order_id) {
    try {
      const adapter = getAdapter(supplierId);
      const info = await adapter.getOrderPaymentInfo(so.external_order_id);
      if (info?.ok) { cj_order_status = info.orderStatus; cj_payment_date = info.paymentDate; cj_amount_to_pay = info.orderAmount; }
    } catch { /* best-effort */ }
  }

  // Real CJ logistics options (best-effort — needs resolved variants + country).
  let logistic_options = [], logistic_error = null, logistic_name = null;
  try {
    if (countryCode && items.length && items.every(i => i.cj_variant_id)) {
      const adapter = getAdapter(supplierId);
      const r = await adapter.getLogisticOptions({ fromCountryCode, toCountryCode: countryCode, zip: addr.postalCode, products: items.map(i => ({ external_variant_id: i.cj_variant_id, quantity: i.quantity })) });
      logistic_options = r.options || []; logistic_error = r.ok ? null : r.message;
      if (logistic_options.length) logistic_name = logistic_options.slice().sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9))[0].logisticName;
    } else {
      logistic_error = "Resolve variants and shipping country first";
    }
  } catch (e) { logistic_error = e.message; }

  const unresolved = items.filter(i => !i.resolved).map(i => i.sku || i.product_id);
  const blocking = unresolved.length ? `Unresolved CJ variant for SKU(s): ${unresolved.join(", ")}`
    : !countryCode ? `Unrecognized shipping country: ${country || "(none)"}`
    : !logistic_name ? (logistic_error || "No CJ logistics option for this destination")
    : null;

  return {
    ok: true,
    order_id: orderId, order_number: order.order_number,
    fulfillment_status: order.fulfillment_status, supplier_external_id: order.supplier_external_id,
    shipping_country: country, shipping_country_code: countryCode, from_country_code: fromCountryCode,
    logistic_name, logistic_options, logistic_error,
    items,
    // Customer shipping info (from THIS order) + the exact CJ payload that would
    // be sent — so the admin can compare before syncing.
    customer: (() => {
      const a1 = (addr.address || "").trim(), a2 = (addr.address2 || "").trim();
      const name = `${(addr.firstName || "").trim()} ${(addr.lastName || "").trim()}`.trim();
      return {
        recipient_name: name || null, address: a1 || null, address2: a2 || null,
        city: (addr.city || "").trim() || null, state: (addr.state || "").trim() || null,
        zip: (addr.postalCode || "").trim() || null, country: country || null,
        country_code: countryCode || null, phone: (addr.phone || "").trim() || null,
      };
    })(),
    cj_payload_preview: (() => {
      const a1 = (addr.address || "").trim(), a2 = (addr.address2 || "").trim();
      const name = `${(addr.firstName || "").trim()} ${(addr.lastName || "").trim()}`.trim();
      return {
        shippingCustomerName: name || null,
        shippingAddress: a2 ? `${a1}, ${a2}` : (a1 || null),
        shippingCity: (addr.city || "").trim() || null,
        shippingProvince: (addr.state || "").trim() || null,
        shippingZip: (addr.postalCode || "").trim() || null,
        shippingCountryCode: countryCode || null,
        fromCountryCode,
        shippingPhone: (addr.phone || "").trim() || null,
        logisticName: logistic_name || null,
        products: items.map(i => ({ vid: i.cj_variant_id, quantity: i.quantity })),
      };
    })(),
    supplier_order: so ? { id: so.id, status: so.status, error: so.error, external_order_id: so.external_order_id, created_at: so.created_at } : null,
    // Payment view — the real CJ id, the amount owed to CJ, live CJ status +
    // paymentDate, and our local payment_status. "paid" only when CJ confirms.
    cj_order_id: so?.external_order_id || order.supplier_external_id || null,
    payment_status: so?.payment_status || "unpaid",
    paid_amount: so?.paid_amount ?? null,
    paid_at: so?.paid_at ?? null,
    payment_error: so?.payment_error ?? null,
    cj_order_status, cj_payment_date, cj_amount_to_pay,
    blocking,
  };
}

// THE single, guarded CJ wallet-payment flow (used by BOTH auto-pay and the
// manual "Pay CJ Order" button). Never pays twice, never marks paid without CJ
// confirming paymentDate, uses the REAL CJ order id, records everything.
export async function paySupplierOrder({ supplierId = "cj", orderId, actor = null } = {}) {
  const s = svc();
  const { data: so } = await s.from("supplier_orders").select("*")
    .eq("order_id", orderId).eq("supplier_id", supplierId)
    .not("external_order_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!so || !so.external_order_id) return { ok: false, error: "No CJ order id for this order — create the CJ order first." };
  const cjId = so.external_order_id; // REAL CJ id, never AS-…

  // Guard 1 — already paid locally.
  if (so.payment_status === "paid" || so.paid_at) return { ok: true, already: true, payment_status: "paid", cj_order_id: cjId, paid_at: so.paid_at, paid_amount: so.paid_amount };
  // Guard 2 — a payment is already in flight.
  if (so.payment_status === "paying") return { ok: false, error: "A payment is already in progress for this CJ order." };

  const adapter = getAdapter(supplierId);

  // Guard 3 — source of truth: is CJ already paid? (never double-pay)
  const pre = await adapter.getOrderPaymentInfo(cjId);
  if (pre?.ok && pre.paymentDate) {
    await s.from("supplier_orders").update({ payment_status: "paid", paid_at: new Date(pre.paymentDate).toISOString(), paid_amount: pre.orderAmount ?? so.total, payment_raw: pre.raw || null, payment_error: null }).eq("id", so.id);
    return { ok: true, already: true, payment_status: "paid", cj_order_id: cjId, paid_amount: pre.orderAmount ?? so.total };
  }

  // Soft lock.
  await s.from("supplier_orders").update({ payment_status: "paying", payment_error: null }).eq("id", so.id);
  await slog(s, { supplier_id: supplierId, action: "pay_order", status: "ok", error: `paying ${cjId}`, actor_id: actor?.id, actor_name: actor?.full_name });

  const pay = await adapter.payOrder({ orderId: cjId });

  // Confirm via CJ regardless of the pay response — mark paid ONLY if paymentDate.
  const post = await adapter.getOrderPaymentInfo(cjId);
  const paymentDate = post?.ok ? post.paymentDate : null;

  if (paymentDate) {
    await s.from("supplier_orders").update({
      payment_status: "paid", paid_at: new Date(paymentDate).toISOString(),
      paid_amount: post.orderAmount ?? so.total, payment_raw: pay.rawResponse || post.raw || null, payment_error: null,
    }).eq("id", so.id);
    await slog(s, { supplier_id: supplierId, action: "pay_order", status: "ok", error: `paid ${cjId}` });
    return { ok: true, payment_status: "paid", cj_order_id: cjId, paid_amount: post.orderAmount ?? so.total, order_status: post.orderStatus };
  }

  // Not confirmed → failed. Leave unpaid, never ship.
  const msg = pay.ok ? "CJ did not confirm payment (paymentDate still empty) — verify wallet/order." : (pay.message || "CJ payment failed");
  await s.from("supplier_orders").update({ payment_status: "failed", payment_error: msg, payment_raw: pay.rawResponse || null }).eq("id", so.id);
  await slog(s, { supplier_id: supplierId, action: "pay_order", status: "error", error: msg });
  return { ok: false, payment_status: "failed", error: msg, cj_order_id: cjId };
}

// Place a supplier order for one of our orders (Order Engine).
export async function createSupplierOrder({ supplierId, order, items, actor }) {
  const s = svc();
  const adapter = getAdapter(supplierId);
  const { data: rec } = await s.from("supplier_orders").insert({ supplier_id: supplierId, order_id: order?.id || null, status: "pending", total: order?.total || 0 }).select("id").single();
  // Pass through an explicitly chosen logisticName (e.g. from the admin Retry) so
  // the adapter uses exactly that value instead of re-deriving it.
  const res = await adapter.createOrder({ orderNumber: order?.order_number, logisticName: order?.logisticName, ...order?.shipping, items });
  await s.from("supplier_orders").update({ external_order_id: res.external_order_id || null, status: res.ok ? "created" : "failed", error: res.ok ? null : res.message, raw: res.raw || null, updated_at: new Date().toISOString() }).eq("id", rec.id);
  await slog(s, { supplier_id: supplierId, action: "create_order", status: res.ok ? "ok" : "error", error: res.ok ? null : res.message, actor_id: actor?.id, actor_name: actor?.full_name });
  return { ok: res.ok, supplier_order_id: rec.id, external_order_id: res.external_order_id, message: res.message };
}

// Sync tracking for a supplier order (Tracking/Shipping Engine).
export async function syncTracking({ supplierId, supplierOrderId, trackingNumber, actor }) {
  const s = svc();
  const adapter = getAdapter(supplierId);
  const res = await adapter.getTracking(trackingNumber);
  if (res.ok) {
    const { data: so } = await s.from("supplier_orders").select("order_id").eq("id", supplierOrderId).maybeSingle();
    await s.from("supplier_tracking").upsert({ supplier_order_id: supplierOrderId, order_id: so?.order_id || null, tracking_number: res.tracking_number, carrier: res.carrier, status: res.status, current_country: res.current_country, history: res.history || [], updated_at: new Date().toISOString() }, { onConflict: "id" }).then(() => {}, () => {});
  }
  await slog(s, { supplier_id: supplierId, action: "tracking", status: res.ok ? "ok" : "error", error: res.ok ? null : res.message, actor_id: actor?.id });
  return res;
}

// Sync inventory/price for imported products (Inventory Engine).
export async function syncInventory({ supplierId, limit = 100, actor }) {
  const s = svc();
  const adapter = getAdapter(supplierId);
  const { data: imported } = await s.from("supplier_products").select("external_id, imported_product_id").eq("supplier_id", supplierId).eq("imported", true).limit(limit);
  let updated = 0;
  for (const row of imported || []) {
    const inv = await adapter.getInventory(row.external_id);
    if (!inv.ok) continue;
    await s.from("supplier_inventory").upsert({ supplier_id: supplierId, external_id: row.external_id, product_id: row.imported_product_id, stock: inv.stock, supplier_price: inv.price, synced_at: new Date().toISOString() }, { onConflict: "supplier_id,external_id,variant_sku" }).then(() => {}, () => {});
    updated++;
  }
  await s.from("supplier_connections").update({ last_sync_at: new Date().toISOString() }).eq("supplier_id", supplierId);
  await slog(s, { supplier_id: supplierId, action: "sync_inventory", status: "ok", error: `${updated} products` });
  return { ok: true, updated };
}

// Map a raw CJ order/tracking status onto our customer-facing order status.
function mapFulfillmentToOrderStatus(supplierStatus, hasTracking) {
  const v = String(supplierStatus || "").toLowerCase();
  if (/deliver/.test(v)) return "delivered";
  if (/(ship|transit|dispatch|fulfil|track)/.test(v) || hasTracking) return "shipped";
  if (/cancel/.test(v)) return "cancelled";
  return null; // leave the order status unchanged
}

// Pull the latest state for ONE placed supplier order from the supplier and
// write it back to supplier_orders, supplier_tracking AND the linked customer
// order (tracking number, carrier, status). Fully automatic — no manual step.
export async function syncSupplierOrder({ supplierId = "cj", supplierOrder }) {
  const s = svc();
  const adapter = getAdapter(supplierId);
  const so = supplierOrder;
  if (!so?.external_order_id) return { ok: false, message: "no external order id" };

  const detail = await adapter.getOrderStatus(so.external_order_id);
  if (!detail.ok) { await slog(s, { supplier_id: supplierId, action: "sync_order", status: "error", error: detail.message }); return detail; }

  let tracking = detail.tracking_number || null;
  let carrier = detail.carrier || null;
  let history = [];
  // Once a tracking number exists, pull the carrier scan history too.
  if (tracking) {
    const t = await adapter.getTracking(tracking);
    if (t.ok) { carrier = carrier || t.carrier; history = t.history || []; }
  }

  await s.from("supplier_orders").update({
    status: tracking ? "shipped" : (so.status || "created"),
    raw: detail.raw || so.raw, updated_at: new Date().toISOString(),
  }).eq("id", so.id).then(() => {}, () => {});

  if (tracking) {
    await s.from("supplier_tracking").upsert({
      supplier_order_id: so.id, order_id: so.order_id || null, tracking_number: tracking,
      carrier, status: detail.status, current_country: detail.raw?.country || null, history, updated_at: new Date().toISOString(),
    }, { onConflict: "supplier_order_id" }).then(() => {}, () => {});
  }

  // Reflect onto the customer order.
  if (so.order_id) {
    const orderStatus = mapFulfillmentToOrderStatus(detail.status, !!tracking);
    const patch: any = { fulfillment_status: tracking ? "shipped" : "submitted" };
    if (tracking) { patch.tracking_number = tracking; patch.carrier = carrier; patch.tracking_status = detail.status || null; patch.tracking_history = history; if (!so.tracking_number) patch.shipped_at = new Date().toISOString(); }
    if (orderStatus) patch.status = orderStatus;
    await s.from("orders").update(patch).eq("id", so.order_id).then(() => {}, () => {});
  }

  await slog(s, { supplier_id: supplierId, action: "sync_order", status: "ok", error: tracking ? `tracking ${tracking}` : "no tracking yet" });
  return { ok: true, tracking_number: tracking, carrier, status: detail.status };
}

// Sweep all open supplier orders (placed, not yet delivered) and sync each.
// Called by the scheduled tracking-sync job so updates flow with no manual work.
export async function syncOpenSupplierOrders({ supplierId = "cj", limit = 100 } = {}) {
  const s = svc();
  const { data: open } = await s.from("supplier_orders")
    .select("*")
    .eq("supplier_id", supplierId)
    .not("external_order_id", "is", null)
    .neq("status", "delivered")
    .order("created_at", { ascending: true })
    .limit(limit);
  let synced = 0, shipped = 0;
  for (const so of open || []) {
    const r = await syncSupplierOrder({ supplierId, supplierOrder: so });
    if (r.ok) { synced++; if (r.tracking_number) shipped++; }
  }
  return { ok: true, synced, shipped };
}
