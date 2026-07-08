// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  CreditCard, Smartphone, Banknote, Landmark, Loader2, RefreshCw,
  CheckCircle2, XCircle, Copy, ShieldCheck, AlertTriangle, Save, Plus,
  Download, Upload, Globe, DollarSign, ShoppingCart, Shield, Receipt,
  Bell, Zap, Wallet, Trash2, PlugZap, ChevronDown, ChevronUp, Coins,
} from "lucide-react";

type Props = { dark: boolean };

const GATEWAY_ICONS = {
  stripe: CreditCard, moncash: Smartphone, natcash: Smartphone, cod: Banknote,
  bank_transfer: Landmark, paypal: Wallet, apple_pay: Smartphone, google_pay: Smartphone,
  wise: Globe, zelle: Landmark, cashapp: DollarSign, klarna: CreditCard,
  affirm: CreditCard, afterpay: CreditCard, cj_wallet: Wallet, manual: Banknote, crypto: Coins,
};
const GATEWAY_COLORS = {
  stripe: "#635bff", moncash: "#d61f26", natcash: "#0057a3", cod: "#16a34a",
  bank_transfer: "#0d9488", paypal: "#003087", apple_pay: "#16181d", google_pay: "#4285f4",
  wise: "#9fe870", zelle: "#6d1ed4", cashapp: "#00d632", klarna: "#ffb3c7",
  affirm: "#4a4af4", afterpay: "#b2fce4", cj_wallet: "#ff6a00", manual: "#6b7280", crypto: "#f7931a",
};

const TABS = [
  { id: "gateways", label: "Gateways", icon: CreditCard },
  { id: "currencies", label: "Currencies", icon: Coins },
  { id: "checkout", label: "Checkout", icon: ShoppingCart },
  { id: "fraud", label: "Fraud Protection", icon: Shield },
  { id: "tax", label: "Tax", icon: Receipt },
  { id: "notifications", label: "Notifications", icon: Bell },
];

const CHECKOUT_OPTIONS = [
  { key: "one_click", label: "One Click Payment", desc: "Returning customers pay with a single tap using their default method" },
  { key: "guest_checkout", label: "Guest Checkout", desc: "Allow purchases without creating an account" },
  { key: "saved_cards", label: "Saved Cards", desc: "Let customers store cards securely with the gateway (tokenized, PCI compliant)" },
  { key: "express_checkout", label: "Express Checkout", desc: "Show Apple Pay / Google Pay buttons at the top of checkout" },
  { key: "split_payment", label: "Split Payment", desc: "Pay one order with multiple payment methods" },
  { key: "wallet", label: "Store Wallet", desc: "Customers can pay from store credit balance" },
  { key: "partial_payment", label: "Partial Payment", desc: "Accept deposits and pay-the-rest-later" },
];

const NOTIFICATION_OPTIONS = [
  { key: "payment_success", label: "Payment Success", desc: "Notify admin + customer when a payment completes" },
  { key: "payment_failed", label: "Payment Failed", desc: "Alert when a payment attempt fails" },
  { key: "refund", label: "Refund", desc: "Notify when a refund is processed" },
  { key: "chargeback", label: "Chargeback", desc: "Alert on gateway dispute/chargeback events" },
  { key: "webhook_failure", label: "Webhook Failure", desc: "Alert when a webhook signature check or delivery fails" },
];

export function AdminPaymentSettings({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[38px] rounded-[10px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");
  const labelCls = cn("text-[10px] font-bold uppercase tracking-wider block mb-1", sub);
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnGhost = cn("h-10 px-3.5 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2", brd, txt, hover);

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("gateways");
  const [settings, setSettings] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [config, setConfig] = useState({ checkout: {}, fraud: {}, notifications: {} });
  const [taxRules, setTaxRules] = useState([]);
  const [envStatus, setEnvStatus] = useState({});
  const [webhookUrls, setWebhookUrls] = useState({});
  const [saving, setSaving] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [showAddGateway, setShowAddGateway] = useState(false);
  const [newGw, setNewGw] = useState({ gateway: "", display_name: "", description: "" });
  const [testResult, setTestResult] = useState(null);
  const [newTax, setNewTax] = useState({ country: "", region: "", tax_type: "sales_tax", rate: "", applies_to_shipping: false });
  const importRef = useRef(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payment-settings");
      if (res.ok) {
        const d = await res.json();
        setSettings(d.settings || []);
        setCurrencies(d.currencies || []);
        setConfig({ checkout: {}, fraud: {}, notifications: {}, ...(d.config || {}) });
        setTaxRules(d.taxRules || []);
        setEnvStatus(d.envStatus || {});
        setWebhookUrls(d.webhookUrls || {});
        const dr = {};
        (d.settings || []).forEach(s => {
          dr[s.gateway] = {
            merchant_id: s.merchant_id || "", timeout_seconds: s.timeout_seconds || 30,
            retry_attempts: s.retry_attempts ?? 3, priority: s.priority || 0,
            fee_percent: s.fee_percent || 0, fee_fixed: s.fee_fixed || 0,
            countries: (s.countries || []).join(", "), currencies: (s.currencies || []).join(", "),
            notes: s.notes || "",
          };
        });
        setDrafts(dr);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateGateway = async (gateway, patch) => {
    setSaving(gateway);
    try {
      const res = await fetch("/api/admin/payment-settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "gateway", gateway, ...patch }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Update failed");
      setSettings(s => s.map(x => x.gateway === gateway ? { ...x, ...patch } : x));
      showToast("Gateway saved");
    } catch (e) { showToast(e.message, "error"); } finally { setSaving(null); }
  };

  const saveGatewayDraft = (gateway) => {
    const d = drafts[gateway] || {};
    updateGateway(gateway, {
      merchant_id: d.merchant_id || null,
      timeout_seconds: parseInt(d.timeout_seconds) || 30,
      retry_attempts: parseInt(d.retry_attempts) || 0,
      priority: parseInt(d.priority) || 0,
      fee_percent: parseFloat(d.fee_percent) || 0,
      fee_fixed: parseFloat(d.fee_fixed) || 0,
      countries: String(d.countries || "").split(",").map(c => c.trim()).filter(Boolean),
      currencies: String(d.currencies || "").split(",").map(c => c.trim().toUpperCase()).filter(Boolean),
      notes: d.notes || null,
    });
  };

  const updateCurrency = async (code, patch) => {
    setSaving(code);
    try {
      const res = await fetch("/api/admin/payment-settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "currency", code, ...patch }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Update failed");
      await load();
      showToast("Currency saved");
    } catch (e) { showToast(e.message, "error"); } finally { setSaving(null); }
  };

  const updateConfig = async (key, value) => {
    setConfig(c => ({ ...c, [key]: value }));
    try {
      const res = await fetch("/api/admin/payment-settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "config", key, value }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      showToast("Configuration saved");
    } catch (e) { showToast(e.message, "error"); load(); }
  };

  const testConnection = async (gateway) => {
    setTestResult({ gateway, loading: true });
    try {
      const res = await fetch("/api/admin/payment-settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_connection", gateway }),
      });
      const d = await res.json();
      setTestResult({ gateway, ok: d.ok, message: d.message });
    } catch { setTestResult({ gateway, ok: false, message: "Test request failed" }); }
  };

  const addGateway = async () => {
    if (!newGw.gateway.trim() || !newGw.display_name.trim()) {
      showToast("Code and name are required", "error");
      return;
    }
    try {
      const res = await fetch("/api/admin/payment-settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_gateway", ...newGw }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setShowAddGateway(false);
      setNewGw({ gateway: "", display_name: "", description: "" });
      load();
      showToast("Gateway added");
    } catch (e) { showToast(e.message, "error"); }
  };

  const deleteGateway = async (gateway) => {
    try {
      const res = await fetch("/api/admin/payment-settings", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "gateway", gateway }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      load();
      showToast("Gateway removed");
    } catch (e) { showToast(e.message, "error"); }
  };

  const exportBackup = async () => {
    try {
      const res = await fetch("/api/admin/payment-settings?section=export");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `payment-settings-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Backup downloaded");
    } catch { showToast("Export failed", "error"); }
  };

  const importBackup = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/admin/payment-settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", data }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      load();
      showToast(`Restored ${d.imported} record(s)`);
    } catch (e) { showToast(e.message || "Invalid backup file", "error"); }
    if (importRef.current) importRef.current.value = "";
  };

  const addTaxRule = async () => {
    if (!newTax.country.trim() || newTax.rate === "") {
      showToast("Country and rate are required", "error");
      return;
    }
    try {
      const res = await fetch("/api/admin/payment-settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_tax_rule", ...newTax, rate: parseFloat(newTax.rate) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setNewTax({ country: "", region: "", tax_type: "sales_tax", rate: "", applies_to_shipping: false });
      load();
      showToast("Tax rule added");
    } catch (e) { showToast(e.message, "error"); }
  };

  const Toggle = ({ on, onChange, disabled }) => (
    <button onClick={onChange} disabled={disabled}
      className={cn("w-12 h-[26px] rounded-full transition-colors relative shrink-0 disabled:opacity-50", on ? "bg-emerald-500" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}>
      <span className={cn("absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-[26px]" : "translate-x-[3px]")} />
    </button>
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-28 animate-pulse", p, brd)} />)}
      </div>
    );
  }

  const enabledCount = settings.filter(s => s.enabled).length;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em]", txt)}>Payment Settings</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Manage all payment gateways, currencies, taxes and checkout payment configuration. {enabledCount} of {settings.length} gateways enabled.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowAddGateway(true)} className="h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Gateway
          </button>
          <button onClick={exportBackup} className={btnGhost}><Download className="w-4 h-4" /> Backup</button>
          <button onClick={() => importRef.current?.click()} className={btnGhost}><Upload className="w-4 h-4" /> Restore</button>
          <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={e => e.target.files?.[0] && importBackup(e.target.files[0])} />
          <button onClick={load} className={btnGhost}><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>
      </div>

      {/* TABS */}
      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors",
              tab === t.id ? "bg-[#2563eb] text-white" : cn(sub, hover))}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* GATEWAYS */}
      {tab === "gateways" && (
        <div className="space-y-3">
          {settings.map(s => {
            const Icon = GATEWAY_ICONS[s.gateway] || CreditCard;
            const color = GATEWAY_COLORS[s.gateway] || "#2563eb";
            const env = envStatus[s.gateway];
            const webhook = webhookUrls[s.gateway];
            const draft = drafts[s.gateway] || {};
            const envOk = !env || Object.entries(env).every(([k, v]) => k === "mode" || v === true);
            const isOpen = expanded === s.gateway;
            const tr = testResult?.gateway === s.gateway ? testResult : null;

            return (
              <div key={s.gateway} className={cn(cardCls, "overflow-hidden")}>
                <div className={cn("p-4 flex items-center gap-3 flex-wrap cursor-pointer", hover)} onClick={() => setExpanded(isOpen ? null : s.gateway)}>
                  <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1a` }}>
                    {s.logo_url ? <img src={s.logo_url} alt="" className="w-7 h-7 object-contain" /> : <Icon className="w-5 h-5" style={{ color }} />}
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm font-bold", txt)}>{s.display_name}</p>
                      {s.is_custom && <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", dark ? "bg-[#252c36] text-[#8b95a3]" : "bg-[#f0f2f5] text-[#8a929c]")}>CUSTOM</span>}
                      {(s.priority || 0) > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600">P{s.priority}</span>}
                    </div>
                    <p className={cn("text-xs", sub)}>{s.description}</p>
                  </div>
                  {env && (
                    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1", envOk ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                      {envOk ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {envOk ? "Credentials OK" : "Missing credentials"}
                    </span>
                  )}
                  {env?.mode && (
                    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold", env.mode === "production" ? "bg-blue-500/10 text-blue-600" : "bg-gray-500/10 text-gray-500")}>
                      {env.mode.toUpperCase()}
                    </span>
                  )}
                  {(Number(s.fee_percent) > 0 || Number(s.fee_fixed) > 0) && (
                    <span className={cn("text-[10px] font-semibold", sub)}>{Number(s.fee_percent)}% + ${Number(s.fee_fixed).toFixed(2)}</span>
                  )}
                  <div onClick={e => e.stopPropagation()}>
                    <Toggle on={s.enabled} disabled={saving === s.gateway} onChange={() => updateGateway(s.gateway, { enabled: !s.enabled })} />
                  </div>
                  {isOpen ? <ChevronUp className={cn("w-4 h-4", sub)} /> : <ChevronDown className={cn("w-4 h-4", sub)} />}
                </div>

                {isOpen && (
                  <div className={cn("px-4 pb-4 border-t pt-4 space-y-4", brd)}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        {env && (
                          <div>
                            <p className={labelCls}>Environment Credentials (server-only)</p>
                            <div className="space-y-1">
                              {Object.entries(env).filter(([k]) => k !== "mode").map(([k, v]) => (
                                <div key={k} className="flex items-center gap-2">
                                  {v ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                                  <span className={cn("text-xs font-mono", txt)}>{s.gateway.toUpperCase()}_{k.toUpperCase()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {webhook && (
                          <div>
                            <p className={labelCls}>Webhook URL</p>
                            <button onClick={() => navigator.clipboard?.writeText(webhook).then(() => showToast("Copied"))} className={cn("flex items-center gap-2 text-left rounded-[9px] border px-2.5 py-1.5 w-full", brd, hover)}>
                              <span className={cn("text-[11px] font-mono truncate flex-1", txt)}>{webhook}</span>
                              <Copy className={cn("w-3.5 h-3.5 shrink-0", sub)} />
                            </button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => testConnection(s.gateway)} className={cn("h-9 px-3 rounded-[10px] border text-xs font-bold flex items-center gap-1.5", brd, txt, hover)}>
                            {tr?.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />} Test Connection
                          </button>
                          {s.sandbox_mode !== undefined && (
                            <button onClick={() => updateGateway(s.gateway, { sandbox_mode: !s.sandbox_mode })} className={cn("h-9 px-3 rounded-[10px] border text-xs font-bold", brd, s.sandbox_mode ? "text-amber-500" : "text-emerald-500", hover)}>
                              {s.sandbox_mode ? "Sandbox Mode" : "Production Mode"}
                            </button>
                          )}
                          {s.is_custom && (
                            <button onClick={() => deleteGateway(s.gateway)} className="h-9 px-3 rounded-[10px] bg-red-500/10 text-red-500 text-xs font-bold flex items-center gap-1.5 hover:bg-red-500/20">
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          )}
                        </div>
                        {tr && !tr.loading && (
                          <div className={cn("rounded-[10px] p-2.5 text-xs font-semibold", tr.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
                            {tr.message}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 content-start">
                        <div>
                          <label className={labelCls}>Merchant ID</label>
                          <input value={draft.merchant_id || ""} onChange={e => setDrafts(d => ({ ...d, [s.gateway]: { ...d[s.gateway], merchant_id: e.target.value } }))} className={inpCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Priority</label>
                          <input type="number" min={0} max={100} value={draft.priority ?? 0} onChange={e => setDrafts(d => ({ ...d, [s.gateway]: { ...d[s.gateway], priority: e.target.value } }))} className={inpCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Timeout (s)</label>
                          <input type="number" min={5} max={120} value={draft.timeout_seconds ?? 30} onChange={e => setDrafts(d => ({ ...d, [s.gateway]: { ...d[s.gateway], timeout_seconds: e.target.value } }))} className={inpCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Retry Attempts</label>
                          <input type="number" min={0} max={10} value={draft.retry_attempts ?? 3} onChange={e => setDrafts(d => ({ ...d, [s.gateway]: { ...d[s.gateway], retry_attempts: e.target.value } }))} className={inpCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Fee %</label>
                          <input type="number" min={0} step={0.1} value={draft.fee_percent ?? 0} onChange={e => setDrafts(d => ({ ...d, [s.gateway]: { ...d[s.gateway], fee_percent: e.target.value } }))} className={inpCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Fee Fixed ($)</label>
                          <input type="number" min={0} step={0.01} value={draft.fee_fixed ?? 0} onChange={e => setDrafts(d => ({ ...d, [s.gateway]: { ...d[s.gateway], fee_fixed: e.target.value } }))} className={inpCls} />
                        </div>
                        <div className="col-span-2">
                          <label className={labelCls}>Country Availability (comma-separated, empty = all)</label>
                          <input value={draft.countries || ""} onChange={e => setDrafts(d => ({ ...d, [s.gateway]: { ...d[s.gateway], countries: e.target.value } }))} placeholder="HT, US, CA" className={inpCls} />
                        </div>
                        <div className="col-span-2">
                          <label className={labelCls}>Currency Support (comma-separated)</label>
                          <input value={draft.currencies || ""} onChange={e => setDrafts(d => ({ ...d, [s.gateway]: { ...d[s.gateway], currencies: e.target.value } }))} placeholder="USD, HTG" className={inpCls} />
                        </div>
                        <div className="col-span-2">
                          <button onClick={() => saveGatewayDraft(s.gateway)} disabled={saving === s.gateway}
                            className="h-9 px-4 rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-1.5">
                            {saving === s.gateway ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Configuration
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className={cn(cardCls, "p-4 flex items-start gap-3")}>
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <p className={cn("text-xs leading-relaxed", sub)}>
              <b className={txt}>PCI & security model:</b> API keys, secret keys and webhook secrets are read exclusively from server environment variables and are never sent to the browser or stored in the database. All payments are verified server-side via signed webhooks with replay protection and idempotency. Card data is tokenized by the gateway (Stripe) — it never touches this server. Customer wallet PINs are never collected.
            </p>
          </div>
        </div>
      )}

      {/* CURRENCIES */}
      {tab === "currencies" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn("border-b", brd)}>
                  {["Currency", "Symbol", "Base", "Rate (per 1 base)", "Rate Source", "Enabled"].map(h => (
                    <th key={h} className={cn("p-3 text-left text-[11px] font-bold uppercase tracking-wider", sub)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currencies.map(c => (
                  <tr key={c.code} className={cn("border-b", brd)}>
                    <td className="p-3">
                      <p className={cn("text-sm font-bold", txt)}>{c.code}</p>
                      <p className={cn("text-[11px]", sub)}>{c.name}</p>
                    </td>
                    <td className={cn("p-3 text-sm font-bold", txt)}>{c.symbol}</td>
                    <td className="p-3">
                      {c.is_base
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600">BASE</span>
                        : <button onClick={() => updateCurrency(c.code, { is_base: true })} className={cn("text-[10px] font-bold underline", sub)}>Set base</button>}
                    </td>
                    <td className="p-3">
                      {c.is_base ? <span className={cn("text-xs", sub)}>1.00</span> : (
                        <input
                          type="number" step="0.0001" defaultValue={c.rate} key={`${c.code}-${c.rate}`}
                          onBlur={e => { const v = parseFloat(e.target.value); if (v > 0 && v !== Number(c.rate)) updateCurrency(c.code, { rate: v }); }}
                          className={cn("w-28 h-8 rounded-[8px] border px-2 text-xs", inp)}
                        />
                      )}
                    </td>
                    <td className="p-3">
                      <select value={c.rate_source} onChange={e => updateCurrency(c.code, { rate_source: e.target.value })} disabled={c.is_base}
                        className={cn("h-8 rounded-[8px] border px-2 text-xs", inp)}>
                        <option value="manual">Manual</option>
                        <option value="api">API (auto)</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <Toggle on={c.enabled} disabled={saving === c.code || c.is_base} onChange={() => updateCurrency(c.code, { enabled: !c.enabled })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={cn("p-3 text-[11px] border-t", brd, sub)}>Rates are expressed as units per 1 base currency. Set source to API to refresh rates automatically when an exchange-rate provider is configured; otherwise edit rates manually.</p>
        </div>
      )}

      {/* CHECKOUT */}
      {tab === "checkout" && (
        <div className={cn(cardCls, "divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
          {CHECKOUT_OPTIONS.map(o => (
            <div key={o.key} className="p-4 flex items-center gap-3">
              <div className="flex-1">
                <p className={cn("text-sm font-bold", txt)}>{o.label}</p>
                <p className={cn("text-xs mt-0.5", sub)}>{o.desc}</p>
              </div>
              <Toggle on={!!config.checkout?.[o.key]} onChange={() => updateConfig("checkout", { ...config.checkout, [o.key]: !config.checkout?.[o.key] })} />
            </div>
          ))}
        </div>
      )}

      {/* FRAUD */}
      {tab === "fraud" && (
        <div className="space-y-4">
          <div className={cn(cardCls, "divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
            {[
              { key: "three_d_secure", label: "3D Secure", desc: "Require 3DS authentication on card payments when supported" },
              { key: "avs", label: "Address Verification (AVS)", desc: "Verify billing address matches the card issuer's records" },
              { key: "cvv", label: "CVV Check", desc: "Require card security code verification" },
              { key: "velocity_check", label: "Velocity Check", desc: "Block rapid repeated payment attempts from the same customer/IP" },
              { key: "ip_verification", label: "IP Verification", desc: "Flag payments where IP country differs from billing country" },
            ].map(o => (
              <div key={o.key} className="p-4 flex items-center gap-3">
                <div className="flex-1">
                  <p className={cn("text-sm font-bold", txt)}>{o.label}</p>
                  <p className={cn("text-xs mt-0.5", sub)}>{o.desc}</p>
                </div>
                <Toggle on={!!config.fraud?.[o.key]} onChange={() => updateConfig("fraud", { ...config.fraud, [o.key]: !config.fraud?.[o.key] })} />
              </div>
            ))}
          </div>
          <div className={cn(cardCls, "p-4 grid grid-cols-1 md:grid-cols-2 gap-4")}>
            <div>
              <label className={labelCls}>Risk Score Threshold (0-100, payments above are held for review)</label>
              <input type="number" min={0} max={100} defaultValue={config.fraud?.risk_score_threshold ?? 60} key={config.fraud?.risk_score_threshold}
                onBlur={e => updateConfig("fraud", { ...config.fraud, risk_score_threshold: parseInt(e.target.value) || 60 })} className={inpCls} />
            </div>
            <div>
              <label className={labelCls}>Max Payment Attempts Per Hour</label>
              <input type="number" min={1} max={50} defaultValue={config.fraud?.velocity_max_per_hour ?? 5} key={config.fraud?.velocity_max_per_hour}
                onBlur={e => updateConfig("fraud", { ...config.fraud, velocity_max_per_hour: parseInt(e.target.value) || 5 })} className={inpCls} />
            </div>
            <div>
              <label className={labelCls}>Blocked Countries (comma-separated ISO codes)</label>
              <input defaultValue={(config.fraud?.blocked_countries || []).join(", ")} key={(config.fraud?.blocked_countries || []).join(",")}
                onBlur={e => updateConfig("fraud", { ...config.fraud, blocked_countries: e.target.value.split(",").map(c => c.trim().toUpperCase()).filter(Boolean) })}
                placeholder="e.g. RU, KP" className={inpCls} />
            </div>
            <div>
              <label className={labelCls}>Blacklist (emails or phone numbers, comma-separated)</label>
              <input defaultValue={(config.fraud?.blacklist || []).join(", ")} key={(config.fraud?.blacklist || []).join(",")}
                onBlur={e => updateConfig("fraud", { ...config.fraud, blacklist: e.target.value.split(",").map(c => c.trim()).filter(Boolean) })}
                className={inpCls} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Whitelist (always allowed, comma-separated)</label>
              <input defaultValue={(config.fraud?.whitelist || []).join(", ")} key={(config.fraud?.whitelist || []).join(",")}
                onBlur={e => updateConfig("fraud", { ...config.fraud, whitelist: e.target.value.split(",").map(c => c.trim()).filter(Boolean) })}
                className={inpCls} />
            </div>
          </div>
        </div>
      )}

      {/* TAX */}
      {tab === "tax" && (
        <div className="space-y-4">
          <div className={cn(cardCls, "p-4")}>
            <p className={cn("text-sm font-bold mb-3", txt)}>Add Tax Rule</p>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <input value={newTax.country} onChange={e => setNewTax(t => ({ ...t, country: e.target.value }))} placeholder="Country (e.g. HT)" className={inpCls} />
              <input value={newTax.region} onChange={e => setNewTax(t => ({ ...t, region: e.target.value }))} placeholder="Region (optional)" className={inpCls} />
              <select value={newTax.tax_type} onChange={e => setNewTax(t => ({ ...t, tax_type: e.target.value }))} className={inpCls}>
                <option value="sales_tax">Sales Tax</option>
                <option value="vat">VAT</option>
                <option value="gst">GST</option>
              </select>
              <input type="number" min={0} step={0.1} value={newTax.rate} onChange={e => setNewTax(t => ({ ...t, rate: e.target.value }))} placeholder="Rate %" className={inpCls} />
              <label className={cn("flex items-center gap-2 text-xs font-semibold", txt)}>
                <input type="checkbox" checked={newTax.applies_to_shipping} onChange={e => setNewTax(t => ({ ...t, applies_to_shipping: e.target.checked }))} className="rounded" /> On shipping
              </label>
              <button onClick={addTaxRule} className="h-[38px] rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Rule
              </button>
            </div>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <table className="w-full text-sm">
              <thead>
                <tr className={cn("border-b", brd)}>
                  {["Country", "Region", "Type", "Rate", "Shipping", "Enabled", ""].map(h => (
                    <th key={h} className={cn("p-3 text-left text-[11px] font-bold uppercase tracking-wider", sub)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {taxRules.length === 0 ? (
                  <tr><td colSpan={7} className={cn("p-8 text-center text-xs", sub)}>No tax rules yet. Orders are untaxed until you add rules.</td></tr>
                ) : taxRules.map(r => (
                  <tr key={r.id} className={cn("border-b", brd)}>
                    <td className={cn("p-3 text-sm font-bold", txt)}>{r.country}</td>
                    <td className={cn("p-3 text-xs", sub)}>{r.region || "All"}</td>
                    <td className="p-3"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", dark ? "bg-[#252c36] text-[#e7ebf0]" : "bg-[#f0f2f5] text-[#16181d]")}>{r.tax_type.replace(/_/g, " ")}</span></td>
                    <td className={cn("p-3 text-sm font-bold", txt)}>{Number(r.rate)}%</td>
                    <td className={cn("p-3 text-xs", sub)}>{r.applies_to_shipping ? "Yes" : "No"}</td>
                    <td className="p-3">
                      <Toggle on={r.enabled} onChange={async () => {
                        await fetch("/api/admin/payment-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: "tax_rule", id: r.id, enabled: !r.enabled }) });
                        load();
                      }} />
                    </td>
                    <td className="p-3">
                      <button onClick={async () => {
                        await fetch("/api/admin/payment-settings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: "tax_rule", id: r.id }) });
                        load();
                        showToast("Tax rule removed");
                      }} className="w-7 h-7 rounded-[8px] flex items-center justify-center hover:bg-red-500/10">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {tab === "notifications" && (
        <div className={cn(cardCls, "divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
          {NOTIFICATION_OPTIONS.map(o => (
            <div key={o.key} className="p-4 flex items-center gap-3">
              <div className="flex-1">
                <p className={cn("text-sm font-bold", txt)}>{o.label}</p>
                <p className={cn("text-xs mt-0.5", sub)}>{o.desc}</p>
              </div>
              <Toggle on={!!config.notifications?.[o.key]} onChange={() => updateConfig("notifications", { ...config.notifications, [o.key]: !config.notifications?.[o.key] })} />
            </div>
          ))}
        </div>
      )}

      {/* ADD GATEWAY DRAWER */}
      <Drawer open={showAddGateway} onClose={() => setShowAddGateway(false)} title="Add Payment Gateway" dark={dark} width="md">
        <div className="p-4 space-y-3">
          <div>
            <label className={labelCls}>Gateway Code</label>
            <input value={newGw.gateway} onChange={e => setNewGw(g => ({ ...g, gateway: e.target.value }))} placeholder="e.g. western_union" className={inpCls} />
          </div>
          <div>
            <label className={labelCls}>Display Name</label>
            <input value={newGw.display_name} onChange={e => setNewGw(g => ({ ...g, display_name: e.target.value }))} placeholder="Western Union" className={inpCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input value={newGw.description} onChange={e => setNewGw(g => ({ ...g, description: e.target.value }))} placeholder="Shown to customers at checkout" className={inpCls} />
          </div>
          <p className={cn("text-[11px]", sub)}>Custom gateways start disabled. Configure priority, fees, countries and currencies after creation, then enable when ready.</p>
          <button onClick={addGateway} className="w-full h-10 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Create Gateway
          </button>
        </div>
      </Drawer>

      {toast && (
        <div className={cn("fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
