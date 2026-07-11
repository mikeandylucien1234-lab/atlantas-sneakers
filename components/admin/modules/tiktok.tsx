// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Music2, RefreshCw, Loader2, Save, Plug, PlugZap, Power, CheckCircle2,
  XCircle, Radio, Package, ShoppingBag, DollarSign, Activity, Zap,
  Store, Webhook, FileText, History, Copy, AlertTriangle, TrendingUp,
  Boxes, Megaphone,
} from "lucide-react";

type Props = { dark: boolean };

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "connection", label: "Connection", icon: Plug },
  { id: "pixel", label: "Pixel", icon: Zap },
  { id: "shop", label: "TikTok Shop", icon: Store },
  { id: "products", label: "Product Mapping", icon: Package },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "events", label: "Events", icon: Radio },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "logs", label: "Logs", icon: FileText },
];

const PIXEL_EVENTS = [
  ["page_view", "Page View"], ["view_content", "View Content"], ["search", "Search"], ["add_to_wishlist", "Add To Wishlist"],
  ["add_to_cart", "Add To Cart"], ["remove_from_cart", "Remove From Cart"], ["initiate_checkout", "Initiate Checkout"],
  ["add_payment_info", "Add Payment Info"], ["purchase", "Purchase"], ["complete_registration", "Complete Registration"],
  ["login", "Login"], ["contact", "Contact"], ["newsletter", "Newsletter"], ["lead", "Lead"], ["custom", "Custom Events"],
];

const SYNC_STATUS = {
  synced: { label: "Synced", cls: "bg-emerald-500/10 text-emerald-600" },
  pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-600" },
  rejected: { label: "Rejected", cls: "bg-red-500/10 text-red-600" },
  unmapped: { label: "Unmapped", cls: "bg-gray-500/10 text-gray-500" },
  error: { label: "Error", cls: "bg-red-500/10 text-red-600" },
};

function money(n) { return `$${(Number(n) || 0).toFixed(2)}`; }
function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return "never"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

export function AdminTikTok({ dark }: Props) {
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
  const [settings, setSettings] = useState({ pixel_events: {} });
  const [dash, setDash] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState(null);
  const [webhooks, setWebhooks] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logType, setLogType] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((m, type = "success") => { setToast({ message: m, type }); setTimeout(() => setToast(null), 3000); }, []);
  const setField = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const loadSettings = useCallback(async () => { const r = await fetch("/api/admin/tiktok?section=settings"); if (r.ok) { const d = await r.json(); setSettings({ pixel_events: {}, ...(d.settings || {}) }); } }, []);
  const loadDash = useCallback(async () => { const r = await fetch("/api/admin/tiktok?section=dashboard"); if (r.ok) setDash(await r.json()); }, []);
  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadSettings(), loadDash()]); setLoading(false); })(); }, [loadSettings, loadDash]);

  useEffect(() => {
    if (tab === "products") fetch("/api/admin/tiktok?section=products").then(r => r.ok ? r.json() : null).then(d => d && setProducts(d.products || []));
    if (tab === "orders") fetch("/api/admin/tiktok?section=orders").then(r => r.ok ? r.json() : null).then(d => d && setOrders(d.orders || []));
    if (tab === "events") fetch("/api/admin/tiktok?section=events").then(r => r.ok ? r.json() : null).then(d => d && setEvents(d));
    if (tab === "webhooks") fetch("/api/admin/tiktok?section=webhooks").then(r => r.ok ? r.json() : null).then(d => d && setWebhooks(d));
    if (tab === "logs") fetch(`/api/admin/tiktok?section=logs${logType ? `&type=${logType}` : ""}`).then(r => r.ok ? r.json() : null).then(d => d && setLogs(d.logs || []));
  }, [tab, logType]);

  const saveSettings = async (keys) => {
    setSaving(true);
    try {
      const payload = {}; keys.forEach(k => { payload[k] = settings[k] ?? null; });
      const res = await fetch("/api/admin/tiktok", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const supabase = createClient(); const { error } = await supabase.from("tiktok_settings").upsert({ id: "global", ...payload, updated_at: new Date().toISOString() }, { onConflict: "id" }); if (error) throw new Error(error.message); }
      showToast("Saved");
    } catch (e) { showToast(e.message || "Save failed", "error"); } finally { setSaving(false); }
  };

  const runAction = async (action, extra = {}) => {
    setBusy(action);
    try {
      const res = await fetch("/api/admin/tiktok", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const d = await res.json();
      if (action === "test") { setTestResult(d); return; }
      if (!res.ok || d.error) throw new Error(d.error || "Action failed");
      showToast(action === "connect" ? "Connected" : action === "disconnect" ? "Disconnected" : action === "test_webhook" ? "Test webhook sent" : `Synced ${d.synced ?? ""} product(s)`);
      loadSettings(); loadDash();
      if (tab === "products") fetch("/api/admin/tiktok?section=products").then(r => r.ok ? r.json() : null).then(x => x && setProducts(x.products || []));
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };

  const togglePixel = (key) => setField("pixel_events", { ...(settings.pixel_events || {}), [key]: !settings.pixel_events?.[key] });
  const connected = settings.connection_status === "connected";

  const kpis = useMemo(() => dash ? [
    { label: "Connection", value: dash.connectionStatus === "connected" ? "Connected" : "Offline", icon: Plug, color: dash.connectionStatus === "connected" ? "#16a34a" : "#8a929c" },
    { label: "Pixel", value: dash.pixelInstalled ? "Installed" : "Missing", icon: Zap, color: dash.pixelInstalled ? "#16a34a" : "#dc2626" },
    { label: "Active Events", value: dash.activeEvents, icon: Radio, color: "#2563eb" },
    { label: "Events Received", value: dash.eventsReceived, icon: Activity, color: "#8b5cf6" },
    { label: "Products Synced", value: dash.productsSynced, icon: Package, color: "#16a34a" },
    { label: "Pending", value: dash.productsPending, icon: Boxes, color: "#ea7317" },
    { label: "Rejected", value: dash.productsRejected, icon: XCircle, color: "#dc2626" },
    { label: "TikTok Shop", value: dash.shopConnected ? "Connected" : "Offline", icon: Store, color: dash.shopConnected ? "#16a34a" : "#8a929c" },
    { label: "TikTok Orders", value: dash.tiktokOrders, icon: ShoppingBag, color: "#2563eb" },
    { label: "Revenue", value: money(dash.revenue), icon: DollarSign, color: "#16a34a" },
    { label: "Purchases", value: dash.purchases, icon: TrendingUp, color: "#0891b2" },
    { label: "Last Sync", value: timeAgo(dash.lastSync), icon: RefreshCw, color: "#8b5cf6" },
  ] : [], [dash]);

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-black flex items-center justify-center"><Music2 className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em]", txt)}>TikTok Business & Shop</h1>
            <p className={cn("text-xs mt-0.5 flex items-center gap-1.5", sub)}><span className={cn("w-2 h-2 rounded-full", connected ? "bg-emerald-500" : "bg-gray-400")} />{connected ? `Connected${settings.pixel_id ? ` · Pixel ${settings.pixel_id}` : ""}` : "Not connected"}</p>
          </div>
        </div>
        <button onClick={() => runAction("sync")} disabled={busy === "sync"} className="h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] flex items-center gap-2 disabled:opacity-50">{busy === "sync" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Synchronize</button>
      </div>

      {/* TABS */}
      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === t.id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><t.icon className="w-3.5 h-3.5" /> {t.label}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {kpis.map(k => (
              <div key={k.label} className={cn(cardCls, "p-3.5")}>
                <div className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-2" style={{ backgroundColor: `${k.color}1a` }}><k.icon className="w-4 h-4" style={{ color: k.color }} /></div>
                <p className={cn("text-[16px] font-extrabold tracking-[-.02em]", txt)}>{k.value}</p>
                <p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p>
              </div>
            ))}
          </div>
          <div className={cn(cardCls, "p-4")}>
            <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Events Received (30 days)</p>
            <BarChart series={dash.series || []} dark={dark} trackBg={trackBg} txt={txt} sub={sub} />
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b flex items-center gap-1.5", sub, brd)}><History className="w-3.5 h-3.5" /> Recent Activity & Errors</p>
            {(dash.recentLogs || []).length === 0 ? <p className={cn("p-4 text-xs", sub)}>No activity yet.</p> : (
              <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
                {dash.recentLogs.map((l, i) => <div key={i} className="px-4 py-2.5 flex items-center gap-2"><span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase", l.log_type === "error" || l.log_type === "api_error" ? "bg-red-500/10 text-red-600" : l.log_type === "sync" ? "bg-blue-500/10 text-blue-600" : dark ? "bg-[#252c36] text-[#8b95a3]" : "bg-[#f0f2f5] text-[#8a929c]")}>{l.log_type}</span><span className={cn("text-xs flex-1", txt)}>{l.message || l.action}</span><span className={cn("text-[10px]", sub)}>{fmtDT(l.created_at)}</span></div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONNECTION */}
      {tab === "connection" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={cn(cardCls, "p-5 space-y-4")}>
            <div className="flex items-center gap-2"><PlugZap className="w-4 h-4 text-[#2563eb]" /><p className={cn("text-sm font-extrabold", txt)}>Connect TikTok Business</p></div>
            <div><label className={labelCls}>Business Account</label><input value={settings.business_account || ""} onChange={e => setField("business_account", e.target.value)} className={inpCls} placeholder="@atlantasneakers" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Advertiser ID</label><input value={settings.advertiser_id || ""} onChange={e => setField("advertiser_id", e.target.value)} className={inpCls} placeholder="700000..." /></div>
              <div><label className={labelCls}>Business Center ID</label><input value={settings.business_center_id || ""} onChange={e => setField("business_center_id", e.target.value)} className={inpCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Pixel ID</label><input value={settings.pixel_id || ""} onChange={e => setField("pixel_id", e.target.value)} className={inpCls} placeholder="C..." /></div>
              <div><label className={labelCls}>TikTok Shop ID</label><input value={settings.shop_id || ""} onChange={e => setField("shop_id", e.target.value)} className={inpCls} /></div>
            </div>
            <p className={cn("text-[11px]", sub)}>Access Token and Refresh Token are read from server environment variables (TIKTOK_ACCESS_TOKEN, TIKTOK_REFRESH_TOKEN, TIKTOK_WEBHOOK_SECRET) — never stored in the browser.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => runAction("connect", { business_account: settings.business_account, advertiser_id: settings.advertiser_id, business_center_id: settings.business_center_id, pixel_id: settings.pixel_id, shop_id: settings.shop_id })} disabled={busy === "connect"} className="h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">{busy === "connect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} {connected ? "Reconnect" : "Connect TikTok"}</button>
              <button onClick={() => runAction("test", { pixel_id: settings.pixel_id })} disabled={busy === "test"} className={btnGhost}>{busy === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />} Test Connection</button>
              {connected && <button onClick={() => runAction("disconnect")} disabled={busy === "disconnect"} className="h-10 px-4 rounded-[11px] bg-red-500/10 text-red-500 text-sm font-bold hover:bg-red-500/20 flex items-center gap-2"><Power className="w-4 h-4" /> Disconnect</button>}
            </div>
            {testResult && <div className={cn("rounded-[10px] p-2.5 text-xs font-semibold", testResult.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>{testResult.message}</div>}
          </div>
          <div className={cn(cardCls, "p-5 space-y-3")}>
            <p className={cn("text-sm font-extrabold", txt)}>Status</p>
            {[["Business connection", connected], ["Pixel installed", !!settings.pixel_id], ["TikTok Shop", settings.shop_status === "connected"], ["Catalog", settings.catalog_status === "connected"], ["Last sync", !!settings.last_synced_at]].map(([label, ok]) => (
              <div key={label} className="flex items-center gap-2.5">{ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}<p className={cn("text-xs font-semibold", txt)}>{label}</p><span className={cn("text-[11px] ml-auto", sub)}>{label === "Last sync" ? timeAgo(settings.last_synced_at) : ok ? "OK" : "—"}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* PIXEL */}
      {tab === "pixel" && (
        <div className={cn(cardCls, "p-5")}>
          <p className={cn("text-sm font-extrabold mb-1", txt)}>Pixel Events</p>
          <p className={cn("text-xs mb-4", sub)}>The TikTok Pixel is injected automatically on the storefront when a Pixel ID is set. Toggle which events fire.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {PIXEL_EVENTS.map(([key, label]) => (
              <label key={key} className={cn("flex items-center justify-between rounded-[10px] border p-3 cursor-pointer", brd, hover)}>
                <span className={cn("text-[13px] font-semibold", txt)}>{label}</span>
                <button type="button" onClick={() => togglePixel(key)} className={cn("w-10 h-5 rounded-full transition-colors relative shrink-0", settings.pixel_events?.[key] ? "bg-emerald-500" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}><span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform", settings.pixel_events?.[key] ? "translate-x-[22px]" : "translate-x-0.5")} /></button>
              </label>
            ))}
          </div>
          <button onClick={() => saveSettings(["pixel_id", "pixel_events"])} disabled={saving} className="mt-4 h-10 px-5 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Pixel Settings</button>
        </div>
      )}

      {/* SHOP */}
      {tab === "shop" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[["Products Synced", dash?.productsSynced ?? 0, "#16a34a"], ["Pending", dash?.productsPending ?? 0, "#ea7317"], ["Rejected", dash?.productsRejected ?? 0, "#dc2626"], ["Last Sync", timeAgo(dash?.lastSync), "#8b5cf6"]].map(([l, v, c]) => (
              <div key={l} className={cn(cardCls, "p-4")}><p className="text-[17px] font-extrabold" style={{ color: c }}>{v}</p><p className={cn("text-xs", sub)}>{l}</p></div>
            ))}
          </div>
          <div className={cn(cardCls, "p-5")}>
            <p className={cn("text-sm font-extrabold mb-3", txt)}>TikTok Shop Synchronization</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[["sync_products", "Sync Products", Package], ["sync", "Sync Prices", DollarSign], ["sync", "Sync Stock", Boxes], ["sync", "Sync Images", FileText], ["sync", "Sync Categories", Store], ["sync", "Sync Orders", ShoppingBag]].map(([action, label, Ico], i) => (
                <button key={i} onClick={() => runAction(action)} disabled={busy === action} className={cn("h-11 rounded-[11px] border text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50", brd, txt, hover)}><Ico className="w-4 h-4" /> {label}</button>
              ))}
            </div>
            <p className={cn("text-[11px] mt-3", sub)}>Sync stages active products into the mapping table. With TIKTOK_ACCESS_TOKEN configured on the server, changes are pushed to the TikTok Shop API; otherwise they are staged locally and marked pending.</p>
          </div>
        </div>
      )}

      {/* PRODUCTS */}
      {tab === "products" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className={cn("border-b", brd)}>{["Product", "SKU", "Price", "Stock", "TikTok ID", "Status", "Last Sync"].map(h => <th key={h} className={cn("p-3 text-left text-[11px] font-bold uppercase tracking-wider", sub)}>{h}</th>)}</tr></thead>
              <tbody>
                {products.length === 0 ? <tr><td colSpan={7} className={cn("p-8 text-center text-xs", sub)}>No products. Run a sync from TikTok Shop.</td></tr> :
                  products.map(p2 => { const st = SYNC_STATUS[p2.sync_status] || SYNC_STATUS.unmapped; return (
                    <tr key={p2.product_id} className={cn("border-b last:border-0", brd)}>
                      <td className="p-3"><div className="flex items-center gap-2">{p2.image && <img src={p2.image} alt="" className="w-8 h-8 rounded-[6px] object-cover" />}<span className={cn("text-xs font-semibold truncate max-w-[160px]", txt)}>{p2.name}</span></div></td>
                      <td className={cn("p-3 text-xs font-mono", sub)}>{p2.sku}</td>
                      <td className={cn("p-3 text-xs font-bold", txt)}>{money(p2.price)}</td>
                      <td className={cn("p-3 text-xs", p2.stock === 0 ? "text-red-500" : sub)}>{p2.stock}</td>
                      <td className={cn("p-3 text-[11px] font-mono", sub)}>{p2.tiktok_product_id || "—"}</td>
                      <td className="p-3"><span className={cn("px-2 py-1 rounded-full text-[10px] font-bold", st.cls)}>{st.label}</span></td>
                      <td className={cn("p-3 text-[11px]", sub)}>{p2.last_synced_at ? timeAgo(p2.last_synced_at) : "—"}</td>
                    </tr>
                  ); })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ORDERS */}
      {tab === "orders" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <table className="w-full text-sm">
            <thead><tr className={cn("border-b", brd)}>{["TikTok Order", "Linked Order", "Status", "Total", "Date"].map(h => <th key={h} className={cn("p-3 text-left text-[11px] font-bold uppercase tracking-wider", sub)}>{h}</th>)}</tr></thead>
            <tbody>
              {orders.length === 0 ? <tr><td colSpan={5} className={cn("p-8 text-center text-xs", sub)}>No TikTok orders yet. They arrive via webhook when TikTok Shop is connected.</td></tr> :
                orders.map(o => (
                  <tr key={o.id} className={cn("border-b last:border-0", brd)}>
                    <td className={cn("p-3 text-xs font-mono", txt)}>{o.tiktok_order_id}</td>
                    <td className={cn("p-3 text-xs", sub)}>{o.order?.order_number || "—"}</td>
                    <td className="p-3"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold capitalize", dark ? "bg-[#252c36] text-[#e7ebf0]" : "bg-[#f0f2f5] text-[#16181d]")}>{o.status}</span></td>
                    <td className={cn("p-3 text-xs font-bold", txt)}>{money(o.total)}</td>
                    <td className={cn("p-3 text-xs", sub)}>{fmtDT(o.created_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* EVENTS */}
      {tab === "events" && events && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={cn(cardCls, "p-4")}>
            <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Event Breakdown ({events.total} total)</p>
            {events.breakdown.length === 0 ? <p className={cn("text-xs", sub)}>No events received yet.</p> : (
              <div className="space-y-1.5">
                {events.breakdown.map((r, i) => { const max = Math.max(...events.breakdown.map(x => x.count), 1); return (
                  <div key={i} className="flex items-center gap-2"><span className={cn("text-[11px] font-semibold w-32 truncate", txt)}>{r.label}</span><div className={cn("flex-1 h-4 rounded-[5px] overflow-hidden", trackBg)}><div className="h-full rounded-[5px] bg-black" style={{ width: `${(r.count / max) * 100}%` }} /></div><span className={cn("text-[11px] font-bold w-8 text-right", txt)}>{r.count}</span></div>
                ); })}
              </div>
            )}
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b", sub, brd)}>Recent Events</p>
            <div className={cn("divide-y max-h-80 overflow-y-auto", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {events.events.length === 0 ? <p className={cn("p-4 text-xs", sub)}>No events.</p> :
                events.events.map((e, i) => <div key={i} className="px-4 py-2 flex items-center gap-2 text-xs"><span className={cn("font-mono font-semibold", txt)}>{e.event_name}</span><span className={cn("truncate", sub)}>{e.path}</span><span className={cn("ml-auto", sub)}>{timeAgo(e.created_at)}</span></div>)}
            </div>
          </div>
        </div>
      )}

      {/* WEBHOOKS */}
      {tab === "webhooks" && webhooks && (
        <div className="space-y-4">
          <div className={cn(cardCls, "p-5 space-y-3")}>
            <p className={cn("text-sm font-extrabold", txt)}>Webhook Endpoint</p>
            <button onClick={() => navigator.clipboard?.writeText(webhooks.webhookUrl).then(() => showToast("Copied"))} className={cn("flex items-center gap-2 text-left rounded-[10px] border px-3 py-2.5 w-full", brd, hover)}><Webhook className={cn("w-4 h-4 shrink-0", sub)} /><span className={cn("text-xs font-mono truncate flex-1", txt)}>{webhooks.webhookUrl}</span><Copy className={cn("w-3.5 h-3.5", sub)} /></button>
            <div className="flex items-center gap-2">
              {webhooks.hasSecret ? <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Signing secret configured</span> : <span className="text-[11px] text-amber-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Set TIKTOK_WEBHOOK_SECRET to verify signatures</span>}
              <button onClick={() => runAction("test_webhook")} className={cn(btnGhost, "ml-auto h-9")}>Test Webhook</button>
            </div>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b", sub, brd)}>Webhook History</p>
            <div className={cn("divide-y max-h-80 overflow-y-auto", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {webhooks.webhooks.length === 0 ? <p className={cn("p-4 text-xs", sub)}>No webhook events received.</p> :
                webhooks.webhooks.map((w, i) => <div key={i} className="px-4 py-2.5 flex items-center gap-2"><span className={cn("text-xs font-mono font-semibold", txt)}>{w.event_type}</span><span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold", w.status === "received" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>{w.status}</span><span className={cn("ml-auto text-[10px]", sub)}>{fmtDT(w.created_at)}</span></div>)}
            </div>
          </div>
        </div>
      )}

      {/* LOGS */}
      {tab === "logs" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <div className={cn("px-4 py-3 border-b flex items-center gap-2", brd)}>
            <p className={cn("text-sm font-extrabold", txt)}>Logs</p>
            <select value={logType} onChange={e => setLogType(e.target.value)} className={cn(inpCls, "w-auto h-9 ml-auto")}>
              <option value="">All types</option><option value="sync">Sync</option><option value="error">Errors</option><option value="success">Success</option><option value="webhook">Webhook</option><option value="api_error">API Errors</option><option value="audit">Audit</option>
            </select>
          </div>
          {logs.length === 0 ? <p className={cn("p-8 text-center text-xs", sub)}>No logs.</p> : (
            <div className={cn("divide-y max-h-[500px] overflow-y-auto", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
              {logs.map(l => <div key={l.id} className="px-4 py-2.5 flex items-center gap-2"><span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase", l.log_type.includes("error") ? "bg-red-500/10 text-red-600" : l.log_type === "sync" ? "bg-blue-500/10 text-blue-600" : "bg-gray-500/10 text-gray-500")}>{l.log_type}</span><span className={cn("text-xs flex-1", txt)}>{l.message || l.action}</span><span className={cn("text-[10px]", sub)}>{l.actor_name} · {fmtDT(l.created_at)}</span></div>)}
            </div>
          )}
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.message}</div>}
    </div>
  );
}

function BarChart({ series, dark, trackBg, txt, sub }) {
  if (!series.length) return <p className={cn("text-xs", sub)}>No data yet.</p>;
  const max = Math.max(...series.map(s => s.events), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {series.map((s, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${s.date}: ${s.events}`}>
          <div className={cn("w-full rounded-t-[3px]", s.events > 0 ? "bg-black" : trackBg)} style={{ height: `${Math.max((s.events / max) * 100, s.events > 0 ? 6 : 2)}%` }} />
        </div>
      ))}
    </div>
  );
}
