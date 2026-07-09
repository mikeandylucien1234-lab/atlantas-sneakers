// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  CreditCard, Smartphone, Banknote, Landmark, Loader2, RefreshCw,
  CheckCircle2, XCircle, Copy, ShieldCheck, AlertTriangle, Save, Plus,
  Download, Upload, Globe, DollarSign, ShoppingCart, Shield, Receipt,
  Bell, Zap, Wallet, Trash2, PlugZap, Coins, Settings2, Terminal,
  BarChart3, User, Truck, FileText, Package, Clock, TrendingUp,
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
  affirm: "#4a4af4", afterpay: "#2ec4b6", cj_wallet: "#ff6a00", manual: "#6b7280", crypto: "#f7931a",
};

const TABS = [
  { id: "gateways", label: "Gateways", icon: CreditCard },
  { id: "currencies", label: "Currencies", icon: Coins },
  { id: "checkout", label: "Checkout", icon: ShoppingCart },
  { id: "fraud", label: "Fraud Protection", icon: Shield },
  { id: "tax", label: "Tax", icon: Receipt },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

const CHECKOUT_SECTIONS = [
  {
    key: "checkout_customer", title: "Customer", icon: User,
    toggles: [
      ["guest_checkout", "Guest Checkout", "Allow purchases without an account"],
      ["one_click", "One Click Checkout", "Returning customers pay in one tap"],
      ["remember_customer", "Remember Customer", "Prefill details on next visit"],
      ["save_address", "Save Address", "Store shipping addresses on the profile"],
      ["newsletter", "Newsletter Opt-in", "Show newsletter checkbox at checkout"],
      ["phone_required", "Phone Required", "Require a phone number"],
      ["email_required", "Email Required", "Require an email address"],
      ["login_required", "Login Required", "Force login before checkout"],
      ["auto_login", "Auto Login", "Log customers in automatically after guest purchase"],
    ],
  },
  {
    key: "checkout_payment", title: "Payment", icon: CreditCard,
    toggles: [
      ["split_payment", "Split Payment", "Pay one order with multiple methods"],
      ["partial_payment", "Partial Payment", "Accept deposits, pay the rest later"],
      ["wallet", "Store Wallet", "Pay from store credit balance"],
      ["gift_card", "Gift Card", "Accept gift cards at checkout"],
      ["coupon", "Coupon", "Show coupon code field"],
      ["reward_points", "Reward Points", "Redeem loyalty points"],
      ["cash_on_delivery", "Cash On Delivery", "Offer COD at checkout"],
      ["store_credit", "Store Credit", "Apply account credit"],
      ["installments", "Installments", "Monthly installment plans"],
      ["bnpl", "Buy Now Pay Later", "Klarna/Affirm/AfterPay style deferred payment"],
    ],
  },
  {
    key: "checkout_shipping", title: "Shipping", icon: Truck,
    toggles: [
      ["shipping_calculator", "Shipping Calculator", "Live rates in cart and checkout"],
      ["shipping_protection", "Shipping Protection", "Optional package protection upsell"],
      ["insurance", "Insurance", "Offer shipment insurance"],
      ["delivery_date", "Delivery Date", "Let customers pick a delivery date"],
      ["pickup", "Pickup", "Local pickup option"],
      ["store_pickup", "Store Pickup", "Pick up at a store location"],
      ["express_shipping", "Express Shipping", "Show express option"],
      ["signature_required", "Signature Required", "Require signature on delivery"],
    ],
  },
];

const FRAUD_TOGGLES = [
  ["three_d_secure", "3D Secure", "Require 3DS authentication on card payments"],
  ["avs", "Address Verification (AVS)", "Verify billing address with the issuer"],
  ["cvv", "CVV Check", "Require card security code"],
  ["velocity_check", "Velocity Check", "Block rapid repeated attempts"],
  ["ip_verification", "IP Verification", "Flag IP-country vs billing-country mismatch"],
  ["proxy_detection", "Proxy Detection", "Flag payments routed through known proxies"],
  ["vpn_detection", "VPN Detection", "Flag payments from VPN exit nodes"],
  ["bin_verification", "BIN Verification", "Validate card BIN against issuer database"],
  ["ml_score", "Machine Learning Score", "Include behavioural risk signals in scoring"],
  ["auto_block", "Auto Block", "Automatically block payments above the block threshold"],
  ["auto_review", "Auto Review", "Hold medium-risk payments for manual review"],
  ["auto_approve", "Auto Approve", "Skip review for low-risk trusted customers"],
];

const NOTIFICATION_EVENTS = [
  ["payment_success", "Payment Success"],
  ["payment_failed", "Payment Failed"],
  ["refund", "Refund"],
  ["chargeback", "Chargeback"],
  ["webhook_failure", "Webhook Failure"],
];
const NOTIFICATION_CHANNELS = [
  ["email", "Email"], ["sms", "SMS"], ["push", "Push"],
  ["slack", "Slack"], ["discord", "Discord"], ["telegram", "Telegram"],
];
const NOTIFICATION_RECIPIENTS = [["admin", "Admin"], ["customer", "Customer"], ["vendor", "Vendor"]];

function money(n) { return `$${(Number(n) || 0).toFixed(2)}`; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }
function ago(d) {
  if (!d) return "never";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

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
  const [config, setConfig] = useState({});
  const [taxRules, setTaxRules] = useState([]);
  const [envStatus, setEnvStatus] = useState({});
  const [gatewayStats, setGatewayStats] = useState({});
  const [webhookUrls, setWebhookUrls] = useState({});
  const [saving, setSaving] = useState(null);
  const [configuring, setConfiguring] = useState(null); // gateway being configured
  const [draft, setDraft] = useState({});
  const [showAddGateway, setShowAddGateway] = useState(false);
  const [newGw, setNewGw] = useState({ gateway: "", display_name: "", description: "" });
  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [newCur, setNewCur] = useState({ code: "", name: "", symbol: "", rate: "1" });
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [newTax, setNewTax] = useState({ country: "", state: "", zip: "", region: "", tax_type: "sales_tax", tax_class: "standard", rate: "", priority: "0", applies_to_shipping: false, compound: false, inclusive: false });
  const [analytics, setAnalytics] = useState(null);
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
        setConfig(d.config || {});
        setTaxRules(d.taxRules || []);
        setEnvStatus(d.envStatus || {});
        setGatewayStats(d.gatewayStats || {});
        setWebhookUrls(d.webhookUrls || {});
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== "analytics" || analytics) return;
    fetch("/api/admin/payments?section=kpis").then(r => r.ok ? r.json() : null).then(d => d && setAnalytics(d)).catch(() => {});
  }, [tab, analytics]);

  const api = async (method, body) => {
    const res = await fetch("/api/admin/payment-settings", {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Request failed");
    return d;
  };

  const updateGateway = async (gateway, patch) => {
    setSaving(gateway);
    try {
      await api("PUT", { target: "gateway", gateway, ...patch });
      setSettings(s => s.map(x => x.gateway === gateway ? { ...x, ...patch } : x));
      showToast("Gateway saved");
    } catch (e) { showToast(e.message, "error"); } finally { setSaving(null); }
  };

  const openConfigure = (s) => {
    setConfiguring(s.gateway);
    setTestResult(null);
    setDraft({
      merchant_id: s.merchant_id || "", api_version: s.api_version || "",
      timeout_seconds: s.timeout_seconds ?? 30, retry_attempts: s.retry_attempts ?? 3,
      webhook_retry: s.webhook_retry ?? 3, priority: s.priority || 0,
      fee_percent: s.fee_percent || 0, fee_fixed: s.fee_fixed || 0,
      min_amount: s.min_amount || 0, max_amount: s.max_amount || 0,
      countries: (s.countries || []).join(", "), currencies: (s.currencies || []).join(", "),
      notes: s.notes || "",
    });
  };

  const saveConfigure = () => {
    updateGateway(configuring, {
      merchant_id: draft.merchant_id || null,
      api_version: draft.api_version || null,
      timeout_seconds: parseInt(draft.timeout_seconds) || 30,
      retry_attempts: parseInt(draft.retry_attempts) || 0,
      webhook_retry: parseInt(draft.webhook_retry) || 0,
      priority: parseInt(draft.priority) || 0,
      fee_percent: parseFloat(draft.fee_percent) || 0,
      fee_fixed: parseFloat(draft.fee_fixed) || 0,
      min_amount: parseFloat(draft.min_amount) || 0,
      max_amount: parseFloat(draft.max_amount) || 0,
      countries: String(draft.countries || "").split(",").map(c => c.trim()).filter(Boolean),
      currencies: String(draft.currencies || "").split(",").map(c => c.trim().toUpperCase()).filter(Boolean),
      notes: draft.notes || null,
    });
  };

  const testConnection = async (gateway) => {
    setTestResult({ gateway, loading: true });
    try {
      const d = await api("POST", { action: "test_connection", gateway });
      setTestResult({ gateway, ok: d.ok, message: d.message });
    } catch (e) { setTestResult({ gateway, ok: false, message: e.message }); }
  };

  const updateCurrency = async (code, patch) => {
    setSaving(code);
    try {
      await api("PUT", { target: "currency", code, ...patch });
      await load();
      showToast("Currency saved");
    } catch (e) { showToast(e.message, "error"); } finally { setSaving(null); }
  };

  const updateConfig = async (key, value) => {
    setConfig(c => ({ ...c, [key]: value }));
    try {
      await api("PUT", { target: "config", key, value });
      showToast("Saved");
    } catch (e) { showToast(e.message, "error"); load(); }
  };

  const syncRates = async () => {
    setSyncing(true);
    try {
      const d = await api("POST", { action: "sync_rates" });
      showToast(`${d.updated} rate(s) synced from ${d.provider}`);
      load();
    } catch (e) { showToast(e.message, "error"); } finally { setSyncing(false); }
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
      const data = JSON.parse(await file.text());
      const d = await api("POST", { action: "import", data });
      load();
      showToast(`Restored ${d.imported} record(s)`);
    } catch (e) { showToast(e.message || "Invalid backup file", "error"); }
    if (importRef.current) importRef.current.value = "";
  };

  const exportTaxCsv = () => {
    const header = ["country", "state", "zip", "region", "tax_type", "tax_class", "rate", "priority", "compound", "inclusive", "applies_to_shipping", "enabled"];
    const csv = [header.join(","), ...taxRules.map(r => header.map(h => r[h] ?? "").join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "tax-rules.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Tax rules exported");
  };

  const Toggle = ({ on, onChange, disabled }) => (
    <button onClick={onChange} disabled={disabled}
      className={cn("w-12 h-[26px] rounded-full transition-colors relative shrink-0 disabled:opacity-50", on ? "bg-emerald-500" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}>
      <span className={cn("absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-[26px]" : "translate-x-[3px]")} />
    </button>
  );

  const ToggleRow = ({ configKey, optKey, label, desc }) => (
    <div className="p-4 flex items-center gap-3">
      <div className="flex-1">
        <p className={cn("text-sm font-bold", txt)}>{label}</p>
        {desc && <p className={cn("text-xs mt-0.5", sub)}>{desc}</p>}
      </div>
      <Toggle on={!!config[configKey]?.[optKey]} onChange={() => updateConfig(configKey, { ...config[configKey], [optKey]: !config[configKey]?.[optKey] })} />
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-36 animate-pulse", p, brd)} />)}
      </div>
    );
  }

  const enabledCount = settings.filter(s => s.enabled).length;
  const configuringGw = settings.find(s => s.gateway === configuring);

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em]", txt)}>Payment Settings</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Enterprise payment configuration center — {enabledCount} of {settings.length} gateways enabled.</p>
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

      {/* ============ GATEWAYS ============ */}
      {tab === "gateways" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {settings.map(s => {
              const Icon = GATEWAY_ICONS[s.gateway] || CreditCard;
              const color = GATEWAY_COLORS[s.gateway] || "#2563eb";
              const env = envStatus[s.gateway];
              const stats = gatewayStats[s.gateway];
              const envOk = !env || Object.entries(env).every(([k, v]) => k === "mode" || v === true);
              return (
                <div key={s.gateway} className={cn(cardCls, "p-4 flex flex-col gap-3")}>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1a` }}>
                      {s.logo_url ? <img src={s.logo_url} alt="" className="w-8 h-8 object-contain" /> : <Icon className="w-6 h-6" style={{ color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={cn("text-[15px] font-extrabold", txt)}>{s.display_name}</p>
                        <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold", s.enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-gray-500/10 text-gray-500")}>{s.enabled ? "ACTIVE" : "DISABLED"}</span>
                        {env?.mode && <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold", env.mode === "production" ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600")}>{env.mode.toUpperCase()}</span>}
                        {s.is_custom && <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", dark ? "bg-[#252c36] text-[#8b95a3]" : "bg-[#f0f2f5] text-[#8a929c]")}>CUSTOM</span>}
                      </div>
                      <p className={cn("text-xs mt-0.5 truncate", sub)}>{s.description}</p>
                    </div>
                    <Toggle on={s.enabled} disabled={saving === s.gateway} onChange={() => updateGateway(s.gateway, { enabled: !s.enabled })} />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className={cn("rounded-[10px] border p-2 text-center", brd)}>
                      <p className={cn("text-sm font-extrabold", txt)}>{stats?.transactions || 0}</p>
                      <p className={cn("text-[9px] font-bold uppercase", sub)}>Today Txns</p>
                    </div>
                    <div className={cn("rounded-[10px] border p-2 text-center", brd)}>
                      <p className={cn("text-sm font-extrabold", txt)}>{money(stats?.volume || 0)}</p>
                      <p className={cn("text-[9px] font-bold uppercase", sub)}>Today Volume</p>
                    </div>
                    <div className={cn("rounded-[10px] border p-2 text-center", brd)}>
                      <p className={cn("text-sm font-extrabold", txt)}>{Number(s.fee_percent) || 0}%{Number(s.fee_fixed) > 0 ? `+${money(s.fee_fixed)}` : ""}</p>
                      <p className={cn("text-[9px] font-bold uppercase", sub)}>Fees</p>
                    </div>
                    <div className={cn("rounded-[10px] border p-2 text-center", brd)}>
                      <p className={cn("text-sm font-extrabold", envOk ? "text-emerald-500" : "text-amber-500")}>{envOk ? "OK" : "!"}</p>
                      <p className={cn("text-[9px] font-bold uppercase", sub)}>Credentials</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className={sub}>API {s.api_version || "default"} · Connected {fmtDate(s.connected_at)}</span>
                    <span className={sub}>Priority {s.priority || 0}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-auto">
                    <button onClick={() => openConfigure(s)} className="h-8 px-3 rounded-[9px] bg-[#2563eb] text-white text-[11px] font-bold flex items-center gap-1 hover:bg-[#1d4ed8]"><Settings2 className="w-3 h-3" /> Configure</button>
                    <button onClick={() => testConnection(s.gateway)} className={cn("h-8 px-3 rounded-[9px] border text-[11px] font-bold flex items-center gap-1", brd, txt, hover)}>
                      {testResult?.gateway === s.gateway && testResult.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlugZap className="w-3 h-3" />} Test
                    </button>
                    <a href="#" onClick={e => { e.preventDefault(); showToast("Open Payment Logs from the sidebar and filter by this gateway"); }} className={cn("h-8 px-3 rounded-[9px] border text-[11px] font-bold flex items-center gap-1", brd, txt, hover)}><Terminal className="w-3 h-3" /> Logs</a>
                    {s.is_custom && (
                      <button onClick={async () => { try { await api("DELETE", { target: "gateway", gateway: s.gateway }); load(); showToast("Gateway removed"); } catch (e) { showToast(e.message, "error"); } }}
                        className="h-8 px-3 rounded-[9px] bg-red-500/10 text-red-500 text-[11px] font-bold flex items-center gap-1 hover:bg-red-500/20"><Trash2 className="w-3 h-3" /> Delete</button>
                    )}
                  </div>
                  {testResult?.gateway === s.gateway && !testResult.loading && (
                    <div className={cn("rounded-[10px] p-2.5 text-xs font-semibold", testResult.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>{testResult.message}</div>
                  )}
                </div>
              );
            })}
          </div>
          <div className={cn(cardCls, "p-4 flex items-start gap-3")}>
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <p className={cn("text-xs leading-relaxed", sub)}>
              <b className={txt}>Security model:</b> secret keys and webhook secrets live exclusively in server environment variables — never in the database, never in the browser. Rotating a secret means updating the env var on the server; the Configure panel shows which variables are set without ever revealing values. All payments are verified via signed webhooks with replay protection and idempotency keys.
            </p>
          </div>
        </div>
      )}

      {/* ============ CURRENCIES ============ */}
      {tab === "currencies" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowAddCurrency(true)} className="h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] flex items-center gap-2"><Plus className="w-4 h-4" /> Add Currency</button>
            <button onClick={syncRates} disabled={syncing} className={cn(btnGhost, "disabled:opacity-50")}>
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sync Rates (live API)
            </button>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn("border-b", brd)}>
                    {["Currency", "Symbol", "Position", "Decimals", "Base", "Default", "Rate", "Auto Update", "Source", "Last Sync", "Enabled", ""].map(h => (
                      <th key={h} className={cn("p-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap", sub)}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currencies.map(c => (
                    <tr key={c.code} className={cn("border-b", brd)}>
                      <td className="p-3 whitespace-nowrap">
                        <p className={cn("text-sm font-bold", txt)}>{c.code}</p>
                        <p className={cn("text-[11px]", sub)}>{c.name}</p>
                      </td>
                      <td className={cn("p-3 text-sm font-bold", txt)}>{c.symbol}</td>
                      <td className="p-3">
                        <select value={c.symbol_position || "before"} onChange={e => updateCurrency(c.code, { symbol_position: e.target.value })} className={cn("h-8 rounded-[8px] border px-2 text-xs", inp)}>
                          <option value="before">Before</option>
                          <option value="after">After</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input type="number" min={0} max={4} defaultValue={c.decimals ?? 2} key={`${c.code}-d-${c.decimals}`}
                          onBlur={e => { const v = parseInt(e.target.value); if (v >= 0 && v !== c.decimals) updateCurrency(c.code, { decimals: v }); }}
                          className={cn("w-14 h-8 rounded-[8px] border px-2 text-xs", inp)} />
                      </td>
                      <td className="p-3">
                        {c.is_base ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600">BASE</span>
                          : <button onClick={() => updateCurrency(c.code, { is_base: true })} className={cn("text-[10px] font-bold underline", sub)}>set</button>}
                      </td>
                      <td className="p-3">
                        {c.is_default ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/10 text-violet-600">DEFAULT</span>
                          : <button onClick={() => updateCurrency(c.code, { is_default: true })} className={cn("text-[10px] font-bold underline", sub)}>set</button>}
                      </td>
                      <td className="p-3">
                        {c.is_base ? <span className={cn("text-xs", sub)}>1.00</span> : (
                          <input type="number" step="0.0001" defaultValue={c.rate} key={`${c.code}-r-${c.rate}`}
                            onBlur={e => { const v = parseFloat(e.target.value); if (v > 0 && v !== Number(c.rate)) updateCurrency(c.code, { rate: v }); }}
                            className={cn("w-24 h-8 rounded-[8px] border px-2 text-xs", inp)} />
                        )}
                      </td>
                      <td className="p-3"><Toggle on={!!c.auto_update} disabled={c.is_base} onChange={() => updateCurrency(c.code, { auto_update: !c.auto_update })} /></td>
                      <td className="p-3">
                        <select value={c.api_source || "exchangerate"} onChange={e => updateCurrency(c.code, { api_source: e.target.value })} disabled={c.is_base} className={cn("h-8 rounded-[8px] border px-2 text-xs", inp)}>
                          <option value="exchangerate">ExchangeRate</option>
                          <option value="fixer">Fixer</option>
                          <option value="currencylayer">CurrencyLayer</option>
                          <option value="openexchangerates">OpenExchangeRates</option>
                        </select>
                      </td>
                      <td className={cn("p-3 text-[11px] whitespace-nowrap", sub)}>{ago(c.last_synced_at)}</td>
                      <td className="p-3"><Toggle on={c.enabled} disabled={saving === c.code || c.is_base} onChange={() => updateCurrency(c.code, { enabled: !c.enabled })} /></td>
                      <td className="p-3">
                        {!c.is_base && !c.is_default && (
                          <button onClick={async () => { try { await api("DELETE", { target: "currency", code: c.code }); load(); showToast("Currency removed"); } catch (e) { showToast(e.message, "error"); } }}
                            className="w-7 h-7 rounded-[8px] flex items-center justify-center hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={cn("p-3 text-[11px] border-t", brd, sub)}>Sync Rates pulls live rates from open.er-api.com for the base currency. Fixer, CurrencyLayer and OpenExchangeRates require their API key in server env vars (FIXER_API_KEY, CURRENCYLAYER_API_KEY, OPENEXCHANGERATES_APP_ID) to be used as source.</p>
          </div>
        </div>
      )}

      {/* ============ CHECKOUT ============ */}
      {tab === "checkout" && (
        <div className="space-y-4">
          {CHECKOUT_SECTIONS.map(section => (
            <div key={section.key} className={cn(cardCls, "overflow-hidden")}>
              <div className={cn("p-4 border-b flex items-center gap-2.5", brd)}>
                <div className="w-8 h-8 rounded-[9px] bg-[#2563eb]/10 flex items-center justify-center"><section.icon className="w-4 h-4 text-[#2563eb]" /></div>
                <p className={cn("text-sm font-extrabold", txt)}>{section.title}</p>
              </div>
              <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
                {section.toggles.map(([key, label, desc]) => (
                  <ToggleRow key={key} configKey={section.key} optKey={key} label={label} desc={desc} />
                ))}
              </div>
            </div>
          ))}

          {/* INVOICE SECTION */}
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className={cn("p-4 border-b flex items-center gap-2.5", brd)}>
              <div className="w-8 h-8 rounded-[9px] bg-[#2563eb]/10 flex items-center justify-center"><FileText className="w-4 h-4 text-[#2563eb]" /></div>
              <p className={cn("text-sm font-extrabold", txt)}>Invoice</p>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ["invoice_prefix", "Invoice Prefix", "INV-"],
                ["company_name", "Company Name", "Atlanta Sneakers"],
                ["company_address", "Company Address", ""],
                ["vat_number", "VAT Number", ""],
                ["tax_id", "Tax ID", ""],
              ].map(([key, label, ph]) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <input defaultValue={config.checkout_invoice?.[key] || ""} key={`inv-${key}-${config.checkout_invoice?.[key]}`} placeholder={ph}
                    onBlur={e => e.target.value !== (config.checkout_invoice?.[key] || "") && updateConfig("checkout_invoice", { ...config.checkout_invoice, [key]: e.target.value })} className={inpCls} />
                </div>
              ))}
              <div className="md:col-span-2">
                <label className={labelCls}>Invoice Footer</label>
                <input defaultValue={config.checkout_invoice?.invoice_footer || ""} key={`inv-footer-${config.checkout_invoice?.invoice_footer}`}
                  onBlur={e => updateConfig("checkout_invoice", { ...config.checkout_invoice, invoice_footer: e.target.value })} className={inpCls} />
              </div>
              <div className="md:col-span-2 flex gap-6">
                {[["pdf_download", "PDF Download"], ["email_invoice", "Email Invoice"]].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Toggle on={!!config.checkout_invoice?.[key]} onChange={() => updateConfig("checkout_invoice", { ...config.checkout_invoice, [key]: !config.checkout_invoice?.[key] })} />
                    <span className={cn("text-xs font-semibold", txt)}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ORDER SECTION */}
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className={cn("p-4 border-b flex items-center gap-2.5", brd)}>
              <div className="w-8 h-8 rounded-[9px] bg-[#2563eb]/10 flex items-center justify-center"><Package className="w-4 h-4 text-[#2563eb]" /></div>
              <p className={cn("text-sm font-extrabold", txt)}>Order</p>
            </div>
            <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {[
                ["order_notes", "Order Notes", "Allow customers to add order notes"],
                ["special_instructions", "Special Instructions", "Free-text delivery instructions"],
                ["auto_confirmation", "Auto Confirmation", "Confirm orders automatically after payment"],
                ["auto_cancel", "Auto Cancel", "Cancel unpaid orders after the pending timeout"],
                ["stock_reservation", "Stock Reservation", "Reserve stock while checkout is in progress"],
              ].map(([key, label, desc]) => (
                <ToggleRow key={key} configKey="checkout_order" optKey={key} label={label} desc={desc} />
              ))}
            </div>
            <div className={cn("p-4 border-t grid grid-cols-2 gap-3", brd)}>
              <div>
                <label className={labelCls}>Pending Timeout (hours)</label>
                <input type="number" min={1} defaultValue={config.checkout_order?.pending_timeout_hours ?? 48} key={`pt-${config.checkout_order?.pending_timeout_hours}`}
                  onBlur={e => updateConfig("checkout_order", { ...config.checkout_order, pending_timeout_hours: parseInt(e.target.value) || 48 })} className={inpCls} />
              </div>
              <div>
                <label className={labelCls}>Order Expiration (days)</label>
                <input type="number" min={1} defaultValue={config.checkout_order?.order_expiration_days ?? 30} key={`oe-${config.checkout_order?.order_expiration_days}`}
                  onBlur={e => updateConfig("checkout_order", { ...config.checkout_order, order_expiration_days: parseInt(e.target.value) || 30 })} className={inpCls} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ FRAUD ============ */}
      {tab === "fraud" && (
        <div className="space-y-4">
          <div className={cn(cardCls, "divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
            {FRAUD_TOGGLES.map(([key, label, desc]) => (
              <ToggleRow key={key} configKey="fraud" optKey={key} label={label} desc={desc} />
            ))}
          </div>
          <div className={cn(cardCls, "p-4 grid grid-cols-1 md:grid-cols-2 gap-4")}>
            {[
              ["risk_score_threshold", "Risk Score Threshold (hold above)", 60],
              ["auto_block_threshold", "Auto Block Threshold (block above)", 85],
              ["velocity_max_per_hour", "Max Payment Attempts / Hour", 5],
              ["max_transactions_per_day", "Max Transactions / Customer / Day", 10],
              ["max_daily_amount", "Max Daily Amount / Customer ($)", 5000],
            ].map(([key, label, def]) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <input type="number" min={0} defaultValue={config.fraud?.[key] ?? def} key={`f-${key}-${config.fraud?.[key]}`}
                  onBlur={e => updateConfig("fraud", { ...config.fraud, [key]: parseInt(e.target.value) || def })} className={inpCls} />
              </div>
            ))}
            <div>
              <label className={labelCls}>Blocked Countries (ISO codes)</label>
              <input defaultValue={(config.fraud?.blocked_countries || []).join(", ")} key={`bc-${(config.fraud?.blocked_countries || []).join(",")}`}
                onBlur={e => updateConfig("fraud", { ...config.fraud, blocked_countries: e.target.value.split(",").map(c => c.trim().toUpperCase()).filter(Boolean) })} className={inpCls} />
            </div>
            <div>
              <label className={labelCls}>Blacklist (emails / phones)</label>
              <input defaultValue={(config.fraud?.blacklist || []).join(", ")} key={`bl-${(config.fraud?.blacklist || []).join(",")}`}
                onBlur={e => updateConfig("fraud", { ...config.fraud, blacklist: e.target.value.split(",").map(c => c.trim()).filter(Boolean) })} className={inpCls} />
            </div>
            <div>
              <label className={labelCls}>Whitelist (always allowed)</label>
              <input defaultValue={(config.fraud?.whitelist || []).join(", ")} key={`wl-${(config.fraud?.whitelist || []).join(",")}`}
                onBlur={e => updateConfig("fraud", { ...config.fraud, whitelist: e.target.value.split(",").map(c => c.trim()).filter(Boolean) })} className={inpCls} />
            </div>
          </div>
        </div>
      )}

      {/* ============ TAX ============ */}
      {tab === "tax" && (
        <div className="space-y-4">
          <div className={cn(cardCls, "p-4")}>
            <div className="flex items-center justify-between mb-3">
              <p className={cn("text-sm font-bold", txt)}>Add Tax Rule</p>
              <button onClick={exportTaxCsv} className={cn("h-8 px-3 rounded-[9px] border text-[11px] font-bold flex items-center gap-1", brd, txt, hover)}><Download className="w-3 h-3" /> Export CSV</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input value={newTax.country} onChange={e => setNewTax(t => ({ ...t, country: e.target.value }))} placeholder="Country (HT)" className={inpCls} />
              <input value={newTax.state} onChange={e => setNewTax(t => ({ ...t, state: e.target.value }))} placeholder="State (optional)" className={inpCls} />
              <input value={newTax.zip} onChange={e => setNewTax(t => ({ ...t, zip: e.target.value }))} placeholder="ZIP (optional)" className={inpCls} />
              <select value={newTax.tax_type} onChange={e => setNewTax(t => ({ ...t, tax_type: e.target.value }))} className={inpCls}>
                <option value="sales_tax">Sales Tax</option><option value="vat">VAT</option><option value="gst">GST</option><option value="import_tax">Import Tax</option><option value="luxury_tax">Luxury Tax</option>
              </select>
              <select value={newTax.tax_class} onChange={e => setNewTax(t => ({ ...t, tax_class: e.target.value }))} className={inpCls}>
                <option value="standard">Standard</option><option value="digital">Digital Products</option><option value="luxury">Luxury</option><option value="shipping">Shipping</option><option value="import">Import</option>
              </select>
              <input type="number" min={0} step={0.1} value={newTax.rate} onChange={e => setNewTax(t => ({ ...t, rate: e.target.value }))} placeholder="Rate %" className={inpCls} />
              <input type="number" min={0} value={newTax.priority} onChange={e => setNewTax(t => ({ ...t, priority: e.target.value }))} placeholder="Priority" className={inpCls} />
              <div className="flex items-center gap-3 flex-wrap">
                {[["applies_to_shipping", "Shipping"], ["compound", "Compound"], ["inclusive", "Inclusive"]].map(([k, l]) => (
                  <label key={k} className={cn("flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer", txt)}>
                    <input type="checkbox" checked={newTax[k]} onChange={e => setNewTax(t => ({ ...t, [k]: e.target.checked }))} className="rounded" /> {l}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={async () => {
              if (!newTax.country.trim() || newTax.rate === "") { showToast("Country and rate required", "error"); return; }
              try {
                await api("POST", { action: "add_tax_rule", ...newTax, rate: parseFloat(newTax.rate) });
                setNewTax({ country: "", state: "", zip: "", region: "", tax_type: "sales_tax", tax_class: "standard", rate: "", priority: "0", applies_to_shipping: false, compound: false, inclusive: false });
                load(); showToast("Tax rule added");
              } catch (e) { showToast(e.message, "error"); }
            }} className="mt-3 h-9 px-4 rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Rule</button>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn("border-b", brd)}>
                    {["Country", "State", "ZIP", "Type", "Class", "Rate", "Priority", "Compound", "Inclusive", "Shipping", "Enabled", ""].map(h => (
                      <th key={h} className={cn("p-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap", sub)}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {taxRules.length === 0 ? (
                    <tr><td colSpan={12} className={cn("p-8 text-center text-xs", sub)}>No tax rules yet. Orders are untaxed until you add rules.</td></tr>
                  ) : taxRules.map(r => (
                    <tr key={r.id} className={cn("border-b", brd)}>
                      <td className={cn("p-3 text-sm font-bold", txt)}>{r.country}</td>
                      <td className={cn("p-3 text-xs", sub)}>{r.state || "All"}</td>
                      <td className={cn("p-3 text-xs", sub)}>{r.zip || "All"}</td>
                      <td className="p-3"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", dark ? "bg-[#252c36] text-[#e7ebf0]" : "bg-[#f0f2f5] text-[#16181d]")}>{(r.tax_type || "").replace(/_/g, " ")}</span></td>
                      <td className={cn("p-3 text-xs capitalize", sub)}>{r.tax_class || "standard"}</td>
                      <td className={cn("p-3 text-sm font-bold", txt)}>{Number(r.rate)}%</td>
                      <td className={cn("p-3 text-xs", sub)}>{r.priority || 0}</td>
                      <td className={cn("p-3 text-xs", sub)}>{r.compound ? "Yes" : "No"}</td>
                      <td className={cn("p-3 text-xs", sub)}>{r.inclusive ? "Incl." : "Excl."}</td>
                      <td className={cn("p-3 text-xs", sub)}>{r.applies_to_shipping ? "Yes" : "No"}</td>
                      <td className="p-3"><Toggle on={r.enabled} onChange={async () => { await api("PUT", { target: "tax_rule", id: r.id, enabled: !r.enabled }); load(); }} /></td>
                      <td className="p-3">
                        <button onClick={async () => { await api("DELETE", { target: "tax_rule", id: r.id }); load(); showToast("Rule removed"); }} className="w-7 h-7 rounded-[8px] flex items-center justify-center hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ NOTIFICATIONS ============ */}
      {tab === "notifications" && (
        <div className="space-y-4">
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className={cn("p-4 border-b", brd)}><p className={cn("text-sm font-extrabold", txt)}>Recipients</p></div>
            <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {NOTIFICATION_RECIPIENTS.map(([key, label]) => (
                <ToggleRow key={key} configKey="notification_recipients" optKey={key} label={label} desc={`Send payment notifications to ${label.toLowerCase()}s`} />
              ))}
            </div>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className={cn("p-4 border-b", brd)}><p className={cn("text-sm font-extrabold", txt)}>Channels</p></div>
            <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {NOTIFICATION_CHANNELS.map(([key, label]) => (
                <ToggleRow key={key} configKey="notification_channels" optKey={key} label={label}
                  desc={key === "email" ? "Built-in transactional email" : `Requires ${key.toUpperCase()}_WEBHOOK_URL or provider credentials in server env vars`} />
              ))}
            </div>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className={cn("p-4 border-b", brd)}><p className={cn("text-sm font-extrabold", txt)}>Events</p></div>
            <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {NOTIFICATION_EVENTS.map(([key, label]) => (
                <ToggleRow key={key} configKey="notifications" optKey={key} label={label} desc={`Fire notifications on ${label.toLowerCase()}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============ ANALYTICS ============ */}
      {tab === "analytics" && (
        !analytics ? <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#2563eb]" /></div> : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ["Total Revenue", money(analytics.totalRevenue), TrendingUp, "#16a34a"],
                ["Today", money(analytics.todayRevenue), Clock, "#2563eb"],
                ["Transactions", analytics.completed, CheckCircle2, "#16a34a"],
                ["Failed", analytics.failed, XCircle, "#dc2626"],
                ["Refunded", money(analytics.refundedAmount), Receipt, "#8b5cf6"],
                ["Chargebacks", analytics.chargebacks, AlertTriangle, "#dc2626"],
                ["Avg Basket", money(analytics.avgOrderValue), ShoppingCart, "#0891b2"],
                ["Net Revenue", money(analytics.netRevenue), Zap, "#16a34a"],
              ].map(([label, value, Icon, color]) => (
                <div key={label} className={cn("rounded-[14px] border p-3", p, brd)}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ backgroundColor: `${color}1a` }}><Icon className="w-3.5 h-3.5" style={{ color }} /></div>
                    <span className={cn("text-[10px] font-semibold", sub)}>{label}</span>
                  </div>
                  <p className={cn("text-lg font-extrabold mt-1.5", txt)}>{value}</p>
                </div>
              ))}
            </div>
            {analytics.gatewayPerformance?.length > 0 && (
              <div className={cn(cardCls, "p-4")}>
                <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Gateway Performance</p>
                <div className="space-y-2">
                  {analytics.gatewayPerformance.map(g => (
                    <div key={g.gateway} className="flex items-center gap-2">
                      <span className={cn("text-[11px] font-semibold w-28 truncate uppercase", txt)}>{g.gateway}</span>
                      <div className={cn("flex-1 h-5 rounded-[6px] overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}>
                        <div className="h-full rounded-[6px] bg-[#2563eb]" style={{ width: `${g.successRate}%` }} />
                      </div>
                      <span className={cn("text-[11px] font-bold w-10 text-right", txt)}>{g.successRate}%</span>
                      <span className={cn("text-[11px] font-bold w-20 text-right", txt)}>{money(g.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className={cn("text-xs", sub)}>Full transaction management, refunds and interactive analytics live in the <b className={txt}>Payments</b> module. Logs and webhook monitoring live in <b className={txt}>Payment Logs</b>.</p>
          </div>
        )
      )}

      {/* ============ CONFIGURE DRAWER ============ */}
      <Drawer open={!!configuring} onClose={() => setConfiguring(null)} title={configuringGw ? `Configure ${configuringGw.display_name}` : "Configure"} dark={dark} width="xl">
        {configuringGw && (
          <div className="p-4 space-y-4">
            {/* Credentials status */}
            {envStatus[configuring] && (
              <div className={cn("rounded-[12px] border p-3", brd)}>
                <p className={labelCls}>Server Credentials (environment variables — values never displayed)</p>
                <div className="space-y-1 mt-1">
                  {Object.entries(envStatus[configuring]).filter(([k]) => k !== "mode").map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      {v ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                      <span className={cn("text-xs font-mono", txt)}>{configuring.toUpperCase()}_{k.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
                <p className={cn("text-[10px] mt-2", sub)}>To rotate a secret, update the environment variable on the server and restart the app. Secrets are never stored in the database.</p>
              </div>
            )}
            {webhookUrls[configuring] && (
              <div>
                <label className={labelCls}>Webhook URL</label>
                <button onClick={() => navigator.clipboard?.writeText(webhookUrls[configuring]).then(() => showToast("Copied"))} className={cn("flex items-center gap-2 text-left rounded-[9px] border px-2.5 py-2 w-full", brd, hover)}>
                  <span className={cn("text-[11px] font-mono truncate flex-1", txt)}>{webhookUrls[configuring]}</span>
                  <Copy className={cn("w-3.5 h-3.5 shrink-0", sub)} />
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Merchant ID</label><input value={draft.merchant_id || ""} onChange={e => setDraft(d => ({ ...d, merchant_id: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>API Version</label><input value={draft.api_version || ""} onChange={e => setDraft(d => ({ ...d, api_version: e.target.value }))} placeholder="e.g. v1, 2024-06-20" className={inpCls} /></div>
              <div><label className={labelCls}>Minimum Amount ($)</label><input type="number" min={0} step={0.01} value={draft.min_amount ?? 0} onChange={e => setDraft(d => ({ ...d, min_amount: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Maximum Amount ($, 0 = none)</label><input type="number" min={0} step={0.01} value={draft.max_amount ?? 0} onChange={e => setDraft(d => ({ ...d, max_amount: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Timeout (s)</label><input type="number" min={5} max={120} value={draft.timeout_seconds ?? 30} onChange={e => setDraft(d => ({ ...d, timeout_seconds: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Retry Attempts</label><input type="number" min={0} max={10} value={draft.retry_attempts ?? 3} onChange={e => setDraft(d => ({ ...d, retry_attempts: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Webhook Retry</label><input type="number" min={0} max={10} value={draft.webhook_retry ?? 3} onChange={e => setDraft(d => ({ ...d, webhook_retry: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Priority</label><input type="number" min={0} max={100} value={draft.priority ?? 0} onChange={e => setDraft(d => ({ ...d, priority: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Fee %</label><input type="number" min={0} step={0.1} value={draft.fee_percent ?? 0} onChange={e => setDraft(d => ({ ...d, fee_percent: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Fee Fixed ($)</label><input type="number" min={0} step={0.01} value={draft.fee_fixed ?? 0} onChange={e => setDraft(d => ({ ...d, fee_fixed: e.target.value }))} className={inpCls} /></div>
              <div className="col-span-2"><label className={labelCls}>Allowed Countries (comma-separated, empty = all)</label><input value={draft.countries || ""} onChange={e => setDraft(d => ({ ...d, countries: e.target.value }))} placeholder="HT, US, CA" className={inpCls} /></div>
              <div className="col-span-2"><label className={labelCls}>Supported Currencies</label><input value={draft.currencies || ""} onChange={e => setDraft(d => ({ ...d, currencies: e.target.value }))} placeholder="USD, HTG" className={inpCls} /></div>
              <div className="col-span-2"><label className={labelCls}>Internal Notes</label><input value={draft.notes || ""} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} className={inpCls} /></div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={saveConfigure} disabled={saving === configuring} className="h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">
                {saving === configuring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
              <button onClick={() => openConfigure(configuringGw)} className={btnGhost}>Reset</button>
              <button onClick={() => testConnection(configuring)} className={btnGhost}>
                {testResult?.gateway === configuring && testResult.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />} Test Connection
              </button>
              <button onClick={() => updateGateway(configuring, { sandbox_mode: !configuringGw.sandbox_mode })} className={cn(btnGhost, configuringGw.sandbox_mode ? "text-amber-500" : "text-emerald-500")}>
                {configuringGw.sandbox_mode ? "Sandbox Mode" : "Production Mode"}
              </button>
            </div>
            {testResult?.gateway === configuring && !testResult.loading && (
              <div className={cn("rounded-[10px] p-2.5 text-xs font-semibold", testResult.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>{testResult.message}</div>
            )}
          </div>
        )}
      </Drawer>

      {/* ADD GATEWAY DRAWER */}
      <Drawer open={showAddGateway} onClose={() => setShowAddGateway(false)} title="Add Payment Gateway" dark={dark} width="md">
        <div className="p-4 space-y-3">
          <div><label className={labelCls}>Gateway Code</label><input value={newGw.gateway} onChange={e => setNewGw(g => ({ ...g, gateway: e.target.value }))} placeholder="e.g. western_union" className={inpCls} /></div>
          <div><label className={labelCls}>Display Name</label><input value={newGw.display_name} onChange={e => setNewGw(g => ({ ...g, display_name: e.target.value }))} placeholder="Western Union" className={inpCls} /></div>
          <div><label className={labelCls}>Description</label><input value={newGw.description} onChange={e => setNewGw(g => ({ ...g, description: e.target.value }))} placeholder="Shown to customers at checkout" className={inpCls} /></div>
          <button onClick={async () => {
            if (!newGw.gateway.trim() || !newGw.display_name.trim()) { showToast("Code and name required", "error"); return; }
            try { await api("POST", { action: "add_gateway", ...newGw }); setShowAddGateway(false); setNewGw({ gateway: "", display_name: "", description: "" }); load(); showToast("Gateway added"); }
            catch (e) { showToast(e.message, "error"); }
          }} className="w-full h-10 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Create Gateway</button>
        </div>
      </Drawer>

      {/* ADD CURRENCY DRAWER */}
      <Drawer open={showAddCurrency} onClose={() => setShowAddCurrency(false)} title="Add Currency" dark={dark} width="md">
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Code</label><input value={newCur.code} onChange={e => setNewCur(c => ({ ...c, code: e.target.value.toUpperCase() }))} placeholder="JPY" className={inpCls} /></div>
            <div><label className={labelCls}>Symbol</label><input value={newCur.symbol} onChange={e => setNewCur(c => ({ ...c, symbol: e.target.value }))} placeholder="¥" className={inpCls} /></div>
          </div>
          <div><label className={labelCls}>Name</label><input value={newCur.name} onChange={e => setNewCur(c => ({ ...c, name: e.target.value }))} placeholder="Japanese Yen" className={inpCls} /></div>
          <div><label className={labelCls}>Rate (per 1 base currency)</label><input type="number" step="0.0001" value={newCur.rate} onChange={e => setNewCur(c => ({ ...c, rate: e.target.value }))} className={inpCls} /></div>
          <button onClick={async () => {
            if (!newCur.code || !newCur.name || !newCur.symbol) { showToast("All fields required", "error"); return; }
            try { await api("POST", { action: "add_currency", ...newCur, rate: parseFloat(newCur.rate) || 1 }); setShowAddCurrency(false); setNewCur({ code: "", name: "", symbol: "", rate: "1" }); load(); showToast("Currency added"); }
            catch (e) { showToast(e.message, "error"); }
          }} className="w-full h-10 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add Currency</button>
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
