// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  CreditCard, Smartphone, Banknote, Landmark, Loader2, RefreshCw,
  CheckCircle2, XCircle, Copy, ShieldCheck, AlertTriangle, Save,
} from "lucide-react";

type Props = { dark: boolean };

const GATEWAY_ICONS = { stripe: CreditCard, moncash: Smartphone, natcash: Smartphone, cod: Banknote, bank_transfer: Landmark };
const GATEWAY_COLORS = { stripe: "#635bff", moncash: "#d61f26", natcash: "#0057a3", cod: "#16a34a", bank_transfer: "#0d9488" };

export function AdminPaymentSettings({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[38px] rounded-[10px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState([]);
  const [envStatus, setEnvStatus] = useState({});
  const [webhookUrls, setWebhookUrls] = useState({});
  const [saving, setSaving] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payment-settings");
      if (res.ok) {
        const d = await res.json();
        setSettings(d.settings || []);
        setEnvStatus(d.envStatus || {});
        setWebhookUrls(d.webhookUrls || {});
        const dr = {};
        (d.settings || []).forEach(s => { dr[s.gateway] = { merchant_id: s.merchant_id || "", timeout_seconds: s.timeout_seconds || 30, retry_attempts: s.retry_attempts || 3 }; });
        setDrafts(dr);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (gateway, patch) => {
    setSaving(gateway);
    try {
      const res = await fetch("/api/admin/payment-settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway, ...patch }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Update failed");
      setSettings(s => s.map(x => x.gateway === gateway ? { ...x, ...patch } : x));
      showToast("Settings saved");
    } catch (e) { showToast(e.message, "error"); } finally { setSaving(null); }
  };

  const copyUrl = (url) => {
    navigator.clipboard?.writeText(url).then(() => showToast("Webhook URL copied"));
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-32 animate-pulse", p, brd)} />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em]", txt)}>Payment Methods</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Enable, disable and configure payment gateways. API keys and secrets are read from environment variables — never stored in the database.</p>
        </div>
        <button onClick={load} className={cn("h-10 px-4 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2", brd, txt, hover)}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {settings.map(s => {
        const Icon = GATEWAY_ICONS[s.gateway] || CreditCard;
        const color = GATEWAY_COLORS[s.gateway] || "#2563eb";
        const env = envStatus[s.gateway];
        const webhook = webhookUrls[s.gateway];
        const draft = drafts[s.gateway] || {};
        const envOk = !env || Object.entries(env).every(([k, v]) => k === "mode" || v === true);

        return (
          <div key={s.gateway} className={cn("rounded-[16px] border p-4", p, brd)}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1a` }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <div className="flex-1 min-w-[160px]">
                <p className={cn("text-sm font-bold", txt)}>{s.display_name}</p>
                <p className={cn("text-xs", sub)}>{s.description}</p>
              </div>
              {env && (
                <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1", envOk ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>
                  {envOk ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {envOk ? "Credentials configured" : "Missing env credentials"}
                </span>
              )}
              {env?.mode && (
                <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold", env.mode === "production" ? "bg-blue-500/10 text-blue-600" : "bg-gray-500/10 text-gray-500")}>
                  {env.mode.toUpperCase()}
                </span>
              )}
              <button
                onClick={() => update(s.gateway, { enabled: !s.enabled })}
                disabled={saving === s.gateway}
                className={cn("w-12 h-[26px] rounded-full transition-colors relative shrink-0", s.enabled ? "bg-emerald-500" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}
              >
                <span className={cn("absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-transform", s.enabled ? "translate-x-[26px]" : "translate-x-[3px]")} />
              </button>
            </div>

            {/* env detail + config */}
            <div className={cn("mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4", brd)}>
              <div className="space-y-2">
                {env && (
                  <div>
                    <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-1.5", sub)}>Environment Credentials</p>
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
                    <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-1.5", sub)}>Webhook URL</p>
                    <button onClick={() => copyUrl(webhook)} className={cn("flex items-center gap-2 text-left rounded-[9px] border px-2.5 py-1.5 w-full", brd, hover)}>
                      <span className={cn("text-[11px] font-mono truncate flex-1", txt)}>{webhook}</span>
                      <Copy className={cn("w-3.5 h-3.5 shrink-0", sub)} />
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 content-start">
                <div className="col-span-3 md:col-span-1">
                  <label className={cn("text-[10px] font-bold uppercase tracking-wider block mb-1", sub)}>Merchant ID</label>
                  <input value={draft.merchant_id || ""} onChange={e => setDrafts(d => ({ ...d, [s.gateway]: { ...d[s.gateway], merchant_id: e.target.value } }))} placeholder="Optional" className={inpCls} />
                </div>
                <div>
                  <label className={cn("text-[10px] font-bold uppercase tracking-wider block mb-1", sub)}>Timeout (s)</label>
                  <input type="number" min={5} max={120} value={draft.timeout_seconds || 30} onChange={e => setDrafts(d => ({ ...d, [s.gateway]: { ...d[s.gateway], timeout_seconds: parseInt(e.target.value) || 30 } }))} className={inpCls} />
                </div>
                <div>
                  <label className={cn("text-[10px] font-bold uppercase tracking-wider block mb-1", sub)}>Retries</label>
                  <input type="number" min={0} max={10} value={draft.retry_attempts ?? 3} onChange={e => setDrafts(d => ({ ...d, [s.gateway]: { ...d[s.gateway], retry_attempts: parseInt(e.target.value) || 0 } }))} className={inpCls} />
                </div>
                <div className="col-span-3">
                  <button
                    onClick={() => update(s.gateway, drafts[s.gateway])}
                    disabled={saving === s.gateway}
                    className="h-9 px-4 rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {saving === s.gateway ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Configuration
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className={cn("rounded-[14px] border p-4 flex items-start gap-3", p, brd)}>
        <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          <p className={cn("text-sm font-bold", txt)}>Security model</p>
          <p className={cn("text-xs mt-1 leading-relaxed", sub)}>
            API keys and secret keys are only read from server environment variables (MONCASH_CLIENT_ID, MONCASH_CLIENT_SECRET, MONCASH_WEBHOOK_SECRET, NATCASH_API_KEY, NATCASH_WEBHOOK_SECRET, STRIPE_SECRET_KEY...) and are never sent to the browser or stored in the database.
            All payments are verified server-side via signed webhooks with replay protection. Customer PINs are never collected — wallet authentication always happens inside MonCash/NatCash secure environments.
          </p>
        </div>
      </div>

      {toast && (
        <div className={cn("fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
