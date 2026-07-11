// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Globe, RefreshCw, Loader2, Save, Plug, PlugZap, Power, CheckCircle2, XCircle,
  AlertTriangle, Search, FileText, Gauge, Smartphone, ShieldCheck, Boxes,
  MousePointerClick, Eye, Percent, TrendingUp, History, Download, Send,
  FileSearch, ListChecks, Bug, Clock, ExternalLink, Layers,
} from "lucide-react";

type Props = { dark: boolean };

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "connection", label: "Connection", icon: Plug },
  { id: "verification", label: "Verification", icon: ShieldCheck },
  { id: "sitemap", label: "Sitemap", icon: FileText },
  { id: "coverage", label: "Index Coverage", icon: ListChecks },
  { id: "inspect", label: "URL Inspection", icon: FileSearch },
  { id: "performance", label: "Performance", icon: TrendingUp },
  { id: "vitals", label: "Core Web Vitals", icon: Gauge },
  { id: "mobile", label: "Mobile", icon: Smartphone },
  { id: "structured", label: "Structured Data", icon: Boxes },
  { id: "errors", label: "Crawl Errors", icon: Bug },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "audit", label: "Audit Log", icon: History },
];

const RANGES = [["1", "Today"], ["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["365", "12 months"]];
const VERIF_METHODS = [
  ["meta", "HTML Meta Tag"], ["dns", "DNS Verification"], ["analytics", "Google Analytics"],
  ["gtm", "Google Tag Manager"], ["file", "HTML File Upload"],
];
const GRADE_COLOR = { good: "#16a34a", needs_improvement: "#ea7317", poor: "#dc2626", no_data: "#8a929c" };
const GRADE_LABEL = { good: "Good", needs_improvement: "Needs Improvement", poor: "Poor", no_data: "No data" };

function num(n) { return (Number(n) || 0).toLocaleString(); }
function pct(n) { return `${(Number(n) || 0).toFixed(1)}%`; }
function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return ""; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

export function AdminSearchConsole({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");
  const labelCls = cn("text-[12px] font-semibold mb-1.5 block", txt);
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnGhost = cn("h-10 px-4 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2 disabled:opacity-50", brd, txt, hover);
  const btnPrimary = "h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2";
  const trackBg = dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]";

  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [settings, setSettings] = useState({});
  const [meta, setMeta] = useState({ hasGoogleCreds: false, credType: null });
  const [data, setData] = useState({});
  const [tabLoading, setTabLoading] = useState(false);
  const [busy, setBusy] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [inspectUrl, setInspectUrl] = useState("");
  const [inspectResult, setInspectResult] = useState(null);
  const [verifToken, setVerifToken] = useState("");
  const [verifMethod, setVerifMethod] = useState("meta");

  const showToast = useCallback((message, type = "success") => { setToast({ message, type }); setTimeout(() => setToast(null), 3200); }, []);
  const setField = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const loadSettings = useCallback(async () => {
    const r = await fetch("/api/search-console/settings");
    if (r.ok) { const d = await r.json(); setSettings(d.settings || {}); setMeta({ hasGoogleCreds: d.hasGoogleCreds, credType: d.credType }); if (d.settings?.verification_token) setVerifToken(d.settings.verification_token); if (d.settings?.verification_method) setVerifMethod(d.settings.verification_method); }
  }, []);

  const sectionFor = (t) => ({ dashboard: "dashboard", performance: "performance", coverage: "coverage", sitemap: "sitemap", vitals: "core-web-vitals", mobile: "mobile", structured: "structured-data", errors: "errors", security: "security", verification: "verification", audit: "audit" }[t]);

  const loadTab = useCallback(async (t) => {
    const section = sectionFor(t);
    if (!section) return;
    setTabLoading(true);
    try { const r = await fetch(`/api/search-console/${section}?days=${days}`); if (r.ok) { const d = await r.json(); setData(prev => ({ ...prev, [t]: d })); } }
    finally { setTabLoading(false); }
  }, [days]);

  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadSettings(), loadTab("dashboard")]); setLoading(false); })(); }, [loadSettings, loadTab]);
  useEffect(() => { if (!loading) loadTab(tab); }, [tab, days]); // eslint-disable-line

  const runAction = async (action, extra = {}, okMsg) => {
    setBusy(action);
    try {
      const res = await fetch(`/api/search-console/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(extra) });
      const d = await res.json();
      if (action === "test") { setTestResult(d); return d; }
      if (action === "inspect") { setInspectResult(d); return d; }
      if (!res.ok || d.error) throw new Error(d.error || "Action failed");
      if (okMsg) showToast(typeof okMsg === "function" ? okMsg(d) : okMsg);
      await loadSettings();
      return d;
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload = { google_account: settings.google_account, property_url: settings.property_url, property_type: settings.property_type, google_client_id: settings.google_client_id, auto_sync: !!settings.auto_sync, sync_interval_minutes: settings.sync_interval_minutes || 720 };
      const res = await fetch("/api/search-console/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Save failed");
      showToast("Configuration saved");
    } catch (e) { showToast(e.message, "error"); } finally { setSaving(false); }
  };

  const syncNow = () => runAction("sync", {}, (d) => `Synced (${d.source === "google" ? "Google API" : "first-party"})`).then(() => loadTab(tab));
  const doExport = (format) => { window.open(`/api/search-console/export?format=${format}&days=${days}`, "_blank"); };

  const connected = settings.connection_status === "connected";
  const dash = data.dashboard;
  const K = dash?.kpis || {};

  const kpis = useMemo(() => [
    { label: "Total Clicks", value: num(K.clicks), icon: MousePointerClick, color: "#2563eb" },
    { label: "Total Impressions", value: num(K.impressions), icon: Eye, color: "#0891b2" },
    { label: "Average CTR", value: pct(K.ctr), icon: Percent, color: "#ea7317" },
    { label: "Average Position", value: (Number(K.position) || 0).toFixed(1), icon: TrendingUp, color: "#8b5cf6" },
    { label: "Indexed Pages", value: num(K.indexed), icon: CheckCircle2, color: "#16a34a" },
    { label: "Not Indexed", value: num(K.non_indexed), icon: XCircle, color: "#8a929c" },
    { label: "Error Pages", value: num(K.errors), icon: Bug, color: "#dc2626" },
    { label: "Warnings", value: num(K.warnings), icon: AlertTriangle, color: "#ca8a04" },
    { label: "LCP", value: K.lcp != null ? `${K.lcp}ms` : "—", icon: Gauge, color: "#2563eb" },
    { label: "CLS", value: K.cls != null ? K.cls : "—", icon: Gauge, color: "#0891b2" },
  ], [K]);

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const StatCard = ({ label, value, icon: Icon, color }) => (
    <div className={cn(cardCls, "p-3.5")}>
      <div className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-2" style={{ backgroundColor: `${color}1a` }}><Icon className="w-4 h-4" style={{ color }} /></div>
      <p className={cn("text-[18px] font-extrabold tracking-[-.02em]", txt)}>{value}</p>
      <p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{label}</p>
    </div>
  );

  const Bar = ({ rows, labelKey, valueKey, unit }) => {
    const list = rows || []; const max = Math.max(...list.map(r => Number(r[valueKey]) || 0), 1);
    return list.length === 0 ? <p className={cn("text-xs", sub)}>No data yet.</p> : (
      <div className="space-y-1.5">
        {list.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={cn("text-[11px] font-semibold w-40 truncate", txt)} title={r[labelKey]}>{r[labelKey] || "—"}</span>
            <div className={cn("flex-1 h-4 rounded-[5px] overflow-hidden", trackBg)}><div className="h-full rounded-[5px] bg-[#2563eb]" style={{ width: `${((Number(r[valueKey]) || 0) / max) * 100}%` }} /></div>
            <span className={cn("text-[11px] font-bold w-16 text-right", txt)}>{unit === "pct" ? pct(r[valueKey]) : num(r[valueKey])}</span>
          </div>
        ))}
      </div>
    );
  };

  const Loading = () => <div className="flex items-center gap-2 p-8 justify-center"><Loader2 className={cn("w-5 h-5 animate-spin", sub)} /><span className={cn("text-xs", sub)}>Loading…</span></div>;
  const Empty = ({ text }) => <div className={cn(cardCls, "p-10 text-center")}><Search className={cn("w-8 h-8 mx-auto mb-2", sub)} /><p className={cn("text-sm font-semibold", sub)}>{text}</p></div>;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Globe className="w-5 h-5 text-[#2563eb]" /> Search Console</h1>
          <p className={cn("text-xs mt-0.5 flex items-center gap-1.5 flex-wrap", sub)}>
            <span className={cn("w-2 h-2 rounded-full", connected ? "bg-emerald-500" : "bg-gray-400")} />
            {connected ? `Connected · ${settings.property_url || "no property"}` : "Not connected"}
            {settings.last_synced_at && ` · synced ${timeAgo(settings.last_synced_at)}`}
            <span className={cn("ml-1 px-1.5 py-0.5 rounded-[6px] text-[10px] font-bold", meta.hasGoogleCreds ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600")}>{meta.hasGoogleCreds ? "Google API active" : "First-party mode"}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={days} onChange={e => setDays(parseInt(e.target.value))} className={cn(inpCls, "w-auto h-10")}>
            {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={syncNow} disabled={busy === "sync"} className={btnPrimary}>{busy === "sync" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Synchronize Now</button>
        </div>
      </div>

      {/* TABS */}
      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("h-9 px-3 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === t.id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><t.icon className="w-3.5 h-3.5" /> {t.label}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">{kpis.map(k => <StatCard key={k.label} {...k} />)}</div>
          <div className={cn(cardCls, "p-4")}>
            <div className="flex items-center justify-between mb-3"><p className={cn("text-xs font-bold uppercase tracking-wider", sub)}>Clicks & Impressions ({days}d)</p>
              <div className="flex gap-3 text-[11px]"><span className="flex items-center gap-1.5" ><span className="w-3 h-[3px] bg-[#2563eb] rounded" />Clicks</span><span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-[#8b5cf6] rounded" />Impressions</span></div>
            </div>
            <PerfChart series={dash.series || []} dark={dark} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Average CTR & Position</p><PerfChart series={dash.series || []} dark={dark} mode="ctr" /></div>
            <div className={cn(cardCls, "overflow-hidden")}>
              <p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b", sub, brd)}>Sitemaps & Sync History</p>
              <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
                {(dash.sitemaps || []).length === 0 ? <p className={cn("p-4 text-xs", sub)}>No sitemap submitted yet — use the Sitemap tab.</p> :
                  dash.sitemaps.map((s, i) => <div key={i} className="px-4 py-2.5 flex items-center justify-between"><span className={cn("text-xs font-semibold truncate", txt)}>{s.sitemap_url}</span><span className={cn("text-[10px] px-2 py-0.5 rounded-full", s.status === "submitted" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600")}>{s.status}</span></div>)}
              </div>
            </div>
          </div>
          {!meta.hasGoogleCreds && <div className={cn("rounded-[12px] border p-3.5 flex gap-3", "border-amber-500/30 bg-amber-500/[.06]")}><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /><p className={cn("text-[12px] leading-relaxed", sub)}>Running in <b className={txt}>first-party mode</b>: metrics are derived from your own storefront + analytics. To pull live Google Search Console data (real clicks/impressions/positions from Google), set <code className="text-[11px]">GSC_SERVICE_ACCOUNT_JSON</code> or <code className="text-[11px]">GSC_REFRESH_TOKEN</code> on the server, then connect in the Connection tab.</p></div>}
        </div>
      )}

      {/* CONNECTION */}
      {tab === "connection" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={cn(cardCls, "p-5 space-y-4")}>
            <div className="flex items-center gap-2"><PlugZap className="w-4 h-4 text-[#2563eb]" /><p className={cn("text-sm font-extrabold", txt)}>Google Search Console Connection</p></div>
            <div><label className={labelCls}>Google Account</label><input value={settings.google_account || ""} onChange={e => setField("google_account", e.target.value)} className={inpCls} placeholder="you@gmail.com" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Property URL <span className="text-red-500">*</span></label><input value={settings.property_url || ""} onChange={e => setField("property_url", e.target.value)} className={inpCls} placeholder="https://atlantassneakers.com/" /></div>
              <div><label className={labelCls}>Property Type</label><select value={settings.property_type || "domain"} onChange={e => setField("property_type", e.target.value)} className={inpCls}><option value="domain">Domain</option><option value="url_prefix">URL prefix</option></select></div>
            </div>
            <div><label className={labelCls}>Google Client ID</label><input value={settings.google_client_id || ""} onChange={e => setField("google_client_id", e.target.value)} className={inpCls} placeholder="xxx.apps.googleusercontent.com" /></div>
            <div className={cn("rounded-[10px] border p-3", brd)}>
              <p className={cn("text-[11px] leading-relaxed", sub)}>Client Secret, Refresh Token, Access Token and Service Account credentials are read from server environment variables only — <b className={txt}>never stored in the database or browser</b>. Configure one of: <code>GSC_SERVICE_ACCOUNT_JSON</code>, or <code>GSC_REFRESH_TOKEN</code> + <code>GSC_CLIENT_ID</code> + <code>GSC_CLIENT_SECRET</code>.</p>
              <p className={cn("text-[11px] mt-1.5 font-semibold", meta.hasGoogleCreds ? "text-emerald-600" : "text-amber-600")}>Server credentials: {meta.hasGoogleCreds ? `configured (${meta.credType})` : "not configured"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => runAction(connected ? "reconnect" : "connect", { property_url: settings.property_url, property_type: settings.property_type, google_account: settings.google_account, google_client_id: settings.google_client_id }, connected ? "Reconnected" : "Connected")} disabled={busy === "connect" || busy === "reconnect" || !settings.property_url} className={btnPrimary}>{(busy === "connect" || busy === "reconnect") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} {connected ? "Reconnect" : "Connect Google"}</button>
              <button onClick={() => runAction("test", { property_url: settings.property_url })} disabled={busy === "test"} className={btnGhost}>{busy === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />} Test Connection</button>
              {connected && <button onClick={() => runAction("disconnect", {}, "Disconnected")} disabled={busy === "disconnect"} className="h-10 px-4 rounded-[11px] bg-red-500/10 text-red-500 text-sm font-bold hover:bg-red-500/20 flex items-center gap-2"><Power className="w-4 h-4" /> Disconnect</button>}
            </div>
            {testResult && <div className={cn("rounded-[10px] p-2.5 text-xs font-semibold", testResult.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>{testResult.message}</div>}
            {settings.last_error && <div className="rounded-[10px] p-2.5 text-xs font-semibold bg-red-500/10 text-red-600">Last error: {settings.last_error}</div>}
          </div>
          <div className={cn(cardCls, "p-5 space-y-3")}>
            <p className={cn("text-sm font-extrabold", txt)}>Status</p>
            {[["Connection", connected ? "Connected" : "Disconnected", connected], ["Property", settings.property_url || "Not set", !!settings.property_url], ["Verification", (settings.verification_status || "not_verified").replace(/_/g, " "), settings.verification_status === "verified"], ["Google API credentials", meta.hasGoogleCreds ? `Configured (${meta.credType})` : "Not configured", meta.hasGoogleCreds], ["Last sync", settings.last_synced_at ? fmtDT(settings.last_synced_at) : "Never", !!settings.last_synced_at]].map(([label, val, ok]) => (
              <div key={label} className="flex items-center gap-2.5">{ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}<div className="flex-1"><p className={cn("text-xs font-bold", txt)}>{label}</p><p className={cn("text-[11px] capitalize", sub)}>{val}</p></div></div>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!settings.auto_sync} onChange={e => setField("auto_sync", e.target.checked)} className="rounded" /><span className={cn("text-xs font-semibold", txt)}>Auto-sync</span></label>
              <input type="number" min={30} value={settings.sync_interval_minutes || 720} onChange={e => setField("sync_interval_minutes", parseInt(e.target.value) || 720)} className={cn(inpCls, "h-9")} placeholder="Interval (min)" />
            </div>
            <button onClick={saveSettings} disabled={saving} className={btnGhost}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Configuration</button>
          </div>
        </div>
      )}

      {/* VERIFICATION */}
      {tab === "verification" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={cn(cardCls, "p-5 space-y-4")}>
            <div className="flex items-center justify-between"><p className={cn("text-sm font-extrabold", txt)}>Site Verification</p>
              <span className={cn("text-[11px] px-2.5 py-1 rounded-full font-bold capitalize", (data.verification?.status || settings.verification_status) === "verified" ? "bg-emerald-500/15 text-emerald-600" : (data.verification?.status || settings.verification_status) === "pending" ? "bg-amber-500/15 text-amber-600" : "bg-gray-500/15 text-gray-500")}>{(data.verification?.status || settings.verification_status || "not_verified").replace(/_/g, " ")}</span>
            </div>
            <div><label className={labelCls}>Verification Method</label><select value={verifMethod} onChange={e => setVerifMethod(e.target.value)} className={inpCls}>{VERIF_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className={labelCls}>{verifMethod === "meta" ? "Meta content value" : verifMethod === "dns" ? "TXT record value" : "Verification token"}</label><input value={verifToken} onChange={e => setVerifToken(e.target.value)} className={inpCls} placeholder="google-site-verification=..." /></div>
            <button onClick={() => runAction("verify", { token: verifToken, method: verifMethod }, "Verification saved").then(() => loadTab("verification"))} disabled={busy === "verify"} className={btnPrimary}>{busy === "verify" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Save & Verify</button>
            {data.verification?.injected && <div className="rounded-[10px] p-2.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Meta tag injected into every page of the site.</div>}
          </div>
          <div className={cn(cardCls, "p-5 space-y-3")}>
            <p className={cn("text-sm font-extrabold", txt)}>Setup Instructions</p>
            {[
              ["HTML Meta Tag", "Paste the content value above. It is injected into <head> on every page automatically."],
              ["DNS Verification", "Add a TXT record to your domain DNS with the value above, then click Save & Verify."],
              ["Google Analytics", "Verify via your linked GA4 property (managed in the Analytics module)."],
              ["Google Tag Manager", "Verify via your GTM container (managed in SEO settings)."],
              ["HTML File Upload", "Upload the Google-provided HTML file to your site root, then Save & Verify."],
            ].map(([t, d]) => <div key={t} className={cn("rounded-[10px] border p-3", brd)}><p className={cn("text-xs font-bold", txt)}>{t}</p><p className={cn("text-[11px] mt-0.5 leading-relaxed", sub)}>{d}</p></div>)}
          </div>
        </div>
      )}

      {/* SITEMAP */}
      {tab === "sitemap" && (
        <div className="space-y-4">
          <div className={cn(cardCls, "p-5")}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button onClick={() => runAction("generate-sitemap", {}, (d) => `Generated · ${d.count} URLs`).then(() => loadTab("sitemap"))} disabled={busy === "generate-sitemap"} className={btnPrimary}>{busy === "generate-sitemap" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Generate Sitemap</button>
              <button onClick={() => runAction("submit-sitemap", { url: data.sitemap?.sitemapUrl }, (d) => d.message).then(() => loadTab("sitemap"))} disabled={busy === "submit-sitemap"} className={btnGhost}>{busy === "submit-sitemap" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit Sitemap</button>
              <button onClick={() => loadTab("sitemap")} className={btnGhost}><RefreshCw className="w-4 h-4" /> Refresh Status</button>
              <a href={data.sitemap?.sitemapUrl || "/sitemap.xml"} download className={btnGhost}><Download className="w-4 h-4" /> Download</a>
              <a href={data.sitemap?.sitemapUrl || "/sitemap.xml"} target="_blank" rel="noreferrer" className={btnGhost}><ExternalLink className="w-4 h-4" /> Preview</a>
            </div>
            <p className={cn("text-xs", sub)}>Live dynamic sitemap: <a href={data.sitemap?.sitemapUrl || "/sitemap.xml"} target="_blank" rel="noreferrer" className="text-[#2563eb] font-semibold">{data.sitemap?.sitemapUrl || "/sitemap.xml"}</a> · {num(data.sitemap?.generatedUrlCount)} URLs from products, categories, brands & static pages.</p>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Sitemap URL", "Status", "Last Submitted", "Last Read", "Indexed", "Pending"].map(h => <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
                {(data.sitemap?.sitemaps || []).length === 0 ? <tr><td colSpan={6} className={cn("px-4 py-8 text-center text-xs", sub)}>No sitemap submitted yet.</td></tr> :
                  data.sitemap.sitemaps.map((s, i) => <tr key={i}><td className={cn("px-4 py-3 font-semibold truncate max-w-[240px]", txt)}>{s.sitemap_url}</td><td className="px-4 py-3"><span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", s.status === "submitted" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600")}>{s.status}</span></td><td className={cn("px-4 py-3 text-xs", sub)}>{fmtDT(s.last_submitted)}</td><td className={cn("px-4 py-3 text-xs", sub)}>{fmtDT(s.last_read)}</td><td className={cn("px-4 py-3 font-bold", txt)}>{num(s.indexed_urls)}</td><td className={cn("px-4 py-3 font-bold", txt)}>{num(s.pending_urls || s.total_urls)}</td></tr>)}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {/* COVERAGE */}
      {tab === "coverage" && (tabLoading && !data.coverage ? <Loading /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[["Indexed", "indexed", "#16a34a"], ["Excluded", "excluded", "#8a929c"], ["Errors", "error", "#dc2626"], ["Valid w/ Warning", "valid_with_warning", "#ca8a04"], ["Discovered", "discovered", "#0891b2"], ["Crawled", "crawled", "#2563eb"], ["Soft 404", "soft_404", "#ea7317"], ["Blocked robots", "blocked_robots", "#8b5cf6"], ["Duplicate", "duplicate", "#db2777"], ["Canonical Issue", "canonical_issue", "#dc2626"]].map(([label, key, color]) => (
              <div key={key} className={cn(cardCls, "p-3.5")}><p className="text-[18px] font-extrabold" style={{ color }}>{num(data.coverage?.coverage?.[key])}</p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{label}</p></div>
            ))}
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Pages ({num(data.coverage?.total)})</p>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["URL", "Coverage", "Clicks", "Impressions", "Position"].map(h => <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
                {(data.coverage?.pages || []).slice(0, 200).map((pg, i) => <tr key={i}><td className={cn("px-4 py-2.5 truncate max-w-[280px]", txt)}>{pg.url}</td><td className="px-4 py-2.5"><span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold capitalize", pg.coverage_state === "indexed" ? "bg-emerald-500/15 text-emerald-600" : pg.coverage_state === "error" ? "bg-red-500/15 text-red-600" : "bg-gray-500/15 text-gray-500")}>{(pg.coverage_state || "unknown").replace(/_/g, " ")}</span></td><td className={cn("px-4 py-2.5", txt)}>{num(pg.clicks)}</td><td className={cn("px-4 py-2.5", txt)}>{num(pg.impressions)}</td><td className={cn("px-4 py-2.5", txt)}>{(Number(pg.position) || 0).toFixed(1)}</td></tr>)}
                {(data.coverage?.pages || []).length === 0 && <tr><td colSpan={5} className={cn("px-4 py-8 text-center text-xs", sub)}>No pages yet — run a sync.</td></tr>}
              </tbody>
            </table></div>
          </div>
        </div>
      ))}

      {/* URL INSPECTION */}
      {tab === "inspect" && (
        <div className="space-y-4">
          <div className={cn(cardCls, "p-5")}>
            <label className={labelCls}>Inspect a URL</label>
            <div className="flex gap-2">
              <input value={inspectUrl} onChange={e => setInspectUrl(e.target.value)} className={inpCls} placeholder="https://atlantassneakers.com/product/..." onKeyDown={e => e.key === "Enter" && inspectUrl && runAction("inspect", { url: inspectUrl })} />
              <button onClick={() => runAction("inspect", { url: inspectUrl })} disabled={busy === "inspect" || !inspectUrl} className={btnPrimary}>{busy === "inspect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />} Inspect URL</button>
            </div>
          </div>
          {inspectResult && (inspectResult.ok ? (
            <div className={cn(cardCls, "p-5 space-y-2.5")}>
              <div className="flex items-center gap-2"><span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", inspectResult.source === "google" ? "bg-emerald-500/15 text-emerald-600" : "bg-blue-500/15 text-blue-600")}>{inspectResult.source === "google" ? "Google Search Console" : "Live check"}</span></div>
              {[["Index Status", inspectResult.result.indexStatus], ["Canonical URL", inspectResult.result.canonical], ["Last Crawl", inspectResult.result.lastCrawl ? fmtDT(inspectResult.result.lastCrawl) : "—"], ["Mobile Friendly", inspectResult.result.mobile], ["Coverage", inspectResult.result.coverage], ["AMP", inspectResult.result.amp || "—"], ["Structured Data", (inspectResult.result.structuredData || []).join(", ") || "None detected"]].map(([l, v]) => (
                <div key={l} className={cn("flex justify-between gap-4 border-b pb-2", brd)}><span className={cn("text-xs font-semibold", sub)}>{l}</span><span className={cn("text-xs font-bold text-right truncate", txt)}>{v}</span></div>
              ))}
            </div>
          ) : <div className={cn(cardCls, "p-4 text-xs font-semibold text-red-600")}>{inspectResult.error}</div>)}
        </div>
      )}

      {/* PERFORMANCE */}
      {tab === "performance" && (tabLoading && !data.performance ? <Loading /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[["Total Clicks", num(data.performance?.totals?.clicks), "#2563eb"], ["Total Impressions", num(data.performance?.totals?.impressions), "#0891b2"], ["Average CTR", pct(data.performance?.totals?.ctr), "#ea7317"], ["Average Position", (Number(data.performance?.totals?.position) || 0).toFixed(1), "#8b5cf6"]].map(([l, v, c]) => (
              <div key={l} className={cn(cardCls, "p-4")}><p className="text-[19px] font-extrabold" style={{ color: c }}>{v}</p><p className={cn("text-xs mt-0.5", sub)}>{l}</p></div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button onClick={() => doExport("csv")} className={btnGhost}><Download className="w-4 h-4" /> CSV</button>
            <button onClick={() => doExport("excel")} className={btnGhost}><Download className="w-4 h-4" /> Excel</button>
            <button onClick={() => window.print()} className={btnGhost}><Download className="w-4 h-4" /> PDF</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Top Queries</p><Bar rows={(data.performance?.keywords || []).slice(0, 15)} labelKey="query" valueKey="clicks" /></div>
            <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Top Landing Pages</p><Bar rows={(data.performance?.landingPages || []).slice(0, 15)} labelKey="url" valueKey="impressions" /></div>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Keyword Performance</p>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Keyword", "Clicks", "Impressions", "CTR", "Position"].map(h => <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
                {(data.performance?.keywords || []).length === 0 ? <tr><td colSpan={5} className={cn("px-4 py-8 text-center text-xs", sub)}>No keyword data yet.</td></tr> :
                  data.performance.keywords.slice(0, 100).map((k, i) => <tr key={i}><td className={cn("px-4 py-2.5 font-semibold", txt)}>{k.query}</td><td className={cn("px-4 py-2.5", txt)}>{num(k.clicks)}</td><td className={cn("px-4 py-2.5", txt)}>{num(k.impressions)}</td><td className={cn("px-4 py-2.5", txt)}>{pct(k.ctr)}</td><td className={cn("px-4 py-2.5", txt)}>{(Number(k.position) || 0).toFixed(1)}</td></tr>)}
              </tbody>
            </table></div>
          </div>
        </div>
      ))}

      {/* CORE WEB VITALS */}
      {tab === "vitals" && (tabLoading && !data.vitals ? <Loading /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[["LCP", "lcp", "ms"], ["CLS", "cls", ""], ["INP", "inp", "ms"], ["FCP", "fcp", "ms"], ["TTFB", "ttfb", "ms"]].map(([label, key, unit]) => {
              const grade = data.vitals?.grades?.[key] || "no_data"; const val = data.vitals?.latest?.[key];
              return <div key={key} className={cn(cardCls, "p-4")}><div className="flex items-center justify-between mb-1"><p className={cn("text-xs font-bold", sub)}>{label}</p><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GRADE_COLOR[grade] }} /></div><p className={cn("text-[20px] font-extrabold", txt)}>{val != null ? `${val}${unit}` : "—"}</p><p className="text-[11px] font-semibold mt-0.5" style={{ color: GRADE_COLOR[grade] }}>{GRADE_LABEL[grade]}</p></div>;
            })}
          </div>
          {(!data.vitals?.latest || data.vitals?.latest?.lcp == null) && <div className={cn("rounded-[12px] border p-3.5 flex gap-3 border-amber-500/30 bg-amber-500/[.06]")}><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /><p className={cn("text-[12px] leading-relaxed", sub)}>Core Web Vitals field data is populated when Google API is connected (CrUX/Search Console) or when you feed real-user measurements into <code>search_console_reports</code>. Thresholds: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 are graded <b className="text-emerald-600">Good</b>.</p></div>}
        </div>
      ))}

      {/* MOBILE */}
      {tab === "mobile" && (tabLoading && !data.mobile ? <Loading /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[["Mobile Friendly", data.mobile?.mobileFriendly, "#16a34a"], ["Not Friendly", data.mobile?.notFriendly?.length, "#dc2626"], ["Responsive Issues", data.mobile?.issues?.responsive, "#ea7317"], ["Clickable Elements", data.mobile?.issues?.clickable_elements, "#ca8a04"], ["Viewport Issues", data.mobile?.issues?.viewport, "#8b5cf6"], ["Text Too Small", data.mobile?.issues?.text_too_small, "#db2777"]].map(([l, v, c]) => (
              <div key={l} className={cn(cardCls, "p-4")}><p className="text-[19px] font-extrabold" style={{ color: c }}>{num(v)}</p><p className={cn("text-xs mt-0.5", sub)}>{l}</p></div>
            ))}
          </div>
          {(data.mobile?.notFriendly || []).length > 0 && <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-2", sub)}>Pages needing review</p><div className="space-y-1">{data.mobile.notFriendly.map((u, i) => <p key={i} className={cn("text-xs truncate", txt)}>{u}</p>)}</div></div>}
        </div>
      ))}

      {/* STRUCTURED DATA */}
      {tab === "structured" && (tabLoading && !data.structured ? <Loading /> : (
        <div className={cn(cardCls, "overflow-hidden")}>
          <p className={cn("px-4 py-3 text-sm font-extrabold border-b flex items-center gap-2", txt, brd)}><Boxes className="w-4 h-4 text-[#2563eb]" /> Schema.org Coverage</p>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className={cn("border-b text-left", brd, sub)}>{["Type", "Items", "Status"].map(h => <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {(data.structured?.types || []).map((t, i) => <tr key={i}><td className={cn("px-4 py-2.5 font-semibold", txt)}>{t.type}</td><td className={cn("px-4 py-2.5", txt)}>{num(t.items)}</td><td className="px-4 py-2.5"><span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold", t.status === "valid" ? "bg-emerald-500/15 text-emerald-600" : "bg-gray-500/15 text-gray-500")}>{t.status === "valid" ? "Valid" : "Not used"}</span></td></tr>)}
            </tbody>
          </table></div>
          {(data.structured?.errors || []).length === 0 && <p className={cn("px-4 py-3 text-xs", sub)}>No structured-data errors detected. Product, Organization, Breadcrumb, Website, Collection & Brand schema are emitted across the storefront.</p>}
        </div>
      ))}

      {/* CRAWL ERRORS */}
      {tab === "errors" && (tabLoading && !data.errors ? <Loading /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[["404 Errors", "404", "#dc2626"], ["500 Errors", "500", "#dc2626"], ["Redirect Errors", "redirect", "#ea7317"], ["Blocked URLs", "blocked", "#8b5cf6"], ["DNS Errors", "dns", "#ca8a04"], ["Robots Errors", "robots", "#0891b2"], ["Security Issues", "security", "#dc2626"]].map(([l, key, c]) => (
              <div key={key} className={cn(cardCls, "p-4")}><p className="text-[19px] font-extrabold" style={{ color: c }}>{num(data.errors?.counts?.[key])}</p><p className={cn("text-xs mt-0.5", sub)}>{l}</p></div>
            ))}
          </div>
          {["404", "blocked", "redirect"].map(kind => (data.errors?.details?.[kind] || []).length > 0 && (
            <div key={kind} className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-2", sub)}>{kind} pages</p><div className="space-y-1">{data.errors.details[kind].map((u, i) => <p key={i} className={cn("text-xs truncate", txt)}>{u}</p>)}</div></div>
          ))}
          {Object.values(data.errors?.counts || {}).every(v => !v) && <div className={cn(cardCls, "p-8 text-center")}><CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" /><p className={cn("text-sm font-semibold", txt)}>No crawl errors detected.</p></div>}
        </div>
      ))}

      {/* SECURITY */}
      {tab === "security" && (tabLoading && !data.security ? <Loading /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[["HTTPS Status", data.security?.https ? "Secure (HTTPS)" : "Not secure", data.security?.https], ["Safe Browsing", (data.security?.safeBrowsing || "no_issues").replace(/_/g, " "), data.security?.safeBrowsing === "no_issues"], ["Malware", data.security?.malware || "clean", data.security?.malware === "clean"], ["Spam", data.security?.spam || "clean", data.security?.spam === "clean"], ["Manual Actions", (data.security?.manualActions || []).length === 0 ? "None" : `${data.security.manualActions.length} action(s)`, (data.security?.manualActions || []).length === 0]].map(([l, v, ok]) => (
            <div key={l} className={cn(cardCls, "p-4 flex items-center gap-3")}>{ok ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <AlertTriangle className="w-6 h-6 text-red-500" />}<div><p className={cn("text-sm font-extrabold capitalize", txt)}>{v}</p><p className={cn("text-xs", sub)}>{l}</p></div></div>
          ))}
        </div>
      ))}

      {/* AUDIT */}
      {tab === "audit" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Audit Log</p>
          {(data.audit?.audit || []).length === 0 ? <p className={cn("p-8 text-center text-xs", sub)}>No activity yet.</p> : (
            <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {data.audit.audit.map(a => <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 min-w-0"><span className={cn("w-1.5 h-1.5 rounded-full shrink-0", a.status === "error" ? "bg-red-500" : "bg-emerald-500")} /><span className={cn("text-xs font-semibold capitalize truncate", txt)}>{(a.action || "").replace(/[._:]/g, " ")}</span>{a.detail && <span className={cn("text-[10px] truncate", sub)}>· {a.detail}</span>}</div><span className={cn("text-[10px] shrink-0", sub)}>{a.actor_name} · {a.ip_address || "—"} · {fmtDT(a.created_at)}</span></div>)}
            </div>
          )}
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.message}</div>}
    </div>
  );
}

function PerfChart({ series, dark, mode = "clicks" }) {
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  if (!series || !series.length) return <p className={cn("text-xs py-8 text-center", sub)}>No data yet — run a sync.</p>;
  const w = 720, h = 170, pad = 10;
  const primaryKey = mode === "ctr" ? "ctr" : "clicks";
  const secondaryKey = mode === "ctr" ? "position" : "impressions";
  const maxP = Math.max(...series.map(s => Number(s[primaryKey]) || 0), 1);
  const maxS = Math.max(...series.map(s => Number(s[secondaryKey]) || 0), 1);
  const x = (i) => pad + (i / Math.max(series.length - 1, 1)) * (w - pad * 2);
  const yP = (v) => h - pad - ((Number(v) || 0) / maxP) * (h - pad * 2);
  const yS = (v) => h - pad - ((Number(v) || 0) / maxS) * (h - pad * 2);
  const pPath = series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i)},${yP(s[primaryKey])}`).join(" ");
  const sPath = series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i)},${yS(s[secondaryKey])}`).join(" ");
  const area = `${pPath} L${x(series.length - 1)},${h - pad} L${x(0)},${h - pad} Z`;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ minWidth: 520 }}>
        <defs><linearGradient id={`g-${mode}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill={`url(#g-${mode})`} />
        <path d={sPath} fill="none" stroke="#8b5cf6" strokeWidth="2" opacity="0.55" />
        <path d={pPath} fill="none" stroke="#2563eb" strokeWidth="2.5" />
        {series.map((s, i) => <circle key={i} cx={x(i)} cy={yP(s[primaryKey])} r="2.5" fill="#2563eb" />)}
      </svg>
    </div>
  );
}
