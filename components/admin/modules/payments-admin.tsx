// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  DollarSign, RefreshCw, Download, Search, Loader2, Eye, TrendingUp,
  Clock, CheckCircle2, XCircle, RotateCcw, AlertTriangle, BarChart3,
  CreditCard, Smartphone, Banknote, Landmark, ChevronLeft, ChevronRight,
  Receipt, FileText, Send, Ban, Repeat2, ShieldCheck, Zap,
} from "lucide-react";

type Props = { dark: boolean };

const STATUS_META = {
  pending: { label: "Pending", bg: "bg-orange-500/10 text-orange-600" },
  paid: { label: "Paid", bg: "bg-emerald-500/10 text-emerald-600" },
  failed: { label: "Failed", bg: "bg-red-500/10 text-red-600" },
  refunded: { label: "Refunded", bg: "bg-violet-500/10 text-violet-600" },
  cancelled: { label: "Cancelled", bg: "bg-gray-500/10 text-gray-500" },
};

const GATEWAY_LABELS = { stripe: "Card (Stripe)", moncash: "MonCash", natcash: "NatCash", cod: "Cash on Delivery", bank_transfer: "Bank Transfer" };
const GATEWAY_ICONS = { stripe: CreditCard, moncash: Smartphone, natcash: Smartphone, cod: Banknote, bank_transfer: Landmark };

function money(n, c = "USD") { return `${c === "HTG" ? "HTG " : "$"}${(Number(n) || 0).toFixed(2)}`; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }
function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }

export function AdminPayments({ dark }: Props) {
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
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [gatewayFilter, setGatewayFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("timeline");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadKpis = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/payments?section=kpis");
      if (res.ok) setKpis(await res.json());
    } catch { /* silent */ }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), per_page: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (gatewayFilter) params.set("gateway", gatewayFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/admin/payments?${params}`);
      if (res.ok) {
        const d = await res.json();
        setPayments(d.payments || []);
        setTotal(d.total || 0);
        setTotalPages(d.totalPages || 0);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [page, search, statusFilter, gatewayFilter, fromDate, toDate]);

  useEffect(() => { loadKpis(); }, [loadKpis]);
  useEffect(() => {
    const t = setTimeout(loadList, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadList]);

  // Realtime-style live updates: poll every 15s while enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(() => { loadKpis(); loadList(); }, 15000);
    return () => clearInterval(iv);
  }, [autoRefresh, loadKpis, loadList]);

  const refresh = () => { loadKpis(); loadList(); };

  const openDetail = async (id) => {
    setDetailLoading(true);
    setDetailTab("timeline");
    try {
      const res = await fetch(`/api/admin/payments?section=detail&id=${id}`);
      if (res.ok) {
        const d = await res.json();
        setDetail(d);
        setRefundAmount(String(d.amount || ""));
        setRefundReason("");
      } else showToast("Failed to load payment", "error");
    } catch { showToast("Failed to load payment", "error"); } finally { setDetailLoading(false); }
  };

  const runAction = async (id, action, extra = {}) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Action failed");
      showToast(d.message || "Action completed");
      refresh();
      openDetail(id);
    } catch (e) { showToast(e.message, "error"); } finally { setActionLoading(false); }
  };

  const exportCsv = async () => {
    try {
      const res = await fetch("/api/admin/payments?section=export");
      const d = await res.json();
      const rows = d.payments || [];
      const header = ["Payment ID", "Order", "Customer", "Gateway", "Amount", "Fees", "Net", "Currency", "Status", "Country", "Transaction ID", "Created", "Updated"];
      const csv = [header.join(","), ...rows.map(r => [
        r.id, r.order?.order_number || "", `"${r.customer?.full_name || r.customer?.email || ""}"`,
        r.gateway, r.amount, r.fee_amount || 0, r.net_amount ?? r.amount, r.currency,
        r.status, r.country || "", r.transaction_id || "", r.created_at, r.updated_at || "",
      ].join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Export downloaded");
    } catch { showToast("Export failed", "error"); }
  };

  const openAnalytics = async () => {
    setShowAnalytics(true);
    try {
      const res = await fetch("/api/admin/payments?section=analytics");
      if (res.ok) setAnalytics(await res.json());
    } catch { /* silent */ }
  };

  const kpiCards = useMemo(() => kpis ? [
    { label: "Total Revenue", value: money(kpis.totalRevenue), icon: DollarSign, color: "#16a34a" },
    { label: "Today's Revenue", value: money(kpis.todayRevenue), icon: TrendingUp, color: "#2563eb" },
    { label: "Pending", value: kpis.pending, icon: Clock, color: "#ea7317" },
    { label: "Completed", value: kpis.completed, icon: CheckCircle2, color: "#16a34a" },
    { label: "Failed", value: kpis.failed, icon: XCircle, color: "#dc2626" },
    { label: "Refunded", value: kpis.refunded, icon: RotateCcw, color: "#8b5cf6" },
    { label: "Chargebacks", value: kpis.chargebacks, icon: AlertTriangle, color: "#dc2626" },
    { label: "Avg Order Value", value: money(kpis.avgOrderValue), icon: BarChart3, color: "#0891b2" },
    { label: "Fees", value: money(kpis.totalFees), icon: Receipt, color: "#ca8a04" },
    { label: "Net Revenue", value: money(kpis.netRevenue), icon: Zap, color: "#16a34a" },
  ] : [], [kpis]);

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em]", txt)}>Payments</h1>
          <p className={cn("text-xs mt-0.5", sub)}>All financial transactions across every gateway — {total} payment(s).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setAutoRefresh(v => !v)} className={cn("h-10 px-3.5 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2", autoRefresh ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : cn(brd, txt, hover))}>
            <span className={cn("w-2 h-2 rounded-full", autoRefresh ? "bg-emerald-500 animate-pulse" : dark ? "bg-[#3a4250]" : "bg-[#d1d5db]")} />
            Live
          </button>
          <button onClick={openAnalytics} className={btnGhost}><BarChart3 className="w-4 h-4" /> Analytics</button>
          <button onClick={exportCsv} className={btnGhost}><Download className="w-4 h-4" /> Export</button>
          <button onClick={refresh} className={btnGhost}><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh</button>
        </div>
      </div>

      {/* KPI GRID */}
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

      {/* GATEWAY PERFORMANCE */}
      {kpis?.gatewayPerformance?.length > 0 && (
        <div className={cn(cardCls, "p-4")}>
          <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Gateway Performance</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {kpis.gatewayPerformance.map(g => {
              const Icon = GATEWAY_ICONS[g.gateway] || CreditCard;
              return (
                <div key={g.gateway} className={cn("rounded-[12px] border p-3", brd)}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn("w-4 h-4", sub)} />
                    <span className={cn("text-xs font-bold", txt)}>{GATEWAY_LABELS[g.gateway] || g.gateway}</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className={cn("text-sm font-extrabold", txt)}>{money(g.revenue)}</p>
                      <p className={cn("text-[10px]", sub)}>{g.paid}/{g.total} paid</p>
                    </div>
                    <span className={cn("text-xs font-bold", g.successRate >= 80 ? "text-emerald-500" : g.successRate >= 50 ? "text-amber-500" : "text-red-500")}>{g.successRate}%</span>
                  </div>
                  <div className={cn("h-1.5 rounded-full mt-2 overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}>
                    <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${g.successRate}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className={cn(cardCls, "p-3 flex flex-col lg:flex-row gap-2")}>
        <div className="relative flex-1">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", sub)} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by transaction ID, merchant reference, payment ID..." className={cn(inpCls, "pl-9")} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={gatewayFilter} onChange={e => { setGatewayFilter(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")}>
            <option value="">All Gateways</option>
            {Object.entries(GATEWAY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")} />
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")} />
        </div>
      </div>

      {/* TABLE */}
      <div className={cn(cardCls, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={cn("border-b", brd)}>
                {["Payment", "Order", "Customer", "Gateway", "Amount", "Fees", "Net", "Status", "Transaction", "Created", ""].map(h => (
                  <th key={h} className={cn("p-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap", sub)}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className={cn("border-b", brd)}>
                    <td colSpan={11} className="p-3"><div className={cn("h-8 rounded-[8px] animate-pulse", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")} /></td>
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr><td colSpan={11} className="p-12 text-center">
                  <DollarSign className={cn("w-10 h-10 mx-auto mb-3", sub)} />
                  <p className={cn("text-sm font-bold", txt)}>No payments found</p>
                  <p className={cn("text-xs mt-1", sub)}>Transactions will appear here as orders are paid.</p>
                </td></tr>
              ) : payments.map(r => {
                const meta = STATUS_META[r.status] || STATUS_META.pending;
                const Icon = GATEWAY_ICONS[r.gateway] || CreditCard;
                return (
                  <tr key={r.id} className={cn("border-b transition-colors cursor-pointer", brd, hover)} onClick={() => openDetail(r.id)}>
                    <td className="p-3 whitespace-nowrap">
                      <span className={cn("text-[11px] font-mono", txt)}>{r.id.slice(0, 8)}…</span>
                      {r.webhook_verified && <ShieldCheck className="w-3 h-3 text-emerald-500 inline ml-1" />}
                    </td>
                    <td className={cn("p-3 text-xs font-semibold whitespace-nowrap", sub)}>{r.order?.order_number || "—"}</td>
                    <td className="p-3 whitespace-nowrap">
                      <p className={cn("text-xs font-semibold", txt)}>{r.customer?.full_name || "Guest"}</p>
                      <p className={cn("text-[10px]", sub)}>{r.customer?.email || ""}</p>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", txt)}>
                        <Icon className={cn("w-3.5 h-3.5", sub)} /> {GATEWAY_LABELS[r.gateway] || r.gateway}
                      </span>
                    </td>
                    <td className={cn("p-3 text-xs font-bold whitespace-nowrap", txt)}>{money(r.amount, r.currency)}</td>
                    <td className={cn("p-3 text-xs whitespace-nowrap", sub)}>{Number(r.fee_amount) > 0 ? money(r.fee_amount, r.currency) : "—"}</td>
                    <td className={cn("p-3 text-xs font-semibold whitespace-nowrap", txt)}>{money(r.net_amount ?? r.amount, r.currency)}</td>
                    <td className="p-3"><span className={cn("px-2 py-1 rounded-full text-[10px] font-bold", meta.bg)}>{meta.label}</span></td>
                    <td className={cn("p-3 text-[11px] font-mono whitespace-nowrap", sub)}>{r.transaction_id ? `${r.transaction_id.slice(0, 14)}${r.transaction_id.length > 14 ? "…" : ""}` : "—"}</td>
                    <td className={cn("p-3 text-xs whitespace-nowrap", sub)}>{fmtDate(r.created_at)}</td>
                    <td className="p-3"><Eye className={cn("w-4 h-4", sub)} /></td>
                  </tr>
                );
              })}
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
      <Drawer open={!!detail || detailLoading} onClose={() => setDetail(null)} title={detail ? `Payment ${detail.id.slice(0, 8)}` : "Loading..."} dark={dark} width="2xl">
        {detailLoading || !detail ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#2563eb]" /></div>
        ) : (() => {
          const meta = STATUS_META[detail.status] || STATUS_META.pending;
          return (
            <div className="flex flex-col h-full">
              <div className={cn("p-4 border-b space-y-3", brd)}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold", meta.bg)}>{meta.label}</span>
                    <span className={cn("text-lg font-extrabold", txt)}>{money(detail.amount, detail.currency)}</span>
                    {detail.webhook_verified
                      ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">WEBHOOK VERIFIED</span>
                      : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-500">NO WEBHOOK</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.status === "pending" && (
                      <>
                        <button onClick={() => runAction(detail.id, "capture")} disabled={actionLoading} className="h-8 px-2.5 rounded-[9px] bg-emerald-500/10 text-emerald-600 text-[11px] font-bold flex items-center gap-1 hover:bg-emerald-500/20 disabled:opacity-50"><CheckCircle2 className="w-3 h-3" /> Capture</button>
                        <button onClick={() => runAction(detail.id, "cancel")} disabled={actionLoading} className="h-8 px-2.5 rounded-[9px] bg-gray-500/10 text-gray-500 text-[11px] font-bold flex items-center gap-1 hover:bg-gray-500/20 disabled:opacity-50"><Ban className="w-3 h-3" /> Cancel</button>
                      </>
                    )}
                    {detail.status === "failed" && (
                      <button onClick={() => runAction(detail.id, "retry")} disabled={actionLoading} className="h-8 px-2.5 rounded-[9px] bg-blue-500/10 text-blue-600 text-[11px] font-bold flex items-center gap-1 hover:bg-blue-500/20 disabled:opacity-50"><Repeat2 className="w-3 h-3" /> Retry</button>
                    )}
                    {detail.status === "paid" && (
                      <button onClick={() => setDetailTab("refund")} className="h-8 px-2.5 rounded-[9px] bg-violet-500/10 text-violet-600 text-[11px] font-bold flex items-center gap-1 hover:bg-violet-500/20"><RotateCcw className="w-3 h-3" /> Refund</button>
                    )}
                    <button onClick={() => runAction(detail.id, "resend_receipt")} disabled={actionLoading} className="h-8 px-2.5 rounded-[9px] bg-blue-500/10 text-blue-600 text-[11px] font-bold flex items-center gap-1 hover:bg-blue-500/20 disabled:opacity-50"><Send className="w-3 h-3" /> Resend Receipt</button>
                    {detail.order?.order_number && (
                      <a href={`/api/invoice?order=${encodeURIComponent(detail.order.order_number)}`} target="_blank" rel="noreferrer" className="h-8 px-2.5 rounded-[9px] bg-gray-500/10 text-gray-500 text-[11px] font-bold flex items-center gap-1 hover:bg-gray-500/20"><FileText className="w-3 h-3" /> Invoice</a>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 overflow-x-auto">
                  {["timeline", "details", "gateway", "fraud", "refunds"].map(t => (
                    <button key={t} onClick={() => setDetailTab(t)} className={cn("px-3 h-8 rounded-[9px] text-xs font-bold capitalize whitespace-nowrap transition-colors", detailTab === t ? "bg-[#2563eb] text-white" : cn(sub, hover))}>{t}</button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {detailTab === "timeline" && (
                  <div className="space-y-0">
                    {(detail.logs || []).length === 0 ? <p className={cn("text-xs", sub)}>No events logged for this payment.</p> :
                      detail.logs.map((ev, i) => (
                        <div key={ev.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5", ev.error ? "bg-red-500" : "bg-[#2563eb]")} />
                            {i < detail.logs.length - 1 && <div className={cn("w-px flex-1", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />}
                          </div>
                          <div className="pb-5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={cn("text-sm font-bold", txt)}>{ev.event_type}</p>
                              {ev.status_code && <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", ev.status_code < 400 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>HTTP {ev.status_code}</span>}
                              {ev.latency_ms != null && <span className={cn("text-[10px]", sub)}>{ev.latency_ms}ms</span>}
                            </div>
                            <p className={cn("text-[10px] mt-0.5", sub)}>{fmtDT(ev.created_at)}{ev.ip_address ? ` — ${ev.ip_address}` : ""}</p>
                            {ev.error && <p className="text-xs text-red-500 mt-1">{ev.error}</p>}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {detailTab === "details" && (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["Payment ID", detail.id, true],
                      ["Order", detail.order?.order_number || "—"],
                      ["Customer", detail.customer?.full_name || detail.customer?.email || "Guest"],
                      ["Gateway", GATEWAY_LABELS[detail.gateway] || detail.gateway],
                      ["Amount", money(detail.amount, detail.currency)],
                      ["Fees", money(detail.fee_amount || 0, detail.currency)],
                      ["Net Amount", money(detail.net_amount ?? detail.amount, detail.currency)],
                      ["Currency", detail.currency],
                      ["Country", detail.country || "—"],
                      ["Transaction ID", detail.transaction_id || "—", true],
                      ["Merchant Reference", detail.merchant_reference || "—", true],
                      ["Idempotency Key", detail.idempotency_key || "—", true],
                      ["Created", fmtDT(detail.created_at)],
                      ["Updated", fmtDT(detail.updated_at)],
                      ["Webhook Received", fmtDT(detail.webhook_received_at)],
                      ["Webhook Verified", detail.webhook_verified ? "Yes" : "No"],
                    ].map(([label, value, mono]) => (
                      <div key={label} className={cn("rounded-[10px] border p-2.5", brd)}>
                        <p className={cn("text-[10px] font-bold uppercase tracking-wider", sub)}>{label}</p>
                        <p className={cn("text-sm mt-1 break-all", mono ? "font-mono text-xs" : "font-semibold", txt)}>{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {detailTab === "gateway" && (
                  <div>
                    <p className={cn("text-xs font-bold uppercase tracking-wider mb-2", sub)}>Raw Gateway Response</p>
                    <pre className={cn("rounded-[12px] border p-3 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-[400px] overflow-y-auto", brd, txt, dark ? "bg-[#0f1318]" : "bg-[#f8f9fb]")}>
                      {detail.gateway_response ? JSON.stringify(detail.gateway_response, null, 2) : "No gateway response stored."}
                    </pre>
                  </div>
                )}

                {detailTab === "fraud" && (
                  <div className="space-y-3">
                    <p className={cn("text-sm font-bold", txt)}>Fraud Analysis</p>
                    {detail.customerStats ? (
                      <div className="grid grid-cols-3 gap-3">
                        <div className={cn("rounded-[10px] border p-3", brd)}>
                          <p className={cn("text-[10px] font-bold uppercase", sub)}>Customer Payments</p>
                          <p className={cn("text-xl font-extrabold mt-1", txt)}>{detail.customerStats.total}</p>
                        </div>
                        <div className={cn("rounded-[10px] border p-3", brd)}>
                          <p className={cn("text-[10px] font-bold uppercase", sub)}>Failed Attempts</p>
                          <p className={cn("text-xl font-extrabold mt-1", detail.customerStats.failed >= 3 ? "text-red-500" : txt)}>{detail.customerStats.failed}</p>
                        </div>
                        <div className={cn("rounded-[10px] border p-3", brd)}>
                          <p className={cn("text-[10px] font-bold uppercase", sub)}>Lifetime Value</p>
                          <p className={cn("text-xl font-extrabold mt-1", txt)}>{money(detail.customerStats.lifetime)}</p>
                        </div>
                      </div>
                    ) : <p className={cn("text-xs", sub)}>Guest payment — no customer history available.</p>}
                    <div className="space-y-2">
                      {[
                        { label: "Webhook signature verified", ok: !!detail.webhook_verified },
                        { label: "Amount matches order total", ok: !detail.order || Math.abs(Number(detail.amount) - Number(detail.order.total)) < 0.01 },
                        { label: "Idempotency key present", ok: !!detail.idempotency_key },
                        { label: "No repeated failures from customer", ok: !detail.customerStats || detail.customerStats.failed < 3 },
                      ].map(c => (
                        <div key={c.label} className={cn("rounded-[10px] border p-2.5 flex items-center gap-2", brd)}>
                          {c.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                          <span className={cn("text-xs font-semibold", txt)}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailTab === "refunds" && (
                  <div className="space-y-2">
                    {(detail.refunds || []).length === 0 ? <p className={cn("text-xs", sub)}>No refunds for this payment.</p> :
                      detail.refunds.map(r => (
                        <div key={r.id} className={cn("rounded-[10px] border p-3 flex items-center justify-between", brd)}>
                          <div>
                            <p className={cn("text-sm font-bold", txt)}>{money(r.amount, detail.currency)} <span className={cn("text-[10px] font-semibold uppercase ml-1", sub)}>{r.type}</span></p>
                            <p className={cn("text-[11px] mt-0.5", sub)}>{r.reason || "No reason"} — {fmtDT(r.created_at)}</p>
                          </div>
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", r.status === "completed" ? "bg-emerald-500/10 text-emerald-600" : "bg-orange-500/10 text-orange-600")}>{r.status}</span>
                        </div>
                      ))}
                  </div>
                )}

                {detailTab === "refund" && detail.status === "paid" && (
                  <div className="space-y-3 max-w-md">
                    <p className={cn("text-sm font-bold", txt)}>Process Refund</p>
                    <div>
                      <label className={cn("text-[10px] font-bold uppercase tracking-wider block mb-1", sub)}>Amount (max {money(detail.amount, detail.currency)})</label>
                      <input type="number" min={0.01} max={detail.amount} step={0.01} value={refundAmount} onChange={e => setRefundAmount(e.target.value)} className={inpCls} />
                    </div>
                    <div>
                      <label className={cn("text-[10px] font-bold uppercase tracking-wider block mb-1", sub)}>Reason</label>
                      <input value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="Customer request, defective item..." className={inpCls} />
                    </div>
                    {parseFloat(refundAmount) > 0 && parseFloat(refundAmount) < Number(detail.amount) && (
                      <p className={cn("text-[11px]", sub)}>This is a <b className={txt}>partial refund</b> — the payment stays marked as paid.</p>
                    )}
                    <button
                      onClick={() => runAction(detail.id, "refund", { amount: parseFloat(refundAmount) || 0, reason: refundReason })}
                      disabled={actionLoading || !(parseFloat(refundAmount) > 0)}
                      className="w-full h-10 rounded-[11px] bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Refund {refundAmount ? money(parseFloat(refundAmount), detail.currency) : ""}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Drawer>

      {/* ANALYTICS DRAWER */}
      <Drawer open={showAnalytics} onClose={() => setShowAnalytics(false)} title="Payments Analytics" dark={dark} width="xl">
        {!analytics ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#2563eb]" /></div>
        ) : (
          <div className="p-4 space-y-5">
            <div>
              <p className={cn("text-xs font-bold uppercase tracking-wider mb-2", sub)}>Monthly Revenue / Fees + Refunds</p>
              {analytics.monthly.length === 0 ? <p className={cn("text-xs", sub)}>No data yet.</p> : (
                <div className="space-y-1.5">
                  {analytics.monthly.map(m => {
                    const max = Math.max(...analytics.monthly.map(x => x.revenue), 1);
                    return (
                      <div key={m.month} className="flex items-center gap-2">
                        <span className={cn("text-[11px] font-semibold w-16", txt)}>{m.month}</span>
                        <div className={cn("flex-1 h-5 rounded-[6px] overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}>
                          <div className="h-full bg-emerald-500 rounded-[6px]" style={{ width: `${(m.revenue / max) * 100}%` }} />
                        </div>
                        <span className={cn("text-[11px] font-bold w-20 text-right", txt)}>{money(m.revenue)}</span>
                        <span className={cn("text-[10px] w-16 text-right", sub)}>-{money(m.fees + m.refunds)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {[
              ["Gateway Comparison", analytics.gateways, "#2563eb"],
              ["Top Countries", analytics.countries, "#0d9488"],
              ["Currencies", analytics.currencies, "#8b5cf6"],
            ].map(([title, rows, color]) => (
              <div key={title}>
                <p className={cn("text-xs font-bold uppercase tracking-wider mb-2", sub)}>{title}</p>
                {rows.length === 0 ? <p className={cn("text-xs", sub)}>No data yet.</p> : (
                  <div className="space-y-1.5">
                    {rows.map(r => {
                      const max = Math.max(...rows.map(x => x.value), 1);
                      return (
                        <div key={r.label} className="flex items-center gap-2">
                          <span className={cn("text-[11px] font-semibold w-28 truncate", txt)}>{GATEWAY_LABELS[r.label] || r.label}</span>
                          <div className={cn("flex-1 h-5 rounded-[6px] overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}>
                            <div className="h-full rounded-[6px]" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: color }} />
                          </div>
                          <span className={cn("text-[11px] font-bold w-20 text-right", txt)}>{money(r.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            <div className={cn("rounded-[12px] border p-3 flex items-center gap-3", brd)}>
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className={cn("text-sm font-bold", txt)}>{analytics.chargebacks} chargeback(s)</p>
                <p className={cn("text-[11px]", sub)}>Disputes recorded in the refunds ledger</p>
              </div>
            </div>
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
