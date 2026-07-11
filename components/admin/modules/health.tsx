// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Activity, LayoutDashboard, Server, AlertTriangle, ShieldAlert, ScrollText,
  Loader2, Search, Download, X, RefreshCw, CheckCircle2, XCircle, Cpu, MemoryStick,
  Database, CreditCard, Mail, HardDrive, Bell, ShieldCheck, Zap, Play, Clock,
  Wifi, Gauge, TrendingUp, Boxes, Globe2, Search as SearchIcon,
} from "lucide-react";

type Props = { dark: boolean };

const SVC_META = {
  database: { label: "Database", icon: Database }, server: { label: "Server", icon: Server }, api: { label: "API", icon: Zap },
  payments: { label: "Payments", icon: CreditCard }, queue: { label: "Queue", icon: Boxes }, cache: { label: "Cache", icon: MemoryStick },
  storage: { label: "Storage", icon: HardDrive }, email: { label: "Email", icon: Mail }, sms: { label: "SMS", icon: Bell },
  notifications: { label: "Notifications", icon: Bell }, backup: { label: "Backup", icon: HardDrive }, security: { label: "Security", icon: ShieldCheck },
  cdn: { label: "CDN", icon: Globe2 }, search: { label: "Search", icon: SearchIcon },
};
const HS = { healthy: { c: "#16a34a", l: "Healthy" }, warning: { c: "#ea7317", l: "Warning" }, critical: { c: "#dc2626", l: "Critical" }, down: { c: "#dc2626", l: "Down" }, unknown: { c: "#8a929c", l: "Unknown" } };
const PRIO = { low: "#16a34a", medium: "#2563eb", high: "#ea7317", critical: "#dc2626" };

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return "never"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

export function AdminHealth({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inpBg = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inpBg, "focus:border-[#2563eb]");
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnGhost = cn("h-9 px-3 rounded-[10px] text-xs font-semibold border transition-colors flex items-center gap-1.5 disabled:opacity-50", brd, txt, hover);
  const btnPrimary = "h-9 px-3 rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-1.5";
  const divide = dark ? "divide-[#252c36]" : "divide-[#eef0f3]";

  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const [dash, setDash] = useState(null);
  const [logs, setLogs] = useState({ logs: [], total: 0, page: 1 });
  const [logFilter, setLogFilter] = useState({ service: "all", status: "all" });
  const [autoRefresh, setAutoRefresh] = useState(true);

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3000); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api/health${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadDash = useCallback(async () => { try { setDash(await api("/dashboard")); } catch {} }, [api]);
  const loadLogs = useCallback(async (page = 1) => { try { const qs = new URLSearchParams({ page, ...logFilter }); const r = await api(`/logs?${qs}`); setLogs({ ...r }); } catch {} }, [api, logFilter]);

  useEffect(() => { (async () => { setLoading(true); await loadDash(); setLoading(false); })(); }, [loadDash]);
  useEffect(() => { if (tab === "logs") loadLogs(1); }, [tab, logFilter]); // eslint-disable-line
  // auto-refresh dashboard every 20s
  useEffect(() => { if (tab !== "dashboard" || !autoRefresh) return; const iv = setInterval(loadDash, 20000); return () => clearInterval(iv); }, [tab, autoRefresh, loadDash]);

  const runCheck = async (services) => { setBusy("run"); try { await api("/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ services }) }); showToast("Health check complete"); await loadDash(); } catch (e) { showToast(e.message, "error"); } finally { setBusy(null); } };
  const post = async (action, body, okMsg, after) => { try { await api(`/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (okMsg) showToast(okMsg); if (after) await after(); } catch (e) { showToast(e.message, "error"); } };

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const overall = dash?.overall ?? 100;
  const overallColor = overall >= 85 ? "#16a34a" : overall >= 60 ? "#ea7317" : "#dc2626";
  const kpis = [
    { label: "CPU Usage", value: K.cpu != null ? `${K.cpu}%` : "—", c: K.cpu > 85 ? "#dc2626" : K.cpu > 70 ? "#ea7317" : undefined },
    { label: "RAM Usage", value: K.ram != null ? `${K.ram}%` : "—", c: K.ram > 88 ? "#dc2626" : K.ram > 78 ? "#ea7317" : undefined },
    { label: "DB Latency", value: K.dbLatency != null ? `${K.dbLatency}ms` : "—" },
    { label: "API Latency", value: K.apiLatency != null ? `${K.apiLatency}ms` : "—" },
    { label: "API Error Rate", value: `${K.apiErrorRate || 0}%`, c: K.apiErrorRate > 5 ? "#dc2626" : undefined },
    { label: "Orders / min", value: K.ordersPerMin ?? 0 },
    { label: "Payment Success", value: `${K.paymentSuccessRate ?? 100}%`, c: (K.paymentSuccessRate ?? 100) < 90 ? "#ea7317" : "#16a34a" },
    { label: "Active Sessions", value: K.activeSessions ?? 0 },
    { label: "Pending Jobs", value: K.pendingJobs ?? 0 },
    { label: "Failed Jobs", value: K.failedJobs ?? 0, c: K.failedJobs > 0 ? "#dc2626" : undefined },
    { label: "Uptime", value: `${K.uptimePct ?? 100}%`, c: "#16a34a" },
    { label: "Active Alerts", value: K.activeAlerts ?? 0, c: K.activeAlerts > 0 ? "#dc2626" : undefined },
    { label: "Incidents", value: K.incidentCount ?? 0, c: K.incidentCount > 0 ? "#ea7317" : undefined },
    { label: "Server Uptime", value: K.uptimeH != null ? `${K.uptimeH}h` : "—" },
  ];

  const statusDot = (st) => <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: HS[st]?.c || "#8a929c" }} />;
  const statusBadge = (st) => <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${HS[st]?.c || "#8a929c"}1a`, color: HS[st]?.c || "#8a929c" }}>{HS[st]?.l || st}</span>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Activity className="w-5 h-5 text-[#2563eb]" /> System Health</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Monitoring Center · last check {timeAgo(K.lastCheck)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" /><span className={cn("text-xs", sub)}>Auto 20s</span></label>
          <a href="/api/health/export?format=csv" className={btnGhost}><Download className="w-3.5 h-3.5" /> CSV</a>
          <button onClick={() => runCheck()} disabled={busy === "run"} className={btnPrimary}>{busy === "run" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Run Health Check</button>
        </div>
      </div>

      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {[["dashboard", "Dashboard", LayoutDashboard], ["services", "Services", Server], ["incidents", "Incidents", ShieldAlert], ["alerts", "Alerts", AlertTriangle], ["logs", "Logs", ScrollText]].map(([id, l, I]) => <button key={id} onClick={() => setTab(id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><I className="w-3.5 h-3.5" /> {l}{id === "alerts" && (K.activeAlerts > 0) && <span className="text-[9px] px-1.5 rounded-full bg-red-500 text-white">{K.activeAlerts}</span>}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={cn(cardCls, "p-5 flex items-center gap-5")}>
              <Gauge value={overall} color={overallColor} dark={dark} />
              <div><p className={cn("text-xs font-bold uppercase tracking-wider", sub)}>Overall Health</p><p className="text-3xl font-extrabold" style={{ color: overallColor }}>{overall}%</p><p className="text-sm font-bold" style={{ color: overallColor }}>{overall >= 85 ? "Healthy" : overall >= 60 ? "Degraded" : "Critical"}</p></div>
            </div>
            <div className={cn(cardCls, "p-4 lg:col-span-2")}>
              <p className={cn("text-xs font-bold uppercase tracking-wider mb-2", sub)}>Service Status</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(dash.services || []).map(sv => { const m = SVC_META[sv.service] || { label: sv.service, icon: Server }; return (
                  <div key={sv.service} className={cn("rounded-[10px] border p-2.5 flex items-center gap-2", brd)} title={sv.message}>
                    <m.icon className="w-4 h-4 shrink-0" style={{ color: HS[sv.status]?.c }} />
                    <div className="min-w-0"><p className={cn("text-xs font-bold truncate", txt)}>{m.label}</p><p className="text-[10px] font-semibold" style={{ color: HS[sv.status]?.c }}>{HS[sv.status]?.l || sv.status}</p></div>
                  </div>
                ); })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">{kpis.map(k => (
            <div key={k.label} className={cn(cardCls, "p-3.5")}><p className="text-[16px] font-extrabold" style={{ color: k.c }}><span className={k.c ? "" : txt}>{k.value}</span></p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
          ))}</div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-2", sub)}>CPU (24h)</p><MiniChart points={dash.charts?.cpu} color="#2563eb" unit="%" dark={dark} /></div>
            <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-2", sub)}>RAM (24h)</p><MiniChart points={dash.charts?.ram} color="#8b5cf6" unit="%" dark={dark} /></div>
            <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-2", sub)}>DB Latency (24h)</p><MiniChart points={dash.charts?.latency} color="#16a34a" unit="ms" dark={dark} /></div>
          </div>

          {(dash.alerts || []).length > 0 && (
            <div className={cn(cardCls, "overflow-hidden")}>
              <p className={cn("px-4 py-3 text-sm font-extrabold border-b flex items-center gap-2", txt, brd)}><AlertTriangle className="w-4 h-4 text-red-500" /> Active Alerts & Recommendations</p>
              <div className={cn("divide-y", divide)}>
                {dash.alerts.map(a => <div key={a.id} className="px-4 py-3 flex items-start justify-between gap-3"><div className="min-w-0"><p className={cn("text-sm font-bold capitalize", txt)}>{a.title}</p><p className={cn("text-xs", sub)}>{a.message}</p>{a.recommendation && <p className="text-[11px] mt-1 text-blue-500">💡 {a.recommendation}</p>}</div><button onClick={() => post("resolve-alert", { id: a.id }, "Resolved", loadDash)} className={btnGhost + " shrink-0"}>Resolve</button></div>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SERVICES */}
      {tab === "services" && dash && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(dash.services || []).map(sv => { const m = SVC_META[sv.service] || { label: sv.service, icon: Server }; return (
            <div key={sv.service} className={cn(cardCls, "p-4")}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-[11px] flex items-center justify-center" style={{ backgroundColor: `${HS[sv.status]?.c}1a` }}><m.icon className="w-5 h-5" style={{ color: HS[sv.status]?.c }} /></div><div><p className={cn("text-sm font-extrabold", txt)}>{m.label}</p><p className={cn("text-[11px]", sub)}>{sv.message || "—"}</p></div></div>
                <div className="text-right">{statusBadge(sv.status)}{sv.latency_ms != null && <p className={cn("text-[10px] mt-1", sub)}>{sv.latency_ms}ms</p>}</div>
              </div>
              {sv.detail && Object.keys(sv.detail).length > 0 && <div className={cn("mt-3 pt-3 border-t grid grid-cols-3 gap-2", brd)}>{Object.entries(sv.detail).slice(0, 6).map(([k, v]) => <div key={k}><p className={cn("text-[9px] uppercase", sub)}>{k}</p><p className={cn("text-xs font-bold truncate", txt)}>{String(v)}</p></div>)}</div>}
              <div className="mt-3 flex items-center justify-between"><span className={cn("text-[10px]", sub)}>checked {timeAgo(sv.last_checked_at)}</span><button onClick={() => runCheck([sv.service])} className={cn("text-[11px] font-bold text-[#2563eb] flex items-center gap-1")}><RefreshCw className="w-3 h-3" /> Recheck</button></div>
            </div>
          ); })}
        </div>
      )}

      {/* INCIDENTS */}
      {tab === "incidents" && dash && (
        <div className="space-y-3">
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Incident Center</p>
            {(dash.incidents || []).length === 0 ? <div className="p-10 text-center"><CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" /><p className={cn("text-sm", sub)}>No incidents. All systems operational.</p></div> : (
              <div className={cn("divide-y", divide)}>
                {dash.incidents.map(i => (
                  <div key={i.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap"><span className={cn("text-sm font-bold", txt)}>{i.title}</span><span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ backgroundColor: `${PRIO[i.priority]}1a`, color: PRIO[i.priority] }}>{i.priority}</span><span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ background: dark ? "#1d242e" : "#f0f2f5", color: sub }}>{i.status}</span></div>
                      <p className={cn("text-xs mt-0.5", sub)}>{i.impact} · services: {(i.affected_services || []).join(", ")}</p>
                      <p className={cn("text-[10px] mt-1", sub)}>started {fmtDT(i.started_at)} {i.assigned_name && `· ${i.assigned_name}`} {i.resolved_at && `· resolved ${fmtDT(i.resolved_at)}`}</p>
                    </div>
                    {i.status !== "resolved" && <div className="flex flex-col gap-1 shrink-0">
                      {!i.assigned_to && <button onClick={() => post("incident", { op: "assign", id: i.id }, "Assigned", loadDash)} className={cn(btnGhost, "h-7")}>Assign me</button>}
                      <select value={i.status} onChange={e => post("incident", { op: "status", id: i.id, status: e.target.value }, "Updated", loadDash)} className={cn(inpCls, "h-7 text-xs w-auto")}><option value="open">Open</option><option value="investigating">Investigating</option><option value="monitoring">Monitoring</option><option value="resolved">Resolved</option></select>
                    </div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ALERTS */}
      {tab === "alerts" && dash && (
        <div className="space-y-2">
          {(dash.alerts || []).length === 0 ? <div className={cn(cardCls, "p-10 text-center")}><CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" /><p className={cn("text-sm", sub)}>No active alerts.</p></div> :
            dash.alerts.map(a => (
              <div key={a.id} className={cn(cardCls, "p-4 flex items-start gap-3")} style={{ borderLeftWidth: 3, borderLeftColor: HS[a.severity === "critical" ? "critical" : "warning"].c }}>
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: HS[a.severity === "critical" ? "critical" : "warning"].c }} />
                <div className="flex-1 min-w-0"><p className={cn("text-sm font-extrabold capitalize", txt)}>{a.title}</p><p className={cn("text-xs mt-0.5", sub)}>{a.message}</p>{a.recommendation && <p className="text-[11px] mt-1 text-blue-500">💡 {a.recommendation}</p>}<p className={cn("text-[10px] mt-1", sub)}>{a.service} · {fmtDT(a.created_at)}</p></div>
                <button onClick={() => post("resolve-alert", { id: a.id }, "Resolved", loadDash)} className={btnGhost + " shrink-0"}>Resolve</button>
              </div>
            ))}
        </div>
      )}

      {/* LOGS */}
      {tab === "logs" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap gap-2")}>
            <select value={logFilter.service} onChange={e => setLogFilter(f => ({ ...f, service: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All services</option>{Object.keys(SVC_META).map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select value={logFilter.status} onChange={e => setLogFilter(f => ({ ...f, status: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All status</option>{Object.keys(HS).map(s => <option key={s} value={s}>{s}</option>)}</select>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Date", "Service", "Status", "Latency", "Duration", "Message", "Error"].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {logs.logs.length === 0 ? <tr><td colSpan={7} className={cn("px-4 py-8 text-center text-xs", sub)}>No health logs yet. Run a check.</td></tr> :
                  logs.logs.map(l => <tr key={l.id}><td className={cn("px-3 py-2.5 text-[11px]", sub)}>{fmtDT(l.created_at)}</td><td className={cn("px-3 py-2.5 font-semibold capitalize", txt)}>{l.service}</td><td className="px-3 py-2.5"><span className="flex items-center gap-1.5">{statusDot(l.status)}<span className={cn("text-xs capitalize", txt)}>{l.status}</span></span></td><td className={cn("px-3 py-2.5", sub)}>{l.latency_ms != null ? `${l.latency_ms}ms` : "—"}</td><td className={cn("px-3 py-2.5", sub)}>{l.duration_ms}ms</td><td className={cn("px-3 py-2.5 truncate max-w-[200px]", sub)}>{l.message}</td><td className={cn("px-3 py-2.5 text-[11px] text-red-500 truncate max-w-[140px]")}>{l.error || ""}</td></tr>)}
              </tbody>
            </table></div>
          </div>
          {logs.total > 40 && <div className="flex items-center justify-between"><span className={cn("text-xs", sub)}>{logs.total} logs · page {logs.page}</span><div className="flex gap-1.5"><button disabled={logs.page <= 1} onClick={() => loadLogs(logs.page - 1)} className={cn(btnGhost, "disabled:opacity-40")}>Prev</button><button disabled={logs.page * 40 >= logs.total} onClick={() => loadLogs(logs.page + 1)} className={cn(btnGhost, "disabled:opacity-40")}>Next</button></div></div>}
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200 max-w-sm", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}

function Gauge({ value, color, dark }) {
  const r = 34, c = 2 * Math.PI * r, off = c - (value / 100) * c;
  return <svg viewBox="0 0 80 80" className="w-20 h-20 shrink-0"><circle cx="40" cy="40" r={r} fill="none" stroke={dark ? "#252c36" : "#eef0f3"} strokeWidth="8" /><circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 40 40)" /><text x="40" y="46" textAnchor="middle" fontSize="17" fontWeight="800" fill={color}>{value}</text></svg>;
}
function MiniChart({ points, color, unit, dark }) {
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const pts = points || [];
  if (!pts.length) return <p className={cn("text-xs py-6 text-center", sub)}>No data — run checks over time.</p>;
  const w = 300, h = 80, pad = 6;
  const vals = pts.map(p => Number(p.v)); const max = Math.max(...vals, unit === "%" ? 100 : 1); const min = 0;
  const x = (i) => pad + (i / Math.max(pts.length - 1, 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(Number(p.v))}`).join(" ");
  const area = `${line} L${x(pts.length - 1)},${h - pad} L${x(0)},${h - pad} Z`;
  const last = vals[vals.length - 1];
  return (
    <div><div className="flex items-baseline gap-1 mb-1"><span className="text-lg font-extrabold" style={{ color }}>{last}{unit}</span><span className={cn("text-[10px]", sub)}>now</span></div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full"><defs><linearGradient id={`hg-${color}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs><path d={area} fill={`url(#hg-${color})`} /><path d={line} fill="none" stroke={color} strokeWidth="2" /></svg>
    </div>
  );
}
