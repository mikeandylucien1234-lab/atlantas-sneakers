// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  CreditCard, Smartphone, Banknote, Landmark, Loader2, RefreshCw,
  CheckCircle2, XCircle, Copy, ShieldCheck, AlertTriangle, Save, Plus,
  Download, Upload, Globe, DollarSign, ShoppingCart, Shield, Receipt,
  Bell, Zap, Wallet, Trash2, PlugZap, Coins, History, Terminal,
  User, Truck, FileText, Package, ChevronDown, ChevronUp, ArrowRight,
  Activity, Webhook, CircleDot,
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
  wise: "#65a30d", zelle: "#6d1ed4", cashapp: "#00d632", klarna: "#e85d9f",
  affirm: "#4a4af4", afterpay: "#2ec4b6", cj_wallet: "#ff6a00", manual: "#6b7280", crypto: "#f7931a",
};

const SETUP_GUIDES = {
  moncash: { account: "Create a MonCash Business account at moncashbutton.digicelhaiti.com", docs: "Digicel MonCash developer portal" },
  natcash: { account: "Request NatCash merchant API access from Natcom Business", docs: "Natcom NatCash merchant support" },
  stripe: { account: "Create a Stripe account at dashboard.stripe.com", docs: "Stripe API keys page" },
  paypal: { account: "Create a PayPal Business account at developer.paypal.com", docs: "PayPal developer dashboard" },
};

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
      ["bnpl", "Buy Now Pay Later", "Deferred payment plans"],
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

const NOTIFICATION_EVENTS = [["payment_success", "Payment Success"], ["payment_failed", "Payment Failed"], ["refund", "Refund"], ["chargeback", "Chargeback"], ["webhook_failure", "Webhook Failure"]];
const NOTIFICATION_CHANNELS = [["email", "Email"], ["sms", "SMS"], ["push", "Push"], ["slack", "Slack"], ["discord", "Discord"], ["telegram", "Telegram"]];
const NOTIFICATION_RECIPIENTS = [["admin", "Admin"], ["customer", "Customer"], ["vendor", "Vendor"]];

const AUDIT_LABELS = {
  "gateway.enabled": { label: "Gateway enabled", color: "#16a34a" },
  "gateway.disabled": { label: "Gateway disabled", color: "#6b7280" },
  "gateway.updated": { label: "Gateway configured", color: "#2563eb" },
  "gateway.created": { label: "Gateway added", color: "#16a34a" },
  "gateway.deleted": { label: "Gateway removed", color: "#dc2626" },
  "currency.updated": { label: "Currency updated", color: "#2563eb" },
  "currency.rates_synced": { label: "Rates synced", color: "#0891b2" },
  "config.updated": { label: "Settings changed", color: "#2563eb" },
  "config.restored": { label: "Backup restored", color: "#ca8a04" },
  "tax.created": { label: "Tax rule added", color: "#16a34a" },
  "tax.deleted": { label: "Tax rule removed", color: "#dc2626" },
};

function money(n) { return `$${(Number(n) || 0).toFixed(2)}`; }
function ago(d) {
  if (!d) return "never";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }

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
  const btnGhost = cn("h-9 px-3.5 rounded-[10px] text-xs font-semibold border transition-colors flex items-center gap-1.5", brd, txt, hover);

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("gateways");
  const [overview, setOverview] = useState(null);
  const [settings, setSettings] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [config, setConfig] = useState({});
  const [taxRules, setTaxRules] = useState([]);
  const [envStatus, setEnvStatus] = useState({});
  const [gatewayStats, setGatewayStats] = useState({});
  const [webhookUrls, setWebhookUrls] = useState({});
  const [saving, setSaving] = useState(null);
  const [openGateway, setOpenGateway] = useState(null);
  const [gwDetail, setGwDetail] = useState(null);
  const [draft, setDraft] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [showAddGateway, setShowAddGateway] = useState(false);
  const [newGw, setNewGw] = useState({ gateway: "", display_name: "", description: "" });
  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [newCur, setNewCur] = useState({ code: "", name: "", symbol: "", rate: "1" });
  const [newTax, setNewTax] = useState({ country: "", state: "", zip: "", tax_type: "sales_tax", tax_class: "standard", rate: "", priority: "0", applies_to_shipping: false, compound: false, inclusive: false });
  const [activity, setActivity] = useState(null);
  const [showPosture, setShowPosture] = useState(false);
  const importRef = useRef(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Defensive parsing: shared hosts sometimes intercept requests and return
  // HTML error pages — res.json() on those throws Safari's cryptic
  // "The string did not match the expected pattern". Read text first and
  // surface a real error message instead.
  const api = async (method, body) => {
    const res = await fetch("/api/admin/payment-settings", {
      method, headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let d;
    try { d = text ? JSON.parse(text) : {}; } catch {
      const err = new Error(`Server returned a non-JSON response (HTTP ${res.status}). The request may have been blocked by the hosting security layer.`);
      err.nonJson = true;
      err.status = res.status;
      throw err;
    }
    if (!res.ok) throw new Error(d.error || `Request failed (HTTP ${res.status})`);
    return d;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allRes, ovRes] = await Promise.all([
        fetch("/api/admin/payment-settings"),
        fetch("/api/admin/payment-settings?section=overview"),
      ]);
      if (allRes.ok) {
        const d = await allRes.json();
        setSettings(d.settings || []);
        setCurrencies(d.currencies || []);
        setConfig(d.config || {});
        setTaxRules(d.taxRules || []);
        setEnvStatus(d.envStatus || {});
        setGatewayStats(d.gatewayStats || {});
        setWebhookUrls(d.webhookUrls || {});
      }
      if (ovRes.ok) setOverview(await ovRes.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== "activity") return;
    fetch("/api/admin/payment-settings?section=activity").then(r => r.ok ? r.json() : null).then(d => d && setActivity(d.activity || [])).catch(() => {});
  }, [tab]);

  const envOkFor = (gateway) => {
    const env = envStatus[gateway];
    if (!env) return true;
    return Object.entries(env).every(([k, v]) => k === "mode" || v === true);
  };

  const openGatewayDetail = async (s) => {
    setOpenGateway(s.gateway);
    setGwDetail(null);
    setTestResult(null);
    setShowAdvanced(false);
    setDraft({
      merchant_id: s.merchant_id || "", api_version: s.api_version || "",
      timeout_seconds: s.timeout_seconds ?? 30, retry_attempts: s.retry_attempts ?? 3,
      webhook_retry: s.webhook_retry ?? 3, priority: s.priority || 0,
      fee_percent: s.fee_percent || 0, fee_fixed: s.fee_fixed || 0,
      min_amount: s.min_amount || 0, max_amount: s.max_amount || 0,
      countries: (s.countries || []).join(", "), currencies: (s.currencies || []).join(", "),
      notes: s.notes || "",
    });
    try {
      const res = await fetch(`/api/admin/payment-settings?section=gateway_detail&gateway=${s.gateway}`);
      if (res.ok) setGwDetail(await res.json());
    } catch { /* silent */ }
  };

  const updateGateway = async (gateway, patch) => {
    setSaving(gateway);
    try {
      await api("PUT", { target: "gateway", gateway, ...patch });
      setSettings(s => s.map(x => x.gateway === gateway ? { ...x, ...patch } : x));
      showToast("Saved");
      fetch("/api/admin/payment-settings?section=overview").then(r => r.ok ? r.json() : null).then(d => d && setOverview(d)).catch(() => {});
    } catch (e) { showToast(e.message, "error"); } finally { setSaving(null); }
  };

  const saveDraft = (gateway) => {
    updateGateway(gateway, {
      merchant_id: draft.merchant_id || null, api_version: draft.api_version || null,
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
    try { await api("PUT", { target: "currency", code, ...patch }); await load(); showToast("Saved"); }
    catch (e) { showToast(e.message, "error"); } finally { setSaving(null); }
  };

  const updateConfig = async (key, value) => {
    setConfig(c => ({ ...c, [key]: value }));
    try { await api("PUT", { target: "config", key, value }); showToast("Saved"); }
    catch (e) { showToast(e.message, "error"); load(); }
  };

  const exportBackup = async () => {
    try {
      const res = await fetch("/api/admin/payment-settings?section=export");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `payment-settings-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      showToast("Backup downloaded");
    } catch { showToast("Export failed", "error"); }
  };

  const importBackup = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      const d = await api("POST", { action: "import", data });
      load(); showToast(`Restored ${d.imported} record(s)`);
    } catch (e) { showToast(e.message || "Invalid backup file", "error"); }
    if (importRef.current) importRef.current.value = "";
  };

  const Toggle = ({ on, onChange, disabled }) => (
    <button onClick={onChange} disabled={disabled}
      className={cn("w-11 h-6 rounded-full transition-colors relative shrink-0 disabled:opacity-40 disabled:cursor-not-allowed", on ? "bg-[#16a34a]" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}>
      <span className={cn("absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform", on ? "translate-x-[23px]" : "translate-x-[3px]")} />
    </button>
  );

  const ToggleRow = ({ configKey, optKey, label, desc }) => (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className={cn("text-[13px] font-semibold", txt)}>{label}</p>
        {desc && <p className={cn("text-[11px] mt-0.5", sub)}>{desc}</p>}
      </div>
      <Toggle on={!!config[configKey]?.[optKey]} onChange={() => updateConfig(configKey, { ...config[configKey], [optKey]: !config[configKey]?.[optKey] })} />
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <div className={cn("rounded-[16px] border h-20 animate-pulse", p, brd)} />
        <div className={cn("rounded-[16px] border h-12 animate-pulse", p, brd)} />
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-28 animate-pulse", p, brd)} />)}
      </div>
    );
  }

  const openGw = settings.find(s => s.gateway === openGateway);
  const criticalIssues = (overview?.issues || []).filter(i => i.severity === "critical");
  const warningIssues = (overview?.issues || []).filter(i => i.severity === "warning");

  return (
    <div className="space-y-4">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em]", txt)}>Payments</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Gateways, currencies, checkout and risk — everything that moves money.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportBackup} className={btnGhost}><Download className="w-3.5 h-3.5" /> Backup</button>
          <button onClick={() => importRef.current?.click()} className={btnGhost}><Upload className="w-3.5 h-3.5" /> Restore</button>
          <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={e => e.target.files?.[0] && importBackup(e.target.files[0])} />
          <button onClick={load} className={btnGhost}><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        </div>
      </div>

      {/* ================= HEALTH BAR ================= */}
      {overview && (
        <div className={cn(cardCls, "p-4")}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2.5">
              <span className={cn("w-2.5 h-2.5 rounded-full", criticalIssues.length > 0 ? "bg-red-500" : warningIssues.length > 0 ? "bg-amber-500" : "bg-emerald-500")} />
              <div>
                <p className={cn("text-sm font-extrabold", txt)}>
                  {criticalIssues.length > 0 ? "Action required" : warningIssues.length > 0 ? "Attention" : "All systems operational"}
                </p>
                <p className={cn("text-[11px]", sub)}>{overview.enabledGateways} of {overview.totalGateways} gateways active</p>
              </div>
            </div>
            <div className={cn("hidden sm:block w-px h-8", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
            <div>
              <p className={cn("text-sm font-extrabold", overview.successRate24h === null ? sub : overview.successRate24h >= 90 ? "text-emerald-500" : overview.successRate24h >= 70 ? "text-amber-500" : "text-red-500")}>
                {overview.successRate24h === null ? "—" : `${overview.successRate24h}%`}
              </p>
              <p className={cn("text-[11px]", sub)}>Success rate 24h</p>
            </div>
            <div>
              <p className={cn("text-sm font-extrabold", txt)}>{money(overview.volume24h)}</p>
              <p className={cn("text-[11px]", sub)}>Volume 24h · {overview.transactions24h} txn</p>
            </div>
            <div>
              <p className={cn("text-sm font-extrabold flex items-center gap-1.5", txt)}>
                <Webhook className={cn("w-3.5 h-3.5", overview.lastWebhookOk === false ? "text-red-500" : sub)} />
                {ago(overview.lastWebhook)}
              </p>
              <p className={cn("text-[11px]", sub)}>Last webhook</p>
            </div>
            <div className="flex-1" />
            <button onClick={() => setShowPosture(v => !v)} className={cn("flex items-center gap-1.5 text-[11px] font-bold", sub, "hover:text-emerald-500 transition-colors")}>
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Security posture {showPosture ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Actionable issues */}
          {(overview.issues || []).length > 0 && (
            <div className="mt-3 space-y-1.5">
              {overview.issues.map((issue, i) => {
                const gw = settings.find(s => s.gateway === issue.gateway);
                return (
                  <button key={i} onClick={() => gw && openGatewayDetail(gw)}
                    className={cn("w-full flex items-center gap-2.5 rounded-[10px] p-2.5 text-left transition-colors",
                      issue.severity === "critical" ? "bg-red-500/10 hover:bg-red-500/15" : "bg-amber-500/10 hover:bg-amber-500/15")}>
                    <AlertTriangle className={cn("w-4 h-4 shrink-0", issue.severity === "critical" ? "text-red-500" : "text-amber-500")} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-bold", issue.severity === "critical" ? "text-red-600" : "text-amber-600")}>{issue.title}</p>
                      <p className={cn("text-[10px] truncate", sub)}>{issue.action}</p>
                    </div>
                    {gw && <ArrowRight className={cn("w-3.5 h-3.5 shrink-0", sub)} />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Security posture (read-only, collapsed by default) */}
          {showPosture && (
            <div className={cn("mt-3 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2", brd)}>
              {(overview.securityPosture || []).map(sp2 => (
                <div key={sp2.label} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className={cn("text-[11px] font-bold", txt)}>{sp2.label}</p>
                    <p className={cn("text-[10px]", sub)}>{sp2.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TABS ================= */}
      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {[
          { id: "gateways", label: "Gateways", icon: CreditCard },
          { id: "localization", label: "Localization", icon: Globe },
          { id: "checkout", label: "Checkout", icon: ShoppingCart },
          { id: "risk", label: "Risk", icon: Shield },
          { id: "activity", label: "Activity", icon: History },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("h-9 px-4 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors",
              tab === t.id ? "bg-[#2563eb] text-white" : cn(sub, hover))}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ================= GATEWAYS ================= */}
      {tab === "gateways" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {settings.map(s => {
              const Icon = GATEWAY_ICONS[s.gateway] || CreditCard;
              const color = GATEWAY_COLORS[s.gateway] || "#2563eb";
              const stats = gatewayStats[s.gateway];
              const ok = envOkFor(s.gateway);
              const env = envStatus[s.gateway];
              return (
                <button key={s.gateway} onClick={() => openGatewayDetail(s)}
                  className={cn(cardCls, "p-4 text-left transition-all hover:shadow-[0_4px_16px_rgba(16,24,40,.08)] flex flex-col gap-3", hover)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}14` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-extrabold truncate", txt)}>{s.display_name}</p>
                      <p className={cn("text-[11px] truncate", sub)}>{s.description}</p>
                    </div>
                    {!ok ? (
                      <span className="px-2 py-1 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 shrink-0">SETUP REQUIRED</span>
                    ) : s.enabled ? (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 shrink-0"><CircleDot className="w-2.5 h-2.5" /> LIVE</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-[9px] font-bold bg-gray-500/10 text-gray-500 shrink-0">OFF</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-auto">
                    <span className={sub}>
                      {stats ? <>Today: <b className={txt}>{stats.transactions} txn · {money(stats.volume)}</b></> : "No activity today"}
                    </span>
                    {env?.mode && <span className={cn("font-bold", env.mode === "production" ? "text-blue-500" : "text-amber-500")}>{env.mode.toUpperCase()}</span>}
                  </div>
                </button>
              );
            })}
            {/* Add gateway tile */}
            <button onClick={() => setShowAddGateway(true)} className={cn("rounded-[16px] border-2 border-dashed p-4 flex flex-col items-center justify-center gap-1.5 min-h-[110px] transition-colors", brd, hover)}>
              <Plus className={cn("w-5 h-5", sub)} />
              <span className={cn("text-xs font-bold", sub)}>Add Gateway</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= LOCALIZATION (currencies + tax) ================= */}
      {tab === "localization" && (
        <div className="space-y-4">
          {/* CURRENCIES */}
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className={cn("p-4 border-b flex items-center justify-between", brd)}>
              <div>
                <p className={cn("text-sm font-extrabold", txt)}>Currencies</p>
                <p className={cn("text-[11px] mt-0.5", sub)}>{currencies.filter(c => c.enabled).length} enabled · base {currencies.find(c => c.is_base)?.code || "USD"}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={async () => {
                  setSyncing(true);
                  try { const d = await api("POST", { action: "sync_rates" }); showToast(`${d.updated} rate(s) synced`); load(); }
                  catch (e) { showToast(e.message, "error"); } finally { setSyncing(false); }
                }} disabled={syncing} className={cn(btnGhost, "disabled:opacity-50")}>
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync rates
                </button>
                <button onClick={() => setShowAddCurrency(true)} className="h-9 px-3.5 rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn("border-b", brd)}>
                    {["Currency", "Format", "Rate", "Auto", "Source", "Synced", "Enabled", ""].map(h => (
                      <th key={h} className={cn("p-3 text-left text-[10px] font-bold uppercase tracking-wider whitespace-nowrap", sub)}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currencies.map(c => (
                    <tr key={c.code} className={cn("border-b last:border-0", brd)}>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-extrabold", txt)}>{c.code}</span>
                          {c.is_base && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600">BASE</span>}
                          {c.is_default && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-500/10 text-violet-600">DEFAULT</span>}
                        </div>
                        <p className={cn("text-[11px]", sub)}>{c.name}</p>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={cn("text-xs font-semibold", txt)}>
                          {c.symbol_position === "after" ? `100${c.symbol}` : `${c.symbol}100`}
                          <span className={sub}>.{Array((c.decimals ?? 2) + 1).join("0")}</span>
                        </span>
                      </td>
                      <td className="p-3">
                        {c.is_base ? <span className={cn("text-xs", sub)}>1.00</span> : (
                          <input type="number" step="0.0001" defaultValue={c.rate} key={`${c.code}-${c.rate}`}
                            onBlur={e => { const v = parseFloat(e.target.value); if (v > 0 && v !== Number(c.rate)) updateCurrency(c.code, { rate: v }); }}
                            className={cn("w-24 h-8 rounded-[8px] border px-2 text-xs", inp)} />
                        )}
                      </td>
                      <td className="p-3"><Toggle on={!!c.auto_update} disabled={c.is_base} onChange={() => updateCurrency(c.code, { auto_update: !c.auto_update })} /></td>
                      <td className="p-3">
                        <select value={c.api_source || "exchangerate"} onChange={e => updateCurrency(c.code, { api_source: e.target.value })} disabled={c.is_base} className={cn("h-8 rounded-[8px] border px-2 text-[11px]", inp)}>
                          <option value="exchangerate">ExchangeRate</option>
                          <option value="fixer">Fixer</option>
                          <option value="currencylayer">CurrencyLayer</option>
                          <option value="openexchangerates">OpenExchangeRates</option>
                        </select>
                      </td>
                      <td className={cn("p-3 text-[11px] whitespace-nowrap", sub)}>{ago(c.last_synced_at)}</td>
                      <td className="p-3"><Toggle on={c.enabled} disabled={saving === c.code || c.is_base} onChange={() => updateCurrency(c.code, { enabled: !c.enabled })} /></td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {!c.is_default && <button onClick={() => updateCurrency(c.code, { is_default: true })} title="Set default" className={cn("text-[10px] font-bold px-1.5", sub, "hover:text-violet-500")}>default</button>}
                          {!c.is_base && !c.is_default && (
                            <button onClick={async () => { try { await api("DELETE", { target: "currency", code: c.code }); load(); showToast("Removed"); } catch (e) { showToast(e.message, "error"); } }}
                              className="w-7 h-7 rounded-[8px] flex items-center justify-center hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* TAX */}
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className={cn("p-4 border-b flex items-center justify-between", brd)}>
              <div>
                <p className={cn("text-sm font-extrabold", txt)}>Tax Rules</p>
                <p className={cn("text-[11px] mt-0.5", sub)}>{taxRules.filter(r => r.enabled).length} active rule(s) — matched by country, state and ZIP in priority order</p>
              </div>
              <button onClick={() => {
                const header = ["country", "state", "zip", "tax_type", "tax_class", "rate", "priority", "compound", "inclusive", "applies_to_shipping", "enabled"];
                const csv = [header.join(","), ...taxRules.map(r => header.map(h => r[h] ?? "").join(","))].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "tax-rules.csv"; a.click();
                URL.revokeObjectURL(url);
              }} className={btnGhost}><Download className="w-3.5 h-3.5" /> CSV</button>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 items-end">
              <div><label className={labelCls}>Country</label><input value={newTax.country} onChange={e => setNewTax(t => ({ ...t, country: e.target.value }))} placeholder="HT" className={inpCls} /></div>
              <div><label className={labelCls}>State</label><input value={newTax.state} onChange={e => setNewTax(t => ({ ...t, state: e.target.value }))} placeholder="All" className={inpCls} /></div>
              <div><label className={labelCls}>ZIP</label><input value={newTax.zip} onChange={e => setNewTax(t => ({ ...t, zip: e.target.value }))} placeholder="All" className={inpCls} /></div>
              <div><label className={labelCls}>Type</label>
                <select value={newTax.tax_type} onChange={e => setNewTax(t => ({ ...t, tax_type: e.target.value }))} className={inpCls}>
                  <option value="sales_tax">Sales Tax</option><option value="vat">VAT</option><option value="gst">GST</option><option value="import_tax">Import</option><option value="luxury_tax">Luxury</option>
                </select>
              </div>
              <div><label className={labelCls}>Class</label>
                <select value={newTax.tax_class} onChange={e => setNewTax(t => ({ ...t, tax_class: e.target.value }))} className={inpCls}>
                  <option value="standard">Standard</option><option value="digital">Digital</option><option value="luxury">Luxury</option><option value="shipping">Shipping</option><option value="import">Import</option>
                </select>
              </div>
              <div><label className={labelCls}>Rate %</label><input type="number" min={0} step={0.1} value={newTax.rate} onChange={e => setNewTax(t => ({ ...t, rate: e.target.value }))} className={inpCls} /></div>
              <div className="flex items-center gap-2 pb-2">
                {[["compound", "Cmpd"], ["inclusive", "Incl"], ["applies_to_shipping", "Ship"]].map(([k, l]) => (
                  <label key={k} className={cn("flex items-center gap-1 text-[10px] font-bold cursor-pointer", txt)}>
                    <input type="checkbox" checked={newTax[k]} onChange={e => setNewTax(t => ({ ...t, [k]: e.target.checked }))} className="rounded" /> {l}
                  </label>
                ))}
              </div>
              <button onClick={async () => {
                if (!newTax.country.trim() || newTax.rate === "") { showToast("Country and rate required", "error"); return; }
                try {
                  await api("POST", { action: "add_tax_rule", ...newTax, rate: parseFloat(newTax.rate) });
                  setNewTax({ country: "", state: "", zip: "", tax_type: "sales_tax", tax_class: "standard", rate: "", priority: "0", applies_to_shipping: false, compound: false, inclusive: false });
                  load(); showToast("Rule added");
                } catch (e) { showToast(e.message, "error"); }
              }} className="h-[38px] rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] flex items-center justify-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
            {taxRules.length > 0 && (
              <div className={cn("border-t divide-y", brd, dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
                {taxRules.map(r => (
                  <div key={r.id} className="px-4 py-2.5 flex items-center gap-3">
                    <span className={cn("text-sm font-extrabold w-10", txt)}>{r.country}</span>
                    <span className={cn("text-[11px] w-24 truncate", sub)}>{[r.state, r.zip].filter(Boolean).join(" · ") || "All regions"}</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", dark ? "bg-[#252c36] text-[#e7ebf0]" : "bg-[#f0f2f5] text-[#16181d]")}>{(r.tax_type || "").replace(/_/g, " ")}</span>
                    <span className={cn("text-sm font-extrabold", txt)}>{Number(r.rate)}%</span>
                    <span className={cn("text-[10px]", sub)}>{[r.compound && "compound", r.inclusive ? "incl." : "excl.", r.applies_to_shipping && "shipping"].filter(Boolean).join(" · ")}</span>
                    <div className="flex-1" />
                    <Toggle on={r.enabled} onChange={async () => { await api("PUT", { target: "tax_rule", id: r.id, enabled: !r.enabled }); load(); }} />
                    <button onClick={async () => { await api("DELETE", { target: "tax_rule", id: r.id }); load(); showToast("Removed"); }} className="w-7 h-7 rounded-[8px] flex items-center justify-center hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= CHECKOUT ================= */}
      {tab === "checkout" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {CHECKOUT_SECTIONS.map(section => (
            <div key={section.key} className={cn(cardCls, "overflow-hidden")}>
              <div className={cn("px-4 py-3 border-b flex items-center gap-2.5", brd)}>
                <section.icon className="w-4 h-4 text-[#2563eb]" />
                <p className={cn("text-sm font-extrabold", txt)}>{section.title}</p>
              </div>
              <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
                {section.toggles.map(([key, label, desc]) => (
                  <ToggleRow key={key} configKey={section.key} optKey={key} label={label} desc={desc} />
                ))}
              </div>
            </div>
          ))}

          {/* INVOICE */}
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className={cn("px-4 py-3 border-b flex items-center gap-2.5", brd)}>
              <FileText className="w-4 h-4 text-[#2563eb]" />
              <p className={cn("text-sm font-extrabold", txt)}>Invoice</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {[["invoice_prefix", "Prefix"], ["company_name", "Company"], ["vat_number", "VAT Number"], ["tax_id", "Tax ID"]].map(([key, label]) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <input defaultValue={config.checkout_invoice?.[key] || ""} key={`inv-${key}-${config.checkout_invoice?.[key]}`}
                    onBlur={e => e.target.value !== (config.checkout_invoice?.[key] || "") && updateConfig("checkout_invoice", { ...config.checkout_invoice, [key]: e.target.value })} className={inpCls} />
                </div>
              ))}
              <div className="col-span-2">
                <label className={labelCls}>Footer</label>
                <input defaultValue={config.checkout_invoice?.invoice_footer || ""} key={`inv-f-${config.checkout_invoice?.invoice_footer}`}
                  onBlur={e => updateConfig("checkout_invoice", { ...config.checkout_invoice, invoice_footer: e.target.value })} className={inpCls} />
              </div>
              <div className="col-span-2 flex gap-5">
                {[["pdf_download", "PDF Download"], ["email_invoice", "Email Invoice"]].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Toggle on={!!config.checkout_invoice?.[key]} onChange={() => updateConfig("checkout_invoice", { ...config.checkout_invoice, [key]: !config.checkout_invoice?.[key] })} />
                    <span className={cn("text-xs font-semibold", txt)}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ORDER */}
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className={cn("px-4 py-3 border-b flex items-center gap-2.5", brd)}>
              <Package className="w-4 h-4 text-[#2563eb]" />
              <p className={cn("text-sm font-extrabold", txt)}>Order</p>
            </div>
            <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {[["order_notes", "Order Notes", "Allow customers to add notes"],
                ["special_instructions", "Special Instructions", "Free-text delivery instructions"],
                ["auto_confirmation", "Auto Confirmation", "Confirm automatically after payment"],
                ["auto_cancel", "Auto Cancel", "Cancel unpaid orders after timeout"],
                ["stock_reservation", "Stock Reservation", "Reserve stock during checkout"]].map(([key, label, desc]) => (
                <ToggleRow key={key} configKey="checkout_order" optKey={key} label={label} desc={desc} />
              ))}
            </div>
            <div className={cn("p-4 border-t grid grid-cols-2 gap-3", brd)}>
              <div>
                <label className={labelCls}>Pending Timeout (h)</label>
                <input type="number" min={1} defaultValue={config.checkout_order?.pending_timeout_hours ?? 48} key={`pt-${config.checkout_order?.pending_timeout_hours}`}
                  onBlur={e => updateConfig("checkout_order", { ...config.checkout_order, pending_timeout_hours: parseInt(e.target.value) || 48 })} className={inpCls} />
              </div>
              <div>
                <label className={labelCls}>Expiration (days)</label>
                <input type="number" min={1} defaultValue={config.checkout_order?.order_expiration_days ?? 30} key={`oe-${config.checkout_order?.order_expiration_days}`}
                  onBlur={e => updateConfig("checkout_order", { ...config.checkout_order, order_expiration_days: parseInt(e.target.value) || 30 })} className={inpCls} />
              </div>
            </div>
          </div>

          {/* NOTIFICATIONS */}
          <div className={cn(cardCls, "overflow-hidden lg:col-span-2")}>
            <div className={cn("px-4 py-3 border-b flex items-center gap-2.5", brd)}>
              <Bell className="w-4 h-4 text-[#2563eb]" />
              <p className={cn("text-sm font-extrabold", txt)}>Notifications</p>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-5">
              {[["Recipients", "notification_recipients", NOTIFICATION_RECIPIENTS], ["Channels", "notification_channels", NOTIFICATION_CHANNELS], ["Events", "notifications", NOTIFICATION_EVENTS]].map(([title, cfgKey, opts]) => (
                <div key={cfgKey}>
                  <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-2", sub)}>{title}</p>
                  <div className="space-y-2">
                    {opts.map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className={cn("text-[13px] font-semibold", txt)}>{label}</span>
                        <Toggle on={!!config[cfgKey]?.[key]} onChange={() => updateConfig(cfgKey, { ...config[cfgKey], [key]: !config[cfgKey]?.[key] })} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= RISK ================= */}
      {tab === "risk" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className={cn("px-4 py-3 border-b flex items-center gap-2.5", brd)}>
              <Shield className="w-4 h-4 text-[#2563eb]" />
              <p className={cn("text-sm font-extrabold", txt)}>Protections</p>
            </div>
            <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {FRAUD_TOGGLES.map(([key, label, desc]) => (
                <ToggleRow key={key} configKey="fraud" optKey={key} label={label} desc={desc} />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className={cn(cardCls, "overflow-hidden")}>
              <div className={cn("px-4 py-3 border-b flex items-center gap-2.5", brd)}>
                <Activity className="w-4 h-4 text-[#2563eb]" />
                <p className={cn("text-sm font-extrabold", txt)}>Thresholds</p>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {[["risk_score_threshold", "Review above score", 60],
                  ["auto_block_threshold", "Block above score", 85],
                  ["velocity_max_per_hour", "Max attempts / hour", 5],
                  ["max_transactions_per_day", "Max txn / day", 10],
                  ["max_daily_amount", "Max daily amount ($)", 5000]].map(([key, label, def]) => (
                  <div key={key}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" min={0} defaultValue={config.fraud?.[key] ?? def} key={`f-${key}-${config.fraud?.[key]}`}
                      onBlur={e => updateConfig("fraud", { ...config.fraud, [key]: parseInt(e.target.value) || def })} className={inpCls} />
                  </div>
                ))}
              </div>
            </div>
            <div className={cn(cardCls, "overflow-hidden")}>
              <div className={cn("px-4 py-3 border-b flex items-center gap-2.5", brd)}>
                <Globe className="w-4 h-4 text-[#2563eb]" />
                <p className={cn("text-sm font-extrabold", txt)}>Lists</p>
              </div>
              <div className="p-4 space-y-3">
                {[["blocked_countries", "Blocked countries (ISO codes)", "RU, KP"],
                  ["blacklist", "Blacklist (emails / phones)", "fraud@example.com"],
                  ["whitelist", "Whitelist (always allowed)", "vip@example.com"]].map(([key, label, ph]) => (
                  <div key={key}>
                    <label className={labelCls}>{label}</label>
                    <input defaultValue={(config.fraud?.[key] || []).join(", ")} key={`fl-${key}-${(config.fraud?.[key] || []).join(",")}`} placeholder={ph}
                      onBlur={e => updateConfig("fraud", { ...config.fraud, [key]: e.target.value.split(",").map(c => c.trim()).filter(Boolean) })} className={inpCls} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= ACTIVITY ================= */}
      {tab === "activity" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <div className={cn("px-4 py-3 border-b", brd)}>
            <p className={cn("text-sm font-extrabold", txt)}>Configuration Activity</p>
            <p className={cn("text-[11px] mt-0.5", sub)}>Every change to payment configuration — who, when, and what changed.</p>
          </div>
          {!activity ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" /></div>
          ) : activity.length === 0 ? (
            <div className="p-10 text-center">
              <History className={cn("w-8 h-8 mx-auto mb-2", sub)} />
              <p className={cn("text-sm font-bold", txt)}>No configuration changes yet</p>
              <p className={cn("text-xs mt-1", sub)}>Changes made from now on will appear here with full before/after values.</p>
            </div>
          ) : (
            <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {activity.map(a => {
                const meta = AUDIT_LABELS[a.action] || { label: a.action, color: "#6b7280" };
                return (
                  <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: meta.color }} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[13px]", txt)}>
                        <b>{meta.label}</b> — <span className="font-mono text-xs">{a.target}</span>
                      </p>
                      {a.new_value && Object.keys(a.new_value).length > 0 && (
                        <div className={cn("text-[11px] mt-1 space-y-0.5", sub)}>
                          {Object.entries(a.new_value).slice(0, 4).map(([k, v]) => (
                            <p key={k} className="truncate">
                              <span className="font-mono">{k}</span>:{" "}
                              {a.old_value?.[k] !== undefined && <><span className="line-through opacity-60">{JSON.stringify(a.old_value[k])}</span> → </>}
                              <span className={txt}>{JSON.stringify(v)}</span>
                            </p>
                          ))}
                          {Object.keys(a.new_value).length > 4 && <p>+{Object.keys(a.new_value).length - 4} more field(s)</p>}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-[11px] font-semibold", txt)}>{a.actor_name || "System"}</p>
                      <p className={cn("text-[10px]", sub)}>{fmtDT(a.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= GATEWAY DETAIL DRAWER (single screen of truth) ================= */}
      <Drawer open={!!openGateway} onClose={() => setOpenGateway(null)} title={openGw?.display_name || ""} dark={dark} width="2xl">
        {openGw && (() => {
          const ok = envOkFor(openGw.gateway);
          const env = envStatus[openGw.gateway];
          const guide = SETUP_GUIDES[openGw.gateway];
          const missing = env ? Object.entries(env).filter(([k, v]) => k !== "mode" && v !== true).map(([k]) => `${openGw.gateway.toUpperCase()}_${k.toUpperCase()}`) : [];
          const maxVol = gwDetail ? Math.max(...gwDetail.days.map(d => d.volume), 1) : 1;
          return (
            <div className="flex flex-col h-full">
              {/* Status header */}
              <div className={cn("p-4 border-b", brd)}>
                <div className="flex items-center gap-3 flex-wrap">
                  {ok ? (
                    openGw.enabled
                      ? <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600"><CircleDot className="w-3 h-3" /> LIVE</span>
                      : <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-500">DISABLED</span>
                  ) : <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600">SETUP REQUIRED</span>}
                  {env?.mode && <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold", env.mode === "production" ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600")}>{env.mode.toUpperCase()}</span>}
                  {gwDetail?.successRate !== null && gwDetail?.successRate !== undefined && (
                    <span className={cn("text-xs font-bold", gwDetail.successRate >= 90 ? "text-emerald-500" : "text-amber-500")}>{gwDetail.successRate}% success (7d)</span>
                  )}
                  <div className="flex-1" />
                  <Toggle on={openGw.enabled} disabled={!ok || saving === openGw.gateway} onChange={() => updateGateway(openGw.gateway, { enabled: !openGw.enabled })} />
                </div>
                {!ok && <p className={cn("text-[11px] mt-2", sub)}>The activation toggle unlocks once every required credential is configured and the connection test passes.</p>}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* GUIDED SETUP when credentials missing */}
                {!ok && (
                  <div className={cn("rounded-[14px] border-2 border-amber-500/30 bg-amber-500/5 p-4", brd)}>
                    <p className={cn("text-sm font-extrabold mb-3", txt)}>Setup guide</p>
                    <div className="space-y-3">
                      {[
                        guide?.account || `Create a merchant account with ${openGw.display_name}`,
                        <>Add the missing environment variable(s) on the server, then restart the app:
                          <span className="block mt-1 space-y-0.5">
                            {missing.map(m => <code key={m} className={cn("block text-[11px] font-mono px-2 py-1 rounded-[6px] w-fit", dark ? "bg-[#0f1318]" : "bg-white border border-[#eef0f3]")}>{m}=•••</code>)}
                          </span>
                        </>,
                        "Run the connection test below — the activation toggle unlocks when it passes",
                      ].map((step, i) => (
                        <div key={i} className="flex gap-3">
                          <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0", "bg-amber-500/15 text-amber-600")}>{i + 1}</span>
                          <div className={cn("text-xs leading-relaxed pt-1", txt)}>{step}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 7-DAY SPARKLINE */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className={cn("text-[10px] font-bold uppercase tracking-wider", sub)}>Last 7 days</p>
                    {gwDetail && <p className={cn("text-[11px] font-bold", txt)}>{money(gwDetail.weekVolume)} · {gwDetail.weekCount} paid</p>}
                  </div>
                  {!gwDetail ? (
                    <div className={cn("h-16 rounded-[10px] animate-pulse", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")} />
                  ) : (
                    <div className="flex items-end gap-1.5 h-16">
                      {gwDetail.days.map(d => (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${money(d.volume)} (${d.count} txn)`}>
                          <div className={cn("w-full rounded-t-[4px] transition-all", d.volume > 0 ? "bg-[#2563eb]" : dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}
                            style={{ height: `${Math.max((d.volume / maxVol) * 100, d.volume > 0 ? 8 : 4)}%` }} />
                          <span className={cn("text-[8px] font-bold", sub)}>{new Date(d.date).toLocaleDateString("en-US", { weekday: "narrow" })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CREDENTIALS + WEBHOOK */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {env && (
                    <div className={cn("rounded-[12px] border p-3", brd)}>
                      <p className={labelCls}>Server credentials</p>
                      <div className="space-y-1 mt-1">
                        {Object.entries(env).filter(([k]) => k !== "mode").map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2">
                            {v ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                            <span className={cn("text-[11px] font-mono", txt)}>{openGw.gateway.toUpperCase()}_{k.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                      <p className={cn("text-[10px] mt-2", sub)}>Values never leave the server. Rotate by updating the env var.</p>
                    </div>
                  )}
                  {webhookUrls[openGw.gateway] && (
                    <div className={cn("rounded-[12px] border p-3", brd)}>
                      <p className={labelCls}>Webhook endpoint</p>
                      <button onClick={() => navigator.clipboard?.writeText(webhookUrls[openGw.gateway]).then(() => showToast("Copied"))}
                        className={cn("mt-1 flex items-center gap-2 text-left rounded-[8px] border px-2 py-1.5 w-full", brd, hover)}>
                        <span className={cn("text-[10px] font-mono truncate flex-1", txt)}>{webhookUrls[openGw.gateway]}</span>
                        <Copy className={cn("w-3 h-3 shrink-0", sub)} />
                      </button>
                      <p className={cn("text-[10px] mt-2", sub)}>Register this URL in the {openGw.display_name} dashboard.</p>
                    </div>
                  )}
                </div>

                {/* TEST CONNECTION */}
                <div className="flex items-center gap-2">
                  <button onClick={() => testConnection(openGw.gateway)} className={cn("h-9 px-4 rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] flex items-center gap-1.5")}>
                    {testResult?.gateway === openGw.gateway && testResult.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />} Test connection
                  </button>
                  {env?.mode !== undefined && (
                    <button onClick={() => updateGateway(openGw.gateway, { sandbox_mode: !openGw.sandbox_mode })} className={btnGhost}>
                      Switch to {openGw.sandbox_mode ? "production" : "sandbox"} note
                    </button>
                  )}
                </div>
                {testResult?.gateway === openGw.gateway && !testResult.loading && (
                  <div className={cn("rounded-[10px] p-2.5 text-xs font-semibold", testResult.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>{testResult.message}</div>
                )}

                {/* ESSENTIAL CONFIG */}
                <div>
                  <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-2", sub)}>Configuration</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Merchant ID</label><input value={draft.merchant_id || ""} onChange={e => setDraft(d => ({ ...d, merchant_id: e.target.value }))} className={inpCls} /></div>
                    <div><label className={labelCls}>Priority</label><input type="number" min={0} value={draft.priority ?? 0} onChange={e => setDraft(d => ({ ...d, priority: e.target.value }))} className={inpCls} /></div>
                    <div><label className={labelCls}>Fee %</label><input type="number" min={0} step={0.1} value={draft.fee_percent ?? 0} onChange={e => setDraft(d => ({ ...d, fee_percent: e.target.value }))} className={inpCls} /></div>
                    <div><label className={labelCls}>Fee fixed ($)</label><input type="number" min={0} step={0.01} value={draft.fee_fixed ?? 0} onChange={e => setDraft(d => ({ ...d, fee_fixed: e.target.value }))} className={inpCls} /></div>
                  </div>

                  {/* Progressive disclosure: advanced */}
                  <button onClick={() => setShowAdvanced(v => !v)} className={cn("mt-3 flex items-center gap-1.5 text-[11px] font-bold transition-colors", sub, "hover:text-[#2563eb]")}>
                    {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Advanced options
                  </button>
                  {showAdvanced && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div><label className={labelCls}>API version</label><input value={draft.api_version || ""} onChange={e => setDraft(d => ({ ...d, api_version: e.target.value }))} placeholder="v1" className={inpCls} /></div>
                      <div><label className={labelCls}>Timeout (s)</label><input type="number" min={5} max={120} value={draft.timeout_seconds ?? 30} onChange={e => setDraft(d => ({ ...d, timeout_seconds: e.target.value }))} className={inpCls} /></div>
                      <div><label className={labelCls}>Retry attempts</label><input type="number" min={0} max={10} value={draft.retry_attempts ?? 3} onChange={e => setDraft(d => ({ ...d, retry_attempts: e.target.value }))} className={inpCls} /></div>
                      <div><label className={labelCls}>Webhook retry</label><input type="number" min={0} max={10} value={draft.webhook_retry ?? 3} onChange={e => setDraft(d => ({ ...d, webhook_retry: e.target.value }))} className={inpCls} /></div>
                      <div><label className={labelCls}>Min amount ($)</label><input type="number" min={0} step={0.01} value={draft.min_amount ?? 0} onChange={e => setDraft(d => ({ ...d, min_amount: e.target.value }))} className={inpCls} /></div>
                      <div><label className={labelCls}>Max amount ($, 0 = none)</label><input type="number" min={0} step={0.01} value={draft.max_amount ?? 0} onChange={e => setDraft(d => ({ ...d, max_amount: e.target.value }))} className={inpCls} /></div>
                      <div className="col-span-2"><label className={labelCls}>Allowed countries (empty = all)</label><input value={draft.countries || ""} onChange={e => setDraft(d => ({ ...d, countries: e.target.value }))} placeholder="HT, US, CA" className={inpCls} /></div>
                      <div className="col-span-2"><label className={labelCls}>Supported currencies</label><input value={draft.currencies || ""} onChange={e => setDraft(d => ({ ...d, currencies: e.target.value }))} placeholder="USD, HTG" className={inpCls} /></div>
                      <div className="col-span-2"><label className={labelCls}>Internal notes</label><input value={draft.notes || ""} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} className={inpCls} /></div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-4">
                    <button onClick={() => saveDraft(openGw.gateway)} disabled={saving === openGw.gateway}
                      className="h-9 px-4 rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-1.5">
                      {saving === openGw.gateway ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                    </button>
                    <button onClick={() => openGatewayDetail(openGw)} className={btnGhost}>Reset</button>
                    {openGw.is_custom && (
                      <button onClick={async () => { try { await api("DELETE", { target: "gateway", gateway: openGw.gateway }); setOpenGateway(null); load(); showToast("Gateway removed"); } catch (e) { showToast(e.message, "error"); } }}
                        className="h-9 px-3 rounded-[10px] bg-red-500/10 text-red-500 text-xs font-bold flex items-center gap-1.5 hover:bg-red-500/20 ml-auto"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                    )}
                  </div>
                </div>

                {/* RECENT EVENTS INLINE */}
                <div>
                  <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-2", sub)}>Recent events</p>
                  {!gwDetail ? (
                    <div className={cn("h-24 rounded-[10px] animate-pulse", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")} />
                  ) : gwDetail.recentEvents.length === 0 ? (
                    <p className={cn("text-xs", sub)}>No events logged for this gateway yet.</p>
                  ) : (
                    <div className={cn("rounded-[12px] border divide-y", brd, dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
                      {gwDetail.recentEvents.map(ev => (
                        <div key={ev.id} className="px-3 py-2 flex items-center gap-2.5">
                          {ev.error || (ev.status_code && ev.status_code >= 400)
                            ? <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                          <span className={cn("text-[11px] font-mono font-semibold flex-1 truncate", txt)}>{ev.event_type}</span>
                          {ev.status_code && <span className={cn("text-[10px] font-mono", ev.status_code < 400 ? sub : "text-red-500")}>{ev.status_code}</span>}
                          {ev.latency_ms != null && <span className={cn("text-[10px] font-mono", sub)}>{ev.latency_ms}ms</span>}
                          <span className={cn("text-[10px] shrink-0", sub)}>{ago(ev.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className={cn("text-[10px] mt-1.5", sub)}>Full history with request/response payloads lives in the Payment Logs module.</p>
                </div>
              </div>
            </div>
          );
        })()}
      </Drawer>

      {/* ================= GATEWAY WIZARD ================= */}
      <GatewayWizard
        open={showAddGateway}
        onClose={() => setShowAddGateway(false)}
        dark={dark}
        api={api}
        settings={settings}
        envStatus={envStatus}
        webhookUrls={webhookUrls}
        reload={load}
        showToast={showToast}
        styles={{ p, brd, txt, sub, inp, hover, inpCls, labelCls, btnGhost }}
      />

      {/* ADD CURRENCY DRAWER */}
      <Drawer open={showAddCurrency} onClose={() => setShowAddCurrency(false)} title="Add Currency" dark={dark} width="md">
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Code</label><input value={newCur.code} onChange={e => setNewCur(c => ({ ...c, code: e.target.value.toUpperCase() }))} placeholder="JPY" className={inpCls} /></div>
            <div><label className={labelCls}>Symbol</label><input value={newCur.symbol} onChange={e => setNewCur(c => ({ ...c, symbol: e.target.value }))} placeholder="¥" className={inpCls} /></div>
          </div>
          <div><label className={labelCls}>Name</label><input value={newCur.name} onChange={e => setNewCur(c => ({ ...c, name: e.target.value }))} placeholder="Japanese Yen" className={inpCls} /></div>
          <div><label className={labelCls}>Rate (per 1 base)</label><input type="number" step="0.0001" value={newCur.rate} onChange={e => setNewCur(c => ({ ...c, rate: e.target.value }))} className={inpCls} /></div>
          <button onClick={async () => {
            if (!newCur.code || !newCur.name || !newCur.symbol) { showToast("All fields required", "error"); return; }
            try { await api("POST", { action: "add_currency", ...newCur, rate: parseFloat(newCur.rate) || 1 }); setShowAddCurrency(false); setNewCur({ code: "", name: "", symbol: "", rate: "1" }); load(); showToast("Currency added"); }
            catch (e) { showToast(e.message, "error"); }
          }} className="w-full h-10 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add Currency</button>
        </div>
      </Drawer>

      {toast && (
        <div className={cn("fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

/* ================= PAYMENT GATEWAY WIZARD ================= */

function GatewayWizard({ open, onClose, dark, api, settings, envStatus, webhookUrls, reload, showToast, styles }) {
  const { brd, txt, sub, hover, inpCls, labelCls, btnGhost } = styles;
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ gateway: "", display_name: "", description: "", integration_type: "manual" });
  const [created, setCreated] = useState(null); // gateway code once created
  const [creating, setCreating] = useState(false);
  const [scaffold, setScaffold] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const isApi = data.integration_type === "api";
  const STEPS = isApi
    ? ["Basics", "Type", "Create", "Integration Files", "Environment", "Webhook", "Test", "Activate"]
    : ["Basics", "Type", "Create", "Activate"];

  const reset = () => {
    setStep(0);
    setData({ gateway: "", display_name: "", description: "", integration_type: "manual" });
    setCreated(null); setScaffold(null); setTestResult(null);
  };
  const close = () => { reset(); onClose(); };

  const code = data.gateway.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const CODE = code.toUpperCase();
  const createdGw = settings.find(s => s.gateway === created);
  const env = created ? envStatus[created] : null;
  const envOk = !env || Object.entries(env).every(([k, v]) => k === "mode" || v === true);

  const validateBasics = () => {
    if (!code) { showToast("Gateway code is required (letters, numbers, underscores)", "error"); return false; }
    if (!data.display_name.trim()) { showToast("Display name is required", "error"); return false; }
    if (settings.some(s => s.gateway === code)) { showToast(`"${code}" already exists — it may just be disabled in the list`, "error"); return false; }
    return true;
  };

  const createGateway = async () => {
    setCreating(true);
    try {
      try {
        await api("POST", { action: "add_gateway", gateway: code, display_name: data.display_name, description: data.description, integration_type: data.integration_type });
      } catch (e) {
        if (e.nonJson) await api("PUT", { target: "gateway", create: true, gateway: code, display_name: data.display_name, description: data.description, integration_type: data.integration_type });
        else throw e;
      }
      setCreated(code);
      await reload();
      if (isApi) {
        try {
          const res = await fetch(`/api/admin/payment-settings?section=scaffold&gateway=${code}`);
          if (res.ok) setScaffold(await res.json());
        } catch { /* silent */ }
      }
      setStep(3);
      showToast("Gateway created");
    } catch (e) { showToast(e.message, "error"); } finally { setCreating(false); }
  };

  const recheckEnv = async () => {
    setChecking(true);
    await reload();
    setChecking(false);
  };

  const runTest = async () => {
    setTestResult({ loading: true });
    try {
      const d = await api("POST", { action: "test_connection", gateway: created });
      setTestResult({ ok: d.ok, message: d.message });
    } catch (e) { setTestResult({ ok: false, message: e.message }); }
  };

  const activate = async () => {
    try {
      await api("PUT", { target: "gateway", gateway: created, enabled: true });
      await reload();
      showToast(`${data.display_name} is now live at checkout`);
      close();
    } catch (e) { showToast(e.message, "error"); }
  };

  const download = (filename, content) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const StepDots = () => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full",
            i === step ? "bg-[#2563eb]" : i < step ? "bg-emerald-500/10" : dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}>
            {i < step
              ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              : <span className={cn("w-3.5 h-3.5 rounded-full text-[8px] font-extrabold flex items-center justify-center", i === step ? "bg-white/20 text-white" : sub)}>{i + 1}</span>}
            <span className={cn("text-[9px] font-bold uppercase tracking-wide", i === step ? "text-white" : i < step ? "text-emerald-600" : sub)}>{label}</span>
          </div>
          {i < STEPS.length - 1 && <div className={cn("w-2 h-px", dark ? "bg-[#252c36]" : "bg-[#e4e7eb]")} />}
        </div>
      ))}
    </div>
  );

  const NavButtons = ({ onNext, nextLabel = "Continue", nextDisabled, showBack = true, loading }) => (
    <div className="flex items-center gap-2 pt-2">
      {showBack && step > 0 && !created && (
        <button onClick={() => setStep(s => s - 1)} className={btnGhost}>Back</button>
      )}
      {created && step > 3 && (
        <button onClick={() => setStep(s => s - 1)} className={btnGhost}>Back</button>
      )}
      <button onClick={onNext} disabled={nextDisabled || loading}
        className="h-10 px-5 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2 ml-auto">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {nextLabel} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  const CodeBlock = ({ content, filename }) => (
    <div className="relative group">
      <pre className={cn("rounded-[12px] border p-3 text-[10px] font-mono overflow-x-auto whitespace-pre max-h-[260px] overflow-y-auto", brd, txt, dark ? "bg-[#0f1318]" : "bg-[#f8f9fb]")}>{content}</pre>
      <div className="absolute top-2 right-2 flex gap-1">
        <button onClick={() => navigator.clipboard?.writeText(content).then(() => showToast("Copied"))}
          className={cn("h-7 px-2 rounded-[8px] border text-[10px] font-bold flex items-center gap-1", brd, txt, dark ? "bg-[#171c24]" : "bg-white")}>
          <Copy className="w-3 h-3" /> Copy
        </button>
        <button onClick={() => download(filename.split("/").pop(), content)}
          className={cn("h-7 px-2 rounded-[8px] border text-[10px] font-bold flex items-center gap-1", brd, txt, dark ? "bg-[#171c24]" : "bg-white")}>
          <Download className="w-3 h-3" /> Download
        </button>
      </div>
    </div>
  );

  return (
    <Drawer open={open} onClose={close} title="Payment Gateway Wizard" dark={dark} width="2xl">
      <div className="p-4 space-y-5">
        <StepDots />

        {/* STEP 0 — BASICS */}
        {step === 0 && (
          <div className="space-y-3">
            <p className={cn("text-sm font-bold", txt)}>Identify the new payment method</p>
            <div>
              <label className={labelCls}>Gateway code (technical identifier)</label>
              <input value={data.gateway} onChange={e => setData(d => ({ ...d, gateway: e.target.value }))} placeholder="western_union" className={inpCls} />
              {code && <p className={cn("text-[10px] mt-1 font-mono", sub)}>Will be registered as: <b className={txt}>{code}</b></p>}
            </div>
            <div>
              <label className={labelCls}>Display name (shown to customers)</label>
              <input value={data.display_name} onChange={e => setData(d => ({ ...d, display_name: e.target.value }))} placeholder="Western Union" className={inpCls} />
            </div>
            <div>
              <label className={labelCls}>Description (shown at checkout)</label>
              <input value={data.description} onChange={e => setData(d => ({ ...d, description: e.target.value }))} placeholder="Pay via Western Union transfer" className={inpCls} />
            </div>
            <NavButtons onNext={() => validateBasics() && setStep(1)} showBack={false} />
          </div>
        )}

        {/* STEP 1 — TYPE */}
        {step === 1 && (
          <div className="space-y-3">
            <p className={cn("text-sm font-bold", txt)}>How will payments be processed?</p>
            {[
              {
                type: "manual", title: "Manual / Offline", icon: Banknote,
                desc: "Bank deposit, money transfer agent, in-person payment... The customer places the order, you verify the payment yourself and confirm it in the Payments module.",
                badge: "Works immediately — zero code",
              },
              {
                type: "api", title: "API Provider", icon: Zap,
                desc: "An online payment provider with its own API (like MonCash or Stripe). The customer is redirected to the provider and a signed webhook confirms the payment automatically.",
                badge: "Guided integration — scaffold generated",
              },
            ].map(opt => (
              <button key={opt.type} onClick={() => setData(d => ({ ...d, integration_type: opt.type }))}
                className={cn("w-full rounded-[14px] border-2 p-4 text-left transition-colors flex gap-3",
                  data.integration_type === opt.type ? "border-[#2563eb] bg-[#2563eb]/5" : cn(brd, hover))}>
                <div className={cn("w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0", data.integration_type === opt.type ? "bg-[#2563eb] text-white" : dark ? "bg-[#1d242e] text-[#8b95a3]" : "bg-[#f0f2f5] text-[#8a929c]")}>
                  <opt.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn("text-sm font-extrabold", txt)}>{opt.title}</p>
                    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold", opt.type === "manual" ? "bg-emerald-500/10 text-emerald-600" : "bg-violet-500/10 text-violet-600")}>{opt.badge}</span>
                  </div>
                  <p className={cn("text-xs mt-1 leading-relaxed", sub)}>{opt.desc}</p>
                </div>
              </button>
            ))}
            <NavButtons onNext={() => setStep(2)} />
          </div>
        )}

        {/* STEP 2 — CREATE */}
        {step === 2 && (
          <div className="space-y-3">
            <p className={cn("text-sm font-bold", txt)}>Review and create</p>
            <div className={cn("rounded-[12px] border divide-y", brd, dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {[["Code", code], ["Name", data.display_name], ["Description", data.description || "—"],
                ["Type", isApi ? "API Provider" : "Manual / Offline"],
                ["Initial state", "Disabled — activated at the last step"]].map(([k, v]) => (
                <div key={k} className="px-3 py-2.5 flex items-center justify-between gap-3">
                  <span className={cn("text-[11px] font-bold uppercase tracking-wide", sub)}>{k}</span>
                  <span className={cn("text-xs font-semibold text-right", txt)}>{v}</span>
                </div>
              ))}
            </div>
            {!isApi && (
              <div className={cn("rounded-[10px] bg-emerald-500/10 p-3 text-xs text-emerald-700 leading-relaxed")}>
                Manual gateways are handled by the built-in generic engine: they appear automatically at checkout, orders are recorded as <b>pending</b>, and you confirm each payment with the <b>Capture</b> action in the Payments module. No code, no credentials.
              </div>
            )}
            <NavButtons onNext={createGateway} nextLabel="Create Gateway" loading={creating} />
          </div>
        )}

        {/* STEP 3 (API) — INTEGRATION FILES / (MANUAL) — ACTIVATE */}
        {step === 3 && !isApi && created && (
          <div className="space-y-3">
            <div className="rounded-[10px] bg-emerald-500/10 p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <p className="text-xs font-bold text-emerald-700">{data.display_name} is ready — everything below already works.</p>
            </div>
            <div className={cn("rounded-[12px] border p-3 space-y-2", brd)}>
              <p className={cn("text-xs font-bold", txt)}>What happens when a customer chooses {data.display_name}:</p>
              {["It appears in the checkout payment list automatically",
                "The order is placed and the payment recorded as pending",
                `You verify the payment, then press Capture in the Payments module`,
                "The order is confirmed and inventory updated"].map((s, i) => (
                <div key={i} className="flex gap-2">
                  <span className={cn("w-5 h-5 rounded-full bg-[#2563eb]/10 text-[#2563eb] text-[10px] font-extrabold flex items-center justify-center shrink-0")}>{i + 1}</span>
                  <p className={cn("text-xs pt-0.5", sub)}>{s}</p>
                </div>
              ))}
            </div>
            <button onClick={activate} className="w-full h-11 rounded-[11px] bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Activate {data.display_name} at checkout
            </button>
            <button onClick={close} className={cn("w-full h-9 text-xs font-bold", sub)}>Keep disabled for now — finish later from its card</button>
          </div>
        )}

        {step === 3 && isApi && (
          <div className="space-y-3">
            <p className={cn("text-sm font-bold", txt)}>Integration files</p>
            <p className={cn("text-xs leading-relaxed", sub)}>
              The signed <b className={txt}>webhook endpoint already exists</b> (generic engine) — no file needed for it. One file must be added to the project so customers can be redirected to the provider: download it, adapt the provider API call to their documentation, place it at the path shown, rebuild and deploy.
            </p>
            {!scaffold ? <div className={cn("h-40 rounded-[12px] animate-pulse", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")} /> : (
              <>
                {scaffold.files.map(f => (
                  <div key={f.path}>
                    <p className={cn("text-[10px] font-bold font-mono mb-1", txt)}>{f.path}</p>
                    <CodeBlock content={f.content} filename={f.path} />
                  </div>
                ))}
                <div className={cn("rounded-[12px] border p-3", brd)}>
                  <p className={cn("text-[10px] font-bold uppercase tracking-wide mb-1", sub)}>Webhook — nothing to code</p>
                  <pre className={cn("text-[10px] font-mono whitespace-pre-wrap leading-relaxed", sub)}>{scaffold.webhookNote}</pre>
                </div>
              </>
            )}
            <NavButtons onNext={() => setStep(4)} />
          </div>
        )}

        {/* STEP 4 (API) — ENVIRONMENT */}
        {step === 4 && isApi && (
          <div className="space-y-3">
            <p className={cn("text-sm font-bold", txt)}>Environment variables</p>
            <p className={cn("text-xs leading-relaxed", sub)}>
              Add these to the server environment (never in code, never in the database), then restart the app. The checks below re-run live.
            </p>
            <div className={cn("rounded-[12px] border p-3 space-y-2", brd)}>
              {[["api_key", `${CODE}_API_KEY`], ["webhook_secret", `${CODE}_WEBHOOK_SECRET`]].map(([k, name]) => (
                <div key={k} className="flex items-center gap-2">
                  {env?.[k] ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  <code className={cn("text-xs font-mono", txt)}>{name}</code>
                  <span className={cn("text-[10px] ml-auto", env?.[k] ? "text-emerald-500 font-bold" : sub)}>{env?.[k] ? "detected" : "not set"}</span>
                </div>
              ))}
            </div>
            <button onClick={recheckEnv} disabled={checking} className={cn(btnGhost, "disabled:opacity-50")}>
              {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Re-check now
            </button>
            <NavButtons onNext={() => setStep(5)} nextLabel={envOk ? "Continue" : "Continue anyway"} />
          </div>
        )}

        {/* STEP 5 (API) — WEBHOOK */}
        {step === 5 && isApi && (
          <div className="space-y-3">
            <p className={cn("text-sm font-bold", txt)}>Register the webhook with the provider</p>
            <p className={cn("text-xs leading-relaxed", sub)}>
              In the provider's dashboard, register this callback URL. Every event they send is verified with HMAC-SHA256 using <code className="font-mono">{CODE}_WEBHOOK_SECRET</code> before any order is marked paid.
            </p>
            <button onClick={() => navigator.clipboard?.writeText(webhookUrls[created] || "").then(() => showToast("Copied"))}
              className={cn("flex items-center gap-2 text-left rounded-[10px] border px-3 py-2.5 w-full", brd, hover)}>
              <Webhook className={cn("w-4 h-4 shrink-0", sub)} />
              <span className={cn("text-xs font-mono truncate flex-1", txt)}>{webhookUrls[created] || `.../api/webhooks/${created}`}</span>
              <Copy className={cn("w-3.5 h-3.5 shrink-0", sub)} />
            </button>
            <NavButtons onNext={() => setStep(6)} />
          </div>
        )}

        {/* STEP 6 (API) — TEST */}
        {step === 6 && isApi && (
          <div className="space-y-3">
            <p className={cn("text-sm font-bold", txt)}>Test the configuration</p>
            <button onClick={runTest} className="h-10 px-5 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] flex items-center gap-2">
              {testResult?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />} Run connection test
            </button>
            {testResult && !testResult.loading && (
              <div className={cn("rounded-[10px] p-3 text-xs font-semibold", testResult.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>{testResult.message}</div>
            )}
            <p className={cn("text-[11px]", sub)}>Then run a full sandbox payment end-to-end and confirm the webhook appears in Payment Logs before going to production.</p>
            <NavButtons onNext={() => setStep(7)} nextDisabled={false} nextLabel={testResult?.ok ? "Continue" : "Continue anyway"} />
          </div>
        )}

        {/* STEP 7 (API) — ACTIVATE */}
        {step === 7 && isApi && (
          <div className="space-y-3">
            <p className={cn("text-sm font-bold", txt)}>Go live</p>
            <div className={cn("rounded-[12px] border divide-y", brd, dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {[["Gateway registered", true],
                ["Integration file deployed", null],
                ["Credentials detected", envOk && !!env],
                ["Connection test passed", testResult?.ok === true]].map(([label, ok]) => (
                <div key={label} className="px-3 py-2.5 flex items-center gap-2">
                  {ok === true ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : ok === false ? <XCircle className="w-4 h-4 text-red-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  <span className={cn("text-xs font-semibold", txt)}>{label}</span>
                  {ok === null && <span className={cn("text-[10px] ml-auto", sub)}>verify manually after deploy</span>}
                </div>
              ))}
            </div>
            <button onClick={activate} className="w-full h-11 rounded-[11px] bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Activate {data.display_name} at checkout
            </button>
            <button onClick={close} className={cn("w-full h-9 text-xs font-bold", sub)}>Keep disabled for now — finish later from its card</button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
