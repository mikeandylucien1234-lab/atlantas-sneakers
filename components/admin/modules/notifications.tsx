// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Bell, LayoutDashboard, Radio, Send, Megaphone, CalendarClock, FileText,
  Inbox, ListChecks, History, Bug, Zap, Settings2, Mail, MessageSquare,
  Smartphone, MessageCircle, Hash, Slack, RefreshCw, Loader2, Save, Plus,
  Trash2, Check, CheckCheck, Archive, Play, X, AlertTriangle, CheckCircle2,
  XCircle, Clock, TrendingUp, Search, PlugZap, Send as SendIcon, AtSign,
} from "lucide-react";

type Props = { dark: boolean };

const CHANNEL_META = {
  email: { label: "Email", icon: Mail, color: "#2563eb" },
  sms: { label: "SMS", icon: MessageSquare, color: "#16a34a" },
  push: { label: "Push", icon: Smartphone, color: "#ea7317" },
  in_app: { label: "In-App", icon: Bell, color: "#8b5cf6" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "#25d366" },
  telegram: { label: "Telegram", icon: Send, color: "#229ED9" },
  discord: { label: "Discord", icon: Hash, color: "#5865F2" },
  slack: { label: "Slack", icon: AtSign, color: "#611f69" },
};
const PROVIDERS = { email: ["resend", "smtp"], sms: ["twilio", "vonage", "messagebird", "infobip", "custom"], push: ["fcm", "apns", "webpush"], whatsapp: ["cloud_api"] };
const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "channels", label: "Channels", icon: Radio },
  { id: "compose", label: "Compose", icon: Send },
  { id: "broadcast", label: "Broadcast", icon: Megaphone },
  { id: "scheduled", label: "Scheduled", icon: CalendarClock },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "inbox", label: "In-App Inbox", icon: Inbox },
  { id: "queue", label: "Queue", icon: ListChecks },
  { id: "history", label: "History", icon: History },
  { id: "automation", label: "Automation", icon: Zap },
  { id: "logs", label: "Logs", icon: Bug },
  { id: "settings", label: "Settings", icon: Settings2 },
];
const AUTOMATIONS = [
  ["new_order", "New Order"], ["order_shipped", "Order Shipped"], ["order_delivered", "Order Delivered"],
  ["payment_received", "Payment Received"], ["payment_failed", "Payment Failed"], ["refund", "Refund"],
  ["return_accepted", "Return Accepted"], ["new_customer", "New Customer"], ["password_reset", "Password Reset"],
  ["login", "Login"], ["signup", "Signup"], ["abandoned_cart", "Abandoned Cart"],
  ["out_of_stock", "Product Out of Stock"], ["back_in_stock", "Back In Stock"], ["review_posted", "Review Posted"],
];
const AUDIENCE = [["all", "All Customers"], ["vip", "VIP"], ["new", "New Customers"], ["inactive", "Inactive"], ["premium", "Premium"]];

function num(n) { return (Number(n) || 0).toLocaleString(); }
function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return ""; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

export function AdminNotifications({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inpBg = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inpBg, "focus:border-[#2563eb]");
  const taCls = cn("w-full rounded-[11px] border-[1.5px] px-3 py-2.5 text-sm outline-none transition-colors", inpBg, "focus:border-[#2563eb]");
  const labelCls = cn("text-[12px] font-semibold mb-1.5 block", txt);
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnGhost = cn("h-10 px-4 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2 disabled:opacity-50", brd, txt, hover);
  const btnPrimary = "h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2";
  const trackBg = dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]";
  const divide = dark ? "divide-[#252c36]" : "divide-[#eef0f3]";

  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const [d, setD] = useState({}); // per-section data
  const [dash, setDash] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [channels, setChannels] = useState([]);
  const [confirm, setConfirm] = useState(null);

  // compose state
  const [compose, setCompose] = useState({ recipient: "", channels: ["in_app"], template_key: "", subject: "", body: "", priority: 3, user_id: "" });
  // broadcast state
  const [bc, setBc] = useState({ filter: "all", channels: ["in_app"], template_key: "", subject: "", body: "", country: "" });
  const [bcCount, setBcCount] = useState(null);
  // schedule state
  const [sched, setSched] = useState({ recipient: "", channels: ["email"], template_key: "", subject: "", body: "", scheduled_for: "", timezone: "UTC", repeat_rule: "none" });
  // template editor
  const [editTpl, setEditTpl] = useState(null);
  // inbox
  const [inbox, setInbox] = useState({ notifications: [], total: 0, page: 1 });
  const [inboxFilter, setInboxFilter] = useState({ status: "all", channel: "all", q: "" });
  // queue/history/logs
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState({ history: [], total: 0, page: 1 });
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState("all");
  // settings/automation
  const [settings, setSettings] = useState({ automations: {}, permissions: {} });

  const showToast = useCallback((message, type = "success") => { setToast({ message, type }); setTimeout(() => setToast(null), 3200); }, []);

  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api/notifications${path}`, opts);
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadDash = useCallback(async () => { try { setDash(await api("/dashboard")); } catch {} }, [api]);
  const loadChannels = useCallback(async () => { try { const r = await api("/channels"); setChannels(r.channels || []); } catch {} }, [api]);
  const loadTemplates = useCallback(async () => { try { const r = await api("/templates"); setTemplates(r.templates || []); } catch {} }, [api]);
  const loadInbox = useCallback(async (page = 1) => { try { const qs = new URLSearchParams({ page, status: inboxFilter.status, channel: inboxFilter.channel, q: inboxFilter.q }); const r = await api(`?${qs}`); setInbox({ notifications: r.notifications, total: r.total, page }); } catch {} }, [api, inboxFilter]);
  const loadQueue = useCallback(async () => { try { const r = await api("/queue"); setQueue(r.queue || []); } catch {} }, [api]);
  const loadHistory = useCallback(async (page = 1) => { try { const r = await api(`/history?page=${page}`); setHistory({ history: r.history, total: r.total, page }); } catch {} }, [api]);
  const loadLogs = useCallback(async () => { try { const r = await api(`/logs?event=${logFilter}`); setLogs(r.logs || []); } catch {} }, [api, logFilter]);
  const loadSettings = useCallback(async () => { try { const r = await api("/settings"); setSettings({ automations: {}, permissions: {}, ...(r.settings || {}) }); } catch {} }, [api]);

  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadDash(), loadChannels(), loadTemplates()]); setLoading(false); })(); }, [loadDash, loadChannels, loadTemplates]);
  useEffect(() => {
    if (tab === "dashboard") loadDash();
    if (tab === "channels") loadChannels();
    if (tab === "templates") loadTemplates();
    if (tab === "inbox") loadInbox(1);
    if (tab === "queue") loadQueue();
    if (tab === "history") loadHistory(1);
    if (tab === "logs") loadLogs();
    if (tab === "settings" || tab === "automation") loadSettings();
  }, [tab]); // eslint-disable-line
  useEffect(() => { if (tab === "inbox") loadInbox(1); }, [inboxFilter]); // eslint-disable-line
  useEffect(() => { if (tab === "logs") loadLogs(); }, [logFilter]); // eslint-disable-line

  const post = async (action, body, okMsg, after) => {
    setBusy(action);
    try { const r = await api(`/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (okMsg) showToast(typeof okMsg === "function" ? okMsg(r) : okMsg); if (after) await after(r); return r;
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };

  const toggleChip = (arr, v, set, key) => set(s => ({ ...s, [key]: s[key].includes(v) ? s[key].filter(x => x !== v) : [...s[key], v] }));

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const kpis = [
    { label: "Total Notifications", value: num(K.total), icon: Bell, color: "#2563eb" },
    { label: "Sent Today", value: num(K.sentToday), icon: Send, color: "#16a34a" },
    { label: "Sent This Month", value: num(K.sentMonth), icon: TrendingUp, color: "#0891b2" },
    { label: "Pending", value: num(K.pending), icon: Clock, color: "#ea7317" },
    { label: "Failed", value: num(K.failed), icon: XCircle, color: "#dc2626" },
    { label: "Scheduled", value: num(K.scheduled), icon: CalendarClock, color: "#8b5cf6" },
    { label: "Read", value: num(K.read), icon: CheckCheck, color: "#16a34a" },
    { label: "Unread", value: num(K.unread), icon: Inbox, color: "#8a929c" },
    { label: "Delivery Rate", value: `${K.deliveryRate || 0}%`, icon: CheckCircle2, color: "#16a34a" },
    { label: "Avg Send Time", value: `${K.avgMs || 0}ms`, icon: Zap, color: "#ea7317" },
  ];

  const ChannelChips = ({ value, onToggle }) => (
    <div className="flex flex-wrap gap-2">
      {Object.entries(CHANNEL_META).map(([id, m]) => (
        <button key={id} type="button" onClick={() => onToggle(id)} className={cn("h-8 px-3 rounded-[9px] text-xs font-bold border flex items-center gap-1.5 transition-colors", value.includes(id) ? "border-transparent text-white" : cn(brd, sub, hover))} style={value.includes(id) ? { backgroundColor: m.color } : {}}><m.icon className="w-3.5 h-3.5" /> {m.label}</button>
      ))}
    </div>
  );

  const priorityBadge = (pr) => <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold capitalize", pr === "urgent" ? "bg-red-500/15 text-red-600" : pr === "high" ? "bg-orange-500/15 text-orange-600" : pr === "low" ? "bg-gray-500/15 text-gray-500" : "bg-blue-500/15 text-blue-600")}>{pr || "normal"}</span>;
  const statusBadge = (s) => { const map = { sent: "bg-emerald-500/15 text-emerald-600", failed: "bg-red-500/15 text-red-600", pending: "bg-amber-500/15 text-amber-600", processing: "bg-blue-500/15 text-blue-600", read: "bg-emerald-500/15 text-emerald-600", unread: "bg-blue-500/15 text-blue-600", archived: "bg-gray-500/15 text-gray-500", cancelled: "bg-gray-500/15 text-gray-500", expired: "bg-gray-500/15 text-gray-500" }; return <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold capitalize", map[s] || "bg-gray-500/15 text-gray-500")}>{s}</span>; };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Bell className="w-5 h-5 text-[#2563eb]" /> Notifications</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Enterprise Notification Management Center · {channels.filter(c => c.enabled).length}/{channels.length} channels enabled</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => post("process", { limit: 50 }, (r) => `Queue processed: ${r.summary?.sent || 0} sent`, () => { loadDash(); loadQueue(); })} disabled={busy === "process"} className={btnGhost}>{busy === "process" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Process Queue</button>
          <button onClick={() => setTab("compose")} className={btnPrimary}><Send className="w-4 h-4" /> Send Notification</button>
        </div>
      </div>

      {/* TABS */}
      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("h-9 px-3 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === t.id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><t.icon className="w-3.5 h-3.5" /> {t.label}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">{kpis.map(k => (
            <div key={k.label} className={cn(cardCls, "p-3.5")}><div className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-2" style={{ backgroundColor: `${k.color}1a` }}><k.icon className="w-4 h-4" style={{ color: k.color }} /></div><p className={cn("text-[18px] font-extrabold tracking-[-.02em]", txt)}>{k.value}</p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
          ))}</div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={cn(cardCls, "p-4 lg:col-span-2")}>
              <div className="flex items-center justify-between mb-3"><p className={cn("text-xs font-bold uppercase tracking-wider", sub)}>Sent vs Failed (14d)</p><div className="flex gap-3 text-[11px]"><span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-[#16a34a] rounded" />Sent</span><span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-[#dc2626] rounded" />Failed</span></div></div>
              <TimelineChart series={dash.series || []} dark={dark} />
            </div>
            <div className={cn(cardCls, "overflow-hidden")}>
              <p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b", sub, brd)}>Activity Feed</p>
              <div className={cn("divide-y max-h-72 overflow-y-auto", divide)}>
                {(dash.recentActivity || []).length === 0 ? <p className={cn("p-4 text-xs", sub)}>No activity yet.</p> :
                  dash.recentActivity.map((a, i) => <div key={i} className="px-4 py-2.5 flex items-center gap-2"><span className={cn("w-1.5 h-1.5 rounded-full shrink-0", a.status === "error" ? "bg-red-500" : "bg-emerald-500")} /><span className={cn("text-xs font-semibold capitalize", txt)}>{a.event}</span><span className={cn("text-[10px] truncate", sub)}>{a.channel || ""}</span><span className={cn("text-[10px] ml-auto shrink-0", sub)}>{timeAgo(a.created_at)}</span></div>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHANNELS */}
      {tab === "channels" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map(c => { const m = CHANNEL_META[c.id] || { label: c.id, icon: Bell, color: "#2563eb" }; return (
            <div key={c.id} className={cn(cardCls, "p-4")}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[11px] flex items-center justify-center" style={{ backgroundColor: `${m.color}1a` }}><m.icon className="w-5 h-5" style={{ color: m.color }} /></div>
                  <div><p className={cn("text-sm font-extrabold", txt)}>{m.label}</p><p className={cn("text-[11px] flex items-center gap-1.5", sub)}><span className={cn("w-1.5 h-1.5 rounded-full", c.enabled ? "bg-emerald-500" : "bg-gray-400")} />{c.enabled ? "Enabled" : "Disabled"} {c.configured ? "· configured" : "· not configured"}</p></div>
                </div>
                <button onClick={() => post("toggle-channel", { id: c.id, enabled: !c.enabled }, c.enabled ? "Disabled" : "Enabled", loadChannels)} className={cn("w-11 h-6 rounded-full transition-colors relative shrink-0", c.enabled ? "bg-emerald-500" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}><span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform", c.enabled ? "translate-x-[22px]" : "translate-x-0.5")} /></button>
              </div>
              <div className={cn("grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 pt-3 border-t text-[11px]", brd)}>
                <div className={sub}>Provider: <span className={cn("font-semibold", txt)}>{c.provider || (PROVIDERS[c.id]?.[0]) || "—"}</span></div>
                <div className={sub}>Last test: <span className={cn("font-semibold", c.last_test_status === "ok" ? "text-emerald-600" : c.last_test_status === "error" ? "text-red-600" : txt)}>{c.last_test_at ? timeAgo(c.last_test_at) : "never"}</span></div>
                <div className={sub}>Last used: <span className={cn("font-semibold", txt)}>{c.last_used_at ? timeAgo(c.last_used_at) : "never"}</span></div>
                <div className={sub}>Config: <span className={cn("font-semibold", txt)}>{(c.env || []).length ? "env vars" : "n/a"}</span></div>
              </div>
              {PROVIDERS[c.id] && (
                <div className="mt-3">
                  <select value={c.provider || PROVIDERS[c.id][0]} onChange={e => post("save-channel", { id: c.id, provider: e.target.value, config: c.config }, "Provider saved", loadChannels)} className={cn(inpCls, "h-9")}>
                    {PROVIDERS[c.id].map(pr => <option key={pr} value={pr}>{pr}</option>)}
                  </select>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={() => { const r = c.id === "email" ? prompt("Test recipient email:") : c.id === "sms" || c.id === "whatsapp" ? prompt("Test recipient phone (+...):") : c.id === "in_app" ? null : prompt("Recipient/token (leave blank for webhook/env):"); if (r === null && (c.id === "email" || c.id === "sms" || c.id === "whatsapp")) return; post("test", { channel: c.id, recipient: r || "" }, null, loadChannels).then(res => res && showToast(res.message, res.ok ? "success" : "error")); }} disabled={busy === "test"} className={btnGhost}><PlugZap className="w-4 h-4" /> Test</button>
                <a href={`/admin?config=${c.id}`} onClick={e => { e.preventDefault(); showToast(`Secrets for ${m.label} are set via server env: ${(c.env || []).join(", ") || "none needed"}`); }} className={btnGhost}><Settings2 className="w-4 h-4" /> Configure</a>
              </div>
            </div>
          ); })}
          <div className={cn("md:col-span-2 rounded-[12px] border p-3.5 flex gap-3 border-blue-500/25 bg-blue-500/[.05]")}><AlertTriangle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" /><p className={cn("text-[12px] leading-relaxed", sub)}>Provider secrets (API keys, tokens, passwords) are read exclusively from <b className={txt}>server environment variables</b> — never stored in the database or exposed to the browser. Configure them on o2switch, then use <b className={txt}>Test</b> to verify each channel with a real send.</p></div>
        </div>
      )}

      {/* COMPOSE */}
      {tab === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className={cn(cardCls, "p-5 space-y-4 lg:col-span-2")}>
            <p className={cn("text-sm font-extrabold", txt)}>Compose & Send</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Recipient (email / phone / token)</label><input value={compose.recipient} onChange={e => setCompose(s => ({ ...s, recipient: e.target.value }))} className={inpCls} placeholder="customer@email.com" /></div>
              <div><label className={labelCls}>User ID (for in-app)</label><input value={compose.user_id} onChange={e => setCompose(s => ({ ...s, user_id: e.target.value }))} className={inpCls} placeholder="uuid (optional)" /></div>
            </div>
            <div><label className={labelCls}>Channels</label><ChannelChips value={compose.channels} onToggle={v => toggleChip(compose.channels, v, setCompose, "channels")} /></div>
            <div><label className={labelCls}>Template (optional)</label><select value={compose.template_key} onChange={e => { const t = templates.find(x => x.key === e.target.value); setCompose(s => ({ ...s, template_key: e.target.value, subject: t?.subject || s.subject, body: t?.body || s.body, channels: t?.channels || s.channels })); }} className={inpCls}><option value="">— Custom —</option>{templates.map(t => <option key={t.id} value={t.key}>{t.name} ({t.category})</option>)}</select></div>
            <div><label className={labelCls}>Subject / Title</label><input value={compose.subject} onChange={e => setCompose(s => ({ ...s, subject: e.target.value }))} className={inpCls} placeholder="Subject" /></div>
            <div><label className={labelCls}>Message</label><textarea rows={5} value={compose.body} onChange={e => setCompose(s => ({ ...s, body: e.target.value }))} className={taCls} placeholder="Message body. Variables like {{customer_name}} are supported." /></div>
            <div className="flex items-center gap-3">
              <div className="w-40"><label className={labelCls}>Priority</label><select value={compose.priority} onChange={e => setCompose(s => ({ ...s, priority: parseInt(e.target.value) }))} className={cn(inpCls, "h-10")}><option value={1}>Urgent</option><option value={3}>High</option><option value={5}>Normal</option><option value={7}>Low</option></select></div>
              <button onClick={() => post("send", { ...compose, vars: {} }, (r) => `Sent (${r.summary?.sent || 0}/${r.queued})`, () => loadDash())} disabled={busy === "send" || (!compose.subject && !compose.body)} className={cn(btnPrimary, "mt-6")}>{busy === "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />} Send Now</button>
            </div>
          </div>
          <div className={cn(cardCls, "p-5 space-y-3")}>
            <p className={cn("text-sm font-extrabold", txt)}>Available Variables</p>
            <div className="flex flex-wrap gap-1.5">{["customer_name", "order_number", "tracking_number", "amount", "coupon", "store_name", "product_name", "reset_link", "ticket_number"].map(v => <code key={v} className={cn("text-[11px] px-1.5 py-0.5 rounded", trackBg, txt)}>{`{{${v}}}`}</code>)}</div>
            <p className={cn("text-[11px] leading-relaxed pt-2 border-t", sub, brd)}>Notifications are enqueued and dispatched through the real queue engine (retry, priority, logging). In-app messages appear instantly in the recipient's inbox. Email/SMS/WhatsApp/Push require the corresponding server credentials.</p>
          </div>
        </div>
      )}

      {/* BROADCAST */}
      {tab === "broadcast" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className={cn(cardCls, "p-5 space-y-4 lg:col-span-2")}>
            <p className={cn("text-sm font-extrabold", txt)}>Broadcast to Audience</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Segment</label><select value={bc.filter} onChange={e => setBc(s => ({ ...s, filter: e.target.value }))} className={inpCls}>{AUDIENCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><label className={labelCls}>Country (optional)</label><input value={bc.country} onChange={e => setBc(s => ({ ...s, country: e.target.value }))} className={inpCls} placeholder="e.g. HT" /></div>
            </div>
            <div><label className={labelCls}>Channels</label><ChannelChips value={bc.channels} onToggle={v => toggleChip(bc.channels, v, setBc, "channels")} /></div>
            <div><label className={labelCls}>Template</label><select value={bc.template_key} onChange={e => { const t = templates.find(x => x.key === e.target.value); setBc(s => ({ ...s, template_key: e.target.value, subject: t?.subject || s.subject, body: t?.body || s.body })); }} className={inpCls}><option value="">— Custom —</option>{templates.map(t => <option key={t.id} value={t.key}>{t.name}</option>)}</select></div>
            <div><label className={labelCls}>Subject</label><input value={bc.subject} onChange={e => setBc(s => ({ ...s, subject: e.target.value }))} className={inpCls} /></div>
            <div><label className={labelCls}>Message</label><textarea rows={4} value={bc.body} onChange={e => setBc(s => ({ ...s, body: e.target.value }))} className={taCls} placeholder="Use {{customer_name}}, {{store_name}}..." /></div>
            <div className="flex items-center gap-2">
              <button onClick={() => api(`/audience?filter=${bc.filter}${bc.country ? `&country=${bc.country}` : ""}`).then(r => setBcCount(r.count)).catch(() => {})} className={btnGhost}><Search className="w-4 h-4" /> Preview Audience</button>
              {bcCount != null && <span className={cn("text-xs font-bold", txt)}>{num(bcCount)} recipients</span>}
              <button onClick={() => setConfirm({ title: "Send broadcast?", message: `This will queue notifications to the "${bc.filter}" segment across ${bc.channels.join(", ")}.`, onConfirm: () => post("broadcast", { ...bc }, (r) => `Broadcast queued to ${r.recipients} recipients`, () => loadDash()) })} disabled={busy === "broadcast" || (!bc.subject && !bc.body && !bc.template_key)} className={cn(btnPrimary, "ml-auto")}>{busy === "broadcast" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Send Broadcast</button>
            </div>
          </div>
          <div className={cn(cardCls, "p-5 space-y-2")}>
            <p className={cn("text-sm font-extrabold", txt)}>Segments</p>
            {AUDIENCE.map(([v, l]) => <div key={v} className={cn("flex items-center justify-between rounded-[10px] border p-2.5", brd)}><span className={cn("text-xs font-semibold", txt)}>{l}</span>{bc.filter === v && <Check className="w-4 h-4 text-emerald-500" />}</div>)}
            <p className={cn("text-[11px] leading-relaxed pt-2", sub)}>Broadcasts are throttled and fully logged. Recipients are pulled live from your customer base with valid emails.</p>
          </div>
        </div>
      )}

      {/* SCHEDULED */}
      {tab === "scheduled" && (
        <div className="space-y-4">
          <div className={cn(cardCls, "p-5 space-y-4")}>
            <p className={cn("text-sm font-extrabold", txt)}>Schedule a Notification</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className={labelCls}>Recipient</label><input value={sched.recipient} onChange={e => setSched(s => ({ ...s, recipient: e.target.value }))} className={inpCls} placeholder="email / phone" /></div>
              <div><label className={labelCls}>Template</label><select value={sched.template_key} onChange={e => { const t = templates.find(x => x.key === e.target.value); setSched(s => ({ ...s, template_key: e.target.value, subject: t?.subject || s.subject, body: t?.body || s.body })); }} className={inpCls}><option value="">— Custom —</option>{templates.map(t => <option key={t.id} value={t.key}>{t.name}</option>)}</select></div>
              <div><label className={labelCls}>Date & Time</label><input type="datetime-local" value={sched.scheduled_for} onChange={e => setSched(s => ({ ...s, scheduled_for: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Timezone</label><input value={sched.timezone} onChange={e => setSched(s => ({ ...s, timezone: e.target.value }))} className={inpCls} placeholder="UTC" /></div>
              <div><label className={labelCls}>Repeat</label><select value={sched.repeat_rule} onChange={e => setSched(s => ({ ...s, repeat_rule: e.target.value }))} className={inpCls}><option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
            </div>
            <div><label className={labelCls}>Channels</label><ChannelChips value={sched.channels} onToggle={v => toggleChip(sched.channels, v, setSched, "channels")} /></div>
            <div><label className={labelCls}>Subject</label><input value={sched.subject} onChange={e => setSched(s => ({ ...s, subject: e.target.value }))} className={inpCls} /></div>
            <div><label className={labelCls}>Message</label><textarea rows={3} value={sched.body} onChange={e => setSched(s => ({ ...s, body: e.target.value }))} className={taCls} /></div>
            <button onClick={() => post("schedule", { ...sched, scheduled_for: sched.scheduled_for ? new Date(sched.scheduled_for).toISOString() : undefined }, "Scheduled", loadQueue)} disabled={busy === "schedule" || !sched.scheduled_for} className={btnPrimary}>{busy === "schedule" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />} Schedule</button>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}><p className={cn("text-sm font-extrabold", txt)}>Upcoming</p><button onClick={loadQueue} className={cn("text-xs flex items-center gap-1", sub)}><RefreshCw className="w-3.5 h-3.5" /> Refresh</button></div>
            <div className={cn("divide-y", divide)}>
              {queue.filter(q => q.status === "pending" && q.scheduled_for > new Date().toISOString()).length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No scheduled notifications.</p> :
                queue.filter(q => q.status === "pending" && q.scheduled_for > new Date().toISOString()).map(q => <div key={q.id} className="px-4 py-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className={cn("text-xs font-bold truncate", txt)}>{q.subject || q.body || "(no subject)"}</p><p className={cn("text-[10px]", sub)}>{q.channel} → {q.recipient || "in-app"} · {fmtDT(q.scheduled_for)} {q.repeat_rule !== "none" && `· ${q.repeat_rule}`}</p></div><button onClick={() => post("queue-action", { id: q.id, op: "cancel" }, "Cancelled", loadQueue)} className="text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg"><X className="w-4 h-4" /></button></div>)}
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATES */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className={cn("text-sm font-extrabold", txt)}>{templates.length} Templates</p>
            <button onClick={() => setEditTpl({ name: "", category: "order", subject: "", body: "", channels: ["email"], variables: [], is_active: true })} className={btnPrimary}><Plus className="w-4 h-4" /> New Template</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {templates.map(t => (
              <div key={t.id} className={cn(cardCls, "p-4")}>
                <div className="flex items-start justify-between"><div><p className={cn("text-sm font-extrabold", txt)}>{t.name}</p><span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold capitalize", "bg-blue-500/15 text-blue-600")}>{t.category}</span></div><div className="flex gap-1"><button onClick={() => setEditTpl(t)} className={cn("p-1.5 rounded-lg", hover, sub)}><Settings2 className="w-4 h-4" /></button><button onClick={() => setConfirm({ title: "Delete template?", message: t.name, onConfirm: () => post("delete-template", { id: t.id }, "Deleted", loadTemplates) })} className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button></div></div>
                <p className={cn("text-xs font-semibold mt-2 truncate", txt)}>{t.subject}</p>
                <p className={cn("text-[11px] mt-1 line-clamp-2", sub)}>{t.body}</p>
                <div className="flex flex-wrap gap-1 mt-2">{(t.channels || []).map(ch => { const m = CHANNEL_META[ch]; return m ? <span key={ch} className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: `${m.color}1a` }} title={m.label}><m.icon className="w-3 h-3" style={{ color: m.color }} /></span> : null; })}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INBOX (in-app) */}
      {tab === "inbox" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap gap-2 items-center")}>
            <div className="relative flex-1 min-w-[180px]"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={inboxFilter.q} onChange={e => setInboxFilter(s => ({ ...s, q: e.target.value }))} className={cn(inpCls, "pl-9 h-9")} placeholder="Search…" /></div>
            <select value={inboxFilter.status} onChange={e => setInboxFilter(s => ({ ...s, status: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All status</option><option value="unread">Unread</option><option value="read">Read</option><option value="archived">Archived</option></select>
            <select value={inboxFilter.channel} onChange={e => setInboxFilter(s => ({ ...s, channel: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All channels</option>{Object.entries(CHANNEL_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}</select>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            {inbox.notifications.length === 0 ? <div className="p-10 text-center"><Inbox className={cn("w-8 h-8 mx-auto mb-2", sub)} /><p className={cn("text-sm", sub)}>No notifications.</p></div> : (
              <div className={cn("divide-y", divide)}>
                {inbox.notifications.map(n => (
                  <div key={n.id} className={cn("px-4 py-3 flex items-start gap-3", n.status === "unread" && (dark ? "bg-blue-500/[.04]" : "bg-blue-500/[.02]"))}>
                    {n.status === "unread" && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap"><span className={cn("text-sm font-bold", txt)}>{n.title || "(no title)"}</span>{priorityBadge(n.priority)}{statusBadge(n.status)}</div>
                      <p className={cn("text-xs mt-0.5", sub)}>{n.message}</p>
                      <p className={cn("text-[10px] mt-1", sub)}>{n.channel} · {n.category || "general"} · {fmtDT(n.created_at)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {n.status !== "read" && <button onClick={() => api("", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id, action: "read" }) }).then(() => loadInbox(inbox.page))} title="Mark read" className={cn("p-1.5 rounded-lg", hover, sub)}><Check className="w-4 h-4" /></button>}
                      <button onClick={() => api("", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id, action: "archive" }) }).then(() => loadInbox(inbox.page))} title="Archive" className={cn("p-1.5 rounded-lg", hover, sub)}><Archive className="w-4 h-4" /></button>
                      <button onClick={() => api("", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [n.id] }) }).then(() => loadInbox(inbox.page))} title="Delete" className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Pagination page={inbox.page} total={inbox.total} pageSize={25} onPage={loadInbox} sub={sub} txt={txt} brd={brd} hover={hover} />
        </div>
      )}

      {/* QUEUE */}
      {tab === "queue" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}><p className={cn("text-sm font-extrabold", txt)}>Queue ({queue.length})</p><div className="flex gap-2"><button onClick={() => post("process", { limit: 50 }, (r) => `Processed ${r.summary?.sent || 0}`, loadQueue)} disabled={busy === "process"} className={cn(btnPrimary, "h-8")}>{busy === "process" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Process</button><button onClick={loadQueue} className={cn(btnGhost, "h-8")}><RefreshCw className="w-4 h-4" /></button></div></div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className={cn("border-b text-left", brd, sub)}>{["Subject", "Channel", "Recipient", "Priority", "Attempts", "Status", "Scheduled", ""].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody className={cn("divide-y", divide)}>
              {queue.length === 0 ? <tr><td colSpan={8} className={cn("px-4 py-8 text-center text-xs", sub)}>Queue is empty.</td></tr> :
                queue.map(q => <tr key={q.id}><td className={cn("px-3 py-2.5 font-semibold truncate max-w-[180px]", txt)}>{q.subject || q.body || "—"}</td><td className={cn("px-3 py-2.5", txt)}>{q.channel}</td><td className={cn("px-3 py-2.5 truncate max-w-[140px]", sub)}>{q.recipient || "in-app"}</td><td className="px-3 py-2.5">{q.priority}</td><td className={cn("px-3 py-2.5", sub)}>{q.attempts}/{q.max_attempts}</td><td className="px-3 py-2.5">{statusBadge(q.status)}{q.last_error && <span title={q.last_error} className="ml-1 text-red-500">!</span>}</td><td className={cn("px-3 py-2.5 text-[11px]", sub)}>{fmtDT(q.scheduled_for)}</td><td className="px-3 py-2.5"><div className="flex gap-1">{q.status === "failed" && <button onClick={() => post("queue-action", { id: q.id, op: "retry" }, "Retrying", loadQueue)} className={cn("p-1 rounded", hover, sub)} title="Retry"><RefreshCw className="w-3.5 h-3.5" /></button>}{q.status === "pending" && <button onClick={() => post("queue-action", { id: q.id, op: "cancel" }, "Cancelled", loadQueue)} className="p-1 rounded text-red-500" title="Cancel"><X className="w-3.5 h-3.5" /></button>}</div></td></tr>)}
            </tbody>
          </table></div>
        </div>
      )}

      {/* HISTORY */}
      {tab === "history" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Notification History</p>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Date", "Channel", "Recipient", "Message", "Status", "Error"].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {history.history.length === 0 ? <tr><td colSpan={6} className={cn("px-4 py-8 text-center text-xs", sub)}>No history yet.</td></tr> :
                  history.history.map(h => <tr key={h.id}><td className={cn("px-3 py-2.5 text-[11px]", sub)}>{fmtDT(h.created_at)}</td><td className={cn("px-3 py-2.5", txt)}>{h.channel}</td><td className={cn("px-3 py-2.5 truncate max-w-[140px]", sub)}>{h.recipient || "in-app"}</td><td className={cn("px-3 py-2.5 truncate max-w-[200px]", txt)}>{h.subject || h.body}</td><td className="px-3 py-2.5">{statusBadge(h.status)}</td><td className={cn("px-3 py-2.5 text-[11px] text-red-500 truncate max-w-[140px]")}>{h.last_error || ""}</td></tr>)}
              </tbody>
            </table></div>
          </div>
          <Pagination page={history.page} total={history.total} pageSize={30} onPage={loadHistory} sub={sub} txt={txt} brd={brd} hover={hover} />
        </div>
      )}

      {/* AUTOMATION */}
      {tab === "automation" && (
        <div className={cn(cardCls, "p-5 space-y-3")}>
          <div className="flex items-center justify-between"><p className={cn("text-sm font-extrabold", txt)}>Automation Triggers</p><button onClick={() => post("save-settings", { automations: settings.automations }, "Automations saved")} disabled={busy === "save-settings"} className={btnPrimary}>{busy === "save-settings" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button></div>
          <p className={cn("text-xs", sub)}>Enable a trigger and pick the channels + template used when the event fires. These configure how the platform reacts to real events (orders, payments, accounts…).</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {AUTOMATIONS.map(([key, label]) => { const a = settings.automations?.[key] || {}; return (
              <div key={key} className={cn("rounded-[11px] border p-3", brd)}>
                <div className="flex items-center justify-between"><span className={cn("text-sm font-bold", txt)}>{label}</span>
                  <button onClick={() => setSettings(s => ({ ...s, automations: { ...s.automations, [key]: { ...a, enabled: !a.enabled } } }))} className={cn("w-10 h-5 rounded-full transition-colors relative shrink-0", a.enabled ? "bg-emerald-500" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}><span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform", a.enabled ? "translate-x-[22px]" : "translate-x-0.5")} /></button>
                </div>
                {a.enabled && (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-1">{Object.entries(CHANNEL_META).map(([id, m]) => <button key={id} onClick={() => { const chs = a.channels || []; setSettings(s => ({ ...s, automations: { ...s.automations, [key]: { ...a, channels: chs.includes(id) ? chs.filter(x => x !== id) : [...chs, id] } } })); }} className={cn("h-6 px-2 rounded-[7px] text-[10px] font-bold border flex items-center gap-1", (a.channels || []).includes(id) ? "border-transparent text-white" : cn(brd, sub))} style={(a.channels || []).includes(id) ? { backgroundColor: m.color } : {}}><m.icon className="w-3 h-3" /></button>)}</div>
                    <select value={a.template_key || ""} onChange={e => setSettings(s => ({ ...s, automations: { ...s.automations, [key]: { ...a, template_key: e.target.value } } }))} className={cn(inpCls, "h-8 text-xs")}><option value="">Default template</option>{templates.map(t => <option key={t.id} value={t.key}>{t.name}</option>)}</select>
                  </div>
                )}
              </div>
            ); })}
          </div>
        </div>
      )}

      {/* LOGS */}
      {tab === "logs" && (
        <div className="space-y-3">
          <div className="flex gap-2">{["all", "send", "error", "read", "delete", "update", "test", "retry"].map(ev => <button key={ev} onClick={() => setLogFilter(ev)} className={cn("h-8 px-3 rounded-[9px] text-xs font-bold capitalize border", logFilter === ev ? "bg-[#2563eb] text-white border-transparent" : cn(brd, sub, hover))}>{ev}</button>)}</div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className={cn("divide-y max-h-[560px] overflow-y-auto", divide)}>
              {logs.length === 0 ? <p className={cn("p-8 text-center text-xs", sub)}>No logs.</p> :
                logs.map(l => <div key={l.id} className="px-4 py-2.5 flex items-center gap-3"><span className={cn("w-1.5 h-1.5 rounded-full shrink-0", l.status === "error" ? "bg-red-500" : "bg-emerald-500")} /><span className={cn("text-xs font-bold capitalize w-16 shrink-0", txt)}>{l.event}</span><span className={cn("text-[11px] shrink-0", sub)}>{l.channel || "—"}</span><span className={cn("text-[11px] truncate flex-1", l.error ? "text-red-500" : sub)}>{l.error || l.detail || l.recipient || ""}</span><span className={cn("text-[10px] shrink-0", sub)}>{l.duration_ms ? `${l.duration_ms}ms · ` : ""}{l.actor_name || ""} · {fmtDT(l.created_at)}</span></div>)}
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS */}
      {tab === "settings" && (
        <div className={cn(cardCls, "p-5 space-y-4")}>
          <p className={cn("text-sm font-extrabold", txt)}>Permissions</p>
          <p className={cn("text-xs", sub)}>Control which admin roles can perform each action. Enforced server-side alongside the admin check.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {["create", "edit", "delete", "send", "schedule", "test"].map(perm => (
              <div key={perm} className={cn("rounded-[11px] border p-3 flex items-center justify-between", brd)}>
                <span className={cn("text-sm font-bold capitalize", txt)}>{perm}</span>
                <select value={settings.permissions?.[perm] || "admin"} onChange={e => setSettings(s => ({ ...s, permissions: { ...s.permissions, [perm]: e.target.value } }))} className={cn(inpCls, "w-auto h-9")}><option value="admin">Admin</option><option value="manager">Manager+</option><option value="staff">Staff+</option></select>
              </div>
            ))}
          </div>
          <button onClick={() => post("save-settings", { permissions: settings.permissions }, "Permissions saved")} disabled={busy === "save-settings"} className={btnPrimary}>{busy === "save-settings" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Permissions</button>
        </div>
      )}

      {/* TEMPLATE EDITOR MODAL */}
      {editTpl && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50" onClick={() => setEditTpl(null)}>
          <div className={cn("w-full max-w-lg rounded-[18px] border p-5 space-y-3 max-h-[90vh] overflow-y-auto", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className={cn("text-base font-extrabold", txt)}>{editTpl.id ? "Edit Template" : "New Template"}</p><button onClick={() => setEditTpl(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Name</label><input value={editTpl.name} onChange={e => setEditTpl(s => ({ ...s, name: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Category</label><select value={editTpl.category} onChange={e => setEditTpl(s => ({ ...s, category: e.target.value }))} className={inpCls}>{["order", "payment", "shipping", "return", "refund", "promotion", "coupon", "account", "security", "newsletter", "support"].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <div><label className={labelCls}>Subject</label><input value={editTpl.subject} onChange={e => setEditTpl(s => ({ ...s, subject: e.target.value }))} className={inpCls} /></div>
            <div><label className={labelCls}>Body</label><textarea rows={6} value={editTpl.body} onChange={e => setEditTpl(s => ({ ...s, body: e.target.value }))} className={taCls} /></div>
            <div><label className={labelCls}>Channels</label><ChannelChips value={editTpl.channels || []} onToggle={v => setEditTpl(s => ({ ...s, channels: (s.channels || []).includes(v) ? s.channels.filter(x => x !== v) : [...(s.channels || []), v] }))} /></div>
            <button onClick={() => post("save-template", editTpl, "Template saved", () => { loadTemplates(); setEditTpl(null); })} disabled={busy === "save-template" || !editTpl.name} className={cn(btnPrimary, "w-full justify-center")}>{busy === "save-template" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Template</button>
          </div>
        </div>
      )}

      {/* CONFIRM DIALOG */}
      {confirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirm(null)}>
          <div className={cn("w-full max-w-sm rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold", txt)}>{confirm.title}</p>
            <p className={cn("text-sm", sub)}>{confirm.message}</p>
            <div className="flex gap-2 justify-end"><button onClick={() => setConfirm(null)} className={btnGhost}>Cancel</button><button onClick={() => { confirm.onConfirm(); setConfirm(null); }} className={btnPrimary}>Confirm</button></div>
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200 max-w-sm", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.message}</div>}
    </div>
  );
}

function Pagination({ page, total, pageSize, onPage, sub, txt, brd, hover }) {
  const pages = Math.ceil(total / pageSize) || 1;
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-xs", sub)}>{total} total · page {page}/{pages}</span>
      <div className="flex gap-1.5">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={cn("h-8 px-3 rounded-[9px] text-xs font-bold border disabled:opacity-40", brd, txt, hover)}>Prev</button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className={cn("h-8 px-3 rounded-[9px] text-xs font-bold border disabled:opacity-40", brd, txt, hover)}>Next</button>
      </div>
    </div>
  );
}

function TimelineChart({ series, dark }) {
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  if (!series || !series.length) return <p className={cn("text-xs py-8 text-center", sub)}>No data yet.</p>;
  const w = 720, h = 170, pad = 10;
  const maxV = Math.max(...series.map(s => Math.max(s.sent, s.failed)), 1);
  const x = (i) => pad + (i / Math.max(series.length - 1, 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((Number(v) || 0) / maxV) * (h - pad * 2);
  const line = (key) => series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(s[key])}`).join(" ");
  const area = `${line("sent")} L${x(series.length - 1)},${h - pad} L${x(0)},${h - pad} Z`;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ minWidth: 520 }}>
        <defs><linearGradient id="ntl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16a34a" stopOpacity="0.25" /><stop offset="100%" stopColor="#16a34a" stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill="url(#ntl)" />
        <path d={line("failed")} fill="none" stroke="#dc2626" strokeWidth="2" opacity="0.7" />
        <path d={line("sent")} fill="none" stroke="#16a34a" strokeWidth="2.5" />
        {series.map((s, i) => <circle key={i} cx={x(i)} cy={y(s.sent)} r="2.5" fill="#16a34a" />)}
      </svg>
    </div>
  );
}
