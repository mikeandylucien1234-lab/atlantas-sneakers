"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  Search, ChevronLeft, ChevronRight, Edit3, Trash2, Eye,
  Download, RefreshCw, X, Loader2, SlidersHorizontal, ArrowUpDown,
  XCircle, TrendingUp, DollarSign, CheckCircle2, Package, Truck,
  Clock, Calendar, BarChart3, FileDown, ShoppingCart, AlertTriangle,
  CreditCard, MapPin, User, Globe, Copy, Printer, RotateCcw,
  Plus, ChevronDown, ChevronUp, FileText, MessageSquare, Tag,
  ArrowRight, ExternalLink, Hash, Mail, Phone, Star, Shield,
  Ban, CircleDot, Receipt, Send, Archive, MoreHorizontal, Box
} from "lucide-react";

type Props = { dark: boolean };
type SortKey = "order_number" | "total" | "created_at" | "status";
type SortOrder = "asc" | "desc";
type DetailTab = "overview" | "items" | "payment" | "shipping" | "timeline" | "notes";

interface OrderKpis {
  totalOrders: number;
  todaysOrders: number;
  pendingOrders: number;
  paidOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  returnedOrders: number;
  failedPayments: number;
  avgOrderValue: number;
  revenueToday: number;
}

interface OrderRow {
  id: string;
  order_number: string;
  user_id: string;
  status: string;
  payment_status: string;
  subtotal: number;
  shipping_cost: number;
  discount: number;
  total: number;
  shipping_address: Record<string, any> | null;
  created_at: string;
  payment_method?: string;
  tracking_number?: string;
  notes?: string;
  fulfillment_status?: string;
  shipping_needs_review?: boolean;
  shipping_quote_source?: string;
  customer?: { id: string; full_name: string | null; email: string; avatar_url: string | null; points: number; role: string };
  items?: any[];
}

const defaultKpis: OrderKpis = {
  totalOrders: 0, todaysOrders: 0, pendingOrders: 0, paidOrders: 0,
  processingOrders: 0, shippedOrders: 0, deliveredOrders: 0,
  cancelledOrders: 0, refundedOrders: 0, returnedOrders: 0,
  failedPayments: 0, avgOrderValue: 0, revenueToday: 0,
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fdecdd", text: "#ea7317" },
  confirmed: { bg: "#eaf1fb", text: "#2563eb" },
  processing: { bg: "#eaf1fb", text: "#2563eb" },
  shipped: { bg: "#efe9fd", text: "#7c3aed" },
  delivered: { bg: "#e8f7ee", text: "#16a34a" },
  cancelled: { bg: "#fde8ec", text: "#ef4444" },
  refunded: { bg: "#eef1f5", text: "#6b7280" },
  paid: { bg: "#e8f7ee", text: "#16a34a" },
  failed: { bg: "#fde8ec", text: "#ef4444" },
};

const STATUSES = ["all", "pending", "confirmed", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["all", "pending", "paid", "failed", "refunded"];

const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
const fmtCurrency = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TIMELINE_STEPS = [
  { key: "pending", label: "Order Placed", icon: ShoppingCart },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Package },
];

export function AdminOrders({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const selectCls = cn("h-[38px] rounded-[10px] border px-2.5 text-[13px] outline-none bg-transparent", brd, txt);

  const [kpis, setKpis] = useState<OrderKpis>(defaultKpis);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [detailData, setDetailData] = useState<Record<string, any> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [trackingInput, setTrackingInput] = useState("");
  const [carrierInput, setCarrierInput] = useState("");
  useEffect(() => {
    setTrackingInput(detailData?.tracking_number || "");
    setCarrierInput(detailData?.carrier || "");
  }, [detailData?.id]);

  const [statusEditId, setStatusEditId] = useState<string | null>(null);
  const [statusEditValue, setStatusEditValue] = useState("");
  const [paymentEditId, setPaymentEditId] = useState<string | null>(null);
  const [paymentEditValue, setPaymentEditValue] = useState("");

  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── FETCH KPIs ──
  const fetchKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const res = await fetch("/api/admin/orders?section=kpis");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setKpis(data.kpis || data);
    } catch { /* silent */ } finally { setKpisLoading(false); }
  }, []);

  // ── FETCH ORDERS ──
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), per_page: String(perPage), sort_by: sortKey, sort_order: sortOrder });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (paymentFilter !== "all") params.set("payment_status", paymentFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`/api/admin/orders?${params}`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      setOrders(data.orders || []);
      setTotal(data.total || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }, [page, perPage, search, statusFilter, paymentFilter, dateFrom, dateTo, sortKey, sortOrder]);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleSearch = (v: string) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setSearch(v); setPage(1); }, 300);
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortOrder("desc"); }
    setPage(1);
  };

  const allSelected = orders.length > 0 && orders.every(o => selected.has(o.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(orders.map(o => o.id)));
  };

  // ── DETAIL ──
  const openDetail = async (order: OrderRow) => {
    setDetailOrder(order);
    setDetailTab("overview");
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetch(`/api/admin/orders?section=detail&id=${order.id}`);
      if (res.ok) {
        const d = await res.json();
        setDetailData(d.order || d);
      }
    } catch { /* silent */ } finally { setDetailLoading(false); }
  };

  // ── STATUS CHANGE ──
  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`Order status → ${status}`);
      setStatusEditId(null);
      fetchOrders();
      fetchKpis();
      if (detailData && detailData.id === orderId) {
        setDetailData({ ...detailData, status });
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  const handleFulfillmentChange = async (orderId: string, fulfillmentStatus: string) => {
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, fulfillment_status: fulfillmentStatus }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`Fulfillment → ${fulfillmentStatus.replace(/_/g, " ")}`);
      if (detailData && detailData.id === orderId) {
        setDetailData({ ...detailData, fulfillment_status: fulfillmentStatus });
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  const handlePaymentStatusChange = async (orderId: string, paymentStatus: string) => {
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, payment_status: paymentStatus }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`Payment status → ${paymentStatus}`);
      setPaymentEditId(null);
      fetchOrders();
      fetchKpis();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  // ── MANUAL SHIPPING / TRACKING (for orders placed by hand on the supplier's
  // site — there's no automated CJ sync for those, so the admin enters the
  // tracking number + carrier here once the supplier provides it. Saving also
  // bumps the order to "shipped" so the customer's /track page and timeline
  // update immediately, matching what the automated CJ sync already does.) ──
  const [trackingSaving, setTrackingSaving] = useState(false);
  const handleSaveTracking = async (orderId: string, trackingNumber: string, carrier: string, currentStatus: string) => {
    setTrackingSaving(true);
    try {
      const nextStatus = trackingNumber.trim() && !["shipped", "delivered", "cancelled"].includes(currentStatus) ? "shipped" : currentStatus;
      const res = await fetch("/api/admin/orders", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, tracking_number: trackingNumber.trim() || null, carrier: carrier.trim() || null, status: nextStatus }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(trackingNumber.trim() ? "Tracking saved — customer can now see it" : "Tracking cleared");
      fetchOrders();
      fetchKpis();
      if (detailData && detailData.id === orderId) {
        setDetailData({ ...detailData, tracking_number: trackingNumber.trim() || null, carrier: carrier.trim() || null, status: nextStatus });
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setTrackingSaving(false);
    }
  };

  // ── REAL REFUND (single official Stripe flow via /api/refunds → refundOrder) ──
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const handleRefund = async (orderId: string, total: number) => {
    if (!confirm(`Issue a REAL refund of ${fmtCurrency(total)} to the customer via Stripe? This returns the money to their card and cannot be undone.`)) return;
    setRefundingId(orderId);
    try {
      const res = await fetch("/api/refunds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason: "Admin refund" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Refund failed");
      showToast(d.manual ? "Manual refund recorded" : `Refunded via Stripe (${d.refundId || "ok"})`);
      fetchOrders();
      fetchKpis();
      if (detailData && detailData.id === orderId) openDetail({ id: orderId } as OrderRow);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Refund error", "error");
    } finally {
      setRefundingId(null);
    }
  };

  // ── DELETE ──
  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} order(s)? This cannot be undone.`)) return;
    try {
      for (const id of ids) {
        const res = await fetch("/api/admin/orders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      }
      showToast(`${ids.length} order(s) deleted`);
      setSelected(new Set());
      fetchOrders();
      fetchKpis();
      if (detailOrder && ids.includes(detailOrder.id)) setDetailOrder(null);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  // ── BULK ──
  const handleBulk = async (action: string, extraData?: Record<string, any>) => {
    if (selected.size === 0) return;
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action, ...extraData }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`Bulk ${action.replace(/_/g, " ")} completed`);
      setSelected(new Set());
      setBulkStatusOpen(false);
      fetchOrders();
      fetchKpis();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  // ── EXPORT ──
  const handleExport = async (format: "csv" | "json") => {
    try {
      const params = new URLSearchParams({ section: "export" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (paymentFilter !== "all") params.set("payment_status", paymentFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`/api/admin/orders?${params}`);
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const items = data.orders || [];
      if (items.length === 0) { showToast("No data to export", "info"); return; }

      if (format === "json") {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "orders.json"; a.click();
        URL.revokeObjectURL(url);
      } else {
        const flat = items.map((o: any) => ({
          order_number: o.order_number, status: o.status, payment_status: o.payment_status,
          total: o.total, subtotal: o.subtotal, shipping_cost: o.shipping_cost, discount: o.discount,
          customer_name: o.customer?.full_name || "", customer_email: o.customer?.email || "",
          payment_method: o.payment_method || "", tracking_number: o.tracking_number || "",
          items_count: o.items?.length || 0, created_at: o.created_at,
        }));
        const headers = Object.keys(flat[0]);
        const csv = [headers.join(","), ...flat.map((r: Record<string, unknown>) => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "orders.csv"; a.click();
        URL.revokeObjectURL(url);
      }
      showToast(`Exported ${items.length} orders as ${format.toUpperCase()}`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Export failed", "error");
    }
  };

  // ── KPI CONFIG ──
  const kpiCards = useMemo(() => [
    { label: "Total Orders", value: fmt(kpis.totalOrders), icon: ShoppingCart, color: "text-[#2563eb]", bg: dark ? "bg-[#2563eb]/10" : "bg-[#eaf1fb]" },
    { label: "Today's Orders", value: fmt(kpis.todaysOrders), icon: Calendar, color: "text-[#7c3aed]", bg: dark ? "bg-[#7c3aed]/10" : "bg-[#efe9fd]" },
    { label: "Pending", value: fmt(kpis.pendingOrders), icon: Clock, color: "text-[#ea7317]", bg: dark ? "bg-[#ea7317]/10" : "bg-[#fdecdd]" },
    { label: "Paid", value: fmt(kpis.paidOrders), icon: CheckCircle2, color: "text-[#16a34a]", bg: dark ? "bg-[#16a34a]/10" : "bg-[#e8f7ee]" },
    { label: "Processing", value: fmt(kpis.processingOrders), icon: Package, color: "text-[#2563eb]", bg: dark ? "bg-[#2563eb]/10" : "bg-[#eaf1fb]" },
    { label: "Shipped", value: fmt(kpis.shippedOrders), icon: Truck, color: "text-[#7c3aed]", bg: dark ? "bg-[#7c3aed]/10" : "bg-[#efe9fd]" },
    { label: "Delivered", value: fmt(kpis.deliveredOrders), icon: CheckCircle2, color: "text-[#16a34a]", bg: dark ? "bg-[#16a34a]/10" : "bg-[#e8f7ee]" },
    { label: "Cancelled", value: fmt(kpis.cancelledOrders), icon: XCircle, color: "text-[#ef4444]", bg: dark ? "bg-[#ef4444]/10" : "bg-[#fde8ec]" },
    { label: "Refunded", value: fmt(kpis.refundedOrders), icon: RotateCcw, color: "text-[#6b7280]", bg: dark ? "bg-[#6b7280]/10" : "bg-[#eef1f5]" },
    { label: "Failed Payments", value: fmt(kpis.failedPayments), icon: AlertTriangle, color: "text-[#ef4444]", bg: dark ? "bg-[#ef4444]/10" : "bg-[#fde8ec]" },
    { label: "Avg Order Value", value: fmtCurrency(kpis.avgOrderValue), icon: DollarSign, color: "text-[#16a34a]", bg: dark ? "bg-[#16a34a]/10" : "bg-[#e8f7ee]" },
    { label: "Revenue Today", value: fmtCurrency(kpis.revenueToday), icon: TrendingUp, color: "text-[#2563eb]", bg: dark ? "bg-[#2563eb]/10" : "bg-[#eaf1fb]" },
  ], [kpis, dark]);

  // ── CLEAR FILTERS ──
  const hasActiveFilters = statusFilter !== "all" || paymentFilter !== "all" || dateFrom || dateTo;
  const clearFilters = () => {
    setStatusFilter("all");
    setPaymentFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  // ── RENDER ──
  return (
    <div className="space-y-5">
      {/* ──── HEADER ──── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-[24px] font-extrabold tracking-tight", txt)}>Orders</h1>
          <p className={cn("text-sm mt-0.5", sub)}>Manage, track and process every customer order.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative group">
            <button className="h-[40px] px-3 rounded-[11px] border text-[13px] font-semibold flex items-center gap-2 transition-colors bg-transparent hover:bg-black/[.03] dark:hover:bg-white/[.04]" style={{ borderColor: dark ? "#252c36" : "#eef0f3", color: dark ? "#e7ebf0" : "#16181d" }}>
              <Download className="w-4 h-4" /> Export <ChevronDown className="w-3 h-3" />
            </button>
            <div className={cn("absolute right-0 top-full mt-1 z-50 rounded-[12px] border shadow-xl py-1 min-w-[140px] hidden group-hover:block", p, brd)}>
              <button onClick={() => handleExport("csv")} className={cn("w-full text-left px-3 py-2 text-[13px]", txt, hover)}>Export CSV</button>
              <button onClick={() => handleExport("json")} className={cn("w-full text-left px-3 py-2 text-[13px]", txt, hover)}>Export JSON</button>
            </div>
          </div>
          <button onClick={() => { fetchOrders(); fetchKpis(); }} className={cn("h-[40px] w-[40px] rounded-[11px] border flex items-center justify-center transition-colors", brd, txt, hover)}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ──── KPI DASHBOARD ──── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {kpiCards.map((k) => (
          <div key={k.label} className={cn("rounded-[14px] border p-4 transition-all hover:shadow-md", p, brd)}>
            {kpisLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className={cn("w-8 h-8 rounded-[10px]", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-6 w-16 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-3 w-20 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
              </div>
            ) : (
              <>
                <div className={cn("w-8 h-8 rounded-[10px] flex items-center justify-center mb-2", k.bg)}>
                  <k.icon className={cn("w-4 h-4", k.color)} />
                </div>
                <p className={cn("text-[20px] font-extrabold leading-tight", txt)}>{k.value}</p>
                <p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ──── TOOLBAR ──── */}
      <div className={cn("rounded-[16px] border p-4 space-y-3", p, brd)}>
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn("flex items-center gap-2 h-[42px] px-3 rounded-[11px] border flex-1 min-w-[220px]", inp)}>
            <Search className="w-4 h-4 shrink-0 opacity-50" />
            <input
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by order #, customer, email, tracking..."
              className="bg-transparent outline-none w-full text-sm"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={cn("h-[42px] px-3 rounded-[11px] border text-[13px] font-semibold flex items-center gap-2 transition-colors", brd, txt, showFilters ? "bg-[#2563eb] text-white border-[#2563eb]" : hover)}>
            <SlidersHorizontal className="w-4 h-4" /> Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#ef4444]" />}
          </button>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-[12px] font-semibold capitalize transition-colors",
                statusFilter === s
                  ? "bg-[#2563eb] text-white"
                  : dark ? "bg-[#1d242e] text-[#8b95a3] hover:bg-[#252c36]" : "bg-[#f6f8fb] text-[#8a929c] hover:bg-[#eef0f3]"
              )}
            >
              {s === "all" ? "All Orders" : s}
            </button>
          ))}
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t", brd)}>
            <div>
              <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>Payment Status</label>
              <select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }} className={selectCls + " w-full"}>
                {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s === "all" ? "All Payments" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>From Date</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={selectCls + " w-full"} />
            </div>
            <div>
              <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>To Date</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={selectCls + " w-full"} />
            </div>
            <div className="flex items-end">
              <button onClick={clearFilters} className={cn("h-[38px] px-3 rounded-[10px] border text-[13px] font-semibold flex items-center gap-2 transition-colors", brd, "text-[#ef4444] hover:bg-[#ef4444]/10")}>
                <XCircle className="w-3.5 h-3.5" /> Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ──── BULK BAR ──── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-[14px] bg-[#2563eb] text-white text-sm font-semibold">
          <span>{selected.size} selected</span>
          <div className="relative ml-auto">
            <button onClick={() => setBulkStatusOpen(!bulkStatusOpen)} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs flex items-center gap-1">
              Update Status <ChevronDown className="w-3 h-3" />
            </button>
            {bulkStatusOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 rounded-[10px] border border-white/20 bg-[#1d4ed8] shadow-xl py-1 min-w-[140px]">
                {["pending", "confirmed", "shipped", "delivered", "cancelled"].map(s => (
                  <button key={s} onClick={() => handleBulk("update_status", { status: s })} className="w-full text-left px-3 py-1.5 text-xs capitalize hover:bg-white/10">{s}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => handleExport("csv")} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs flex items-center gap-1">
            <Download className="w-3 h-3" /> Export
          </button>
          <button onClick={() => handleDelete(Array.from(selected))} className="px-3 py-1.5 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-xs flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      )}

      {/* ──── ERROR ──── */}
      {error && (
        <div className="rounded-[14px] border border-red-300 bg-red-50 p-4 text-sm text-red-600 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
          <button onClick={fetchOrders} className="ml-auto underline text-sm font-semibold">Retry</button>
        </div>
      )}

      {/* ──── TABLE ──── */}
      <div className={cn("rounded-[16px] border overflow-hidden", p, brd)}>
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={cn("flex items-center gap-4 px-4 py-4 border-b", brd)}>
                <div className={cn("w-4 h-4 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-4 rounded flex-1", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} style={{ maxWidth: `${60 + i * 15}px` }} />
                <div className={cn("h-4 w-20 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-4 w-16 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-4 w-14 rounded hidden md:block", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-4 w-12 rounded hidden lg:block", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={cn("border-b", brd)}>
                    <th className="w-10 p-3"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" /></th>
                    <th onClick={() => handleSort("order_number")} className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 cursor-pointer select-none", sub)}>
                      <span className="flex items-center gap-1">Order # <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Customer</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Items</th>
                    <th onClick={() => handleSort("total")} className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 cursor-pointer select-none", sub)}>
                      <span className="flex items-center gap-1">Total <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Payment</th>
                    <th onClick={() => handleSort("status")} className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 cursor-pointer select-none", sub)}>
                      <span className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden lg:table-cell", sub)}>Tracking</th>
                    <th onClick={() => handleSort("created_at")} className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 cursor-pointer select-none", sub)}>
                      <span className="flex items-center gap-1">Date <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={cn("text-right text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const sc = STATUS_COLORS[o.status] ?? STATUS_COLORS.pending;
                    const psc = STATUS_COLORS[o.payment_status] ?? STATUS_COLORS.pending;
                    const customerName = o.customer?.full_name || o.customer?.email || "—";
                    return (
                      <tr key={o.id} className={cn("border-b last:border-0 transition-colors", brd, hover)}>
                        <td className="p-3"><input type="checkbox" checked={selected.has(o.id)} onChange={() => setSelected(prev => { const n = new Set(prev); n.has(o.id) ? n.delete(o.id) : n.add(o.id); return n; })} className="rounded" /></td>
                        <td className={cn("p-3 text-sm font-bold", txt)}>
                          <button onClick={() => openDetail(o)} className="hover:text-[#2563eb] transition-colors">
                            {o.order_number}
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0", o.customer?.avatar_url ? "" : "bg-[#2563eb]")}>
                              {o.customer?.avatar_url ? (
                                <img src={o.customer.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                              ) : (
                                (customerName[0] || "?").toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className={cn("text-[13px] font-semibold truncate", txt)}>{customerName}</p>
                              {o.customer?.email && <p className={cn("text-[11px] truncate", sub)}>{o.customer.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className={cn("p-3 text-sm", sub)}>{o.items?.length ?? 0}</td>
                        <td className={cn("p-3 text-sm font-bold", txt)}>{fmtCurrency(o.total)}</td>
                        <td className="p-3">
                          {paymentEditId === o.id ? (
                            <select
                              autoFocus
                              value={paymentEditValue}
                              onChange={(e) => { setPaymentEditValue(e.target.value); handlePaymentStatusChange(o.id, e.target.value); }}
                              onBlur={() => setPaymentEditId(null)}
                              className={cn("text-[11px] rounded-md px-2 py-1 border outline-none", inp)}
                            >
                              {["pending", "paid", "failed"].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <button
                              onClick={() => { setPaymentEditId(o.id); setPaymentEditValue(o.payment_status); }}
                              className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold capitalize cursor-pointer hover:opacity-80 transition-opacity"
                              style={{ background: psc.bg, color: psc.text }}
                            >
                              {o.payment_status}
                            </button>
                          )}
                        </td>
                        <td className="p-3">
                          {statusEditId === o.id ? (
                            <select
                              autoFocus
                              value={statusEditValue}
                              onChange={(e) => { setStatusEditValue(e.target.value); handleStatusChange(o.id, e.target.value); }}
                              onBlur={() => setStatusEditId(null)}
                              className={cn("text-[11px] rounded-md px-2 py-1 border outline-none", inp)}
                            >
                              {["pending", "confirmed", "shipped", "delivered", "cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <button
                              onClick={() => { setStatusEditId(o.id); setStatusEditValue(o.status); }}
                              className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold capitalize cursor-pointer hover:opacity-80 transition-opacity"
                              style={{ background: sc.bg, color: sc.text }}
                            >
                              {o.status}
                            </button>
                          )}
                        </td>
                        <td className={cn("p-3 text-[12px] hidden lg:table-cell", sub)}>
                          {o.tracking_number ? (
                            <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> {o.tracking_number}</span>
                          ) : "—"}
                        </td>
                        <td className={cn("p-3 text-[12px]", sub)}>{new Date(o.created_at).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openDetail(o)} className="p-1.5 rounded-lg hover:bg-[#2563eb]/10 text-[#2563eb] transition-colors" title="View">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete([o.id])} className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-[#ef4444] transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={10} className={cn("p-12 text-center", sub)}>
                        <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-semibold">No orders found</p>
                        <p className="text-xs mt-1">Adjust your filters or search criteria.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}>
              {orders.map((o) => {
                const sc = STATUS_COLORS[o.status] ?? STATUS_COLORS.pending;
                const psc = STATUS_COLORS[o.payment_status] ?? STATUS_COLORS.pending;
                const customerName = o.customer?.full_name || o.customer?.email || "—";
                return (
                  <div key={o.id} className={cn("p-4 transition-colors", hover)} onClick={() => openDetail(o)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn("text-[13px] font-bold", txt)}>{o.order_number}</span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold capitalize" style={{ background: sc.bg, color: sc.text }}>{o.status}</span>
                    </div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn("text-[12px]", sub)}>{customerName}</span>
                      <span className={cn("text-[13px] font-bold", txt)}>{fmtCurrency(o.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[11px]", sub)}>{new Date(o.created_at).toLocaleDateString()}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold capitalize" style={{ background: psc.bg, color: psc.text }}>{o.payment_status}</span>
                    </div>
                  </div>
                );
              })}
              {orders.length === 0 && (
                <div className={cn("p-8 text-center", sub)}>
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">No orders found</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className={cn("flex items-center justify-between px-4 py-3 border-t", brd)}>
              <p className={cn("text-[12px]", sub)}>
                {total} order{total !== 1 ? "s" : ""} · Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30 transition-colors", hover)}>
                  <ChevronLeft className={cn("w-4 h-4", sub)} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const pg = start + i;
                  if (pg > totalPages) return null;
                  return (
                    <button key={pg} onClick={() => setPage(pg)} className={cn("w-8 h-8 rounded-lg text-[12px] font-semibold transition-colors", pg === page ? "bg-[#2563eb] text-white" : cn(sub, hover))}>
                      {pg}
                    </button>
                  );
                })}
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30 transition-colors", hover)}>
                  <ChevronRight className={cn("w-4 h-4", sub)} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ──── ORDER DETAIL DRAWER ──── */}
      <Drawer open={!!detailOrder} onClose={() => setDetailOrder(null)} dark={dark} title={detailOrder ? `Order ${detailOrder.order_number}` : ""} width="2xl">
        {detailOrder && (
          <div className="space-y-5">
            {/* Tabs */}
            <div className="flex flex-wrap gap-1">
              {(["overview", "items", "payment", "shipping", "timeline", "notes"] as DetailTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[12px] font-semibold capitalize transition-colors",
                    detailTab === tab ? "bg-[#2563eb] text-white" : dark ? "bg-[#1d242e] text-[#8b95a3] hover:bg-[#252c36]" : "bg-[#f6f8fb] text-[#8a929c] hover:bg-[#eef0f3]"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />
              </div>
            ) : (
              <>
                {/* ── OVERVIEW TAB ── */}
                {detailTab === "overview" && (() => {
                  const o = detailData || detailOrder;
                  const sc = STATUS_COLORS[o.status] ?? STATUS_COLORS.pending;
                  const psc = STATUS_COLORS[o.payment_status] ?? STATUS_COLORS.pending;
                  const addr = o.shipping_address;
                  return (
                    <div className="space-y-4">
                      {/* Status row */}
                      <div className="flex flex-wrap gap-3">
                        <div className={cn("flex-1 min-w-[180px] rounded-[14px] border p-4", p, brd)}>
                          <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", sub)}>Order Status</p>
                          <span className="px-3 py-1 rounded-md text-[12px] font-bold capitalize" style={{ background: sc.bg, color: sc.text }}>{o.status}</span>
                          <div className="mt-3">
                            <select
                              value={o.status}
                              onChange={(e) => handleStatusChange(o.id, e.target.value)}
                              className={cn("text-[12px] rounded-[8px] border px-2 py-1.5 w-full outline-none", inp)}
                            >
                              {["pending", "confirmed", "shipped", "delivered", "cancelled"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className={cn("flex-1 min-w-[180px] rounded-[14px] border p-4", p, brd)}>
                          <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", sub)}>Payment Status</p>
                          <span className="px-3 py-1 rounded-md text-[12px] font-bold capitalize" style={{ background: psc.bg, color: psc.text }}>{o.payment_status}</span>
                          <div className="mt-3">
                            <select
                              value={o.payment_status}
                              onChange={(e) => handlePaymentStatusChange(o.id, e.target.value)}
                              className={cn("text-[12px] rounded-[8px] border px-2 py-1.5 w-full outline-none", inp)}
                            >
                              {["pending", "paid", "failed"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Shipping / Tracking — manual entry. For orders placed
                          by hand on the supplier's site (no automated CJ sync),
                          this is how the customer's /track page gets its data. */}
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>Shipping / Tracking</p>
                        {o.tracking_number && (
                          <div className="mb-3 px-3 py-2 rounded-[10px] text-[12px] font-semibold" style={{ backgroundColor: "#16a34a1a", color: "#16a34a" }}>
                            Customer can see this tracking on the site now.
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className={cn("text-[11px] font-semibold mb-1 block", sub)}>Tracking Number</label>
                            <input
                              type="text" value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)}
                              placeholder="e.g. YT2345678901234"
                              className={cn("text-[13px] rounded-[8px] border px-3 py-2 w-full outline-none", inp)}
                            />
                          </div>
                          <div>
                            <label className={cn("text-[11px] font-semibold mb-1 block", sub)}>Carrier</label>
                            <input
                              type="text" value={carrierInput} onChange={(e) => setCarrierInput(e.target.value)}
                              placeholder="e.g. YunExpress"
                              className={cn("text-[13px] rounded-[8px] border px-3 py-2 w-full outline-none", inp)}
                            />
                          </div>
                        </div>
                        <button
                          type="button" disabled={trackingSaving}
                          onClick={() => handleSaveTracking(o.id, trackingInput, carrierInput, o.status)}
                          className="mt-3 text-[12px] font-bold px-4 py-2 rounded-[10px] bg-[#2563eb] text-white disabled:opacity-50 cursor-pointer"
                        >
                          {trackingSaving ? "Saving…" : "Save Tracking"}
                        </button>
                      </div>

                      {/* Summary */}
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>Order Summary</p>
                        <div className="space-y-2 text-[13px]">
                          <div className="flex justify-between"><span className={sub}>Subtotal</span><span className={txt}>{fmtCurrency(o.subtotal || 0)}</span></div>
                          <div className="flex justify-between"><span className={sub}>Shipping</span><span className={txt}>{fmtCurrency(o.shipping_cost || 0)}</span></div>
                          {(o.discount || 0) > 0 && <div className="flex justify-between"><span className={sub}>Discount</span><span className="text-[#16a34a]">-{fmtCurrency(o.discount)}</span></div>}
                          <div className={cn("flex justify-between pt-2 border-t font-bold", brd)}><span className={txt}>Total</span><span className={txt}>{fmtCurrency(o.total)}</span></div>
                        </div>
                      </div>

                      {/* Customer info */}
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>Customer</p>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#2563eb] flex items-center justify-center text-white font-bold text-sm">
                            {o.customer?.avatar_url ? (
                              <img src={o.customer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              ((o.customer?.full_name || o.customer?.email || "?")[0] || "?").toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className={cn("text-[14px] font-bold", txt)}>{o.customer?.full_name || "—"}</p>
                            <p className={cn("text-[12px]", sub)}>{o.customer?.email || "—"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Shipping address */}
                      {addr && (
                        <div className={cn("rounded-[14px] border p-4", p, brd)}>
                          <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>Shipping Address</p>
                          <div className={cn("text-[13px] space-y-1", txt)}>
                            <p className="font-semibold">{addr.full_name || addr.name || "—"}</p>
                            {addr.street && <p>{addr.street}</p>}
                            <p>{[addr.city, addr.state, addr.zip].filter(Boolean).join(", ")}</p>
                            {addr.country && <p>{addr.country}</p>}
                            {addr.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {addr.phone}</p>}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleStatusChange(o.id, "cancelled")} className="h-[36px] px-3 rounded-[10px] border border-[#ef4444] text-[#ef4444] text-[12px] font-semibold flex items-center gap-1.5 hover:bg-[#ef4444]/10 transition-colors">
                          <Ban className="w-3.5 h-3.5" /> Cancel Order
                        </button>
                        <button disabled={refundingId === o.id} onClick={() => handleRefund(o.id, Number(o.total))} className="h-[36px] px-3 rounded-[10px] border border-[#ea7317] text-[#ea7317] text-[12px] font-semibold flex items-center gap-1.5 hover:bg-[#ea7317]/10 transition-colors disabled:opacity-50">
                          <RotateCcw className="w-3.5 h-3.5" /> {refundingId === o.id ? "Refunding…" : "Refund"}
                        </button>
                        <button onClick={() => handleDelete([o.id])} className="h-[36px] px-3 rounded-[10px] border border-[#ef4444] text-[#ef4444] text-[12px] font-semibold flex items-center gap-1.5 hover:bg-[#ef4444]/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* ── ITEMS TAB ── */}
                {detailTab === "items" && (() => {
                  const o = detailData || detailOrder;
                  const items = o.items || [];
                  const fs = o.fulfillment_status || "manual_pending";
                  const FS_LABEL: Record<string, string> = {
                    manual_pending: "Manual fulfillment pending",
                    manual_order_placed: "Manual order placed",
                    shipped: "Shipped",
                    delivered: "Delivered",
                    submitted: "Submitted to supplier",
                    error: "Fulfillment error",
                  };
                  return (
                    <div className="space-y-3">
                      {o.shipping_needs_review && (
                        <div className="rounded-[12px] border border-[#ea7317] bg-[#ea7317]/10 p-3 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-[#ea7317] shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[12px] font-bold text-[#ea7317]">Shipping cost estimated — verify before placing the CJ order</p>
                            <p className={cn("text-[11px] mt-0.5", sub)}>Real-time CJ freight wasn't available when this order was charged (${Number(o.shipping_cost || 0).toFixed(2)} charged, weight-based estimate + safety margin). Confirm the real CJ shipping cost via View Store before manually placing this order.</p>
                          </div>
                        </div>
                      )}
                      <div className={cn("rounded-[12px] border p-3 flex items-center justify-between flex-wrap gap-2", p, brd)}>
                        <div>
                          <p className={cn("text-[11px] font-bold uppercase tracking-wider", sub)}>Manual Fulfillment</p>
                          <p className={cn("text-[13px] font-semibold mt-0.5", txt)}>{FS_LABEL[fs] || fs}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleFulfillmentChange(o.id, "manual_order_placed")} className={cn("h-8 px-3 rounded-[9px] border text-[11px] font-semibold transition-colors", brd, txt, hover)}>
                            Mark as Manual Order Placed
                          </button>
                          <button onClick={() => handleFulfillmentChange(o.id, "shipped")} className={cn("h-8 px-3 rounded-[9px] border text-[11px] font-semibold transition-colors", brd, txt, hover)}>
                            Mark as Shipped
                          </button>
                        </div>
                      </div>
                      <p className={cn("text-[11px] font-bold uppercase tracking-wider", sub)}>{items.length} Product{items.length !== 1 ? "s" : ""}</p>
                      {items.length === 0 ? (
                        <p className={cn("text-sm py-6 text-center", sub)}>No items in this order.</p>
                      ) : (
                        <div className="space-y-2">
                          {items.map((item: any, i: number) => {
                            const sup = item.supplier;
                            const supplierUrl = sup?.supplier_url || null;
                            const isHttps = (() => { try { return supplierUrl && new URL(supplierUrl).protocol === "https:"; } catch { return false; } })();
                            return (
                            <div key={item.id || i} className={cn("rounded-[12px] border p-3", p, brd)}>
                              <div className="flex items-center gap-3">
                                <div className={cn("w-12 h-12 rounded-[10px] overflow-hidden shrink-0 flex items-center justify-center", dark ? "bg-[#252c36]" : "bg-[#f6f8fb]")}>
                                  {item.product?.images?.[0] ? (
                                    <img src={item.product.images[0]} alt="" className="w-12 h-12 object-cover" />
                                  ) : (
                                    <Box className={cn("w-5 h-5", sub)} />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-[13px] font-semibold truncate", txt)}>{item.product?.name || "Unknown Product"}</p>
                                  <p className={cn("text-[11px]", sub)}>Qty: {item.quantity} × {fmtCurrency(item.price)}{item.variant ? ` · ${[item.variant.color, item.variant.size].filter(Boolean).join(" / ")}` : ""}{item.variant?.sku ? ` · SKU ${item.variant.sku}` : ""}</p>
                                </div>
                                <p className={cn("text-[14px] font-bold shrink-0", txt)}>{fmtCurrency(item.quantity * item.price)}</p>
                              </div>
                              {sup && (
                                <div className={cn("mt-2.5 pt-2.5 border-t flex items-center justify-between flex-wrap gap-2", brd)}>
                                  <div className={cn("text-[11px]", sub)}>
                                    Supplier: <span className={cn("font-semibold", txt)}>{sup.supplier_name}</span>
                                    {sup.supplier_product_id && <> · Product ID: <span className={txt}>{sup.supplier_product_id}</span></>}
                                    {sup.supplier_variant_id && <> · Variant ID: <span className={txt}>{sup.supplier_variant_id}</span></>}
                                  </div>
                                  {isHttps ? (
                                    <button onClick={() => window.open(supplierUrl, "_blank", "noopener,noreferrer")} className="h-8 px-3 rounded-[9px] bg-[#2563eb] text-white text-[11px] font-semibold hover:bg-[#1d4ed8] transition-colors flex items-center gap-1.5">
                                      <ExternalLink className="w-3.5 h-3.5" /> View Store
                                    </button>
                                  ) : (
                                    <span className={cn("text-[11px] italic", sub)}>Source unavailable — configure in Admin → Products</span>
                                  )}
                                </div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── PAYMENT TAB ── */}
                {detailTab === "payment" && (() => {
                  const o = detailData || detailOrder;
                  const psc = STATUS_COLORS[o.payment_status] ?? STATUS_COLORS.pending;
                  return (
                    <div className="space-y-4">
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>Payment Details</p>
                        <div className="space-y-3 text-[13px]">
                          <div className="flex justify-between items-center">
                            <span className={sub}>Status</span>
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold capitalize" style={{ background: psc.bg, color: psc.text }}>{o.payment_status}</span>
                          </div>
                          <div className="flex justify-between"><span className={sub}>Method</span><span className={cn("font-semibold capitalize", txt)}>{o.payment_method || "—"}</span></div>
                          <div className="flex justify-between"><span className={sub}>Subtotal</span><span className={txt}>{fmtCurrency(o.subtotal || 0)}</span></div>
                          <div className="flex justify-between"><span className={sub}>Shipping</span><span className={txt}>{fmtCurrency(o.shipping_cost || 0)}</span></div>
                          {(o.discount || 0) > 0 && <div className="flex justify-between"><span className={sub}>Discount</span><span className="text-[#16a34a]">-{fmtCurrency(o.discount)}</span></div>}
                          <div className={cn("flex justify-between pt-2 border-t font-bold text-[15px]", brd)}>
                            <span className={txt}>Total Charged</span>
                            <span className={txt}>{fmtCurrency(o.total)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button disabled={refundingId === o.id} onClick={() => handleRefund(o.id, Number(o.total))} className="h-[36px] px-3 rounded-[10px] bg-[#ea7317] text-white text-[12px] font-semibold flex items-center gap-1.5 hover:bg-[#d96a13] transition-colors disabled:opacity-50">
                          <RotateCcw className="w-3.5 h-3.5" /> {refundingId === o.id ? "Refunding…" : "Full Refund"}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* ── SHIPPING TAB ── */}
                {detailTab === "shipping" && (() => {
                  const o = detailData || detailOrder;
                  const addr = o.shipping_address;
                  return (
                    <div className="space-y-4">
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>Shipping Info</p>
                        <div className="space-y-2 text-[13px]">
                          <div className="flex justify-between"><span className={sub}>Tracking #</span><span className={cn("font-semibold", txt)}>{o.tracking_number || "Not assigned"}</span></div>
                          <div className="flex justify-between"><span className={sub}>Shipping Cost</span><span className={txt}>{fmtCurrency(o.shipping_cost || 0)}</span></div>
                        </div>
                      </div>
                      {addr && (
                        <div className={cn("rounded-[14px] border p-4", p, brd)}>
                          <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>Delivery Address</p>
                          <div className={cn("text-[13px] space-y-1", txt)}>
                            <p className="font-semibold">{addr.full_name || addr.name || "—"}</p>
                            {addr.street && <p>{addr.street}</p>}
                            <p>{[addr.city, addr.state, addr.zip].filter(Boolean).join(", ")}</p>
                            {addr.country && <p className="flex items-center gap-1"><Globe className="w-3 h-3" /> {addr.country}</p>}
                            {addr.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {addr.phone}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── TIMELINE TAB ── */}
                {detailTab === "timeline" && (() => {
                  const o = detailData || detailOrder;
                  const statusIndex = TIMELINE_STEPS.findIndex(s => s.key === o.status);
                  const isCancelled = o.status === "cancelled";
                  return (
                    <div className="space-y-4">
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-4", sub)}>Order Timeline</p>
                        <div className="relative space-y-0">
                          {TIMELINE_STEPS.map((step, i) => {
                            const reached = !isCancelled && i <= statusIndex;
                            const active = !isCancelled && i === statusIndex;
                            return (
                              <div key={step.key} className="flex items-start gap-3 relative pb-6 last:pb-0">
                                {i < TIMELINE_STEPS.length - 1 && (
                                  <div className={cn("absolute left-[15px] top-[30px] w-[2px] h-[calc(100%-18px)]", reached && i < statusIndex ? "bg-[#16a34a]" : dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                                )}
                                <div className={cn("w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 z-10", reached ? "bg-[#16a34a] text-white" : dark ? "bg-[#252c36] text-[#8b95a3]" : "bg-[#eef0f3] text-[#8a929c]")}>
                                  <step.icon className="w-3.5 h-3.5" />
                                </div>
                                <div className="pt-1">
                                  <p className={cn("text-[13px] font-semibold", reached ? txt : sub)}>{step.label}</p>
                                  {active && <p className={cn("text-[11px] mt-0.5", sub)}>Current status</p>}
                                </div>
                              </div>
                            );
                          })}
                          {isCancelled && (
                            <div className="flex items-start gap-3 relative">
                              <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 bg-[#ef4444] text-white z-10">
                                <XCircle className="w-3.5 h-3.5" />
                              </div>
                              <div className="pt-1">
                                <p className={cn("text-[13px] font-semibold text-[#ef4444]")}>Cancelled</p>
                                <p className={cn("text-[11px] mt-0.5", sub)}>This order has been cancelled</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", sub)}>Event Log</p>
                        <div className="space-y-2 text-[13px]">
                          <div className="flex items-center gap-2">
                            <Clock className={cn("w-3.5 h-3.5 shrink-0", sub)} />
                            <span className={sub}>Order created</span>
                            <span className={cn("ml-auto text-[11px]", sub)}>{new Date(o.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── NOTES TAB ── */}
                {detailTab === "notes" && (() => {
                  const o = detailData || detailOrder;
                  return (
                    <div className="space-y-4">
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>Internal Notes</p>
                        <textarea
                          defaultValue={o.notes || ""}
                          placeholder="Add internal notes about this order..."
                          rows={5}
                          className={cn("w-full rounded-[10px] border px-3 py-2.5 text-[13px] outline-none resize-none transition-colors", inp, "focus:border-[#2563eb]")}
                          onBlur={async (e) => {
                            const notes = e.target.value;
                            try {
                              await fetch("/api/admin/orders", {
                                method: "PUT", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: o.id, notes }),
                              });
                              showToast("Notes saved");
                            } catch { showToast("Failed to save notes", "error"); }
                          }}
                        />
                      </div>
                      {o.tracking_number && (
                        <div className={cn("rounded-[14px] border p-4", p, brd)}>
                          <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", sub)}>Tracking Number</p>
                          <p className={cn("text-[14px] font-bold flex items-center gap-2", txt)}>
                            <Truck className="w-4 h-4" /> {o.tracking_number}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </Drawer>

      {/* ──── TOAST ──── */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200",
          toast.type === "success" && "bg-[#16a34a]",
          toast.type === "info" && "bg-[#2563eb]",
          toast.type === "error" && "bg-[#ef4444]"
        )}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
