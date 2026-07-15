// @ts-nocheck
// Supplier engines: Import (supplier product -> real Atlanta Sneakers product +
// variants + images, with pricing rules & category mapping), Order (place a
// supplier order when a customer buys), and Sync (inventory/price/tracking).
import { createClient as createAnon } from "@supabase/supabase-js";
import { getAdapter } from "./registry";
import { applyPricingRule, suggestComparePrice } from "./adapter";

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
    await s.from("product_variants").insert({ product_id: product.id, size: v.size || null, color: v.color || null, color_hex: v.color_hex || null, sku: v.sku || null, stock: v.stock ?? 0 }).then(() => {}, () => {});
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

// Place a supplier order for one of our orders (Order Engine).
export async function createSupplierOrder({ supplierId, order, items, actor }) {
  const s = svc();
  const adapter = getAdapter(supplierId);
  const { data: rec } = await s.from("supplier_orders").insert({ supplier_id: supplierId, order_id: order?.id || null, status: "pending", total: order?.total || 0 }).select("id").single();
  const res = await adapter.createOrder({ orderNumber: order?.order_number, ...order?.shipping, items });
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
