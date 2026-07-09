// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  Terminal, RefreshCw, Download, Search, Loader2, Eye, Webhook,
  Zap, AlertTriangle, Clock, Repeat2, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Activity, HeartPulse, Copy,
} from "lucide-react";

type Props = { dark: boolean };

const CODE_COLORS = (code) => {
  if (!code) return "bg-gray-500/10 text-gray-500";
  if (code < 300) return "bg-emerald-500/10 text-emerald-600";
  if (code < 400) return "bg-blue-500/10 text-blue-600";
  if (code < 500) return "bg-amber-500/10 text-amber-600";
  return "bg-red-500/10 text-red-600";
};

const ERROR_CODES = ["401", "403", "404", "408", "422", "429", "500", "502", "503", "504"];

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"; }
function ago(d) {
  if (!d) return "never";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function JsonBlock({ data, dark, brd, txt }) {
  const text = data == null ? "null" : typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <div className="relative group">
      <pre className={cn("rounded-[12px] border p-3 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-[320px] overflow-y-auto", brd, txt, dark ? "bg-[#0f1318]" : "bg-[#f8f9fb]")}>{text}</pre>
      <button onClick={() => navigator.clipboard?.writeText(text)}
        className={cn("absolute top-2 right-2 w-7 h-7 rounded-[8px] border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity", brd, dark ? "bg-[#171c24]" : "bg-white")}>
        <Copy className="w-3.5 h-3.5 text-[#8a929c]" />
      </button>
    </div>
  );
}

export function AdminPaymentLogs({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[40px] rounded-[10px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnGhost = cn("h-10 px-4 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2", brd, txt, hover);

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [gatewayFilter, setGatewayFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("request");
  const [health, setHealth] = useState(null);
  const [showHealth, setShowHealth] = useState(false);
  const [live, setLive] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadKpis = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/payment-logs?section=kpis");
      if (res.ok) setKpis(await res.json());
    } catch { /* silent */ }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), per_page: "25" });
      if (search) params.set("search", search);
      if (gatewayFilter) params.set("gateway", gatewayFilter);
      if (eventFilter) params.set("event", eventFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (codeFilter) params.set("code", codeFilter);
      const res = await fetch(`/api/admin/payment-logs?${params}`);
      if (res.ok) {
        const d = await res.json();
        setLogs(d.logs || []);
        setTotal(d.total || 0);
        setTotalPages(d.totalPages || 0);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [page, search, gatewayFilter, eventFilter, statusFilter, codeFilter]);

  useEffect(() => { loadKpis(); }, [loadKpis]);
  useEffect(() => {
    const t = setTimeout(loadList, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadList]);

  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => { loadKpis(); loadList(); }, 10000);
    return () => clearInterval(iv);
  }, [live, loadKpis, loadList]);

  const refresh = () => { loadKpis(); loadList(); };

  const openDetail = async (id) => {
    setDetailLoading(true);
    setDetailTab("request");
    try {
      const res = await fetch(`/api/admin/payment-logs?section=detail&id=${id}`);
      if (res.ok) setDetail(await res.json());
      else showToast("Failed to load log", "error");
    } catch { showToast("Failed to load log", "error"); } finally { setDetailLoading(false); }
  };

  const retryLog = async (id) => {
    try {
      const res = await fetch("/api/admin/payment-logs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showToast("Retry queued and logged");
      refresh();
      openDetail(id);
    } catch (e) { showToast(e.message, "error"); }
  };

  const openHealth = async () => {
    setShowHealth(true);
    try {
      const res = await fetch("/api/admin/payment-logs?section=health");
      if (res.ok) setHealth((await res.json()).health || []);
    } catch { /* silent */ }
  };

  const exportJson = async () => {
    try {
      const res = await fetch("/api/admin/payment-logs?section=export");
      const d = await res.json();
      const blob = new Blob([JSON.stringify(d.logs, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `payment-logs-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Logs exported");
    } catch { showToast("Export failed", "error"); }
  };

  const kpiCards = useMemo(() => kpis ? [
    { label: "Total Logs", value: kpis.total, icon: Terminal, color: "#2563eb" },
    { label: "Webhook Events", value: kpis.webhookEvents, icon: Webhook, color: "#8b5cf6" },
    { label: "API Calls", value: kpis.apiCalls, icon: Zap, color: "#0891b2" },
    { label: "Gateway Errors", value: kpis.gatewayErrors, icon: AlertTriangle, color: "#dc2626" },
    { label: "Timeouts", value: kpis.timeouts, icon: Clock, color: "#ea7317" },
    { label: "Retries", value: kpis.retries, icon: Repeat2, color: "#ca8a04" },
    { label: "Successful", value: kpis.successful, icon: CheckCircle2, color: "#16a34a" },
    { label: "Failed", value: kpis.failed, icon: XCircle, color: "#dc2626" },
    { label: "Avg Latency", value: `${kpis.avgLatency}ms`, icon: Activity, color: "#0891b2" },
    { label: "P95 Latency", value: `${kpis.p95Latency}ms`, icon: Activity, color: "#8b5cf6" },
  ] : [], [kpis]);

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em]", txt)}>Payment Logs</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Webhook events, gateway API calls and errors — {total} log(s). For admins and developers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setLive(v => !v)} className={cn("h-10 px-3.5 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2", live ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : cn(brd, txt, hover))}>
            <span className={cn("w-2 h-2 rounded-full", live ? "bg-emerald-500 animate-pulse" : dark ? "bg-[#3a4250]" : "bg-[#d1d5db]")} />
            Live Tail
          </button>
          <button onClick={openHealth} className={btnGhost}><HeartPulse className="w-4 h-4" /> Health</button>
          <button onClick={exportJson} className={btnGhost}><Download className="w-4 h-4" /> Export</button>
          <button onClick={refresh} className={btnGhost}><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpiCards.length === 0
          ? Array.from({ length: 10 }).map((_, i) => <div key={i} className={cn("rounded-[14px] border p-3 animate-pulse h-[76px]", p, brd)} />)
          : kpiCards.map(k => (
            <div key={k.label} className={cn("rounded-[14px] border p-3", p, brd)}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${k.color}1a` }}>
                  <k.icon className="w-3.5 h-3.5" style={{ color: k.color }} />
                </div>
                <span className={cn("text-[10px] font-semibold truncate", sub)}>{k.label}</span>
              </div>
              <p className={cn("text-lg font-extrabold mt-1.5 tracking-[-.02em]", txt)}>{k.value}</p>
            </div>
          ))}
      </div>

      {/* FILTERS */}
      <div className={cn(cardCls, "p-3 flex flex-col lg:flex-row gap-2")}>
        <div className="relative flex-1">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", sub)} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search event type, error message, IP address..." className={cn(inpCls, "pl-9")} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={gatewayFilter} onChange={e => { setGatewayFilter(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")}>
            <option value="">All Gateways</option>
            {["stripe", "moncash", "natcash", "cod", "bank_transfer", "paypal"].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={eventFilter} onChange={e => { setEventFilter(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")}>
            <option value="">All Events</option>
            <option value="webhook">Webhooks</option>
            <option value="api">API Calls</option>
            <option value="retry">Retries</option>
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")}>
            <option value="">All Results</option>
            <option value="success">Success</option>
            <option value="error">Errors</option>
          </select>
          <select value={codeFilter} onChange={e => { setCodeFilter(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")}>
            <option value="">Any Code</option>
            {ERROR_CODES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className={cn(cardCls, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={cn("border-b", brd)}>
                {["Log", "Gateway", "Event", "Code", "Latency", "Error", "IP", "Timestamp", ""].map(h => (
                  <th key={h} className={cn("p-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap", sub)}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className={cn("border-b", brd)}>
                    <td colSpan={9} className="p-3"><div className={cn("h-7 rounded-[8px] animate-pulse", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")} /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr><td colSpan={9} className="p-12 text-center">
                  <Terminal className={cn("w-10 h-10 mx-auto mb-3", sub)} />
                  <p className={cn("text-sm font-bold", txt)}>No logs found</p>
                  <p className={cn("text-xs mt-1", sub)}>Gateway activity will appear here.</p>
                </td></tr>
              ) : logs.map(r => (
                <tr key={r.id} className={cn("border-b transition-colors cursor-pointer", brd, hover)} onClick={() => openDetail(r.id)}>
                  <td className={cn("p-3 text-[11px] font-mono whitespace-nowrap", sub)}>{r.id.slice(0, 8)}…</td>
                  <td className="p-3"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", dark ? "bg-[#252c36] text-[#e7ebf0]" : "bg-[#f0f2f5] text-[#16181d]")}>{r.gateway}</span></td>
                  <td className="p-3 whitespace-nowrap">
                    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold font-mono", txt)}>
                      {(r.event_type || "").startsWith("webhook") ? <Webhook className={cn("w-3 h-3", sub)} /> : <Zap className={cn("w-3 h-3", sub)} />}
                      {r.event_type}
                    </span>
                  </td>
                  <td className="p-3">{r.status_code ? <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", CODE_COLORS(r.status_code))}>{r.status_code}</span> : <span className={cn("text-xs", sub)}>—</span>}</td>
                  <td className={cn("p-3 text-xs whitespace-nowrap font-mono", (r.latency_ms || 0) > 3000 ? "text-red-500 font-bold" : sub)}>{r.latency_ms != null ? `${r.latency_ms}ms` : "—"}</td>
                  <td className="p-3 max-w-[200px]">{r.error ? <span className="text-xs text-red-500 truncate block">{r.error}</span> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}</td>
                  <td className={cn("p-3 text-[11px] font-mono whitespace-nowrap", sub)}>{r.ip_address || "—"}</td>
                  <td className={cn("p-3 text-xs whitespace-nowrap", sub)}>{fmtDT(r.created_at)}</td>
                  <td className="p-3"><Eye className={cn("w-4 h-4", sub)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className={cn("flex items-center justify-between p-3 border-t", brd)}>
            <span className={cn("text-xs", sub)}>Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(x => x - 1)} className={cn("w-8 h-8 rounded-[9px] border flex items-center justify-center disabled:opacity-40", brd, hover)}><ChevronLeft className={cn("w-4 h-4", sub)} /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(x => x + 1)} className={cn("w-8 h-8 rounded-[9px] border flex items-center justify-center disabled:opacity-40", brd, hover)}><ChevronRight className={cn("w-4 h-4", sub)} /></button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER */}
      <Drawer open={!!detail || detailLoading} onClose={() => setDetail(null)} title={detail ? `Log ${detail.id.slice(0, 8)}` : "Loading..."} dark={dark} width="2xl">
        {detailLoading || !detail ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#2563eb]" /></div>
        ) : (
          <div className="flex flex-col h-full">
            <div className={cn("p-4 border-b space-y-3", brd)}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", dark ? "bg-[#252c36] text-[#e7ebf0]" : "bg-[#f0f2f5] text-[#16181d]")}>{detail.gateway}</span>
                <span className={cn("text-sm font-bold font-mono", txt)}>{detail.event_type}</span>
                {detail.status_code && <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", CODE_COLORS(detail.status_code))}>{detail.status_code}</span>}
                {detail.latency_ms != null && <span className={cn("text-xs font-mono", sub)}>{detail.latency_ms}ms</span>}
                <div className="flex-1" />
                {(detail.error || (detail.status_code && detail.status_code >= 400)) && (
                  <button onClick={() => retryLog(detail.id)} className="h-8 px-3 rounded-[9px] bg-amber-500/10 text-amber-600 text-[11px] font-bold flex items-center gap-1 hover:bg-amber-500/20">
                    <Repeat2 className="w-3 h-3" /> Retry
                  </button>
                )}
              </div>
              {detail.error && (
                <div className="rounded-[10px] bg-red-500/10 p-2.5">
                  <p className="text-xs font-semibold text-red-600 break-all">{detail.error}</p>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div><p className={cn("text-[10px] font-bold uppercase", sub)}>Timestamp</p><p className={cn("font-semibold mt-0.5", txt)}>{fmtDT(detail.created_at)}</p></div>
                <div><p className={cn("text-[10px] font-bold uppercase", sub)}>IP Address</p><p className={cn("font-mono mt-0.5", txt)}>{detail.ip_address || "—"}</p></div>
                <div><p className={cn("text-[10px] font-bold uppercase", sub)}>Payment</p><p className={cn("font-mono mt-0.5", txt)}>{detail.payment ? `${detail.payment.order?.order_number || detail.payment_id?.slice(0, 8)} (${detail.payment.status})` : "—"}</p></div>
                <div><p className={cn("text-[10px] font-bold uppercase", sub)}>Log ID</p><p className={cn("font-mono mt-0.5 break-all", txt)}>{detail.id}</p></div>
              </div>
              <div className="flex gap-1">
                {["request", "response", "related"].map(t => (
                  <button key={t} onClick={() => setDetailTab(t)} className={cn("px-3 h-8 rounded-[9px] text-xs font-bold capitalize transition-colors", detailTab === t ? "bg-[#2563eb] text-white" : cn(sub, hover))}>{t}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {detailTab === "request" && (
                <div>
                  <p className={cn("text-xs font-bold uppercase tracking-wider mb-2", sub)}>Full Request Payload</p>
                  <JsonBlock data={detail.request} dark={dark} brd={brd} txt={txt} />
                </div>
              )}
              {detailTab === "response" && (
                <div>
                  <p className={cn("text-xs font-bold uppercase tracking-wider mb-2", sub)}>Full Response</p>
                  <JsonBlock data={detail.response} dark={dark} brd={brd} txt={txt} />
                </div>
              )}
              {detailTab === "related" && (
                <div className="space-y-2">
                  <p className={cn("text-xs font-bold uppercase tracking-wider", sub)}>Related Events (same payment) — Retry History</p>
                  {(detail.related || []).length === 0 ? <p className={cn("text-xs", sub)}>No related events.</p> :
                    detail.related.map(r => (
                      <button key={r.id} onClick={() => openDetail(r.id)} className={cn("w-full rounded-[10px] border p-2.5 flex items-center justify-between text-left", brd, hover)}>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-mono font-semibold", txt)}>{r.event_type}</span>
                          {r.status_code && <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold font-mono", CODE_COLORS(r.status_code))}>{r.status_code}</span>}
                          {r.error && <AlertTriangle className="w-3 h-3 text-red-500" />}
                        </div>
                        <span className={cn("text-[10px]", sub)}>{fmtDT(r.created_at)}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* HEALTH DRAWER */}
      <Drawer open={showHealth} onClose={() => setShowHealth(false)} title="Gateway Health (last 24h)" dark={dark} width="lg">
        {!health ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#2563eb]" /></div>
        ) : health.length === 0 ? (
          <div className="p-8 text-center">
            <HeartPulse className={cn("w-10 h-10 mx-auto mb-3", sub)} />
            <p className={cn("text-sm font-bold", txt)}>No activity in the last 24 hours</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {health.map(h => (
              <div key={h.gateway} className={cn("rounded-[12px] border p-3", brd)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", h.status === "healthy" ? "bg-emerald-500" : h.status === "degraded" ? "bg-amber-500" : "bg-red-500")} />
                    <span className={cn("text-sm font-bold uppercase", txt)}>{h.gateway}</span>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", h.status === "healthy" ? "bg-emerald-500/10 text-emerald-600" : h.status === "degraded" ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600")}>{h.status}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div><p className={cn("text-base font-extrabold", txt)}>{h.total}</p><p className={cn("text-[9px] font-bold uppercase", sub)}>Events</p></div>
                  <div><p className={cn("text-base font-extrabold", h.errors > 0 ? "text-red-500" : txt)}>{h.errors}</p><p className={cn("text-[9px] font-bold uppercase", sub)}>Errors</p></div>
                  <div><p className={cn("text-base font-extrabold", txt)}>{h.avgLatency != null ? `${h.avgLatency}ms` : "—"}</p><p className={cn("text-[9px] font-bold uppercase", sub)}>Avg Latency</p></div>
                  <div><p className={cn("text-base font-extrabold", txt)}>{ago(h.lastEvent)}</p><p className={cn("text-[9px] font-bold uppercase", sub)}>Last Event</p></div>
                </div>
                <div className={cn("h-1.5 rounded-full mt-2 overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}>
                  <div className={cn("h-full rounded-full", h.errorRate >= 50 ? "bg-red-500" : h.errorRate >= 15 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${100 - h.errorRate}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Drawer>

      {toast && (
        <div className={cn("fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
