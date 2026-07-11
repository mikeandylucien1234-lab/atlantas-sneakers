// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Activity, LayoutDashboard, Radio, ListChecks, Pin, Star, Loader2, Search,
  Download, X, ChevronRight, ShoppingCart, Package, Users, CreditCard, RotateCcw,
  Star as StarIcon, Ticket, Boxes, FolderTree, Tag, Shield, UserCog, FileText,
  Server, MessageSquare, Send, Trash2, AlertTriangle, Clock,
} from "lucide-react";

type Props = { dark: boolean };

const STATUS = { success: "#16a34a", completed: "#16a34a", pending: "#2563eb", warning: "#ea7317", failed: "#dc2626", cancelled: "#dc2626" };
const PRIORITY = { low: "#16a34a", medium: "#2563eb", high: "#ea7317", critical: "#dc2626" };
const TYPE_ICON = { order: ShoppingCart, product: Package, customer: Users, payment: CreditCard, refund: RotateCcw, review: StarIcon, coupon: Ticket, inventory: Boxes, category: FolderTree, brand: Tag, security: Shield, staff: UserCog, blog: FileText, system: Server };
const MODULES = ["orders", "products", "customers", "payments", "reviews", "coupons", "categories", "brands", "inventory", "security", "staff", "blog", "system"];

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function fmtT(d) { return d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return "—"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }
function initials(n) { return (n || "?").split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase(); }

export function AdminActivity({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inpBg = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inpBg, "focus:border-[#2563eb]");
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnGhost = cn("h-10 px-4 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2 disabled:opacity-50", brd, txt, hover);
  const btnPrimary = "h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2";
  const divide = dark ? "divide-[#252c36]" : "divide-[#eef0f3]";

  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [dash, setDash] = useState(null);
  const [list, setList] = useState({ activities: [], total: 0, page: 1, pageSize: 30 });
  const [pinned, setPinned] = useState([]);
  const [filters, setFilters] = useState({ q: "", module: "all", status: "all", priority: "all", country: "" });
  const [live, setLive] = useState([]);
  const [liveOn, setLiveOn] = useState(true);
  const [detail, setDetail] = useState(null);
  const [noteText, setNoteText] = useState("");
  const liveSince = useRef(new Date().toISOString());

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3000); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api/activity${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadDash = useCallback(async () => { try { setDash(await api("/dashboard")); } catch {} }, [api]);
  const loadList = useCallback(async (page = 1) => { try { const qs = new URLSearchParams({ page, pageSize: 30, ...filters }); const r = await api(`/list?${qs}`); setList({ ...r }); } catch (e) { showToast(e.message, "error"); } }, [api, filters, showToast]);
  const loadPinned = useCallback(async () => { try { const r = await api("/pinned"); setPinned(r.activities || []); } catch {} }, [api]);

  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadDash(), loadPinned()]); setLoading(false); })(); }, [loadDash, loadPinned]);
  useEffect(() => { if (tab === "dashboard") loadDash(); if (tab === "table") loadList(1); if (tab === "pinned") loadPinned(); }, [tab]); // eslint-disable-line
  useEffect(() => { if (tab === "table") loadList(1); }, [filters]); // eslint-disable-line

  useEffect(() => {
    if (tab !== "feed" || !liveOn) return; let stop = false;
    const poll = async () => { try { const r = await api(`/live?since=${encodeURIComponent(liveSince.current)}`); if (r.activities?.length) { liveSince.current = r.activities[0].created_at; setLive(prev => [...r.activities, ...prev].slice(0, 100)); } } catch {} if (!stop) setTimeout(poll, 5000); };
    // seed with an initial page
    api("/live?since=" + encodeURIComponent(new Date(Date.now() - 6 * 3600000).toISOString())).then(r => { if (r.activities) setLive(r.activities.slice(0, 60)); }).catch(() => {});
    poll(); return () => { stop = true; };
  }, [tab, liveOn, api]);

  const openDetail = async (id) => { setDetail({ loading: true }); setNoteText(""); try { setDetail(await api(`/detail?id=${encodeURIComponent(id)}`)); } catch (e) { showToast(e.message, "error"); setDetail(null); } };
  const act = async (action, body, after) => {
    try { await api(`/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (after) await after(); }
    catch (e) { showToast(e.message, "error"); }
  };
  const togglePin = (a) => act("pin", { activity_id: a.id, on: !a.pinned }, () => { showToast(a.pinned ? "Unpinned" : "Pinned"); loadPinned(); if (detail?.activity?.id === a.id) openDetail(a.id); if (tab === "table") loadList(list.page); });
  const toggleFav = (a) => act("favorite", { activity_id: a.id, on: !a.favorite }, () => { showToast(a.favorite ? "Removed" : "Starred"); if (detail?.activity?.id === a.id) openDetail(a.id); if (tab === "table") loadList(list.page); });
  const addNote = async () => { if (!noteText.trim()) return; await act("comment", { activity_id: detail.activity.id, note: noteText }, () => { setNoteText(""); openDetail(detail.activity.id); showToast("Note added"); }); };

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const kpis = [
    { label: "Today", value: K.today }, { label: "This Week", value: K.week }, { label: "This Month", value: K.month },
    { label: "Active Users", value: K.activeUsers }, { label: "Active Staff", value: K.activeStaff },
    { label: "New Orders", value: K.newOrders }, { label: "New Customers", value: K.newCustomers }, { label: "New Products", value: K.newProducts },
    { label: "New Reviews", value: K.newReviews }, { label: "New Payments", value: K.newPayments }, { label: "Refunds", value: K.refundRequests },
    { label: "Coupons", value: K.couponsUsed }, { label: "Pending Orders", value: K.pendingOrders, warn: K.pendingOrders > 0 },
    { label: "Failed Payments", value: K.failedPayments, crit: K.failedPayments > 0 }, { label: "Cancelled", value: K.cancelledOrders, warn: K.cancelledOrders > 0 },
  ];

  const Avatar = ({ url, name, size = 32 }) => url ? <img src={url} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} /> : <div className="rounded-full flex items-center justify-center font-bold text-white shrink-0" style={{ width: size, height: size, fontSize: size / 2.8, background: "linear-gradient(135deg,#2563eb,#8b5cf6)" }}>{initials(name)}</div>;
  const statusBadge = (s) => <span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ backgroundColor: `${STATUS[s] || "#8a929c"}1a`, color: STATUS[s] || "#8a929c" }}>{s}</span>;
  const prioBadge = (pr) => <span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ backgroundColor: `${PRIORITY[pr] || "#8a929c"}1a`, color: PRIORITY[pr] || "#8a929c" }}>{pr}</span>;

  const FeedItem = ({ a }) => { const I = TYPE_ICON[a.activity_type] || Activity; const col = STATUS[a.status] || "#8a929c"; return (
    <div className={cn("px-4 py-3 flex items-center gap-3 cursor-pointer", hover)} onClick={() => openDetail(a.id)}>
      <div className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${col}1a` }}><I className="w-4 h-4" style={{ color: col }} /></div>
      <div className="min-w-0 flex-1"><p className={cn("text-sm truncate", txt)}><span className="font-bold">{a.actor_name || "System"}</span> <span className={sub}>· {(a.action || "").replace(/_/g, " ")}</span></p><p className={cn("text-[11px] truncate", sub)}>{a.description}</p></div>
      {a.pinned && <Pin className="w-3.5 h-3.5 text-[#2563eb] shrink-0" />}{a.favorite && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
      {prioBadge(a.priority)}<span className={cn("text-[10px] shrink-0", sub)}>{timeAgo(a.created_at)}</span>
    </div>
  ); };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Activity className="w-5 h-5 text-[#2563eb]" /> Activity</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Operational Activity Center · live business events</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/activity/export?format=csv" className={btnGhost}><Download className="w-4 h-4" /> CSV</a>
          <a href="/api/activity/export?format=json" className={btnGhost}><Download className="w-4 h-4" /> JSON</a>
        </div>
      </div>

      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {[["dashboard", "Dashboard", LayoutDashboard], ["feed", "Live Feed", Radio], ["table", "All Activity", ListChecks], ["pinned", "Pinned", Pin]].map(([id, l, I]) => <button key={id} onClick={() => setTab(id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><I className="w-3.5 h-3.5" /> {l}{id === "feed" && liveOn && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}{id === "pinned" && pinned.length > 0 && <span className="text-[9px] px-1.5 rounded-full bg-[#2563eb] text-white">{pinned.length}</span>}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">{kpis.map(k => (
            <div key={k.label} className={cn(cardCls, "p-3.5")}><p className={cn("text-[18px] font-extrabold", k.crit ? "text-red-500" : k.warn ? "text-orange-500" : txt)}>{k.value ?? 0}</p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
          ))}</div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={cn(cardCls, "p-4 lg:col-span-2")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Activity (14 days)</p><AreaChart series={dash.series || []} dark={dark} /></div>
            <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>By Module</p><BarList rows={dash.byModule} dark={dark} txt={txt} sub={sub} /></div>
          </div>
          <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Activity Heatmap</p><Heatmap data={dash.heatmap || {}} dark={dark} sub={sub} /></div>
        </div>
      )}

      {/* FEED */}
      {tab === "feed" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex items-center justify-between")}><div className="flex items-center gap-2"><span className={cn("w-2.5 h-2.5 rounded-full", liveOn ? "bg-emerald-500 animate-pulse" : "bg-gray-400")} /><span className={cn("text-sm font-bold", txt)}>{liveOn ? "Live — every 5s" : "Paused"}</span></div><button onClick={() => setLiveOn(v => !v)} className={btnGhost}>{liveOn ? "Pause" : "Resume"}</button></div>
          {pinned.length > 0 && <div className={cn(cardCls, "overflow-hidden")}><p className={cn("px-4 py-2 text-[11px] font-bold uppercase tracking-wider border-b flex items-center gap-1.5", sub, brd)}><Pin className="w-3 h-3" /> Pinned</p><div className={cn("divide-y", divide)}>{pinned.map(a => <FeedItem key={a.id} a={{ ...a, pinned: true }} />)}</div></div>}
          <div className={cn(cardCls, "overflow-hidden")}>{live.length === 0 ? <p className={cn("p-10 text-center text-sm", sub)}>Waiting for activity… new events appear here in real time.</p> : <div className={cn("divide-y", divide)}>{live.map(a => <FeedItem key={a.id} a={a} />)}</div>}</div>
        </div>
      )}

      {/* TABLE */}
      {tab === "table" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap gap-2 items-center")}>
            <div className="relative flex-1 min-w-[180px]"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} className={cn(inpCls, "pl-9 h-9")} placeholder="Search actor, action, description…" /></div>
            <select value={filters.module} onChange={e => setFilters(f => ({ ...f, module: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All modules</option>{MODULES.map(m => <option key={m} value={m}>{m}</option>)}</select>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All status</option>{Object.keys(STATUS).map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All priority</option>{Object.keys(PRIORITY).map(s => <option key={s} value={s}>{s}</option>)}</select>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Date", "Actor", "Module", "Action", "Description", "Status", "Priority", ""].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {list.activities.length === 0 ? <tr><td colSpan={8} className={cn("px-4 py-10 text-center", sub)}><Activity className="w-8 h-8 mx-auto mb-2" /><p className="text-sm">No activity matches your filters.</p></td></tr> :
                  list.activities.map(a => (
                    <tr key={a.id} className={cn(hover, "cursor-pointer")} onClick={() => openDetail(a.id)}>
                      <td className={cn("px-3 py-2.5 whitespace-nowrap font-semibold", txt)}>{fmtDT(a.created_at)}</td>
                      <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Avatar url={a.actor_avatar} name={a.actor_name} size={26} /><span className={txt}>{a.actor_name || "System"}</span></div></td>
                      <td className={cn("px-3 py-2.5 capitalize", sub)}>{a.module}</td>
                      <td className={cn("px-3 py-2.5 font-semibold capitalize", txt)}>{(a.action || "").replace(/_/g, " ")}</td>
                      <td className={cn("px-3 py-2.5 truncate max-w-[220px]", sub)}>{a.description}</td>
                      <td className="px-3 py-2.5">{statusBadge(a.status)}</td>
                      <td className="px-3 py-2.5">{prioBadge(a.priority)}</td>
                      <td className="px-3 py-2.5"><div className="flex items-center gap-1" onClick={e => e.stopPropagation()}><button onClick={() => togglePin(a)} title="Pin"><Pin className={cn("w-3.5 h-3.5", a.pinned ? "text-[#2563eb]" : sub)} /></button><button onClick={() => toggleFav(a)} title="Star"><Star className={cn("w-3.5 h-3.5", a.favorite ? "text-amber-500 fill-amber-500" : sub)} /></button></div></td>
                    </tr>
                  ))}
              </tbody>
            </table></div>
          </div>
          {list.total > list.pageSize && <div className="flex items-center justify-between"><span className={cn("text-xs", sub)}>{list.total.toLocaleString()} activities · page {list.page}</span><div className="flex gap-1.5"><button disabled={list.page <= 1} onClick={() => loadList(list.page - 1)} className={cn(btnGhost, "h-8 disabled:opacity-40")}>Prev</button><button disabled={list.page * list.pageSize >= list.total} onClick={() => loadList(list.page + 1)} className={cn(btnGhost, "h-8 disabled:opacity-40")}>Next</button></div></div>}
        </div>
      )}

      {/* PINNED */}
      {tab === "pinned" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <p className={cn("px-4 py-3 text-sm font-extrabold border-b flex items-center gap-2", txt, brd)}><Pin className="w-4 h-4 text-[#2563eb]" /> Pinned Activities</p>
          {pinned.length === 0 ? <div className="p-10 text-center"><Pin className={cn("w-8 h-8 mx-auto mb-2", sub)} /><p className={cn("text-sm", sub)}>No pinned activities. Pin important events to keep them here.</p></div> : <div className={cn("divide-y", divide)}>{pinned.map(a => <FeedItem key={a.id} a={{ ...a, pinned: true }} />)}</div>}
        </div>
      )}

      {/* DETAIL */}
      {detail && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDetail(null)}>
          <div className={cn("w-full max-w-xl h-full overflow-y-auto border-l", p, brd)} onClick={e => e.stopPropagation()}>
            {detail.loading ? <div className="p-10 flex justify-center"><Loader2 className={cn("w-6 h-6 animate-spin", sub)} /></div> : (() => { const a = detail.activity; const I = TYPE_ICON[a.activity_type] || Activity; const col = STATUS[a.status] || "#8a929c"; return (
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${col}1a` }}><I className="w-5 h-5" style={{ color: col }} /></div><div><p className={cn("text-lg font-extrabold capitalize", txt)}>{(a.action || "").replace(/_/g, " ")}</p><p className={cn("text-xs", sub)}>{fmtDT(a.created_at)} · {a.module}</p><div className="mt-1.5 flex gap-1.5">{statusBadge(a.status)}{prioBadge(a.priority)}</div></div></div>
                  <button onClick={() => setDetail(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => togglePin(a)} className={cn(btnGhost, a.pinned && "text-[#2563eb] border-[#2563eb]")}><Pin className="w-4 h-4" /> {a.pinned ? "Pinned" : "Pin"}</button>
                  <button onClick={() => toggleFav(a)} className={cn(btnGhost, a.favorite && "text-amber-500 border-amber-500")}><Star className={cn("w-4 h-4", a.favorite && "fill-amber-500")} /> {a.favorite ? "Starred" : "Star"}</button>
                </div>
                <Section title="Details" dark={dark} txt={txt} sub={sub} brd={brd} rows={[["Actor", a.actor_name], ["Module", a.module], ["Type", a.activity_type], ["Action", a.action], ["Description", a.description], ["Object", a.object_type ? `${a.object_type} ${a.object_id || ""}` : "—"], ["Status", a.status], ["Priority", a.priority], ["Country", a.country], ["When", fmtDT(a.created_at)]]} />

                <div className={cn("rounded-[12px] border", brd)}>
                  <p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b flex items-center gap-1.5", sub, brd)}><MessageSquare className="w-3.5 h-3.5" /> Private Notes</p>
                  <div className="p-3 space-y-2">
                    <div className="flex gap-2"><input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === "Enter" && addNote()} className={inpCls} placeholder="Add a private note…" /><button onClick={addNote} className={btnPrimary}><Send className="w-4 h-4" /></button></div>
                    {(detail.comments || []).map(c => <div key={c.id} className={cn("rounded-[10px] border p-2.5 flex items-start justify-between gap-2", brd)}><div><p className={cn("text-xs", txt)}>{c.note}</p><p className={cn("text-[10px] mt-0.5", sub)}>{c.admin_name} · {timeAgo(c.created_at)}</p></div><button onClick={() => act("comment-delete", { id: c.id, activity_id: a.id }, () => openDetail(a.id))} className="text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button></div>)}
                  </div>
                </div>

                <div className={cn(cardCls, "overflow-hidden")}>
                  <p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b", sub, brd)}>Related activity by this actor</p>
                  <div className={cn("divide-y", divide)}>{(detail.context || []).map(c => <div key={c.id} className="px-3 py-2 flex items-center gap-2 text-xs"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS[c.status] || "#8a929c" }} /><span className={cn("capitalize", txt)}>{(c.action || "").replace(/_/g, " ")}</span><span className={sub}>· {c.module}</span><span className={cn("ml-auto", sub)}>{timeAgo(c.created_at)}</span></div>)}</div>
                </div>
              </div>
            ); })()}
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200 max-w-sm", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}

function Section({ title, rows, dark, txt, sub, brd }) {
  return (
    <div className={cn("rounded-[12px] border", brd)}>
      <p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b", sub, brd)}>{title}</p>
      <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2">{rows.map(([k, v]) => <div key={k}><p className={cn("text-[10px]", sub)}>{k}</p><p className={cn("text-xs font-semibold break-words capitalize", txt)}>{v || "—"}</p></div>)}</div>
    </div>
  );
}
function BarList({ rows, dark, txt, sub }) {
  const list = rows || []; const max = Math.max(...list.map(r => r.count), 1);
  return list.length === 0 ? <p className={cn("text-xs", sub)}>No data.</p> : (
    <div className="space-y-1.5">{list.map((r, i) => (
      <div key={i} className="flex items-center gap-2"><span className={cn("text-[11px] font-semibold w-24 truncate capitalize", txt)}>{r.name}</span><div className={cn("flex-1 h-4 rounded-[5px] overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}><div className="h-full rounded-[5px] bg-[#2563eb]" style={{ width: `${(r.count / max) * 100}%` }} /></div><span className={cn("text-[11px] font-bold w-10 text-right", txt)}>{r.count}</span></div>
    ))}</div>
  );
}
function AreaChart({ series, dark }) {
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  if (!series.length) return <p className={cn("text-xs py-8 text-center", sub)}>No data.</p>;
  const w = 720, h = 160, pad = 10;
  const max = Math.max(...series.map(s => s.count), 1);
  const x = (i) => pad + (i / Math.max(series.length - 1, 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((Number(v) || 0) / max) * (h - pad * 2);
  const line = series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(s.count)}`).join(" ");
  const area = `${line} L${x(series.length - 1)},${h - pad} L${x(0)},${h - pad} Z`;
  return (
    <div className="overflow-x-auto"><svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ minWidth: 520 }}>
      <defs><linearGradient id="acg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#acg)" /><path d={line} fill="none" stroke="#2563eb" strokeWidth="2.5" />
      {series.map((s, i) => <circle key={i} cx={x(i)} cy={y(s.count)} r="2" fill="#2563eb" />)}
    </svg></div>
  );
}
function Heatmap({ data, dark, sub }) {
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const max = Math.max(...Object.values(data), 1);
  const color = (v) => { if (!v) return dark ? "#1d242e" : "#f0f2f5"; const t = v / max; return `rgba(37,99,235,${0.2 + t * 0.8})`; };
  return (
    <div className="overflow-x-auto"><div className="inline-block">
      <div className="flex gap-[3px] ml-8 mb-1">{Array.from({ length: 24 }).map((_, h) => <div key={h} className={cn("text-[8px] w-[13px] text-center", sub)}>{h % 6 === 0 ? h : ""}</div>)}</div>
      {DAYS.map((d, di) => <div key={d} className="flex items-center gap-[3px] mb-[3px]"><span className={cn("text-[9px] w-7", sub)}>{d}</span>{Array.from({ length: 24 }).map((_, h) => <div key={h} className="w-[13px] h-[13px] rounded-[2px]" style={{ backgroundColor: color(data[`${di}-${h}`] || 0) }} title={`${d} ${h}:00 — ${data[`${di}-${h}`] || 0}`} />)}</div>)}
    </div></div>
  );
}
