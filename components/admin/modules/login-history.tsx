// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  History, LayoutDashboard, ListChecks, Radio, Loader2, Search, Download, X,
  Ban, Power, KeyRound, ShieldAlert, CheckCircle2, XCircle, AlertTriangle,
  Monitor, Smartphone, Tablet, Globe2, MapPin, Wifi, Clock, Fingerprint,
  RefreshCw, Eye, ShieldOff, UserX, ChevronRight,
} from "lucide-react";

type Props = { dark: boolean };

const RISK = { low: { c: "#16a34a", l: "Low" }, medium: { c: "#ea7317", l: "Medium" }, high: { c: "#dc2626", l: "High" }, critical: { c: "#dc2626", l: "Critical" } };
const STATUS_OK = "success";
const METHODS = ["email", "phone", "google", "facebook", "apple", "github", "magic_link", "passkey"];
const STATUSES = ["success", "failed", "password_incorrect", "blocked", "locked", "expired", "2fa_failed", "otp_failed", "session_expired"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function fmtT(d) { return d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return "never"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }
function DeviceIcon({ t, className }) { const I = t === "phone" ? Smartphone : t === "tablet" ? Tablet : Monitor; return <I className={className} />; }

export function AdminLoginHistory({ dark }: Props) {
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
  const [list, setList] = useState({ logs: [], total: 0, page: 1, pageSize: 25 });
  const [filters, setFilters] = useState({ q: "", status: "all", risk: "all", method: "all", country: "" });
  const [live, setLive] = useState([]);
  const [liveOn, setLiveOn] = useState(true);
  const [detail, setDetail] = useState(null);
  const liveSince = useRef(new Date().toISOString());

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3000); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api/login-history${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadDash = useCallback(async () => { try { setDash(await api("/dashboard")); } catch {} }, [api]);
  const loadList = useCallback(async (page = 1) => {
    try { const qs = new URLSearchParams({ page, pageSize: 25, ...filters }); const r = await api(`/list?${qs}`); setList({ ...r }); } catch (e) { showToast(e.message, "error"); }
  }, [api, filters, showToast]);

  useEffect(() => { (async () => { setLoading(true); await loadDash(); setLoading(false); })(); }, [loadDash]);
  useEffect(() => { if (tab === "dashboard") loadDash(); if (tab === "table") loadList(1); }, [tab]); // eslint-disable-line
  useEffect(() => { if (tab === "table") loadList(1); }, [filters]); // eslint-disable-line

  // live monitoring poll
  useEffect(() => {
    if (tab !== "live" || !liveOn) return;
    let stop = false;
    const poll = async () => {
      try { const r = await api(`/live?since=${encodeURIComponent(liveSince.current)}`);
        if (r.logs?.length) { liveSince.current = r.logs[0].created_at; setLive(prev => [...r.logs, ...prev].slice(0, 100)); } } catch {}
      if (!stop) setTimeout(poll, 5000);
    };
    poll();
    return () => { stop = true; };
  }, [tab, liveOn, api]);

  const post = async (action, body, okMsg, after) => {
    setBusy(action + (body?.ip || body?.session_id || ""));
    try { const r = await api(`/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (okMsg) showToast(typeof okMsg === "function" ? okMsg(r) : okMsg); if (after) await after(r); return r; }
    catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };

  const openDetail = async (id) => { setDetail({ loading: true }); try { setDetail(await api(`/session?id=${id}`)); } catch (e) { showToast(e.message, "error"); setDetail(null); } };

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const kpis = [
    { label: "Logins Today", value: K.today }, { label: "This Week", value: K.week }, { label: "This Month", value: K.month },
    { label: "Successful", value: K.successful, good: true }, { label: "Failed", value: K.failed, warn: K.failed > 0 },
    { label: "Active Sessions", value: K.activeSessions }, { label: "Locked", value: K.lockedAccounts, warn: K.lockedAccounts > 0 },
    { label: "Suspicious", value: K.suspicious, crit: K.suspicious > 0 }, { label: "New Devices", value: K.newDevices },
    { label: "New Locations", value: K.newLocations }, { label: "VPN / TOR", value: K.vpnTor, warn: K.vpnTor > 0 },
  ];

  const riskBadge = (r) => <span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ backgroundColor: `${RISK[r]?.c || "#8a929c"}1a`, color: RISK[r]?.c || "#8a929c" }}>{RISK[r]?.l || r}</span>;
  const statusBadge = (s) => <span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ backgroundColor: s === STATUS_OK ? "#16a34a1a" : "#dc26261a", color: s === STATUS_OK ? "#16a34a" : "#dc2626" }}>{(s || "").replace(/_/g, " ")}</span>;

  const Row = ({ log, onClick }) => (
    <tr className={cn(hover, "cursor-pointer")} onClick={onClick}>
      <td className={cn("px-3 py-2.5 whitespace-nowrap", sub)}><span className={cn("font-semibold", txt)}>{fmtDT(log.created_at)}</span></td>
      <td className="px-3 py-2.5"><div><p className={cn("font-semibold", txt)}>{log.full_name || log.email || "Unknown"}</p><p className={cn("text-[10px]", sub)}>{log.email} {log.role && `· ${log.role}`}</p></div></td>
      <td className={cn("px-3 py-2.5", sub)}>{log.ip_address || "—"}{(log.is_vpn || log.is_tor || log.is_proxy) && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-red-500/15 text-red-500 font-bold">{log.is_tor ? "TOR" : log.is_vpn ? "VPN" : "PROXY"}</span>}</td>
      <td className={cn("px-3 py-2.5", sub)}><span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[log.city, log.country].filter(Boolean).join(", ") || "—"}</span></td>
      <td className={cn("px-3 py-2.5", sub)}><span className="flex items-center gap-1.5"><DeviceIcon t={log.device_type} className="w-3.5 h-3.5" />{log.browser || "—"}</span></td>
      <td className={cn("px-3 py-2.5 capitalize", sub)}>{(log.method || "").replace(/_/g, " ")}</td>
      <td className="px-3 py-2.5">{statusBadge(log.status)}</td>
      <td className="px-3 py-2.5">{riskBadge(log.risk_level)}</td>
      <td className="px-3 py-2.5"><ChevronRight className={cn("w-4 h-4", sub)} /></td>
    </tr>
  );

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><History className="w-5 h-5 text-[#2563eb]" /> Login History</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Access Monitoring Center · last login {timeAgo(K.lastLogin)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/login-history/export?format=csv" className={btnGhost}><Download className="w-4 h-4" /> CSV</a>
          <a href="/api/login-history/export?format=json" className={btnGhost}><Download className="w-4 h-4" /> JSON</a>
        </div>
      </div>

      {/* TABS */}
      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {[["dashboard", "Dashboard", LayoutDashboard], ["table", "History", ListChecks], ["live", "Live Monitoring", Radio]].map(([id, l, I]) => <button key={id} onClick={() => setTab(id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><I className="w-3.5 h-3.5" /> {l}{id === "live" && liveOn && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">{kpis.map(k => (
            <div key={k.label} className={cn(cardCls, "p-3.5")}><p className={cn("text-[18px] font-extrabold", k.crit ? "text-red-500" : k.warn ? "text-orange-500" : k.good ? "text-emerald-600" : txt)}>{k.value ?? 0}</p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
          ))}</div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={cn(cardCls, "p-4 lg:col-span-2")}>
              <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Logins (14 days)</p>
              <LoginChart series={dash.series || []} dark={dark} />
            </div>
            <div className={cn(cardCls, "overflow-hidden")}>
              <p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b", sub, brd)}>Security Events</p>
              <div className={cn("divide-y max-h-64 overflow-y-auto", divide)}>
                {(dash.events || []).length === 0 ? <p className={cn("p-4 text-xs", sub)}>No events.</p> :
                  dash.events.map((e, i) => <div key={i} className="px-4 py-2.5 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: RISK[e.severity === "critical" ? "critical" : e.severity === "medium" ? "medium" : "low"].c }} /><span className={cn("text-xs font-semibold capitalize", txt)}>{(e.event_type || "").replace(/_/g, " ")}</span><span className={cn("text-[10px] ml-auto", sub)}>{timeAgo(e.created_at)}</span></div>)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={cn(cardCls, "p-4")}>
              <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Login Heatmap (day × hour)</p>
              <Heatmap data={dash.heatmap || {}} dark={dark} sub={sub} />
            </div>
            <div className={cn(cardCls, "p-4")}>
              <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Logins by Country</p>
              <WorldMap points={dash.worldMap || []} dark={dark} txt={txt} sub={sub} />
            </div>
          </div>
        </div>
      )}

      {/* TABLE */}
      {tab === "table" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap gap-2 items-center")}>
            <div className="relative flex-1 min-w-[180px]"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} className={cn(inpCls, "pl-9 h-9")} placeholder="Search email, name, IP, city…" /></div>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All status</option>{STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
            <select value={filters.risk} onChange={e => setFilters(f => ({ ...f, risk: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All risk</option>{["low", "medium", "high", "critical"].map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select value={filters.method} onChange={e => setFilters(f => ({ ...f, method: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All methods</option>{METHODS.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
            <input value={filters.country} onChange={e => setFilters(f => ({ ...f, country: e.target.value }))} className={cn(inpCls, "w-32 h-9")} placeholder="Country" />
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Date", "User", "IP", "Location", "Device", "Method", "Status", "Risk", ""].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {list.logs.length === 0 ? <tr><td colSpan={9} className={cn("px-4 py-10 text-center", sub)}><History className="w-8 h-8 mx-auto mb-2" /><p className="text-sm">No login records yet. They appear here automatically as users sign in.</p></td></tr> :
                  list.logs.map(log => <Row key={log.id} log={log} onClick={() => openDetail(log.id)} />)}
              </tbody>
            </table></div>
          </div>
          {list.total > list.pageSize && <div className="flex items-center justify-between"><span className={cn("text-xs", sub)}>{list.total} records · page {list.page}</span><div className="flex gap-1.5"><button disabled={list.page <= 1} onClick={() => loadList(list.page - 1)} className={cn(btnGhost, "h-8 disabled:opacity-40")}>Prev</button><button disabled={list.page * list.pageSize >= list.total} onClick={() => loadList(list.page + 1)} className={cn(btnGhost, "h-8 disabled:opacity-40")}>Next</button></div></div>}
        </div>
      )}

      {/* LIVE */}
      {tab === "live" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex items-center justify-between")}>
            <div className="flex items-center gap-2"><span className={cn("w-2.5 h-2.5 rounded-full", liveOn ? "bg-emerald-500 animate-pulse" : "bg-gray-400")} /><span className={cn("text-sm font-bold", txt)}>{liveOn ? "Live — polling every 5s" : "Paused"}</span></div>
            <button onClick={() => setLiveOn(v => !v)} className={btnGhost}>{liveOn ? "Pause" : "Resume"}</button>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className={cn("divide-y max-h-[600px] overflow-y-auto", divide)}>
              {live.length === 0 ? <p className={cn("p-10 text-center text-sm", sub)}>Waiting for new logins… New sign-ins appear here in real time.</p> :
                live.map(log => (
                  <div key={log.id} className={cn("px-4 py-3 flex items-center gap-3 animate-in slide-in-from-top-1 duration-300 cursor-pointer", hover)} onClick={() => openDetail(log.id)}>
                    <DeviceIcon t={log.device_type} className={cn("w-4 h-4 shrink-0", sub)} />
                    <div className="min-w-0 flex-1"><p className={cn("text-sm font-bold truncate", txt)}>{log.full_name || log.email || "Unknown"}</p><p className={cn("text-[10px]", sub)}>{log.browser} · {[log.city, log.country].filter(Boolean).join(", ") || "—"} · {log.ip_address}</p></div>
                    {statusBadge(log.status)}{riskBadge(log.risk_level)}<span className={cn("text-[10px] shrink-0", sub)}>{fmtT(log.created_at)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {detail && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDetail(null)}>
          <div className={cn("w-full max-w-xl h-full overflow-y-auto border-l", p, brd)} onClick={e => e.stopPropagation()}>
            {detail.loading ? <div className="p-10 flex justify-center"><Loader2 className={cn("w-6 h-6 animate-spin", sub)} /></div> : (() => { const l = detail.login; return (
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div><p className={cn("text-lg font-extrabold", txt)}>{l.full_name || l.email || "Unknown"}</p><p className={cn("text-xs", sub)}>{fmtDT(l.created_at)}</p><div className="mt-1.5 flex gap-1.5 flex-wrap">{statusBadge(l.status)}{riskBadge(l.risk_level)}<span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ background: dark ? "#1d242e" : "#f0f2f5" }}>{(l.method || "").replace(/_/g, " ")}</span></div></div>
                  <button onClick={() => setDetail(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button>
                </div>

                {(l.risk_factors || []).length > 0 && (
                  <div className={cn("rounded-[12px] border p-3", "border-red-500/30 bg-red-500/[.05]")}>
                    <p className="text-xs font-bold text-red-500 mb-1.5 flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Risk Factors (score {l.risk_score})</p>
                    <div className="flex flex-wrap gap-1.5">{l.risk_factors.map((f, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/15 text-red-500 capitalize">{f.replace(/_/g, " ")}</span>)}</div>
                  </div>
                )}

                <Section title="User" icon={UserX} dark={dark} txt={txt} sub={sub} brd={brd} rows={[["Email", l.email], ["Role", l.role], ["Roles", (detail.roles || []).map(r => r.name).join(", ") || "—"]]} />
                <Section title="Device" icon={Monitor} dark={dark} txt={txt} sub={sub} brd={brd} rows={[["Type", l.device_type], ["Device", l.device], ["OS", l.os], ["Browser", `${l.browser} ${l.browser_version || ""}`], ["Resolution", l.screen_resolution], ["Language", l.language]]} />
                <Section title="Location" icon={Globe2} dark={dark} txt={txt} sub={sub} brd={brd} rows={[["IP", l.ip_address], ["Country", l.country], ["State", l.state], ["City", l.city], ["Coordinates", l.latitude ? `${l.latitude}, ${l.longitude}` : "—"], ["ISP", l.isp], ["Network", l.network], ["Timezone", l.timezone], ["VPN / Proxy / TOR", `${l.is_vpn ? "VPN " : ""}${l.is_proxy ? "Proxy " : ""}${l.is_tor ? "TOR" : ""}` || "None"]]} />

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => post("block-ip", { ip: l.ip_address }, "IP blocked")} disabled={!l.ip_address} className={cn(btnGhost, "text-red-500")}><Ban className="w-4 h-4" /> Block IP</button>
                  <button onClick={() => post("unblock-ip", { ip: l.ip_address }, "IP unblocked")} className={btnGhost}><ShieldOff className="w-4 h-4" /> Unblock IP</button>
                  {l.session_id && <button onClick={() => post("logout-session", { session_id: l.session_id, user_id: l.user_id }, "Session ended")} className={btnGhost}><Power className="w-4 h-4" /> Logout Session</button>}
                  {l.user_id && <button onClick={() => setConfirm({ title: "Force password reset?", message: `${l.email} will receive a new temporary password by email.`, onConfirm: () => post("reset-password", { user_id: l.user_id }, "Password reset & emailed") })} className={btnGhost}><KeyRound className="w-4 h-4" /> Reset Password</button>}
                  {l.user_id && <button onClick={() => setConfirm({ title: "Suspend account?", message: `${l.email} will lose access immediately.`, danger: true, onConfirm: () => post("suspend", { user_id: l.user_id }, "Account suspended") })} className={cn(btnGhost, "text-red-500")}><UserX className="w-4 h-4" /> Suspend</button>}
                </div>

                <div className={cn(cardCls, "overflow-hidden")}>
                  <p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b", sub, brd)}>Recent logins for this user</p>
                  <div className={cn("divide-y", divide)}>
                    {(detail.history || []).map(h => <div key={h.id} className="px-3 py-2 flex items-center gap-2 text-xs"><span className={cn("w-1.5 h-1.5 rounded-full", h.status === "success" ? "bg-emerald-500" : "bg-red-500")} /><span className={txt}>{[h.city, h.country].filter(Boolean).join(", ") || h.ip_address}</span>{riskBadge(h.risk_level)}<span className={cn("ml-auto", sub)}>{timeAgo(h.created_at)}</span></div>)}
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
      <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map(([k, v]) => <div key={k}><p className={cn("text-[10px]", sub)}>{k}</p><p className={cn("text-xs font-semibold truncate", txt)}>{v || "—"}</p></div>)}
      </div>
    </div>
  );
}

function LoginChart({ series, dark }) {
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  if (!series.length) return <p className={cn("text-xs py-8 text-center", sub)}>No data.</p>;
  const w = 720, h = 160, pad = 10;
  const max = Math.max(...series.map(s => s.success + s.failed), 1);
  const bw = (w - pad * 2) / series.length;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ minWidth: 520 }}>
        {series.map((s, i) => { const x = pad + i * bw; const sh = (s.success / max) * (h - pad * 2); const fh = (s.failed / max) * (h - pad * 2); return (
          <g key={i}>
            <rect x={x + bw * 0.2} y={h - pad - sh} width={bw * 0.6} height={sh} fill="#16a34a" rx="1.5" />
            <rect x={x + bw * 0.2} y={h - pad - sh - fh} width={bw * 0.6} height={fh} fill="#dc2626" rx="1.5" />
          </g>
        ); })}
      </svg>
      <div className="flex gap-4 mt-2 text-[11px]"><span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#16a34a]" />Success</span><span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#dc2626]" />Failed</span></div>
    </div>
  );
}

function Heatmap({ data, dark, sub }) {
  const max = Math.max(...Object.values(data), 1);
  const color = (v) => { if (!v) return dark ? "#1d242e" : "#f0f2f5"; const t = v / max; return `rgba(37,99,235,${0.2 + t * 0.8})`; };
  return (
    <div className="overflow-x-auto"><div className="inline-block">
      <div className="flex gap-[3px] ml-8 mb-1">{Array.from({ length: 24 }).map((_, h) => <div key={h} className={cn("text-[8px] w-[13px] text-center", sub)}>{h % 6 === 0 ? h : ""}</div>)}</div>
      {DAYS.map((d, di) => (
        <div key={d} className="flex items-center gap-[3px] mb-[3px]"><span className={cn("text-[9px] w-7", sub)}>{d}</span>{Array.from({ length: 24 }).map((_, h) => <div key={h} className="w-[13px] h-[13px] rounded-[2px]" style={{ backgroundColor: color(data[`${di}-${h}`] || 0) }} title={`${d} ${h}:00 — ${data[`${di}-${h}`] || 0}`} />)}</div>
      ))}
    </div></div>
  );
}

function WorldMap({ points, dark, txt, sub }) {
  // Simplified equirectangular projection dot map + ranked list (no external assets).
  const W = 360, H = 180;
  const proj = (lat, lon) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
  const max = Math.max(...points.map(p => p.count), 1);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-[10px]" style={{ background: dark ? "#1d242e" : "#f0f2f5" }}>
        <rect x="0" y="0" width={W} height={H} fill="none" />
        {points.filter(p => p.lat != null).map((p, i) => { const [x, y] = proj(p.lat, p.lon); const r = 2 + (p.count / max) * 6; return <g key={i}><circle cx={x} cy={y} r={r} fill="#2563eb" opacity="0.35" /><circle cx={x} cy={y} r={2} fill="#2563eb" /></g>; })}
      </svg>
      <div className="mt-3 space-y-1.5">
        {points.slice(0, 6).map((p, i) => { const m = Math.max(...points.map(x => x.count), 1); return (
          <div key={i} className="flex items-center gap-2"><span className={cn("text-[11px] font-semibold w-28 truncate", txt)}>{p.country}</span><div className={cn("flex-1 h-3.5 rounded-[4px] overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}><div className="h-full bg-[#2563eb] rounded-[4px]" style={{ width: `${(p.count / m) * 100}%` }} /></div><span className={cn("text-[11px] font-bold w-8 text-right", txt)}>{p.count}</span></div>
        ); })}
        {points.length === 0 && <p className={cn("text-xs", sub)}>No location data yet.</p>}
      </div>
    </div>
  );
}
