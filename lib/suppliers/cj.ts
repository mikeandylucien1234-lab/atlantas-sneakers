// @ts-nocheck
// CJ Dropshipping adapter — the first concrete SupplierAdapter. Talks to the real
// CJ Dropshipping API v2 when credentials are present (CJ_EMAIL + CJ_API_KEY, or a
// pre-issued CJ_ACCESS_TOKEN). Access tokens are cached in-process. With no
// credentials every method returns an honest "not connected" result.
import { SupplierAdapter } from "./adapter";
import { ensureCreds, getCreds } from "./secrets";

const BASE = "https://developers.cjdropshipping.com/api2.0/v1";

/* ============ Smart search helpers ============ */
const STOPWORDS = new Set(["the", "a", "an", "and", "or", "for", "with", "of", "in", "on", "to", "set", "pcs", "pc", "new", "hot", "fashion", "style", "women", "womens", "woman", "men", "mens", "man", "kids", "girls", "boys", "s"]);
// Normalize: lowercase, strip punctuation/apostrophes/hyphens → spaces, collapse.
function norm(s) {
  return String(s || "").toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(s) { return norm(s).split(" ").filter(Boolean); }
function keyTokens(s) { return tokens(s).filter(t => t.length > 1 && !STOPWORDS.has(t)); }

// Relevance score of a product name against the original query (0..1000).
function relevance(query, name) {
  const q = norm(query), n = norm(name);
  if (!q || !n) return 0;
  if (q === n) return 1000;
  let score = 0;
  if (n.includes(q)) score += 600 + Math.round((q.length / n.length) * 100); // full query appears in title
  const qt = tokens(q), nt = new Set(tokens(n));
  const matched = qt.filter(t => nt.has(t)).length;
  score += Math.round((matched / qt.length) * 300); // token coverage
  // ordered bigram bonus (keeps phrase order relevance)
  const qb = []; for (let i = 0; i < qt.length - 1; i++) qb.push(qt[i] + " " + qt[i + 1]);
  const bigramHits = qb.filter(b => n.includes(b)).length;
  score += bigramHits * 20;
  // fuzzy token match (handles plurals / small typos)
  const ntArr = [...nt];
  let fuzzy = 0;
  for (const t of qt) { if (!nt.has(t) && ntArr.some(x => x.length > 3 && (x.startsWith(t.slice(0, 4)) || t.startsWith(x.slice(0, 4))))) fuzzy++; }
  score += Math.round((fuzzy / qt.length) * 80);
  return score;
}

// CJ encodes a variant's options in variantKey, e.g. "White-S", "Wine Red-2XL",
// "Black-XXL". Split on the LAST separator so multi-word colours stay intact and
// the trailing token becomes the size. Falls back to treating the whole value as
// the colour when there is no size segment.
const SIZE_TOKENS = new Set(["xs", "s", "m", "l", "xl", "xxl", "xxxl", "2xl", "3xl", "4xl", "5xl", "6xl", "one size", "onesize", "free size"]);
function parseVariantKey(key) {
  const k = String(key || "").replace(/\s+/g, " ").trim();
  if (!k) return { color: null, size: null };
  const parts = k.split(/[-/|]/).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    // If the last token looks like a size, use it; else keep everything as colour.
    if (SIZE_TOKENS.has(last.toLowerCase()) || /^\d+([.,]\d+)?$/.test(last) || /^(2|3|4|5|6)?x*l$/i.test(last)) {
      return { color: parts.slice(0, -1).join(" "), size: last };
    }
    return { color: parts.join(" "), size: null };
  }
  // single token — is it a size or a colour?
  if (SIZE_TOKENS.has(k.toLowerCase())) return { color: null, size: k };
  return { color: k, size: null };
}

const COLOR_HEX = {
  white: "#f5f5f5", black: "#111111", grey: "#8a8f98", gray: "#8a8f98", silver: "#c0c0c0",
  red: "#d32f2f", "wine red": "#722f37", wine: "#722f37", burgundy: "#722f37",
  blue: "#1e50a2", navy: "#1f2d5a", "navy blue": "#1f2d5a", "sky blue": "#87ceeb", "light blue": "#add8e6",
  green: "#2e7d32", "army green": "#4b5320", "dark green": "#1b4332",
  yellow: "#f4c430", orange: "#ea7317", pink: "#ec4899", purple: "#7c3aed", brown: "#6f4e37",
  coffee: "#6f4e37", "coffee brown": "#6f4e37", khaki: "#c3b091", beige: "#e8d9c0",
  gold: "#d4af37", "rose gold": "#b76e79", apricot: "#fbceb1", "light grey": "#d3d3d3", "dark grey": "#4a4a4a",
};
function hexForColor(name) {
  if (!name) return null;
  return COLOR_HEX[String(name).toLowerCase().trim()] || null;
}
let _token = { value: null, exp: 0 };

// Resolve credentials: env vars win, then UI-stored (encrypted) values.
function creds() {
  const s = getCreds("cj");
  return {
    email: process.env.CJ_EMAIL || s.email || null,
    apiKey: process.env.CJ_API_KEY || s.api_key || null,
    accessToken: process.env.CJ_ACCESS_TOKEN || s.access_token || null,
  };
}

let _tokenSig = "";
async function getToken() {
  const c = creds();
  const sig = `${c.email || ""}:${c.apiKey || ""}:${c.accessToken || ""}`;
  if (sig !== _tokenSig) { _token = { value: null, exp: 0 }; _tokenSig = sig; } // creds changed → re-auth
  if (_token.value && Date.now() < _token.exp) return _token.value;
  const { email, apiKey, accessToken } = c;
  if (!email || !apiKey) return accessToken || null;
  const r = await fetch(`${BASE}/authentication/getAccessToken`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: apiKey }), signal: AbortSignal.timeout(8000),
  });
  const d = await r.json();
  if (!d?.data?.accessToken) throw new Error(d?.message || "CJ auth failed");
  _token = { value: d.data.accessToken, exp: Date.now() + 13 * 24 * 3600_000 }; // ~15d validity
  return _token.value;
}
async function cj(path, { method = "GET", body, query } = {}) {
  const token = await getToken();
  if (!token) throw new Error("CJ credentials not configured");
  const url = new URL(`${BASE}${path}`);
  if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const r = await fetch(url, { method, headers: { "CJ-Access-Token": token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000) });
  const d = await r.json();
  if (d && d.result === false) throw new Error(d.message || `CJ ${r.status}`);
  return d;
}

export class CJAdapter extends SupplierAdapter {
  constructor() { super("cj", ["CJ_API_KEY", "CJ_ACCESS_TOKEN"]); }
  // Ensures the encrypted UI-stored credentials are hydrated into the cache
  // before any sync isConfigured() check runs. Call at the top of async methods.
  async hydrate() { await ensureCreds("cj"); }
  isConfigured() { const c = creds(); return !!(c.accessToken || (c.email && c.apiKey)); }
  missingEnv() { return this.isConfigured() ? [] : ["CJ_EMAIL", "CJ_API_KEY"]; }

  async testConnection() {
    await this.hydrate();
    if (!this.isConfigured()) return { ok: false, configured: false, message: "Add your CJ credentials (email + API key) below, or set CJ_EMAIL + CJ_API_KEY on the server." };
    const t = Date.now();
    try { await getToken(); await cj("/product/list", { query: { pageNum: 1, pageSize: 1 } }); return { ok: true, configured: true, latency: Date.now() - t, message: "CJ Dropshipping API reachable & authenticated." }; }
    catch (e) { return { ok: false, configured: true, latency: Date.now() - t, message: e.message }; }
  }

  // Intelligent multi-attempt search: exact title → punctuation-free →
  // keywords-only → narrower core, across several CJ params (productNameEn,
  // productName, productSku), merged/de-duped and ranked by relevance.
  // `debug` returns the exact URLs, params, totals and whether `skuCheck` was
  // found — so we can see if a missing product is an API-request issue.
  async searchProducts({ keyword, page = 1, pageSize = 20, category, warehouse, debug = false, skuCheck } = {}) {
    await this.hydrate();
    if (!this.isConfigured()) return { ok: false, products: [], total: 0, configured: false, message: "CJ not connected — add credentials to search live products." };

    const kw = String(keyword || "").trim();
    const mapItem = (p) => ({
      external_id: p.pid, name: p.productNameEn, sku: p.productSku, image: p.productImage, supplier_price: Number(p.sellPrice) || 0,
      category_external: p.categoryName, warehouse: p.entryCode, processing_time: p.deliveryTime, raw: p,
    });
    const dbg = [];
    const buildUrl = (params) => { const u = new URL(`${BASE}/product/list`); Object.entries(params).forEach(([k, v]) => v != null && u.searchParams.set(k, String(v))); return u.toString(); };
    const hit = (list) => skuCheck ? list.some(p => (p.productSku && String(p.productSku).toUpperCase() === String(skuCheck).toUpperCase()) || String(p.pid) === String(skuCheck)) : undefined;

    // One CJ /product/list call for arbitrary params, with debug capture.
    const listRaw = async (params, label) => {
      const query = { pageSize: 40, pageNum: 1, categoryId: category || undefined, countryCode: warehouse || undefined, ...params };
      const url = buildUrl(query);
      try {
        const d = await cj("/product/list", { query });
        const list = d?.data?.list || [];
        const rec = { attempt: label, url, params: query, total: d?.data?.total ?? 0, returned: list.length, skuFound: hit(list) };
        if (debug) { rec.sampleNames = list.slice(0, 5).map(p => p.productNameEn); dbg.push(rec); }
        console.log("[CJ search]", JSON.stringify(rec));
        return { list, total: d?.data?.total || 0 };
      } catch (e) {
        const rec = { attempt: label, url, params: query, error: e.message };
        if (debug) dbg.push(rec);
        console.log("[CJ search][error]", JSON.stringify(rec));
        return { list: [], total: 0 };
      }
    };

    try {
      // No keyword → plain paginated browse.
      if (!kw) {
        const d = await cj("/product/list", { query: { pageNum: page, pageSize, categoryId: category || undefined, countryCode: warehouse || undefined } });
        const list = d?.data?.list || [];
        return { ok: true, total: d?.data?.total || list.length, products: list.map(mapItem), ...(debug ? { debug: dbg } : {}) };
      }

      const byId = new Map();
      const absorb = (pool) => { for (const p of pool.list) if (p?.pid && !byId.has(p.pid)) byId.set(p.pid, p); };
      let firstTotal = 0;

      // 0) If the term looks like a SKU/PID → definitive exact lookup by SKU.
      const looksLikeSku = !kw.includes(" ") && kw.length >= 6 && /\d/.test(kw) && /^[A-Za-z0-9._-]+$/.test(kw);
      if (looksLikeSku) {
        const bySku = await listRaw({ productSku: kw }, "productSku");
        firstTotal = bySku.total; absorb(bySku);
        // also try CJ /product/query which resolves a SKU directly to a product
        try {
          const q = await cj("/product/query", { query: { productSku: kw } });
          const qp = q?.data;
          if (qp?.pid && !byId.has(qp.pid)) { byId.set(qp.pid, { pid: qp.pid, productNameEn: qp.productNameEn, productSku: qp.productSku, productImage: qp.productImage, sellPrice: qp.sellPrice, categoryName: qp.categoryName }); }
          if (debug) dbg.push({ attempt: "product/query?productSku", url: `${BASE}/product/query?productSku=${encodeURIComponent(kw)}`, found: !!qp?.pid, name: qp?.productNameEn });
        } catch (e) { if (debug) dbg.push({ attempt: "product/query?productSku", error: e.message }); }
      }

      // Name-based variants across two CJ name params.
      const kt = keyTokens(kw);
      const variants = [...new Set([kw, norm(kw), kt.join(" "), kt.slice(0, 4).join(" "), kt.slice(0, 2).join(" ")].map(v => v && v.trim()).filter(Boolean))];
      for (const v of variants) {
        const a = await listRaw({ productNameEn: v }, `productNameEn="${v}"`);
        if (!firstTotal) firstTotal = a.total; absorb(a);
        if (skuCheck && hit(a.list)) break;                          // stop as soon as target SKU appears
        // CJ also indexes some products under `productName` — try it too.
        const b = await listRaw({ productName: v }, `productName="${v}"`);
        absorb(b);
        if (skuCheck && hit(b.list)) break;
        const strong = [...byId.values()].some(p => relevance(kw, p.productNameEn) >= 600);
        if (byId.size >= 40 && strong) break;
        if (byId.size >= 120) break;
      }

      const ranked = [...byId.values()]
        .map(p => ({ p, score: relevance(kw, p.productNameEn) }))
        .sort((a, b) => b.score - a.score)
        .map(x => x.p);

      const total = Math.max(ranked.length, firstTotal);
      const start = (page - 1) * pageSize;
      const pageItems = ranked.slice(start, start + pageSize).map(mapItem);
      const out = { ok: true, total, products: pageItems };
      if (debug) { out.debug = { query: kw, skuCheck: skuCheck || null, skuFoundAnywhere: skuCheck ? ranked.some(p => String(p.productSku).toUpperCase() === String(skuCheck).toUpperCase()) : null, pool: byId.size, attempts: dbg }; }
      return out;
    } catch (e) { return { ok: false, products: [], total: 0, message: e.message, ...(debug ? { debug: dbg } : {}) }; }
  }

  async getProduct(externalId) {
    await this.hydrate();
    if (!this.isConfigured()) return { ok: false, message: "CJ not connected." };
    try {
      const d = await cj("/product/query", { query: { pid: externalId } });
      const p = d?.data; if (!p) return { ok: false, message: "Product not found" };
      const variants = (p.variants || []).map(v => {
        const parsed = parseVariantKey(v.variantKey || v.variantNameEn || v.variantStandard || "");
        return {
          external_variant_id: v.vid, sku: v.variantSku,
          color: parsed.color, size: parsed.size, color_hex: hexForColor(parsed.color),
          supplier_price: Number(v.variantSellPrice) || 0, stock: v.variantQuantity ?? null,
          weight: Number(v.variantWeight) || null, image: v.variantImage, raw: v,
        };
      });
      const images = p.productImageSet || (p.productImage ? [p.productImage] : []);
      return { ok: true, product: {
        external_id: p.pid, name: p.productNameEn, description: p.description || p.productNameEn,
        category_external: p.categoryName, supplier_price: Number(p.sellPrice) || 0, currency: "USD",
        main_image: p.productImage, images, videos: p.productVideo ? [p.productVideo] : [],
        weight: Number(p.productWeight) || null, dimensions: { length: p.packLength, width: p.packWidth, height: p.packHeight },
        specs: p.propertyList ? Object.fromEntries((p.propertyList || []).map(x => [x.propertyNameEn, x.propertyValueEn])) : {},
        processing_time: p.deliveryTime, variants, raw: p,
      } };
    } catch (e) { return { ok: false, message: e.message }; }
  }

  // Real CJ logistics options for a destination + products. CJ requires a
  // logisticName on createOrder; we pick a REAL available one (never invented).
  async getLogisticOptions({ fromCountryCode, toCountryCode, zip, products } = {}) {
    await this.hydrate();
    if (!this.isConfigured()) return { ok: false, options: [], message: "CJ not connected." };
    try {
      const d = await cj("/logistic/freightCalculate", { method: "POST", body: {
        startCountryCode: fromCountryCode || process.env.CJ_FROM_COUNTRY_CODE || "CN",
        endCountryCode: toCountryCode,
        zip: zip || undefined,
        products: (products || []).map(p => ({ quantity: p.quantity, vid: p.external_variant_id })),
      } });
      const options = (d?.data || []).map(o => ({
        logisticName: o.logisticName || o.logisticsName, price: Number(o.logisticPrice) || null, aging: o.logisticAging || null,
      })).filter(o => o.logisticName);
      return { ok: true, options };
    } catch (e) { return { ok: false, options: [], message: e.message }; }
  }

  async createOrder(order) {
    await this.hydrate();
    if (!this.isConfigured()) return { ok: false, message: "CJ not connected." };
    const fromCountryCode = order.fromCountryCode || process.env.CJ_FROM_COUNTRY_CODE || "CN";
    try {
      // Resolve a real logistics method (CJ requires logisticName). Prefer an
      // explicit one (e.g. the value shown/chosen in the admin); otherwise pick
      // the cheapest option CJ actually offers. Trim to avoid stray whitespace.
      let logisticName = (order.logisticName || "").toString().trim() || null;
      let logisticFrom = logisticName ? "explicit" : null;
      if (!logisticName) {
        const opt = await this.getLogisticOptions({ fromCountryCode, toCountryCode: order.countryCode, zip: order.zip, products: order.items });
        if (opt.ok && opt.options.length) {
          const cheapest = opt.options.slice().sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9))[0];
          logisticName = (cheapest.logisticName || "").toString().trim() || null; logisticFrom = "freightCalculate";
        }
      }

      // SERVER-SIDE VALIDATION: never call CJ with an empty logisticName.
      if (!logisticName) {
        return { ok: false, message: `logisticName is empty — refusing to call CJ. No logistics option resolved for ${order.countryCode || "(no country)"}. Verify the shipping country/zip and that the products ship to this destination.` };
      }

      const vids = (order.items || []).map(i => i.external_variant_id);
      if (vids.some(v => !v)) {
        return { ok: false, message: `Missing CJ variant id (vid) on one or more items — refusing to call CJ.` };
      }

      // SERVER-SIDE VALIDATION: CJ requires both shippingCountry and
      // shippingCountryCode — never call CJ with an empty destination country.
      const shippingCountryCode = (order.countryCode || "").toString().trim();
      if (!shippingCountryCode) {
        return { ok: false, message: `shippingCountry/shippingCountryCode is empty — refusing to call CJ. Resolve the shipping country to an ISO code first.` };
      }

      const payload = {
        orderNumber: order.orderNumber,
        fromCountryCode,
        // CJ requires BOTH: the ISO code and a non-empty shippingCountry.
        shippingCountry: shippingCountryCode,
        shippingCountryCode,
        shippingProvince: order.province,
        shippingCity: order.city, shippingAddress: order.address, shippingCustomerName: order.name,
        shippingZip: order.zip, shippingPhone: order.phone,
        logisticName, remark: "Atlanta Sneakers",
        products: (order.items || []).map(i => ({ vid: i.external_variant_id, quantity: i.quantity })),
      };
      // Log the EXACT payload just before the CJ call, confirming the critical
      // fields are present (not undefined/null/"").
      console.log("[CJ createOrder payload]", JSON.stringify({
        ...payload,
        _check: {
          logisticNamePresent: !!payload.logisticName,
          shippingCountry: payload.shippingCountry,
          shippingCountryCode: payload.shippingCountryCode,
          fromCountryCode: payload.fromCountryCode,
        },
      }));

      const d = await cj("/shopping/order/createOrder", { method: "POST", body: payload });
      // Log the FULL CJ response so the exact order-id shape is verifiable.
      console.log("[CJ createOrder response]", JSON.stringify(d));

      // Robustly extract the CJ order id — CJ may return `data` as a plain string
      // (the id) or an object under one of several keys.
      const data = d?.data;
      const external_order_id = data == null ? null
        : (typeof data === "object"
            ? (data.orderId || data.orderNum || data.orderNumber || data.cjOrderId || data.id || null)
            : String(data));

      if (!external_order_id) {
        // CJ accepted but we couldn't read an id — do NOT report success (would
        // orphan a real CJ order). Store the FULL response for inspection.
        return { ok: false, message: "CJ returned success but no order id could be parsed — inspect rawResponse.", raw: d, rawResponse: d };
      }
      // Store the FULL response (code/result/message/data) so the exact id shape
      // is always inspectable from the database.
      return { ok: true, external_order_id: String(external_order_id), status: "created", logisticName, logisticFrom, raw: d, rawResponse: d };
    } catch (e) { return { ok: false, message: e.message }; }
  }

  // Best-effort recovery of a CJ order id from OUR order number — used to reclaim
  // an id when createOrder succeeded but its response id wasn't captured, so we
  // never place a duplicate. Non-throwing.
  async findOrderByNumber(orderNumber) {
    await this.hydrate();
    if (!this.isConfigured() || !orderNumber) return { ok: false };
    try {
      // CJ's order list endpoint is GET (POST returns "method not supported").
      const d = await cj("/shopping/order/list", { query: { pageNum: 1, pageSize: 100 } });
      const list = d?.data?.list || (Array.isArray(d?.data) ? d.data : []);
      const match = (list || []).find(o =>
        o.orderNum === orderNumber || o.orderNumber === orderNumber || o.cpOrderNumber === orderNumber || o.cpOrderNum === orderNumber);
      if (match) return { ok: true, external_order_id: match.orderId || match.cjOrderId || match.orderNum || match.id || null, rawResponse: d, match };
      // Fallback: try order detail keyed by our number (some CJ accounts accept it).
      let detail = null;
      try { detail = await cj("/shopping/order/getOrderDetail", { query: { orderId: orderNumber } }); } catch { /* ignore */ }
      const dOrderId = detail?.data?.orderId || detail?.data?.cjOrderId || null;
      if (dOrderId) return { ok: true, external_order_id: dOrderId, rawResponse: { list: d, detail }, match: detail?.data };
      return { ok: false, rawResponse: { list: d, detail } };
    } catch (e) { return { ok: false, message: e.message }; }
  }

  async getTracking(ref) {
    await this.hydrate();
    if (!this.isConfigured()) return { ok: false, message: "CJ not connected." };
    try {
      const d = await cj("/logistic/getTrackInfo", { query: { trackNumber: ref } });
      const t = d?.data;
      return { ok: true, tracking_number: ref, carrier: t?.logisticName, status: t?.trackStatus, current_country: t?.country, history: t?.trackList || [] };
    } catch (e) { return { ok: false, message: e.message }; }
  }

  // Poll a placed CJ order for its fulfillment state + tracking number. Used by
  // the automatic tracking-sync job to pull shipping updates without any manual
  // step. Returns { status, tracking_number, carrier } when available.
  async getOrderStatus(externalOrderId) {
    await this.hydrate();
    if (!this.isConfigured()) return { ok: false, message: "CJ not connected." };
    try {
      const d = await cj("/shopping/order/getOrderDetail", { query: { orderId: externalOrderId } });
      const o = d?.data || {};
      const tracking = o.trackNumber || o.trackingNumber || null;
      return {
        ok: true,
        status: o.orderStatus || o.status || null,
        tracking_number: tracking,
        carrier: o.logisticName || o.shippingName || null,
        raw: o,
      };
    } catch (e) { return { ok: false, message: e.message }; }
  }

  async getInventory(externalId) {
    const r = await this.getProduct(externalId);
    if (!r.ok) return r;
    const stock = (r.product.variants || []).reduce((a, v) => a + (v.stock || 0), 0);
    return { ok: true, stock, price: r.product.supplier_price, variants: r.product.variants };
  }

  async getCategories() {
    await this.hydrate();
    if (!this.isConfigured()) return { ok: false, categories: [] };
    try { const d = await cj("/product/getCategory", {}); const flat = []; (d?.data || []).forEach(l1 => (l1.categoryFirstList || []).forEach(l2 => (l2.categorySecondList || []).forEach(l3 => flat.push({ external_category_id: l3.categoryId, external_category: `${l1.categoryFirstName} / ${l3.categoryName}` })))); return { ok: true, categories: flat }; }
    catch (e) { return { ok: false, categories: [], message: e.message }; }
  }
}
