// @ts-nocheck
// Supplier abstraction layer. Every supplier (CJ, AliExpress, Alibaba, 1688,
// DSers, HyperSKU, Spocket…) implements this same SupplierAdapter interface, so
// the rest of the platform never changes when a new supplier is added — you only
// write a new adapter and register it. Secrets are read ONLY from server env.

export class SupplierAdapter {
  constructor(id, envKeys = []) { this.id = id; this.envKeys = envKeys; }
  // True only when the required server env credentials are all present.
  isConfigured() { return this.envKeys.length === 0 || this.envKeys.every(k => !!process.env[k]); }
  missingEnv() { return this.envKeys.filter(k => !process.env[k]); }

  // ---- Interface every supplier must implement (defaults = "not configured") ----
  async testConnection() { return { ok: false, message: `Not configured. Set ${this.missingEnv().join(", ") || "credentials"}.`, configured: this.isConfigured() }; }
  async searchProducts(_params) { return { ok: false, products: [], total: 0, message: "Supplier not connected — set API credentials to search." }; }
  async getProduct(_externalId) { return { ok: false, message: "Supplier not connected." }; }
  async createOrder(_order) { return { ok: false, message: "Supplier not connected." }; }
  async getTracking(_ref) { return { ok: false, message: "Supplier not connected." }; }
  async getInventory(_externalId) { return { ok: false, message: "Supplier not connected." }; }
  async getCategories() { return { ok: false, categories: [] }; }
}

// ---- Pricing engine (shared by all suppliers) ----
export function applyPricingRule(cost, rule) {
  cost = Number(cost) || 0;
  if (!rule) return +(cost * 1.35).toFixed(2);
  let price = cost;
  switch (rule.rule_type) {
    case "markup_percent": price = cost * (1 + (Number(rule.value) || 0) / 100); break;
    case "markup_fixed": price = cost + (Number(rule.value) || 0); break;
    case "multiplier": price = cost * (Number(rule.value) || 1); break;
    case "fixed_price": price = Number(rule.value) || cost; break;
    default: price = cost * 1.35;
  }
  // enforce minimum profit
  if (rule.min_profit && price - cost < Number(rule.min_profit)) price = cost + Number(rule.min_profit);
  // rounding
  const r = rule.rounding;
  if (r === "0.99") price = Math.max(0, Math.ceil(price) - 0.01);
  else if (r === "9.99") { const base = Math.ceil(price / 10) * 10; price = base - 0.01; }
  else if (r === "whole") price = Math.round(price);
  return +price.toFixed(2);
}
// Suggested compare-at (strike) price for a sale look.
export function suggestComparePrice(price) { return +(price * 1.3).toFixed(2); }
