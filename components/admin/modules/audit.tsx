// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  ScrollText, LayoutDashboard, ListChecks, Radio, Settings2, Loader2, Search,
  Download, X, ChevronRight, ShieldCheck, AlertTriangle, Info, CheckCircle2,
  XCircle, Clock, Lock, Trash2, Save, User, Globe2, Monitor, FileClock,
} from "lucide-react";

type Props = { dark: boolean };

const LEVEL = { success: { c: "#16a34a", l: "Success" }, information: { c: "#2563eb", l: "Info" }, warning: { c: "#ea7317", l: "Warning" }, error: { c: "#dc2626", l: "Error" }, critical: { c: "#dc2626", l: "Critical" } };
const RISK = { low: "#16a34a", medium: "#ea7317", high: "#dc2626", critical: "#dc2626" };
const MODULES = ["dashboard", "orders", "products", "inventory", "categories", "brands", "customers", "reviews", "tickets", "coupons", "homepage", "media", "blog", "seo", "faq", "shipping", "returns", "payments", "notifications", "roles", "staff", "security", "auth", "analytics", "settings", "system"];
const SOURCES = ["audit", "auth", "security", "permissions", "staff", "notifications", "payments", "analytics"];
const RETENTION = [[30, "30 days"], [90, "90 days"], [180, "180 days"], [365, "1 year"], [1095, "3 years"], [0, "Unlimited"]];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function fmtT(d) { return d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return "—"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

export function AdminAudit({ dark }: Props) {
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
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [dash, setDash] = useState(null);
  const [list, setList] = useState({ events: [], total: 0, page: 1, pageSize: 30 });
  const [filters, setFilters] = useState({ q: "", module: "all", level: "all", source: "all", risk: "all", country: "" });
  const [live, setLive] = useState([]);
  const [liveOn, setLiveOn] = useState(true);
  const [detail, setDetail] = useState(null);
  const [settings, setSettings] = useState(null);
  const liveSince = useRef(new Date().toISOString());

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3000); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api/audit${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadDash = useCallback(async () => { try { setDash(await api("/dashboard")); } catch {} }, [api]);
  const loadList = useCallback(async (page = 1) => { try { const qs = new URLSearchParams({ page, pageSize: 30, ...filters }); const r = await api(`/list?${qs}`); setList({ ...r }); } catch (e) { showToast(e.message, "error"); } }, [api, filters, showToast]);
  const loadSettings = useCallback(async () => { try { const r = await api("/settings"); setSettings(r.settings); } catch {} }, [api]);

  useEffect(() => { (async () => { setLoading(true); await loadDash(); setLoading(false); })(); }, [loadDash]);
  useEffect(() => { if (tab === "dashboard") loadDash(); if (tab === "table") loadList(1); if (tab === "settings") loadSettings(); }, [tab]); // eslint-disable-line
  useEffect(() => { if (tab === "table") loadList(1); }, [filters]); // eslint-disable-line

  useEffect(() => {
    if (tab !== "live" || !liveOn) return; let stop = false;
    const poll = async () => { try { const r = await api(`/live?since=${encodeURIComponent(liveSince.current)}`); if (r.events?.length) { liveSince.current = r.events[0].created_at; setLive(prev => [...r.events, ...prev].slice(0, 100)); } } catch {} if (!stop) setTimeout(poll, 5000); };
    poll(); return () => { stop = true; };
  }, [tab, liveOn, api]);

  const openDetail = async (id) => { setDetail({ loading: true }); try { setDetail(await api(`/detail?id=${encodeURIComponent(id)}`)); } catch (e) { showToast(e.message, "error"); setDetail(null); } };
  const saveSettings = async () => { setBusy("save"); try { await api("/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) }); showToast("Retention policy saved"); } catch (e) { showToast(e.message, "error"); } finally { setBusy(null); } };
  const purge = async () => { setBusy("purge"); try { const r = await api("/purge", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); showToast(`Purged ${r.purged} rows`); loadDash(); } catch (e) { showToast(e.message, "error"); } finally { setBusy(null); } };

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const kpis = [
    { label: "Today", value: K.today }, { label: "This Week", value: K.week }, { label: "This Month", value: K.month },
    { label: "Active Users", value: K.activeUsers }, { label: "Admin Actions", value: K.adminActions },
    { label: "Failed", value: K.failed, level: "error" }, { label: "Security", value: K.security, level: "warning" },
    { label: "Payments", value: K.payments }, { label: "Products", value: K.products }, { label: "Orders", value: K.orders },
    { label: "Critical", value: K.critical, level: "critical" }, { label: "Warnings", value: K.warning, level: "warning" },
    { label: "Info", value: K.info, level: "information" }, { label: "Success", value: K.success, level: "success" },
  ];

  const levelBadge = (l) => <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${LEVEL[l]?.c || "#8a929c"}1a`, color: LEVEL[l]?.c || "#8a929c" }}>{LEVEL[l]?.l || l}</span>;
  const resultBadge = (r) => <span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ backgroundColor: r === "ok" || r === "success" ? "#16a34a1a" : "#dc26261a", color: r === "ok" || r === "success" ? "#16a34a" : "#dc2626" }}>{r}</span>;

  const Feed = ({ items, onClick }) => (
    <div className={cn("divide-y", divide)}>
      {items.map(e => (
        <div key={e.id} className={cn("px-4 py-2.5 flex items-center gap-3 cursor-pointer", hover)} onClick={() => onClick(e.id)}>
          <span className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: LEVEL[e.level]?.c || "#8a929c" }} />
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-semibold truncate", txt)}><span className="capitalize">{(e.action || "").replace(/_/g, " ")}</span> <span className={cn("font-normal", sub)}>· {e.module}</span></p>
            <p className={cn("text-[11px] truncate", sub)}>{e.actor_name || "System"} {e.ip_address && `· ${e.ip_address}`} {e.description && `· ${e.description}`}</p>
          </div>
          {levelBadge(e.level)}<span className={cn("text-[10px] shrink-0", sub)}>{fmtT(e.created_at)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><ScrollText className="w-5 h-5 text-[#2563eb]" /> Audit Log <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 flex items-center gap-1"><Lock className="w-3 h-3" /> Immutable</span></h1>
          <p className={cn("text-xs mt-0.5", sub)}>Activity Center · aggregates every platform action</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/audit/export?format=csv" className={btnGhost}><Download className="w-4 h-4" /> CSV</a>
          <a href="/api/audit/export?format=json" className={btnGhost}><Download className="w-4 h-4" /> JSON</a>
        </div>
      </div>

      {/* TABS */}
      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {[["dashboard", "Dashboard", LayoutDashboard], ["table", "Audit Log", ListChecks], ["live", "Live Audit", Radio], ["settings", "Retention", Settings2]].map(([id, l, I]) => <button key={id} onClick={() => setTab(id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><I className="w-3.5 h-3.5" /> {l}{id === "live" && liveOn && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">{kpis.map(k => (
            <div key={k.label} className={cn(cardCls, "p-3.5")}><p className="text-[18px] font-extrabold" style={{ color: k.level ? LEVEL[k.level].c : undefined }}><span className={k.level ? "" : txt}>{k.value ?? 0}</span></p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
          ))}</div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={cn(cardCls, "p-4 lg:col-span-2")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Events (14 days)</p><AreaChart series={dash.series || []} dark={dark} /></div>
            <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>By Source</p><BarList rows={dash.bySource} dark={dark} txt={txt} sub={sub} /></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Activity Heatmap</p><Heatmap data={dash.heatmap || {}} dark={dark} sub={sub} /></div>
            <div className={cn(cardCls, "overflow-hidden")}><p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b", sub, brd)}>Live Activity Feed</p>{(dash.recent || []).length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No events yet.</p> : <Feed items={dash.recent} onClick={openDetail} />}</div>
          </div>
        </div>
      )}

      {/* TABLE */}
      {tab === "table" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap gap-2 items-center")}>
            <div className="relative flex-1 min-w-[180px]"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} className={cn(inpCls, "pl-9 h-9")} placeholder="Search actor, action, description, IP…" /></div>
            <select value={filters.module} onChange={e => setFilters(f => ({ ...f, module: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All modules</option>{MODULES.map(m => <option key={m} value={m}>{m}</option>)}</select>
            <select value={filters.level} onChange={e => setFilters(f => ({ ...f, level: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All levels</option>{Object.keys(LEVEL).map(l => <option key={l} value={l}>{l}</option>)}</select>
            <select value={filters.source} onChange={e => setFilters(f => ({ ...f, source: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All sources</option>{SOURCES.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select value={filters.risk} onChange={e => setFilters(f => ({ ...f, risk: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All risk</option>{["low", "medium", "high", "critical"].map(r => <option key={r} value={r}>{r}</option>)}</select>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Date", "Actor", "Module", "Action", "Description", "IP", "Level", "Result", ""].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {list.events.length === 0 ? <tr><td colSpan={9} className={cn("px-4 py-10 text-center", sub)}><ScrollText className="w-8 h-8 mx-auto mb-2" /><p className="text-sm">No audit events match. Events are recorded automatically as actions occur.</p></td></tr> :
                  list.events.map(e => (
                    <tr key={e.id} className={cn(hover, "cursor-pointer")} onClick={() => openDetail(e.id)}>
                      <td className={cn("px-3 py-2.5 whitespace-nowrap font-semibold", txt)}>{fmtDT(e.created_at)}</td>
                      <td className={cn("px-3 py-2.5", txt)}>{e.actor_name || "System"}</td>
                      <td className={cn("px-3 py-2.5 capitalize", sub)}>{e.module}</td>
                      <td className={cn("px-3 py-2.5 font-semibold capitalize", txt)}>{(e.action || "").replace(/_/g, " ")}</td>
                      <td className={cn("px-3 py-2.5 truncate max-w-[220px]", sub)}>{e.description || "—"}</td>
                      <td className={cn("px-3 py-2.5", sub)}>{e.ip_address || "—"}</td>
                      <td className="px-3 py-2.5">{levelBadge(e.level)}</td>
                      <td className="px-3 py-2.5">{resultBadge(e.result)}</td>
                      <td className="px-3 py-2.5"><ChevronRight className={cn("w-4 h-4", sub)} /></td>
                    </tr>
                  ))}
              </tbody>
            </table></div>
          </div>
          {list.total > list.pageSize && <div className="flex items-center justify-between"><span className={cn("text-xs", sub)}>{list.total.toLocaleString()} events · page {list.page}</span><div className="flex gap-1.5"><button disabled={list.page <= 1} onClick={() => loadList(list.page - 1)} className={cn(btnGhost, "h-8 disabled:opacity-40")}>Prev</button><button disabled={list.page * list.pageSize >= list.total} onClick={() => loadList(list.page + 1)} className={cn(btnGhost, "h-8 disabled:opacity-40")}>Next</button></div></div>}
        </div>
      )}

      {/* LIVE */}
      {tab === "live" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex items-center justify-between")}><div className="flex items-center gap-2"><span className={cn("w-2.5 h-2.5 rounded-full", liveOn ? "bg-emerald-500 animate-pulse" : "bg-gray-400")} /><span className={cn("text-sm font-bold", txt)}>{liveOn ? "Live — every 5s" : "Paused"}</span></div><button onClick={() => setLiveOn(v => !v)} className={btnGhost}>{liveOn ? "Pause" : "Resume"}</button></div>
          <div className={cn(cardCls, "overflow-hidden")}>{live.length === 0 ? <p className={cn("p-10 text-center text-sm", sub)}>Waiting for new events… Any action across the platform appears here in real time.</p> : <Feed items={live} onClick={openDetail} />}</div>
        </div>
      )}

      {/* SETTINGS */}
      {tab === "settings" && settings && (
        <div className="space-y-4 max-w-2xl">
          <div className={cn(cardCls, "p-5 space-y-4")}>
            <div className="flex items-center gap-2"><FileClock className="w-5 h-5 text-[#2563eb]" /><p className={cn("text-sm font-extrabold", txt)}>Retention Policy</p></div>
            <p className={cn("text-xs", sub)}>Audit logs are <b className={txt}>immutable</b> — they can never be edited or deleted from the interface. Only the automatic retention policy below may remove old entries (DB-guarded).</p>
            <div><label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Keep logs for</label><select value={settings.retention_days} onChange={e => setSettings(s => ({ ...s, retention_days: parseInt(e.target.value) }))} className={inpCls}>{RETENTION.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!settings.auto_purge} onChange={e => setSettings(s => ({ ...s, auto_purge: e.target.checked }))} className="rounded" /><span className={cn("text-sm font-semibold", txt)}>Enable automatic purge of expired logs</span></label>
            <div className="flex gap-2">
              <button onClick={saveSettings} disabled={busy === "save"} className={btnPrimary}>{busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Policy</button>
              <button onClick={() => setConfirm({ title: "Run retention purge now?", message: `Permanently delete audit logs older than the retention window (${RETENTION.find(r => r[0] === settings.retention_days)?.[1]}). This cannot be undone.`, danger: true, onConfirm: purge })} disabled={busy === "purge" || settings.retention_days === 0} className={cn(btnGhost, "text-red-500")}>{busy === "purge" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Run Purge Now</button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {detail && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDetail(null)}>
          <div className={cn("w-full max-w-xl h-full overflow-y-auto border-l", p, brd)} onClick={e => e.stopPropagation()}>
            {detail.loading ? <div className="p-10 flex justify-center"><Loader2 className={cn("w-6 h-6 animate-spin", sub)} /></div> : (() => { const e = detail.event; return (
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div><p className={cn("text-lg font-extrabold capitalize", txt)}>{(e.action || "").replace(/_/g, " ")}</p><p className={cn("text-xs", sub)}>{fmtDT(e.created_at)} · {e.source}</p><div className="mt-1.5 flex gap-1.5 flex-wrap">{levelBadge(e.level)}{resultBadge(e.result)}<span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ background: dark ? "#1d242e" : "#f0f2f5", color: sub }}>{e.module}</span></div></div>
                  <button onClick={() => setDetail(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button>
                </div>
                <Section title="Who / What / When" icon={User} dark={dark} txt={txt} sub={sub} brd={brd} rows={[["Actor", e.actor_name], ["Module", e.module], ["Submodule", e.submodule], ["Action", e.action], ["Description", e.description], ["Object", e.object_type ? `${e.object_type} ${e.object_id || ""}` : "—"], ["When", fmtDT(e.created_at)]]} />
                <Section title="Where" icon={Globe2} dark={dark} txt={txt} sub={sub} brd={brd} rows={[["IP", e.ip_address], ["Country", e.country], ["City", e.city], ["Browser", e.browser], ["OS", e.os], ["Risk", e.risk_level]]} />
                {(e.old_value || e.new_value) && (
                  <div className={cn("rounded-[12px] border", brd)}>
                    <p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b", sub, brd)}>Change (old → new)</p>
                    <div className="p-3 grid grid-cols-2 gap-3">
                      <div><p className={cn("text-[10px] mb-1", sub)}>Old</p><pre className={cn("text-[11px] p-2 rounded-lg overflow-x-auto", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]", txt)}>{e.old_value || "—"}</pre></div>
                      <div><p className={cn("text-[10px] mb-1", sub)}>New</p><pre className={cn("text-[11px] p-2 rounded-lg overflow-x-auto", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]", txt)}>{e.new_value || "—"}</pre></div>
                    </div>
                  </div>
                )}
                <div className={cn(cardCls, "overflow-hidden")}>
                  <p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b", sub, brd)}>Context — recent events by this actor</p>
                  <div className={cn("divide-y", divide)}>
                    {(detail.context || []).map(c => <div key={c.id} className="px-3 py-2 flex items-center gap-2 text-xs"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: LEVEL[c.level]?.c || "#8a929c" }} /><span className={cn("capitalize", txt)}>{(c.action || "").replace(/_/g, " ")}</span><span className={sub}>· {c.module}</span><span className={cn("ml-auto", sub)}>{timeAgo(c.created_at)}</span></div>)}
                  </div>
                </div>
              </div>
            ); })()}
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirm(null)}>
          <div className={cn("w-full max-w-sm rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><AlertTriangle className={cn("w-5 h-5", confirm.danger ? "text-red-500" : "text-amber-500")} /> {confirm.title}</p>
            <p className={cn("text-sm", sub)}>{confirm.message}</p>
            <div className="flex gap-2 justify-end"><button onClick={() => setConfirm(null)} className={btnGhost}>Cancel</button><button onClick={() => { confirm.onConfirm(); setConfirm(null); }} className={cn("h-10 px-4 rounded-[11px] text-white text-sm font-bold", confirm.danger ? "bg-red-500 hover:bg-red-600" : "bg-[#2563eb]")}>Confirm</button></div>
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200 max-w-sm", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}

function Section({ title, icon: Icon, rows, dark, txt, sub, brd }) {
  return (
    <div className={cn("rounded-[12px] border", brd)}>
      <p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b flex items-center gap-1.5", sub, brd)}><Icon className="w-3.5 h-3.5" /> {title}</p>
      <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2">{rows.map(([k, v]) => <div key={k}><p className={cn("text-[10px]", sub)}>{k}</p><p className={cn("text-xs font-semibold break-words", txt)}>{v || "—"}</p></div>)}</div>
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
  const max = Math.max(...series.map(s => s.total), 1);
  const x = (i) => pad + (i / Math.max(series.length - 1, 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((Number(v) || 0) / max) * (h - pad * 2);
  const line = (k) => series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(s[k])}`).join(" ");
  const area = `${line("total")} L${x(series.length - 1)},${h - pad} L${x(0)},${h - pad} Z`;
  return (
    <div className="overflow-x-auto"><svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ minWidth: 520 }}>
      <defs><linearGradient id="au" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#au)" /><path d={line("total")} fill="none" stroke="#2563eb" strokeWidth="2.5" /><path d={line("errors")} fill="none" stroke="#dc2626" strokeWidth="2" />
      {series.map((s, i) => <circle key={i} cx={x(i)} cy={y(s.total)} r="2" fill="#2563eb" />)}
    </svg>
      <div className="flex gap-4 mt-2 text-[11px]"><span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-[#2563eb] rounded" />Total</span><span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-[#dc2626] rounded" />Errors</span></div>
    </div>
  );
}

function Heatmap({ data, dark, sub }) {
  const max = Math.max(...Object.values(data), 1);
  const color = (v) => { if (!v) return dark ? "#1d242e" : "#f0f2f5"; const t = v / max; return `rgba(37,99,235,${0.2 + t * 0.8})`; };
  return (
    <div className="overflow-x-auto"><div className="inline-block">
      <div className="flex gap-[3px] ml-8 mb-1">{Array.from({ length: 24 }).map((_, h) => <div key={h} className={cn("text-[8px] w-[13px] text-center", sub)}>{h % 6 === 0 ? h : ""}</div>)}</div>
      {DAYS.map((d, di) => <div key={d} className="flex items-center gap-[3px] mb-[3px]"><span className={cn("text-[9px] w-7", sub)}>{d}</span>{Array.from({ length: 24 }).map((_, h) => <div key={h} className="w-[13px] h-[13px] rounded-[2px]" style={{ backgroundColor: color(data[`${di}-${h}`] || 0) }} title={`${d} ${h}:00 — ${data[`${di}-${h}`] || 0}`} />)}</div>)}
    </div></div>
  );
}
