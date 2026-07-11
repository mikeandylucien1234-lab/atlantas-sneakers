// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart3, RefreshCw, Loader2, Save, Users, Eye, MousePointerClick,
  TrendingUp, DollarSign, ShoppingCart, Activity, Radio, Globe, Share2,
  Plug, CheckCircle2, XCircle, PlugZap, Power, History, Clock, Percent,
  UserPlus, Repeat, Zap, Download, Wifi,
} from "lucide-react";

type Props = { dark: boolean };

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "connection", label: "Connection", icon: Plug },
  { id: "tracking", label: "Tracking", icon: Activity },
  { id: "realtime", label: "Real Time", icon: Radio },
  { id: "audience", label: "Audience", icon: Users },
  { id: "traffic", label: "Traffic", icon: Share2 },
  { id: "sales", label: "Sales", icon: DollarSign },
  { id: "audit", label: "Audit Log", icon: History },
];

const TRACKING_OPTIONS = [
  ["page_views", "Page Views"], ["scroll", "Scroll Tracking"], ["outbound_links", "Outbound Links"], ["downloads", "Downloads"],
  ["search", "Search Tracking"], ["video", "Video Tracking"], ["button_clicks", "Button Clicks"], ["form_submissions", "Form Submissions"],
  ["checkout", "Checkout Tracking"], ["purchase", "Purchase Tracking"], ["refund", "Refund Tracking"], ["login", "Login Tracking"],
  ["signup", "Signup Tracking"], ["newsletter", "Newsletter Tracking"], ["wishlist", "Wishlist Tracking"], ["add_to_cart", "Add To Cart"],
  ["remove_from_cart", "Remove From Cart"], ["product_view", "Product View"], ["category_view", "Category View"], ["search_event", "Search Event"],
  ["coupon", "Coupon Usage"], ["payment_method", "Payment Method Selection"], ["shipping", "Shipping Selection"],
];

const PIE_COLORS = ["#2563eb", "#16a34a", "#ea7317", "#8b5cf6", "#0891b2", "#dc2626", "#ca8a04", "#db2777"];

function money(n) { return `$${(Number(n) || 0).toFixed(2)}`; }
function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return ""; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; return `${Math.floor(s / 3600)}h ago`; }

export function AdminAnalytics({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");
  const labelCls = cn("text-[12px] font-semibold mb-1.5 block", txt);
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnGhost = cn("h-10 px-4 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2", brd, txt, hover);
  const trackBg = dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]";

  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ tracking: {} });
  const [dash, setDash] = useState(null);
  const [realtime, setRealtime] = useState(null);
  const [audience, setAudience] = useState(null);
  const [traffic, setTraffic] = useState(null);
  const [sales, setSales] = useState(null);
  const [audit, setAudit] = useState([]);
  const [days, setDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); }, []);
  const setField = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const loadSettings = useCallback(async () => {
    const r = await fetch("/api/admin/analytics?section=settings");
    if (r.ok) { const d = await r.json(); setSettings({ tracking: {}, ...(d.settings || {}) }); }
  }, []);
  const loadDash = useCallback(async () => { const r = await fetch(`/api/admin/analytics?section=dashboard&days=${days}`); if (r.ok) setDash(await r.json()); }, [days]);

  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadSettings(), loadDash()]); setLoading(false); })(); }, [loadSettings, loadDash]);

  // Tab-specific loaders
  useEffect(() => {
    if (tab === "realtime") { const f = () => fetch("/api/admin/analytics?section=realtime").then(r => r.ok ? r.json() : null).then(d => d && setRealtime(d)); f(); const iv = setInterval(f, 10000); return () => clearInterval(iv); }
    if (tab === "audience") fetch(`/api/admin/analytics?section=audience&days=${days}`).then(r => r.ok ? r.json() : null).then(d => d && setAudience(d));
    if (tab === "traffic") fetch(`/api/admin/analytics?section=traffic&days=${days}`).then(r => r.ok ? r.json() : null).then(d => d && setTraffic(d));
    if (tab === "sales") fetch(`/api/admin/analytics?section=sales&days=${days}`).then(r => r.ok ? r.json() : null).then(d => d && setSales(d));
    if (tab === "audit") fetch("/api/admin/analytics?section=audit").then(r => r.ok ? r.json() : null).then(d => d && setAudit(d.audit || []));
  }, [tab, days]);

  const saveSettings = async (keys) => {
    setSaving(true);
    try {
      const payload = {}; keys.forEach(k => { payload[k] = settings[k] ?? null; });
      const res = await fetch("/api/admin/analytics", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const supabase = createClient(); const { error } = await supabase.from("google_analytics_settings").upsert({ id: "global", ...payload, updated_at: new Date().toISOString() }, { onConflict: "id" }); if (error) throw new Error(error.message); }
      showToast("Saved");
    } catch (e) { showToast(e.message || "Save failed", "error"); } finally { setSaving(false); }
  };

  const runAction = async (action, extra = {}) => {
    setBusy(action);
    try {
      const res = await fetch("/api/admin/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const d = await res.json();
      if (action === "test") { setTestResult(d); return; }
      if (!res.ok || d.error) throw new Error(d.error || "Action failed");
      showToast(action === "connect" ? "Connected" : action === "disconnect" ? "Disconnected" : "Synchronized");
      loadSettings();
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };

  const toggleTracking = (key) => {
    const next = { ...(settings.tracking || {}), [key]: !settings.tracking?.[key] };
    setField("tracking", next);
  };

  const connected = settings.connection_status === "connected";

  const kpis = useMemo(() => dash ? [
    { label: "Users Today", value: dash.usersToday, icon: Users, color: "#2563eb" },
    { label: "Users This Week", value: dash.usersWeek, icon: Users, color: "#0891b2" },
    { label: "Users This Month", value: dash.usersMonth, icon: Users, color: "#8b5cf6" },
    { label: "Sessions", value: dash.sessions, icon: Activity, color: "#16a34a" },
    { label: "Page Views", value: dash.pageViews, icon: Eye, color: "#2563eb" },
    { label: "Bounce Rate", value: `${dash.bounceRate}%`, icon: MousePointerClick, color: "#ea7317" },
    { label: "Engagement Rate", value: `${dash.engagementRate}%`, icon: Zap, color: "#16a34a" },
    { label: "New Visitors", value: dash.newVisitors, icon: UserPlus, color: "#0891b2" },
    { label: "Returning", value: dash.returningVisitors, icon: Repeat, color: "#8b5cf6" },
    { label: "Revenue", value: money(dash.revenue), icon: DollarSign, color: "#16a34a" },
    { label: "Conversion Rate", value: `${dash.conversionRate}%`, icon: Percent, color: "#ea7317" },
    { label: "Orders", value: dash.orders, icon: ShoppingCart, color: "#2563eb" },
    { label: "Avg Order Value", value: money(dash.avgOrderValue), icon: TrendingUp, color: "#0891b2" },
  ] : [], [dash]);

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const List = ({ title, rows, unit }) => (
    <div className={cn(cardCls, "p-4")}>
      <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>{title}</p>
      {(!rows || rows.length === 0) ? <p className={cn("text-xs", sub)}>No data yet.</p> : (
        <div className="space-y-1.5">
          {rows.map((r, i) => { const max = Math.max(...rows.map(x => x.count ?? x.value), 1); const v = r.count ?? r.value; return (
            <div key={i} className="flex items-center gap-2">
              <span className={cn("text-[11px] font-semibold w-28 truncate capitalize", txt)}>{r.label || "—"}</span>
              <div className={cn("flex-1 h-4 rounded-[5px] overflow-hidden", trackBg)}><div className="h-full rounded-[5px] bg-[#2563eb]" style={{ width: `${(v / max) * 100}%` }} /></div>
              <span className={cn("text-[11px] font-bold w-16 text-right", txt)}>{unit === "money" ? money(v) : v}</span>
            </div>
          ); })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em]", txt)}>Google Analytics</h1>
          <p className={cn("text-xs mt-0.5 flex items-center gap-1.5", sub)}>
            <span className={cn("w-2 h-2 rounded-full", connected ? "bg-emerald-500" : "bg-gray-400")} />
            {connected ? `Connected · ${settings.measurement_id}` : "Not connected"} {settings.last_synced_at && `· synced ${timeAgo(settings.last_synced_at)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={days} onChange={e => setDays(parseInt(e.target.value))} className={cn(inpCls, "w-auto h-10")}>
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
          </select>
          <button onClick={() => runAction("sync")} disabled={busy === "sync"} className="h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] flex items-center gap-2 disabled:opacity-50">{busy === "sync" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Synchronize Now</button>
        </div>
      </div>

      {/* TABS */}
      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === t.id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><t.icon className="w-3.5 h-3.5" /> {t.label}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {kpis.map(k => (
              <div key={k.label} className={cn(cardCls, "p-3.5")}>
                <div className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-2" style={{ backgroundColor: `${k.color}1a` }}><k.icon className="w-4 h-4" style={{ color: k.color }} /></div>
                <p className={cn("text-[18px] font-extrabold tracking-[-.02em]", txt)}>{k.value}</p>
                <p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p>
              </div>
            ))}
          </div>
          {/* Revenue line chart */}
          <div className={cn(cardCls, "p-4")}>
            <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Revenue & Page Views ({days}d)</p>
            <LineChart series={dash.series || []} dark={dark} />
          </div>
        </div>
      )}

      {/* CONNECTION */}
      {tab === "connection" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={cn(cardCls, "p-5 space-y-4")}>
            <div className="flex items-center gap-2"><PlugZap className="w-4 h-4 text-[#2563eb]" /><p className={cn("text-sm font-extrabold", txt)}>Google Analytics 4 Connection</p></div>
            <div><label className={labelCls}>Measurement ID <span className="text-red-500">*</span></label><input value={settings.measurement_id || ""} onChange={e => setField("measurement_id", e.target.value)} className={inpCls} placeholder="G-XXXXXXXXXX" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Property ID</label><input value={settings.property_id || ""} onChange={e => setField("property_id", e.target.value)} className={inpCls} placeholder="123456789" /></div>
              <div><label className={labelCls}>Data Stream ID</label><input value={settings.data_stream_id || ""} onChange={e => setField("data_stream_id", e.target.value)} className={inpCls} placeholder="1234567890" /></div>
            </div>
            <div><label className={labelCls}>Google Client ID</label><input value={settings.google_client_id || ""} onChange={e => setField("google_client_id", e.target.value)} className={inpCls} placeholder="xxx.apps.googleusercontent.com" /></div>
            <p className={cn("text-[11px]", sub)}>Client Secret and service-account credentials are read from server environment variables (GA_CLIENT_SECRET, GA_SERVICE_ACCOUNT_JSON) — never stored here.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => runAction("connect", { measurement_id: settings.measurement_id, property_id: settings.property_id, data_stream_id: settings.data_stream_id, google_client_id: settings.google_client_id })} disabled={busy === "connect"} className="h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">{busy === "connect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} {connected ? "Reconnect" : "Connect Google Account"}</button>
              <button onClick={() => runAction("test", { measurement_id: settings.measurement_id })} disabled={busy === "test"} className={btnGhost}>{busy === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />} Test Connection</button>
              {connected && <button onClick={() => runAction("disconnect")} disabled={busy === "disconnect"} className="h-10 px-4 rounded-[11px] bg-red-500/10 text-red-500 text-sm font-bold hover:bg-red-500/20 flex items-center gap-2"><Power className="w-4 h-4" /> Disconnect</button>}
            </div>
            {testResult && <div className={cn("rounded-[10px] p-2.5 text-xs font-semibold", testResult.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>{testResult.message}</div>}
          </div>
          <div className={cn(cardCls, "p-5 space-y-3")}>
            <p className={cn("text-sm font-extrabold", txt)}>Status</p>
            {[["Connection", connected ? "Connected" : "Disconnected", connected], ["Measurement ID", settings.measurement_id || "Not set", !!settings.measurement_id], ["GA4 tag injected", "On every page", true], ["First-party tracking", "Active", true], ["Last sync", settings.last_synced_at ? fmtDT(settings.last_synced_at) : "Never", !!settings.last_synced_at]].map(([label, val, ok]) => (
              <div key={label} className="flex items-center gap-2.5">{ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}<div className="flex-1"><p className={cn("text-xs font-bold", txt)}>{label}</p><p className={cn("text-[11px]", sub)}>{val}</p></div></div>
            ))}
            <div className={cn("rounded-[10px] border p-3 mt-2", brd)}>
              <p className={cn("text-[11px] leading-relaxed", sub)}>Once connected, the GA4 tag fires on every page (managed via SEO settings). First-party events also record into your own database, powering the Realtime, Audience, Traffic and Sales reports here — no Google Data API round-trip needed.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!settings.auto_sync} onChange={e => setField("auto_sync", e.target.checked)} className="rounded" /><span className={cn("text-xs font-semibold", txt)}>Auto-sync</span></label>
              <div><input type="number" min={5} value={settings.sync_interval_minutes || 60} onChange={e => setField("sync_interval_minutes", parseInt(e.target.value) || 60)} className={cn(inpCls, "h-9")} placeholder="Interval (min)" /></div>
            </div>
            <button onClick={() => saveSettings(["property_id", "data_stream_id", "google_client_id", "auto_sync", "sync_interval_minutes"])} disabled={saving} className={btnGhost}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Configuration</button>
          </div>
        </div>
      )}

      {/* TRACKING */}
      {tab === "tracking" && (
        <div className={cn(cardCls, "p-5")}>
          <p className={cn("text-sm font-extrabold mb-1", txt)}>Tracking Settings</p>
          <p className={cn("text-xs mb-4", sub)}>Enable the events sent to GA4 and recorded first-party. Ecommerce events (add-to-cart, checkout, purchase) fire automatically from the storefront when enabled.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {TRACKING_OPTIONS.map(([key, label]) => (
              <label key={key} className={cn("flex items-center justify-between rounded-[10px] border p-3 cursor-pointer", brd, hover)}>
                <span className={cn("text-[13px] font-semibold", txt)}>{label}</span>
                <button type="button" onClick={() => toggleTracking(key)} className={cn("w-10 h-5 rounded-full transition-colors relative shrink-0", settings.tracking?.[key] ? "bg-emerald-500" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}><span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform", settings.tracking?.[key] ? "translate-x-[22px]" : "translate-x-0.5")} /></button>
              </label>
            ))}
          </div>
          <button onClick={() => saveSettings(["tracking"])} disabled={saving} className="mt-4 h-10 px-5 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Tracking Settings</button>
        </div>
      )}

      {/* REALTIME */}
      {tab === "realtime" && (
        <div className="space-y-4">
          <div className={cn(cardCls, "p-5 flex items-center gap-4")}>
            <div className="relative"><Wifi className="w-8 h-8 text-emerald-500" /><span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping" /></div>
            <div><p className={cn("text-3xl font-extrabold", txt)}>{realtime?.activeUsers ?? 0}</p><p className={cn("text-xs", sub)}>Active users in the last 30 minutes · auto-refreshing</p></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <List title="Active Pages" rows={realtime?.topPages} />
            <List title="Countries" rows={realtime?.countries} />
            <List title="Devices" rows={realtime?.devices} />
            <List title="Traffic Sources" rows={realtime?.sources} />
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b", sub, brd)}>Live Event Stream</p>
            <div className={cn("divide-y max-h-72 overflow-y-auto", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {(realtime?.recent || []).length === 0 ? <p className={cn("p-4 text-xs", sub)}>No events in the last 30 minutes.</p> :
                realtime.recent.map((e, i) => <div key={i} className="px-4 py-2 flex items-center gap-2 text-xs"><span className={cn("font-mono font-semibold", txt)}>{e.event}</span><span className={sub}>{e.path}</span><span className={cn("ml-auto", sub)}>{e.device} · {e.country || "—"} · {timeAgo(e.at)}</span></div>)}
            </div>
          </div>
        </div>
      )}

      {/* AUDIENCE */}
      {tab === "audience" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <List title="Countries" rows={audience?.countries} />
          <List title="Cities" rows={audience?.cities} />
          <PieCard title="Devices" rows={audience?.devices} dark={dark} txt={txt} sub={sub} />
          <PieCard title="Browsers" rows={audience?.browsers} dark={dark} txt={txt} sub={sub} />
          <List title="Operating Systems" rows={audience?.os} />
        </div>
      )}

      {/* TRAFFIC */}
      {tab === "traffic" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PieCard title="Traffic Sources" rows={traffic?.sources} dark={dark} txt={txt} sub={sub} />
          <List title="Top Referrers" rows={traffic?.referrers} />
        </div>
      )}

      {/* SALES */}
      {tab === "sales" && sales && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className={cn(cardCls, "p-4")}><p className={cn("text-[19px] font-extrabold", txt)}>{money(sales.revenue)}</p><p className={cn("text-xs", sub)}>Revenue ({days}d)</p></div>
            <div className={cn(cardCls, "p-4")}><p className={cn("text-[19px] font-extrabold", txt)}>{sales.unitsSold}</p><p className={cn("text-xs", sub)}>Units Sold</p></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <List title="Top Products" rows={sales.topProducts} unit="money" />
            <List title="Top Categories" rows={sales.topCategories} unit="money" />
            <List title="Top Brands" rows={sales.topBrands} unit="money" />
          </div>
        </div>
      )}

      {/* AUDIT */}
      {tab === "audit" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Audit Log</p>
          {audit.length === 0 ? <p className={cn("p-8 text-center text-xs", sub)}>No activity yet.</p> : (
            <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {audit.map(a => <div key={a.id} className="px-4 py-3 flex items-center justify-between"><span className={cn("text-xs font-semibold capitalize", txt)}>{a.action.replace(/[._]/g, " ")}</span><span className={cn("text-[10px]", sub)}>{a.actor_name} · {fmtDT(a.created_at)}</span></div>)}
            </div>
          )}
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.message}</div>}
    </div>
  );
}

function LineChart({ series, dark }) {
  if (!series.length) return <p className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No data yet.</p>;
  const w = 700, h = 160, pad = 8;
  const maxRev = Math.max(...series.map(s => s.revenue), 1);
  const maxViews = Math.max(...series.map(s => s.views), 1);
  const x = (i) => pad + (i / Math.max(series.length - 1, 1)) * (w - pad * 2);
  const yR = (v) => h - pad - (v / maxRev) * (h - pad * 2);
  const yV = (v) => h - pad - (v / maxViews) * (h - pad * 2);
  const revPath = series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i)},${yR(s.revenue)}`).join(" ");
  const viewPath = series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i)},${yV(s.views)}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ minWidth: 500 }}>
        <path d={viewPath} fill="none" stroke="#8b5cf6" strokeWidth="2" opacity="0.5" />
        <path d={revPath} fill="none" stroke="#16a34a" strokeWidth="2.5" />
        {series.map((s, i) => <circle key={i} cx={x(i)} cy={yR(s.revenue)} r="2.5" fill="#16a34a" />)}
      </svg>
      <div className="flex items-center gap-4 mt-2 text-[11px]">
        <span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-[#16a34a] rounded" /> Revenue</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-[#8b5cf6] rounded" /> Page Views</span>
      </div>
    </div>
  );
}

function PieCard({ title, rows, dark, txt, sub }) {
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const data = rows || [];
  const total = data.reduce((s, r) => s + (r.count ?? r.value), 0) || 1;
  let acc = 0;
  const segments = data.map((r, i) => { const v = r.count ?? r.value; const start = acc / total; acc += v; const end = acc / total; return { ...r, start, end, color: PIE_COLORS[i % PIE_COLORS.length], pct: Math.round((v / total) * 100) }; });
  const arc = (start, end) => { const a0 = start * 2 * Math.PI - Math.PI / 2, a1 = end * 2 * Math.PI - Math.PI / 2; const x0 = 50 + 40 * Math.cos(a0), y0 = 50 + 40 * Math.sin(a0), x1 = 50 + 40 * Math.cos(a1), y1 = 50 + 40 * Math.sin(a1); return `M50,50 L${x0},${y0} A40,40 0 ${end - start > 0.5 ? 1 : 0},1 ${x1},${y1} Z`; };
  return (
    <div className={cn("rounded-[16px] border p-4", p, brd)}>
      <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>{title}</p>
      {data.length === 0 ? <p className={cn("text-xs", sub)}>No data yet.</p> : (
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0">{segments.map((s, i) => <path key={i} d={arc(s.start, s.end)} fill={s.color} />)}</svg>
          <div className="flex-1 space-y-1">
            {segments.map((s, i) => <div key={i} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} /><span className={cn("text-xs font-semibold flex-1 truncate capitalize", txt)}>{s.label}</span><span className={cn("text-xs font-bold", txt)}>{s.pct}%</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
