// @ts-nocheck
// Supplier registry — the single place that maps a supplier id to its adapter.
// Adding Alibaba/AliExpress/1688/etc. later = implement a new SupplierAdapter
// subclass (like CJAdapter) and register it here. Nothing else in the platform
// needs to change. Until a concrete adapter exists, a supplier transparently uses
// the base adapter which reports "not connected" — so the whole UI already works.
import { SupplierAdapter } from "./adapter";
import { CJAdapter } from "./cj";

const ADAPTERS = {
  cj: () => new CJAdapter(),
  // Future suppliers plug in here, e.g.:
  // aliexpress: () => new AliExpressAdapter(),
  // alibaba: () => new AlibabaAdapter(),
};

// Env keys per supplier (used for "configured" status when no concrete adapter yet).
const ENV = {
  aliexpress: ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET"],
  alibaba: ["ALIBABA_APP_KEY", "ALIBABA_APP_SECRET"],
  "1688": ["X1688_APP_KEY"],
  dsers: ["DSERS_API_KEY"],
  hypersku: ["HYPERSKU_API_KEY"],
  spocket: ["SPOCKET_API_KEY"],
};

export function getAdapter(supplierId) {
  const factory = ADAPTERS[supplierId];
  if (factory) return factory();
  return new SupplierAdapter(supplierId, ENV[supplierId] || []);
}
export function hasConcreteAdapter(supplierId) { return !!ADAPTERS[supplierId]; }
