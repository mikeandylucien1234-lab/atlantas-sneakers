// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  RotateCcw, RefreshCw, Download, Plus, Search, X, Eye, Check,
  XCircle, Loader2, Package, DollarSign, Truck, Clock, AlertTriangle,
  ShieldAlert, ClipboardCheck, MessageSquare, ArchiveIcon, Trash2,
  ChevronLeft, ChevronRight, BarChart3, Repeat, Warehouse, Tag,
  CheckCircle2, Send, FileText, MapPin, User, CreditCard, Ban,
} from "lucide-react";

type Props = { dark: boolean };

const STATUS_META = {
  pending: { label: "Pending", color: "#ea7317", bg: "bg-orange-500/10 text-orange-600" },
  approved: { label: "Approved", color: "#2563eb", bg: "bg-blue-500/10 text-blue-600" },
  rejected: { label: "Rejected", color: "#dc2626", bg: "bg-red-500/10 text-red-600" },
  awaiting_shipment: { label: "Awaiting Shipment", color: "#8b5cf6", bg: "bg-violet-500/10 text-violet-600" },
  in_transit: { label: "In Transit", color: "#0891b2", bg: "bg-cyan-500/10 text-cyan-600" },
  received: { label: "Received", color: "#0d9488", bg: "bg-teal-500/10 text-teal-600" },
  inspecting: { label: "Inspecting", color: "#ca8a04", bg: "bg-yellow-500/10 text-yellow-600" },
  refunded: { label: "Refunded", color: "#16a34a", bg: "bg-emerald-500/10 text-emerald-600" },
  exchanged: { label: "Exchanged", color: "#4f46e5", bg: "bg-indigo-500/10 text-indigo-600" },
  closed: { label: "Closed", color: "#6b7280", bg: "bg-gray-500/10 text-gray-500" },
};

const TYPE_LABELS = {
  refund: "Refund", exchange: "Exchange", replacement: "Replacement",
  store_credit: "Store Credit", repair: "Repair",
  partial_refund: "Partial Refund", partial_exchange: "Partial Exchange",
};

const WAREHOUSES = ["main", "cj", "usa", "europe", "custom"];
const WAREHOUSE_LABELS = { main: "Main Warehouse", cj: "CJ Warehouse", usa: "USA Warehouse", europe: "Europe Warehouse", custom: "Custom Warehouse" };
const CARRIERS = ["FedEx", "UPS", "DHL", "USPS", "CJPacket", "YunExpress", "4PX", "EMS", "Aramex", "Local Carrier"];

function fmtMoney(n) { return `$${(Number(n) || 0).toFixed(2)}`; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }
function fmtDateTime(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }

export function AdminReturns({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[40px] rounded-[10px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");
  const labelCls = cn("text-xs font-semibold block mb-1.5", sub);
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnPrimary = "h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors flex items-center gap-2 disabled:opacity-50";
  const btnGhost = cn("h-10 px-4 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2", brd, txt, hover);

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [returns, setReturns] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");
  const [showCreate, setShowCreate] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadKpis = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/returns?section=kpis");
      if (res.ok) setKpis(await res.json());
    } catch { /* silent */ }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), per_page: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (reasonFilter) params.set("reason", reasonFilter);
      if (typeFilter) params.set("type", typeFilter);
      if (warehouseFilter) params.set("warehouse", warehouseFilter);
      if (showArchived) params.set("archived", "true");
      const res = await fetch(`/api/admin/returns?${params}`);
      if (res.ok) {
        const d = await res.json();
        setReturns(d.returns || []);
        setTotal(d.total || 0);
        setTotalPages(d.totalPages || 0);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [page, search, statusFilter, reasonFilter, typeFilter, warehouseFilter, showArchived]);

  useEffect(() => { loadKpis(); }, [loadKpis]);
  useEffect(() => {
    const t = setTimeout(loadList, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadList]);
  useEffect(() => {
    fetch("/api/admin/returns?section=reasons").then(r => r.ok ? r.json() : null).then(d => d && setReasons(d.reasons || [])).catch(() => {});
  }, []);

  const refresh = () => { loadKpis(); loadList(); };

  const openDetail = async (id) => {
    setDetailLoading(true);
    setDetailTab("overview");
    try {
      const res = await fetch(`/api/admin/returns?section=detail&id=${id}`);
      if (res.ok) setDetail(await res.json());
      else showToast("Failed to load return", "error");
    } catch { showToast("Failed to load return", "error"); } finally { setDetailLoading(false); }
  };

  const runAction = async (id, action, extra = {}) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/returns", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Action failed");
      showToast("Action completed");
      refresh();
      if (detail?.id === id) openDetail(id);
      return true;
    } catch (e) {
      showToast(e.message || "Action failed", "error");
      return false;
    } finally { setActionLoading(false); }
  };

  const bulkAction = async (action, extra = {}) => {
    if (selected.size === 0) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/returns", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], action, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Bulk action failed");
      showToast(`${selected.size} return(s) updated`);
      setSelected(new Set());
      refresh();
    } catch (e) { showToast(e.message, "error"); } finally { setActionLoading(false); }
  };

  const exportCsv = async () => {
    try {
      const res = await fetch("/api/admin/returns?section=export");
      const d = await res.json();
      const rows = d.returns || [];
      const header = ["Return ID", "Order", "Customer", "Type", "Reason", "Status", "Refund Amount", "Tracking", "Carrier", "Warehouse", "Created"];
      const csv = [header.join(","), ...rows.map(r => [
        r.return_number, r.order?.order_number || "", `"${r.customer?.full_name || r.customer?.email || ""}"`,
        r.return_type, r.reason, r.status, r.refund_amount || 0,
        r.tracking_number || "", r.carrier || "", r.warehouse || "", r.created_at?.slice(0, 10) || "",
      ].join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `returns-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Export downloaded");
    } catch { showToast("Export failed", "error"); }
  };

  const openAnalytics = async () => {
    setShowAnalytics(true);
    try {
      const res = await fetch("/api/admin/returns?section=analytics");
      if (res.ok) setAnalytics(await res.json());
    } catch { /* silent */ }
  };

  const toggleSelect = (id) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const kpiCards = useMemo(() => kpis ? [
    { label: "Total Requests", value: kpis.total, icon: RotateCcw, color: "#2563eb" },
    { label: "Pending Approval", value: kpis.pending, icon: Clock, color: "#ea7317" },
    { label: "Approved", value: kpis.approved, icon: Check, color: "#2563eb" },
    { label: "Rejected", value: kpis.rejected, icon: XCircle, color: "#dc2626" },
    { label: "Awaiting Shipment", value: kpis.awaiting_shipment, icon: Package, color: "#8b5cf6" },
    { label: "In Transit", value: kpis.in_transit, icon: Truck, color: "#0891b2" },
    { label: "Received", value: kpis.received, icon: Warehouse, color: "#0d9488" },
    { label: "Inspection Pending", value: kpis.inspecting, icon: ClipboardCheck, color: "#ca8a04" },
    { label: "Refunded", value: kpis.refunded, icon: DollarSign, color: "#16a34a" },
    { label: "Exchanged", value: kpis.exchanged, icon: Repeat, color: "#4f46e5" },
    { label: "Closed Cases", value: kpis.closed, icon: CheckCircle2, color: "#6b7280" },
    { label: "Avg Resolution", value: `${kpis.avgResolutionHours}h`, icon: Clock, color: "#0891b2" },
    { label: "Refund Amount", value: fmtMoney(kpis.refundAmount), icon: CreditCard, color: "#16a34a" },
    { label: "Exchange Rate", value: `${kpis.exchangeRate}%`, icon: Repeat, color: "#8b5cf6" },
    { label: "Return Rate", value: `${kpis.returnRate}%`, icon: BarChart3, color: "#ea7317" },
    { label: "Fraud Flags", value: kpis.fraudulent, icon: ShieldAlert, color: "#dc2626" },
  ] : [], [kpis]);

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em]", txt)}>Returns & Refunds</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Manage all return requests, exchanges, refunds and reverse logistics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowCreate(true)} className={btnPrimary}><Plus className="w-4 h-4" /> Create Return</button>
          <button onClick={openAnalytics} className={btnGhost}><BarChart3 className="w-4 h-4" /> Analytics</button>
          <button onClick={exportCsv} className={btnGhost}><Download className="w-4 h-4" /> Export</button>
          <button onClick={refresh} className={btnGhost}><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh</button>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpiCards.length === 0
          ? Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className={cn("rounded-[14px] border p-3 animate-pulse h-[76px]", p, brd)} />
            ))
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

      {/* SEARCH + FILTERS */}
      <div className={cn(cardCls, "p-3 flex flex-col lg:flex-row gap-2")}>
        <div className="relative flex-1">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", sub)} />
          <input
            type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by return ID, tracking number, carrier..."
            className={cn(inpCls, "pl-9")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={reasonFilter} onChange={e => { setReasonFilter(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")}>
            <option value="">All Reasons</option>
            {reasons.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")}>
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={warehouseFilter} onChange={e => { setWarehouseFilter(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")}>
            <option value="">All Warehouses</option>
            {WAREHOUSES.map(w => <option key={w} value={w}>{WAREHOUSE_LABELS[w]}</option>)}
          </select>
          <button onClick={() => { setShowArchived(v => !v); setPage(1); }} className={cn("h-10 px-3 rounded-[10px] border text-xs font-semibold transition-colors", showArchived ? "bg-[#2563eb] text-white border-[#2563eb]" : cn(brd, sub, hover))}>
            <ArchiveIcon className="w-3.5 h-3.5 inline mr-1" /> Archived
          </button>
        </div>
      </div>

      {/* BULK BAR */}
      {selected.size > 0 && (
        <div className={cn("rounded-[12px] border p-3 flex flex-wrap items-center gap-2", p, brd)}>
          <span className={cn("text-sm font-bold mr-2", txt)}>{selected.size} selected</span>
          <button onClick={() => bulkAction("approve")} disabled={actionLoading} className="h-8 px-3 rounded-[9px] bg-emerald-500/10 text-emerald-600 text-xs font-bold hover:bg-emerald-500/20">Approve</button>
          <button onClick={() => bulkAction("reject")} disabled={actionLoading} className="h-8 px-3 rounded-[9px] bg-red-500/10 text-red-600 text-xs font-bold hover:bg-red-500/20">Reject</button>
          <button onClick={() => bulkAction("assign_warehouse", { warehouse: "main" })} disabled={actionLoading} className="h-8 px-3 rounded-[9px] bg-blue-500/10 text-blue-600 text-xs font-bold hover:bg-blue-500/20">Assign Main WH</button>
          <button onClick={() => bulkAction("archive")} disabled={actionLoading} className="h-8 px-3 rounded-[9px] bg-gray-500/10 text-gray-500 text-xs font-bold hover:bg-gray-500/20">Archive</button>
          <button onClick={() => bulkAction("delete")} disabled={actionLoading} className="h-8 px-3 rounded-[9px] bg-red-500/10 text-red-600 text-xs font-bold hover:bg-red-500/20">Delete</button>
          <button onClick={() => setSelected(new Set())} className={cn("h-8 px-3 rounded-[9px] text-xs font-bold", sub)}>Clear</button>
        </div>
      )}

      {/* TABLE */}
      <div className={cn(cardCls, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={cn("border-b", brd)}>
                <th className="p-3 w-10">
                  <input type="checkbox"
                    checked={returns.length > 0 && selected.size === returns.length}
                    onChange={e => setSelected(e.target.checked ? new Set(returns.map(r => r.id)) : new Set())}
                    className="rounded" />
                </th>
                {["Return ID", "Order", "Customer", "Product", "Reason", "Type", "Refund", "Tracking", "Status", "Created", ""].map(h => (
                  <th key={h} className={cn("p-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap", sub)}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className={cn("border-b", brd)}>
                    <td colSpan={12} className="p-3"><div className={cn("h-8 rounded-[8px] animate-pulse", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")} /></td>
                  </tr>
                ))
              ) : returns.length === 0 ? (
                <tr><td colSpan={12} className="p-12 text-center">
                  <RotateCcw className={cn("w-10 h-10 mx-auto mb-3", sub)} />
                  <p className={cn("text-sm font-bold", txt)}>No returns found</p>
                  <p className={cn("text-xs mt-1", sub)}>Return requests will appear here.</p>
                </td></tr>
              ) : returns.map(r => {
                const meta = STATUS_META[r.status] || STATUS_META.pending;
                const firstItem = (r.items || [])[0];
                return (
                  <tr key={r.id} className={cn("border-b transition-colors cursor-pointer", brd, hover)} onClick={() => openDetail(r.id)}>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" />
                    </td>
                    <td className="p-3">
                      <span className={cn("text-xs font-bold font-mono", txt)}>{r.return_number}</span>
                      {(r.fraud_score || 0) >= 60 && <ShieldAlert className="w-3.5 h-3.5 text-red-500 inline ml-1.5" />}
                    </td>
                    <td className={cn("p-3 text-xs font-semibold whitespace-nowrap", sub)}>{r.order?.order_number || "—"}</td>
                    <td className="p-3 whitespace-nowrap">
                      <p className={cn("text-xs font-semibold", txt)}>{r.customer?.full_name || "—"}</p>
                      <p className={cn("text-[10px]", sub)}>{r.customer?.email || ""}</p>
                    </td>
                    <td className="p-3 max-w-[160px]">
                      <p className={cn("text-xs font-semibold truncate", txt)}>{firstItem?.product_name || firstItem?.product?.name || "—"}</p>
                      {(r.items || []).length > 1 && <p className={cn("text-[10px]", sub)}>+{r.items.length - 1} more</p>}
                    </td>
                    <td className={cn("p-3 text-xs capitalize whitespace-nowrap", sub)}>{(r.reason || "").replace(/_/g, " ")}</td>
                    <td className="p-3 whitespace-nowrap"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", dark ? "bg-[#252c36] text-[#e7ebf0]" : "bg-[#f0f2f5] text-[#16181d]")}>{TYPE_LABELS[r.return_type] || r.return_type}</span></td>
                    <td className={cn("p-3 text-xs font-bold whitespace-nowrap", txt)}>{r.refund_amount > 0 ? fmtMoney(r.refund_amount) : "—"}</td>
                    <td className="p-3 whitespace-nowrap">
                      <p className={cn("text-[11px] font-mono", txt)}>{r.tracking_number || "—"}</p>
                      {r.carrier && <p className={cn("text-[10px]", sub)}>{r.carrier}</p>}
                    </td>
                    <td className="p-3 whitespace-nowrap"><span className={cn("px-2 py-1 rounded-full text-[10px] font-bold", meta.bg)}>{meta.label}</span></td>
                    <td className={cn("p-3 text-xs whitespace-nowrap", sub)}>{fmtDate(r.created_at)}</td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openDetail(r.id)} title="View" className={cn("w-7 h-7 rounded-[8px] flex items-center justify-center", hover)}><Eye className={cn("w-3.5 h-3.5", sub)} /></button>
                        {r.status === "pending" && (
                          <>
                            <button onClick={() => runAction(r.id, "approve")} title="Approve" className="w-7 h-7 rounded-[8px] flex items-center justify-center hover:bg-emerald-500/10"><Check className="w-3.5 h-3.5 text-emerald-500" /></button>
                            <button onClick={() => runAction(r.id, "reject")} title="Reject" className="w-7 h-7 rounded-[8px] flex items-center justify-center hover:bg-red-500/10"><XCircle className="w-3.5 h-3.5 text-red-500" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className={cn("flex items-center justify-between p-3 border-t", brd)}>
            <span className={cn("text-xs", sub)}>{total} return(s) — page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p2 => p2 - 1)} className={cn("w-8 h-8 rounded-[9px] border flex items-center justify-center disabled:opacity-40", brd, hover)}><ChevronLeft className={cn("w-4 h-4", sub)} /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p2 => p2 + 1)} className={cn("w-8 h-8 rounded-[9px] border flex items-center justify-center disabled:opacity-40", brd, hover)}><ChevronRight className={cn("w-4 h-4", sub)} /></button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER */}
      <DetailDrawer
        dark={dark} detail={detail} loading={detailLoading} tab={detailTab} setTab={setDetailTab}
        onClose={() => setDetail(null)} runAction={runAction} actionLoading={actionLoading}
        showToast={showToast} refreshDetail={() => detail && openDetail(detail.id)}
        styles={{ p, brd, txt, sub, inp, hover, inpCls, labelCls }}
      />

      {/* CREATE DRAWER */}
      {showCreate && (
        <CreateDrawer
          dark={dark} reasons={reasons} onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refresh(); showToast("Return created"); }}
          showToast={showToast}
          styles={{ p, brd, txt, sub, inp, hover, inpCls, labelCls, btnPrimary }}
        />
      )}

      {/* ANALYTICS DRAWER */}
      <Drawer open={showAnalytics} onClose={() => setShowAnalytics(false)} title="Returns Analytics" dark={dark} width="xl">
        {!analytics ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#2563eb]" /></div>
        ) : (
          <div className="p-4 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className={cn("rounded-[12px] border p-3", brd)}>
                <p className={cn("text-[10px] font-bold uppercase", sub)}>Total Refunded</p>
                <p className={cn("text-xl font-extrabold mt-1", txt)}>{fmtMoney(analytics.totalRefunded)}</p>
                <p className={cn("text-[10px] mt-0.5", sub)}>{analytics.refundCount} refund(s)</p>
              </div>
              <div className={cn("rounded-[12px] border p-3", brd)}>
                <p className={cn("text-[10px] font-bold uppercase", sub)}>Fraud Detection</p>
                <p className={cn("text-xl font-extrabold mt-1 text-red-500")}>{analytics.flagged}</p>
                <p className={cn("text-[10px] mt-0.5", sub)}>{analytics.highRiskCustomers} high-risk customer(s)</p>
              </div>
            </div>
            <ChartBlock title="Top Return Reasons" rows={analytics.topReasons.map(r => ({ label: r.reason.replace(/_/g, " "), value: r.count }))} color="#ea7317" dark={dark} txt={txt} sub={sub} />
            <ChartBlock title="Most Returned Products" rows={analytics.mostReturnedProducts.map(r => ({ label: r.product, value: r.count }))} color="#2563eb" dark={dark} txt={txt} sub={sub} />
            <ChartBlock title="Carrier Performance" rows={analytics.topCarriers.map(r => ({ label: r.carrier, value: r.count }))} color="#0d9488" dark={dark} txt={txt} sub={sub} />
            <ChartBlock title="Monthly Volume" rows={analytics.monthly.map(r => ({ label: r.month, value: r.count }))} color="#8b5cf6" dark={dark} txt={txt} sub={sub} />
          </div>
        )}
      </Drawer>

      {/* TOAST */}
      {toast && (
        <div className={cn("fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg",
          toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function ChartBlock({ title, rows, color, dark, txt, sub }) {
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div>
      <p className={cn("text-xs font-bold uppercase tracking-wider mb-2", sub)}>{title}</p>
      {rows.length === 0 ? <p className={cn("text-xs", sub)}>No data yet.</p> : (
        <div className="space-y-1.5">
          {rows.map(r => (
            <div key={r.label} className="flex items-center gap-2">
              <span className={cn("text-[11px] font-semibold w-32 truncate capitalize", txt)}>{r.label}</span>
              <div className={cn("flex-1 h-5 rounded-[6px] overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}>
                <div className="h-full rounded-[6px] transition-all" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: color }} />
              </div>
              <span className={cn("text-[11px] font-bold w-8 text-right", txt)}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailDrawer({ dark, detail, loading, tab, setTab, onClose, runAction, actionLoading, showToast, refreshDetail, styles }) {
  const { brd, txt, sub, inpCls, labelCls, hover } = styles;
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [labelCarrier, setLabelCarrier] = useState("CJPacket");
  const [labelWarehouse, setLabelWarehouse] = useState("main");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("original");
  const [refundShipping, setRefundShipping] = useState(false);
  const [refundTax, setRefundTax] = useState(false);
  const [inspCondition, setInspCondition] = useState("like_new");
  const [inspDecision, setInspDecision] = useState("approved");
  const [inspDamage, setInspDamage] = useState("");
  const [inspMissing, setInspMissing] = useState("");
  const [inspNotes, setInspNotes] = useState("");
  const [restocks, setRestocks] = useState({});
  const [exProductQ, setExProductQ] = useState("");
  const [exProducts, setExProducts] = useState([]);
  const [exProduct, setExProduct] = useState(null);
  const [exVariant, setExVariant] = useState("");
  const [exDiff, setExDiff] = useState("0");

  useEffect(() => {
    if (detail) {
      setRefundAmount(String(detail.refund_amount || detail.order?.total || ""));
      setRestocks({});
      setNote(""); setMessage("");
    }
  }, [detail?.id]);

  useEffect(() => {
    if (!exProductQ || exProductQ.length < 2) { setExProducts([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/products?section=list&search=${encodeURIComponent(exProductQ)}&per_page=8`);
        if (res.ok) {
          const d = await res.json();
          setExProducts(d.products || []);
        }
      } catch { /* silent */ }
    }, 300);
    return () => clearTimeout(t);
  }, [exProductQ]);

  if (!detail && !loading) return null;
  const meta = detail ? (STATUS_META[detail.status] || STATUS_META.pending) : null;

  const sendMessage = async () => {
    if (!message.trim()) return;
    try {
      const res = await fetch("/api/admin/returns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_message", return_id: detail.id, message, is_internal: isInternal }),
      });
      if (!res.ok) throw new Error();
      setMessage("");
      refreshDetail();
    } catch { showToast("Failed to send message", "error"); }
  };

  const generateLabel = async () => {
    try {
      const res = await fetch("/api/admin/returns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_label", return_id: detail.id, carrier: labelCarrier, warehouse: labelWarehouse }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showToast(`Label generated — ${d.tracking_number}`);
      refreshDetail();
    } catch (e) { showToast(e.message || "Failed to generate label", "error"); }
  };

  const submitInspection = () => {
    const item_restocks = (detail.items || []).map(it => ({
      item_id: it.id, restock: !!restocks[it.id], condition: inspCondition,
    }));
    runAction(detail.id, "inspect", {
      condition: inspCondition, decision: inspDecision,
      damage_report: inspDamage || null, missing_accessories: inspMissing || null,
      notes: inspNotes || null, item_restocks,
    });
  };

  const TABS = ["overview", "products", "timeline", "inspection", "refund", "exchange", "messages", "history"];

  return (
    <Drawer open={!!detail || loading} onClose={onClose} title={detail ? `Return ${detail.return_number}` : "Loading..."} dark={dark} width="2xl">
      {loading || !detail ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#2563eb]" /></div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Status + quick actions */}
          <div className={cn("p-4 border-b space-y-3", brd)}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold", meta.bg)}>{meta.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {detail.status === "pending" && (
                  <>
                    <QBtn onClick={() => runAction(detail.id, "approve")} disabled={actionLoading} color="emerald" icon={Check}>Approve</QBtn>
                    <QBtn onClick={() => runAction(detail.id, "reject")} disabled={actionLoading} color="red" icon={XCircle}>Reject</QBtn>
                    <QBtn onClick={() => runAction(detail.id, "request_info", { note: "Could you provide more details or photos about this return?" })} disabled={actionLoading} color="blue" icon={MessageSquare}>Request Info</QBtn>
                  </>
                )}
                {detail.status === "approved" && (
                  <QBtn onClick={generateLabel} disabled={actionLoading} color="violet" icon={Tag}>Generate Label</QBtn>
                )}
                {detail.status === "awaiting_shipment" && (
                  <QBtn onClick={() => runAction(detail.id, "update_status", { status: "in_transit" })} disabled={actionLoading} color="cyan" icon={Truck}>Mark In Transit</QBtn>
                )}
                {detail.status === "in_transit" && (
                  <QBtn onClick={() => runAction(detail.id, "update_status", { status: "received" })} disabled={actionLoading} color="teal" icon={Warehouse}>Mark Received</QBtn>
                )}
                {["received", "inspecting"].includes(detail.status) && (
                  <QBtn onClick={() => setTab("inspection")} color="yellow" icon={ClipboardCheck}>Inspect</QBtn>
                )}
                {!["refunded", "exchanged", "closed", "rejected"].includes(detail.status) && (
                  <QBtn onClick={() => runAction(detail.id, "close")} disabled={actionLoading} color="gray" icon={Ban}>Close</QBtn>
                )}
                <QBtn onClick={() => runAction(detail.id, "archive")} disabled={actionLoading} color="gray" icon={ArchiveIcon}>{detail.is_archived ? "Unarchive" : "Archive"}</QBtn>
              </div>
            </div>
            {(detail.fraud_score || 0) >= 30 && (
              <div className="rounded-[10px] bg-red-500/10 p-2.5 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-xs font-semibold text-red-600">
                  Fraud score {detail.fraud_score}/100 — {(detail.fraud_flags || []).map(f => f.replace(/_/g, " ")).join(", ")}
                </p>
              </div>
            )}
            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)} className={cn("px-3 h-8 rounded-[9px] text-xs font-bold capitalize whitespace-nowrap transition-colors", tab === t ? "bg-[#2563eb] text-white" : cn(sub, hover))}>{t}</button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {tab === "overview" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Order" value={detail.order?.order_number || "—"} icon={Package} styles={styles} />
                  <InfoRow label="Order Total" value={fmtMoney(detail.order?.total)} icon={DollarSign} styles={styles} />
                  <InfoRow label="Customer" value={detail.customer?.full_name || detail.customer?.email || "—"} icon={User} styles={styles} />
                  <InfoRow label="Agent" value={detail.agent?.full_name || "Unassigned"} icon={User} styles={styles} />
                  <InfoRow label="Type" value={TYPE_LABELS[detail.return_type] || detail.return_type} icon={Repeat} styles={styles} />
                  <InfoRow label="Reason" value={(detail.reason || "").replace(/_/g, " ")} icon={FileText} styles={styles} />
                  <InfoRow label="Warehouse" value={WAREHOUSE_LABELS[detail.warehouse] || detail.warehouse} icon={Warehouse} styles={styles} />
                  <InfoRow label="Carrier / Tracking" value={detail.tracking_number ? `${detail.carrier || ""} ${detail.tracking_number}` : "—"} icon={Truck} styles={styles} />
                  <InfoRow label="Created" value={fmtDateTime(detail.created_at)} icon={Clock} styles={styles} />
                  <InfoRow label="Resolved" value={fmtDateTime(detail.resolved_at)} icon={CheckCircle2} styles={styles} />
                </div>
                {detail.description && (
                  <div>
                    <p className={labelCls}>Customer Description</p>
                    <p className={cn("text-sm rounded-[10px] border p-3", brd, txt)}>{detail.description}</p>
                  </div>
                )}
                {(detail.evidence || []).length > 0 && (
                  <div>
                    <p className={labelCls}>Customer Evidence</p>
                    <div className="grid grid-cols-4 gap-2">
                      {detail.evidence.map((ev, i) => (
                        <a key={i} href={ev.url} target="_blank" rel="noreferrer" className={cn("rounded-[10px] border overflow-hidden aspect-square", brd)}>
                          {ev.type === "photo" ? <img src={ev.url} alt="" className="w-full h-full object-cover" /> : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                              <FileText className={cn("w-5 h-5", sub)} />
                              <span className={cn("text-[9px] font-bold uppercase", sub)}>{ev.type}</span>
                            </div>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {detail.return_label_url && (
                  <div className="rounded-[10px] bg-violet-500/10 p-3">
                    <p className="text-xs font-bold text-violet-600">Return Label</p>
                    <p className={cn("text-[11px] mt-1 break-all", sub)}>{detail.return_label_url}</p>
                  </div>
                )}
              </>
            )}

            {tab === "products" && (
              <div className="space-y-2">
                {(detail.items || []).map(it => (
                  <div key={it.id} className={cn("rounded-[12px] border p-3 flex items-center gap-3", brd)}>
                    {it.product?.images?.[0]
                      ? <img src={it.product.images[0]} alt="" className="w-12 h-12 rounded-[8px] object-cover" />
                      : <div className={cn("w-12 h-12 rounded-[8px] flex items-center justify-center", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}><Package className={cn("w-5 h-5", sub)} /></div>}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-bold truncate", txt)}>{it.product_name || it.product?.name || "Product"}</p>
                      <p className={cn("text-[11px]", sub)}>{it.sku ? `SKU ${it.sku} — ` : ""}Qty {it.quantity} × {fmtMoney(it.unit_price)}</p>
                    </div>
                    <div className="text-right">
                      {it.condition && <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold capitalize", dark ? "bg-[#252c36] text-[#e7ebf0]" : "bg-[#f0f2f5] text-[#16181d]")}>{it.condition.replace(/_/g, " ")}</span>}
                      {it.restock && <p className="text-[10px] font-bold text-emerald-500 mt-1">Restocked</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "timeline" && (
              <div className="space-y-0">
                {(detail.events || []).length === 0 ? <p className={cn("text-xs", sub)}>No events yet.</p> :
                  detail.events.map((ev, i) => (
                    <div key={ev.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#2563eb] mt-1.5" />
                        {i < detail.events.length - 1 && <div className={cn("w-px flex-1", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />}
                      </div>
                      <div className="pb-5">
                        <p className={cn("text-sm font-bold", txt)}>{ev.title}</p>
                        {ev.description && <p className={cn("text-xs mt-0.5", sub)}>{ev.description}</p>}
                        <p className={cn("text-[10px] mt-1", sub)}>{fmtDateTime(ev.created_at)}{ev.actor ? ` — ${ev.actor}` : ""}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {tab === "inspection" && (
              detail.inspection ? (
                <div className="space-y-3">
                  <div className="rounded-[10px] bg-emerald-500/10 p-3">
                    <p className="text-xs font-bold text-emerald-600">Inspection completed {fmtDateTime(detail.inspection.inspected_at)} by {detail.inspection.inspector}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow label="Condition" value={(detail.inspection.condition || "").replace(/_/g, " ")} icon={ClipboardCheck} styles={styles} />
                    <InfoRow label="Decision" value={detail.inspection.decision} icon={CheckCircle2} styles={styles} />
                  </div>
                  {detail.inspection.damage_report && <div><p className={labelCls}>Damage Report</p><p className={cn("text-sm rounded-[10px] border p-3", brd, txt)}>{detail.inspection.damage_report}</p></div>}
                  {detail.inspection.missing_accessories && <div><p className={labelCls}>Missing Accessories</p><p className={cn("text-sm rounded-[10px] border p-3", brd, txt)}>{detail.inspection.missing_accessories}</p></div>}
                  {detail.inspection.notes && <div><p className={labelCls}>Notes</p><p className={cn("text-sm rounded-[10px] border p-3", brd, txt)}>{detail.inspection.notes}</p></div>}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className={cn("text-sm font-bold", txt)}>Inspection Center</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Product Condition</label>
                      <select value={inspCondition} onChange={e => setInspCondition(e.target.value)} className={inpCls}>
                        {["new", "like_new", "used", "damaged", "defective"].map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Final Decision</label>
                      <select value={inspDecision} onChange={e => setInspDecision(e.target.value)} className={inpCls}>
                        <option value="approved">Approve — proceed to refund/exchange</option>
                        <option value="rejected">Reject — claim invalid</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Damage Report</label>
                    <textarea value={inspDamage} onChange={e => setInspDamage(e.target.value)} rows={2} placeholder="Describe any damage found..." className={cn("w-full rounded-[10px] border-[1.5px] p-3 text-sm outline-none resize-y", styles.inp, "focus:border-[#2563eb]")} />
                  </div>
                  <div>
                    <label className={labelCls}>Missing Accessories</label>
                    <input value={inspMissing} onChange={e => setInspMissing(e.target.value)} placeholder="Laces, box, extra soles..." className={inpCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea value={inspNotes} onChange={e => setInspNotes(e.target.value)} rows={2} placeholder="Internal quality validation notes..." className={cn("w-full rounded-[10px] border-[1.5px] p-3 text-sm outline-none resize-y", styles.inp, "focus:border-[#2563eb]")} />
                  </div>
                  <div>
                    <label className={labelCls}>Restock Items (updates inventory automatically)</label>
                    <div className="space-y-2">
                      {(detail.items || []).map(it => (
                        <label key={it.id} className={cn("flex items-center gap-2 rounded-[10px] border p-2.5 cursor-pointer", brd)}>
                          <input type="checkbox" checked={!!restocks[it.id]} onChange={e => setRestocks(r => ({ ...r, [it.id]: e.target.checked }))} className="rounded" />
                          <span className={cn("text-xs font-semibold flex-1", txt)}>{it.product_name || it.product?.name} × {it.quantity}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button onClick={submitInspection} disabled={actionLoading} className="w-full h-10 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center justify-center gap-2">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />} Complete Inspection
                  </button>
                </div>
              )
            )}

            {tab === "refund" && (
              detail.refund_status === "completed" ? (
                <div className="rounded-[10px] bg-emerald-500/10 p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-emerald-600">Refunded {fmtMoney(detail.refund_amount)}</p>
                  <p className={cn("text-xs mt-1", sub)}>Method: {(detail.refund_method || "original").replace(/_/g, " ")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className={cn("text-sm font-bold", txt)}>Refund Center</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Refund Amount ($)</label>
                      <input type="number" min={0} step={0.01} value={refundAmount} onChange={e => setRefundAmount(e.target.value)} className={inpCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Refund Method</label>
                      <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)} className={inpCls}>
                        <option value="original">Original Payment</option>
                        <option value="store_credit">Store Credit</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <label className={cn("flex items-center gap-2 text-xs font-semibold cursor-pointer", txt)}>
                      <input type="checkbox" checked={refundShipping} onChange={e => setRefundShipping(e.target.checked)} className="rounded" /> Refund shipping
                    </label>
                    <label className={cn("flex items-center gap-2 text-xs font-semibold cursor-pointer", txt)}>
                      <input type="checkbox" checked={refundTax} onChange={e => setRefundTax(e.target.checked)} className="rounded" /> Refund tax
                    </label>
                  </div>
                  {detail.order && (
                    <p className={cn("text-[11px]", sub)}>Order total: {fmtMoney(detail.order.total)} (subtotal {fmtMoney(detail.order.subtotal)} + shipping {fmtMoney(detail.order.shipping_cost)})</p>
                  )}
                  <button
                    onClick={() => runAction(detail.id, "refund", { amount: parseFloat(refundAmount) || 0, method: refundMethod, refund_shipping: refundShipping, refund_tax: refundTax })}
                    disabled={actionLoading || !(parseFloat(refundAmount) > 0)}
                    className="w-full h-10 rounded-[11px] bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />} Process Refund
                  </button>
                </div>
              )
            )}

            {tab === "exchange" && (
              detail.status === "exchanged" ? (
                <div className="rounded-[10px] bg-indigo-500/10 p-4 text-center">
                  <Repeat className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-indigo-600">Exchange processed</p>
                  <p className={cn("text-xs mt-1", sub)}>Replacement order created{detail.price_difference ? ` — price difference ${fmtMoney(detail.price_difference)}` : ""}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className={cn("text-sm font-bold", txt)}>Exchange Center</p>
                  <div>
                    <label className={labelCls}>Search Replacement Product</label>
                    <input value={exProductQ} onChange={e => { setExProductQ(e.target.value); setExProduct(null); }} placeholder="Type product name..." className={inpCls} />
                    {exProducts.length > 0 && !exProduct && (
                      <div className={cn("mt-1 rounded-[10px] border divide-y max-h-52 overflow-y-auto", brd)}>
                        {exProducts.map(pr => (
                          <button key={pr.id} onClick={() => { setExProduct(pr); setExProducts([]); setExDiff(String(Math.max((Number(pr.price) || 0) - (Number(detail.refund_amount) || Number(detail.order?.total) || 0), 0).toFixed(2))); }}
                            className={cn("w-full flex items-center gap-2 p-2 text-left", hover)}>
                            {pr.images?.[0] && <img src={pr.images[0]} alt="" className="w-8 h-8 rounded object-cover" />}
                            <span className={cn("text-xs font-semibold flex-1 truncate", txt)}>{pr.name}</span>
                            <span className={cn("text-xs font-bold", txt)}>{fmtMoney(pr.price)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {exProduct && (
                    <>
                      <div className={cn("rounded-[10px] border p-3 flex items-center gap-3", brd)}>
                        {exProduct.images?.[0] && <img src={exProduct.images[0]} alt="" className="w-10 h-10 rounded-[8px] object-cover" />}
                        <div className="flex-1">
                          <p className={cn("text-sm font-bold", txt)}>{exProduct.name}</p>
                          <p className={cn("text-xs", sub)}>{fmtMoney(exProduct.price)}</p>
                        </div>
                        <button onClick={() => setExProduct(null)}><X className={cn("w-4 h-4", sub)} /></button>
                      </div>
                      {(exProduct.variants || []).length > 0 && (
                        <div>
                          <label className={labelCls}>Variant (size / color)</label>
                          <select value={exVariant} onChange={e => setExVariant(e.target.value)} className={inpCls}>
                            <option value="">No specific variant</option>
                            {exProduct.variants.map(v => <option key={v.id} value={v.id}>{[v.size, v.color].filter(Boolean).join(" / ")} — stock {v.stock}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className={labelCls}>Price Difference to Collect ($)</label>
                        <input type="number" step={0.01} value={exDiff} onChange={e => setExDiff(e.target.value)} className={inpCls} />
                      </div>
                      <button
                        onClick={() => runAction(detail.id, "exchange", { product_id: exProduct.id, variant_id: exVariant || null, price_difference: parseFloat(exDiff) || 0 })}
                        disabled={actionLoading}
                        className="w-full h-10 rounded-[11px] bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />} Process Exchange (creates replacement order)
                      </button>
                    </>
                  )}
                </div>
              )
            )}

            {tab === "messages" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {(detail.messages || []).length === 0 ? <p className={cn("text-xs", sub)}>No messages yet.</p> :
                    detail.messages.map(m => (
                      <div key={m.id} className={cn("rounded-[12px] border p-3", brd, m.is_internal && "bg-amber-500/5 border-amber-500/30")}>
                        <div className="flex items-center justify-between">
                          <p className={cn("text-xs font-bold", txt)}>{m.sender_name || m.sender_role}{m.is_internal && <span className="ml-2 text-[9px] font-bold text-amber-600 uppercase">Internal</span>}</p>
                          <span className={cn("text-[10px]", sub)}>{fmtDateTime(m.created_at)}</span>
                        </div>
                        <p className={cn("text-sm mt-1", txt)}>{m.message}</p>
                      </div>
                    ))}
                </div>
                <div className="space-y-2">
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Write a message to the customer or an internal note..." className={cn("w-full rounded-[10px] border-[1.5px] p-3 text-sm outline-none resize-y", styles.inp, "focus:border-[#2563eb]")} />
                  <div className="flex items-center justify-between">
                    <label className={cn("flex items-center gap-2 text-xs font-semibold cursor-pointer", txt)}>
                      <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" /> Internal note (hidden from customer)
                    </label>
                    <button onClick={sendMessage} disabled={!message.trim()} className="h-9 px-4 rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" /> Send
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "history" && (
              <div className="space-y-2">
                <p className={cn("text-xs font-bold uppercase tracking-wider", sub)}>Customer Return History</p>
                {(detail.customer_history || []).length === 0 ? <p className={cn("text-xs", sub)}>No previous returns from this customer.</p> :
                  detail.customer_history.map(h => (
                    <div key={h.id} className={cn("rounded-[10px] border p-2.5 flex items-center justify-between", brd)}>
                      <div>
                        <p className={cn("text-xs font-bold font-mono", txt)}>{h.return_number}</p>
                        <p className={cn("text-[10px]", sub)}>{fmtDate(h.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", (STATUS_META[h.status] || STATUS_META.pending).bg)}>{(STATUS_META[h.status] || STATUS_META.pending).label}</span>
                        {h.refund_amount > 0 && <p className={cn("text-[10px] font-bold mt-0.5", txt)}>{fmtMoney(h.refund_amount)}</p>}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Label generation footer for approved returns */}
          {detail.status === "approved" && (
            <div className={cn("p-3 border-t flex flex-wrap items-center gap-2", brd)}>
              <select value={labelCarrier} onChange={e => setLabelCarrier(e.target.value)} className={cn(inpCls, "w-auto h-9")}>
                {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={labelWarehouse} onChange={e => setLabelWarehouse(e.target.value)} className={cn(inpCls, "w-auto h-9")}>
                {WAREHOUSES.map(w => <option key={w} value={w}>{WAREHOUSE_LABELS[w]}</option>)}
              </select>
              <button onClick={generateLabel} className="h-9 px-4 rounded-[10px] bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Generate Return Label
              </button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

function QBtn({ onClick, disabled, color, icon: Icon, children }) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20",
    red: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
    blue: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
    violet: "bg-violet-500/10 text-violet-600 hover:bg-violet-500/20",
    cyan: "bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20",
    teal: "bg-teal-500/10 text-teal-600 hover:bg-teal-500/20",
    yellow: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
    gray: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={cn("h-8 px-2.5 rounded-[9px] text-[11px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50", colors[color])}>
      <Icon className="w-3 h-3" /> {children}
    </button>
  );
}

function InfoRow({ label, value, icon: Icon, styles }) {
  const { brd, txt, sub } = styles;
  return (
    <div className={cn("rounded-[10px] border p-2.5", brd)}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("w-3 h-3", sub)} />
        <p className={cn("text-[10px] font-bold uppercase tracking-wider", sub)}>{label}</p>
      </div>
      <p className={cn("text-sm font-semibold mt-1 capitalize", txt)}>{value || "—"}</p>
    </div>
  );
}

function CreateDrawer({ dark, reasons, onClose, onCreated, showToast, styles }) {
  const { brd, txt, sub, inpCls, labelCls, hover, btnPrimary } = styles;
  const [orderQ, setOrderQ] = useState("");
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [selectedItems, setSelectedItems] = useState({});
  const [returnType, setReturnType] = useState("refund");
  const [reason, setReason] = useState("wrong_size");
  const [description, setDescription] = useState("");
  const [warehouse, setWarehouse] = useState("main");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/returns?section=orders_lookup&q=${encodeURIComponent(orderQ)}`);
        if (res.ok) {
          const d = await res.json();
          setOrders(d.orders || []);
        }
      } catch { /* silent */ }
    }, orderQ ? 300 : 0);
    return () => clearTimeout(t);
  }, [orderQ]);

  const refundTotal = useMemo(() => {
    if (!order) return 0;
    return (order.items || []).reduce((sum, it) => {
      const qty = selectedItems[it.id] || 0;
      return sum + qty * (Number(it.price) || 0);
    }, 0);
  }, [order, selectedItems]);

  const submit = async () => {
    const items = (order?.items || [])
      .filter(it => (selectedItems[it.id] || 0) > 0)
      .map(it => ({
        order_item_id: it.id, product_id: it.product_id, variant_id: it.variant_id,
        product_name: it.product?.name || null, sku: it.variant?.sku || null,
        quantity: selectedItems[it.id], unit_price: Number(it.price) || 0,
      }));
    if (!order || items.length === 0) {
      showToast("Select an order and at least one item", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/returns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_return", order_id: order.id, customer_id: order.user?.id || null,
          return_type: returnType, reason, description, warehouse,
          refund_amount: refundTotal, items,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to create return");
      onCreated();
    } catch (e) { showToast(e.message, "error"); } finally { setSaving(false); }
  };

  return (
    <Drawer open onClose={onClose} title="Create Return" dark={dark} width="xl">
      <div className="p-4 space-y-4">
        <div>
          <label className={labelCls}>Find Order</label>
          <input value={orderQ} onChange={e => { setOrderQ(e.target.value); setOrder(null); setSelectedItems({}); }} placeholder="Search order number..." className={inpCls} />
          {!order && orders.length > 0 && (
            <div className={cn("mt-1 rounded-[10px] border divide-y max-h-56 overflow-y-auto", brd)}>
              {orders.map(o => (
                <button key={o.id} onClick={() => { setOrder(o); }} className={cn("w-full flex items-center justify-between p-2.5 text-left", hover)}>
                  <div>
                    <p className={cn("text-xs font-bold font-mono", txt)}>{o.order_number}</p>
                    <p className={cn("text-[10px]", sub)}>{o.user?.full_name || o.user?.email || "Guest"} — {fmtDate(o.created_at)}</p>
                  </div>
                  <span className={cn("text-xs font-bold", txt)}>{fmtMoney(o.total)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {order && (
          <>
            <div className={cn("rounded-[10px] border p-3 flex items-center justify-between", brd)}>
              <div>
                <p className={cn("text-sm font-bold font-mono", txt)}>{order.order_number}</p>
                <p className={cn("text-xs", sub)}>{order.user?.full_name || order.user?.email || "Guest"}</p>
              </div>
              <button onClick={() => { setOrder(null); setSelectedItems({}); }}><X className={cn("w-4 h-4", sub)} /></button>
            </div>

            <div>
              <label className={labelCls}>Items to Return</label>
              <div className="space-y-2">
                {(order.items || []).map(it => (
                  <div key={it.id} className={cn("rounded-[10px] border p-2.5 flex items-center gap-3", brd)}>
                    {it.product?.images?.[0] && <img src={it.product.images[0]} alt="" className="w-10 h-10 rounded-[8px] object-cover" />}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-bold truncate", txt)}>{it.product?.name || "Product"}</p>
                      <p className={cn("text-[10px]", sub)}>{it.variant ? `${[it.variant.size, it.variant.color].filter(Boolean).join(" / ")} — ` : ""}{fmtMoney(it.price)} × {it.quantity}</p>
                    </div>
                    <select
                      value={selectedItems[it.id] || 0}
                      onChange={e => setSelectedItems(s => ({ ...s, [it.id]: parseInt(e.target.value) }))}
                      className={cn("h-8 rounded-[8px] border px-2 text-xs", styles.inp)}>
                      {Array.from({ length: (it.quantity || 1) + 1 }).map((_, q) => <option key={q} value={q}>{q === 0 ? "Not returned" : `Return ${q}`}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Return Type</label>
                <select value={returnType} onChange={e => setReturnType(e.target.value)} className={inpCls}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Reason</label>
                <select value={reason} onChange={e => setReason(e.target.value)} className={inpCls}>
                  {reasons.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Warehouse Destination</label>
              <select value={warehouse} onChange={e => setWarehouse(e.target.value)} className={inpCls}>
                {WAREHOUSES.map(w => <option key={w} value={w}>{WAREHOUSE_LABELS[w]}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Details about the return request..." className={cn("w-full rounded-[10px] border-[1.5px] p-3 text-sm outline-none resize-y", styles.inp, "focus:border-[#2563eb]")} />
            </div>

            <div className={cn("rounded-[10px] border p-3 flex items-center justify-between", brd)}>
              <span className={cn("text-xs font-bold", sub)}>Estimated Refund</span>
              <span className={cn("text-lg font-extrabold", txt)}>{fmtMoney(refundTotal)}</span>
            </div>

            <button onClick={submit} disabled={saving} className={cn(btnPrimary, "w-full justify-center")}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Return Request
            </button>
          </>
        )}
      </div>
    </Drawer>
  );
}
