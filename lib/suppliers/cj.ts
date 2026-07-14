// @ts-nocheck
// CJ Dropshipping adapter — the first concrete SupplierAdapter. Talks to the real
// CJ Dropshipping API v2 when credentials are present (CJ_EMAIL + CJ_API_KEY, or a
// pre-issued CJ_ACCESS_TOKEN). Access tokens are cached in-process. With no
// credentials every method returns an honest "not connected" result.
import { SupplierAdapter } from "./adapter";
import { ensureCreds, getCreds } from "./secrets";

const BASE = "https://developers.cjdropshipping.com/api2.0/v1";

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

  async searchProducts({ keyword, page = 1, pageSize = 20, category, warehouse } = {}) {
    await this.hydrate();
    if (!this.isConfigured()) return { ok: false, products: [], total: 0, configured: false, message: "CJ not connected — add credentials to search live products." };
    try {
      const d = await cj("/product/list", { query: { pageNum: page, pageSize, productNameEn: keyword || undefined, categoryId: category || undefined, countryCode: warehouse || undefined } });
      const list = d?.data?.list || [];
      return { ok: true, total: d?.data?.total || list.length, products: list.map(p => ({
        external_id: p.pid, name: p.productNameEn, image: p.productImage, supplier_price: Number(p.sellPrice) || 0,
        category_external: p.categoryName, warehouse: p.entryCode, processing_time: p.deliveryTime, raw: p,
      })) };
    } catch (e) { return { ok: false, products: [], total: 0, message: e.message }; }
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

  async createOrder(order) {
    await this.hydrate();
    if (!this.isConfigured()) return { ok: false, message: "CJ not connected." };
    try {
      const d = await cj("/shopping/order/createOrder", { method: "POST", body: {
        orderNumber: order.orderNumber, shippingCountryCode: order.countryCode, shippingProvince: order.province,
        shippingCity: order.city, shippingAddress: order.address, shippingCustomerName: order.name,
        shippingZip: order.zip, shippingPhone: order.phone, remark: "Atlanta Sneakers",
        products: (order.items || []).map(i => ({ vid: i.external_variant_id, quantity: i.quantity })),
      } });
      return { ok: true, external_order_id: d?.data?.orderId || d?.data?.orderNum, status: "created", raw: d?.data };
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
