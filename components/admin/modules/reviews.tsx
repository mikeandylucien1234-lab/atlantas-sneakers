"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  Search, ChevronLeft, ChevronRight, Eye, Trash2,
  Download, RefreshCw, X, Loader2, SlidersHorizontal, ArrowUpDown,
  XCircle, TrendingUp, CheckCircle2, Clock, Calendar,
  Star, MessageSquare, ThumbsUp, ThumbsDown, Shield, AlertTriangle,
  ChevronDown, ImageIcon, User, ShoppingCart, Package,
  Send, Ban, Flag, Filter, MoreHorizontal, Check, Camera, Video,
  BarChart3, Award, Mail, Heart, Sparkles, FileDown
} from "lucide-react";

type Props = { dark: boolean };
type SortKey = "created_at" | "rating" | "helpful_votes";
type SortOrder = "asc" | "desc";
type DetailTab = "overview" | "customer" | "product" | "reply" | "analytics";

interface ReviewKpis {
  totalReviews: number;
  publishedReviews: number;
  pendingReviews: number;
  rejectedReviews: number;
  reportedReviews: number;
  averageRating: number;
  verifiedReviews: number;
  positiveReviews: number;
  negativeReviews: number;
  withImages: number;
  responseRate: number;
}

interface ReviewRow {
  id: string;
  user_id: string;
  product_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  created_at: string;
  status?: string;
  is_verified?: boolean;
  helpful_votes?: number;
  not_helpful_votes?: number;
  admin_reply?: string | null;
  admin_reply_at?: string | null;
  images?: string[];
  reported?: boolean;
  customer?: { id: string; full_name: string | null; email: string; avatar_url: string | null; points: number };
  product?: { id: string; name: string; slug: string; images: string[]; price: number };
}

const defaultKpis: ReviewKpis = {
  totalReviews: 0, publishedReviews: 0, pendingReviews: 0, rejectedReviews: 0,
  reportedReviews: 0, averageRating: 0, verifiedReviews: 0,
  positiveReviews: 0, negativeReviews: 0, withImages: 0, responseRate: 0,
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  published: { bg: "#e8f7ee", text: "#16a34a" },
  pending: { bg: "#fdecdd", text: "#ea7317" },
  rejected: { bg: "#fde8ec", text: "#ef4444" },
  hidden: { bg: "#eef1f5", text: "#6b7280" },
  featured: { bg: "#eaf1fb", text: "#2563eb" },
};

const RATING_COLORS: Record<number, string> = {
  5: "#16a34a", 4: "#22c55e", 3: "#ea7317", 2: "#f97316", 1: "#ef4444",
};

const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={i <= rating ? "fill-[#f59e0b] text-[#f59e0b]" : "text-gray-300"} style={{ width: size, height: size }} />
      ))}
    </div>
  );
}

export function AdminReviews({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const selectCls = cn("h-[38px] rounded-[10px] border px-2.5 text-[13px] outline-none bg-transparent", brd, txt);

  const [kpis, setKpis] = useState<ReviewKpis>(defaultKpis);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);

  const [detailReview, setDetailReview] = useState<ReviewRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [detailData, setDetailData] = useState<Record<string, any> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [replySaving, setReplySaving] = useState(false);

  const [ratingDist, setRatingDist] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── FETCH ──
  const fetchKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const res = await fetch("/api/admin/reviews?section=kpis");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setKpis(data.kpis || data);
    } catch { /* silent */ } finally { setKpisLoading(false); }
  }, []);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), per_page: String(perPage), sort_by: sortKey, sort_order: sortOrder });
      if (search) params.set("search", search);
      if (ratingFilter !== "all") params.set("rating", ratingFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (verifiedFilter !== "all") params.set("verified", verifiedFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`/api/admin/reviews?${params}`);
      if (!res.ok) throw new Error("Failed to load reviews");
      const data = await res.json();
      setReviews(data.reviews || []);
      setTotal(data.total || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }, [page, perPage, search, ratingFilter, statusFilter, verifiedFilter, dateFrom, dateTo, sortKey, sortOrder]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/reviews?section=stats");
      if (res.ok) {
        const data = await res.json();
        if (data.distribution) setRatingDist(data.distribution);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchKpis(); fetchStats(); }, [fetchKpis, fetchStats]);
  useEffect(() => { fetchReviews(); }, [fetchReviews]);

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

  const allSelected = reviews.length > 0 && reviews.every(r => selected.has(r.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(reviews.map(r => r.id)));
  };

  // ── DETAIL ──
  const openDetail = async (review: ReviewRow) => {
    setDetailReview(review);
    setDetailTab("overview");
    setDetailLoading(true);
    setDetailData(null);
    setReplyText(review.admin_reply || "");
    try {
      const res = await fetch(`/api/admin/reviews?section=detail&id=${review.id}`);
      if (res.ok) {
        const d = await res.json();
        setDetailData(d.review || d);
        setReplyText(d.review?.admin_reply || review.admin_reply || "");
      }
    } catch { /* silent */ } finally { setDetailLoading(false); }
  };

  // ── STATUS ──
  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`Review ${status}`);
      fetchReviews();
      fetchKpis();
      if (detailData && detailData.id === id) setDetailData({ ...detailData, status });
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error", "error"); }
  };

  // ── REPLY ──
  const handleReply = async (id: string) => {
    if (!replyText.trim()) { showToast("Reply cannot be empty", "error"); return; }
    setReplySaving(true);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, admin_reply: replyText }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast("Reply saved");
      fetchReviews();
      fetchKpis();
      if (detailData) setDetailData({ ...detailData, admin_reply: replyText, admin_reply_at: new Date().toISOString() });
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error", "error"); }
    finally { setReplySaving(false); }
  };

  // ── DELETE ──
  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} review(s)? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`${ids.length} review(s) deleted`);
      setSelected(new Set());
      fetchReviews();
      fetchKpis();
      fetchStats();
      if (detailReview && ids.includes(detailReview.id)) setDetailReview(null);
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error", "error"); }
  };

  // ── BULK ──
  const handleBulk = async (action: string) => {
    if (selected.size === 0) return;
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`Bulk ${action} completed`);
      setSelected(new Set());
      setBulkMenuOpen(false);
      fetchReviews();
      fetchKpis();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error", "error"); }
  };

  // ── EXPORT ──
  const handleExport = async (format: "csv" | "json") => {
    try {
      const res = await fetch("/api/admin/reviews?section=export");
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const items = data.reviews || [];
      if (items.length === 0) { showToast("No data to export", "info"); return; }
      if (format === "json") {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "reviews.json"; a.click(); URL.revokeObjectURL(url);
      } else {
        const flat = items.map((r: any) => ({
          id: r.id, rating: r.rating, title: r.title || "", comment: r.comment || "",
          customer: r.customer?.full_name || "", email: r.customer?.email || "",
          product: r.product?.name || "", status: r.status || "published",
          verified: r.is_verified ? "Yes" : "No", helpful_votes: r.helpful_votes || 0,
          admin_reply: r.admin_reply || "", created_at: r.created_at,
        }));
        const headers = Object.keys(flat[0]);
        const csv = [headers.join(","), ...flat.map((row: Record<string, unknown>) => headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "reviews.csv"; a.click(); URL.revokeObjectURL(url);
      }
      showToast(`Exported ${items.length} reviews`);
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Export failed", "error"); }
  };

  // ── KPI CARDS ──
  const kpiCards = useMemo(() => [
    { label: "Total Reviews", value: fmt(kpis.totalReviews), icon: MessageSquare, color: "text-[#2563eb]", bg: dark ? "bg-[#2563eb]/10" : "bg-[#eaf1fb]" },
    { label: "Published", value: fmt(kpis.publishedReviews), icon: CheckCircle2, color: "text-[#16a34a]", bg: dark ? "bg-[#16a34a]/10" : "bg-[#e8f7ee]" },
    { label: "Pending", value: fmt(kpis.pendingReviews), icon: Clock, color: "text-[#ea7317]", bg: dark ? "bg-[#ea7317]/10" : "bg-[#fdecdd]" },
    { label: "Rejected", value: fmt(kpis.rejectedReviews), icon: XCircle, color: "text-[#ef4444]", bg: dark ? "bg-[#ef4444]/10" : "bg-[#fde8ec]" },
    { label: "Reported", value: fmt(kpis.reportedReviews), icon: Flag, color: "text-[#ef4444]", bg: dark ? "bg-[#ef4444]/10" : "bg-[#fde8ec]" },
    { label: "Avg Rating", value: kpis.averageRating.toFixed(1), icon: Star, color: "text-[#f59e0b]", bg: dark ? "bg-[#f59e0b]/10" : "bg-[#fef3c7]" },
    { label: "Verified", value: fmt(kpis.verifiedReviews), icon: Shield, color: "text-[#7c3aed]", bg: dark ? "bg-[#7c3aed]/10" : "bg-[#efe9fd]" },
    { label: "Positive (4-5★)", value: fmt(kpis.positiveReviews), icon: ThumbsUp, color: "text-[#16a34a]", bg: dark ? "bg-[#16a34a]/10" : "bg-[#e8f7ee]" },
    { label: "Negative (1-2★)", value: fmt(kpis.negativeReviews), icon: ThumbsDown, color: "text-[#ef4444]", bg: dark ? "bg-[#ef4444]/10" : "bg-[#fde8ec]" },
    { label: "With Photos", value: fmt(kpis.withImages), icon: Camera, color: "text-[#2563eb]", bg: dark ? "bg-[#2563eb]/10" : "bg-[#eaf1fb]" },
    { label: "Response Rate", value: `${Math.round(kpis.responseRate)}%`, icon: Send, color: "text-[#7c3aed]", bg: dark ? "bg-[#7c3aed]/10" : "bg-[#efe9fd]" },
  ], [kpis, dark]);

  const hasActiveFilters = ratingFilter !== "all" || statusFilter !== "all" || verifiedFilter !== "all" || dateFrom || dateTo;
  const clearFilters = () => { setRatingFilter("all"); setStatusFilter("all"); setVerifiedFilter("all"); setDateFrom(""); setDateTo(""); setPage(1); };

  // ── RATING DISTRIBUTION BAR ──
  const maxDist = Math.max(...Object.values(ratingDist), 1);

  return (
    <div className="space-y-5">
      {/* ──── HEADER ──── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-[24px] font-extrabold tracking-tight", txt)}>Reviews</h1>
          <p className={cn("text-sm mt-0.5", sub)}>Manage customer reviews, ratings and product reputation.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative group">
            <button className={cn("h-[40px] px-3 rounded-[11px] border text-[13px] font-semibold flex items-center gap-2 transition-colors", brd, txt, hover)}>
              <Download className="w-4 h-4" /> Export <ChevronDown className="w-3 h-3" />
            </button>
            <div className={cn("absolute right-0 top-full mt-1 z-50 rounded-[12px] border shadow-xl py-1 min-w-[140px] hidden group-hover:block", p, brd)}>
              <button onClick={() => handleExport("csv")} className={cn("w-full text-left px-3 py-2 text-[13px]", txt, hover)}>Export CSV</button>
              <button onClick={() => handleExport("json")} className={cn("w-full text-left px-3 py-2 text-[13px]", txt, hover)}>Export JSON</button>
            </div>
          </div>
          <button onClick={() => { fetchReviews(); fetchKpis(); fetchStats(); }} className={cn("h-[40px] w-[40px] rounded-[11px] border flex items-center justify-center transition-colors", brd, txt, hover)}>
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

      {/* ──── RATING DISTRIBUTION ──── */}
      <div className={cn("rounded-[16px] border p-4", p, brd)}>
        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>Rating Distribution</p>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map(r => (
            <div key={r} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-16 shrink-0">
                <Star className="w-3.5 h-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                <span className={cn("text-[13px] font-semibold", txt)}>{r}</span>
              </div>
              <div className={cn("flex-1 h-[8px] rounded-full overflow-hidden", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(ratingDist[r] / maxDist) * 100}%`, backgroundColor: RATING_COLORS[r] }}
                />
              </div>
              <span className={cn("text-[12px] font-semibold w-10 text-right", sub)}>{ratingDist[r]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ──── TOOLBAR ──── */}
      <div className={cn("rounded-[16px] border p-4 space-y-3", p, brd)}>
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn("flex items-center gap-2 h-[42px] px-3 rounded-[11px] border flex-1 min-w-[220px]", inp)}>
            <Search className="w-4 h-4 shrink-0 opacity-50" />
            <input onChange={(e) => handleSearch(e.target.value)} placeholder="Search by customer, product, comment..." className="bg-transparent outline-none w-full text-sm" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={cn("h-[42px] px-3 rounded-[11px] border text-[13px] font-semibold flex items-center gap-2 transition-colors", brd, txt, showFilters ? "bg-[#2563eb] text-white border-[#2563eb]" : hover)}>
            <SlidersHorizontal className="w-4 h-4" /> Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#ef4444]" />}
          </button>
        </div>

        {/* Rating chips */}
        <div className="flex flex-wrap gap-2">
          {["all", "5", "4", "3", "2", "1"].map(r => (
            <button key={r} onClick={() => { setRatingFilter(r); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1 transition-colors",
                ratingFilter === r ? "bg-[#2563eb] text-white" : dark ? "bg-[#1d242e] text-[#8b95a3] hover:bg-[#252c36]" : "bg-[#f6f8fb] text-[#8a929c] hover:bg-[#eef0f3]"
              )}
            >
              {r === "all" ? "All Ratings" : <><Star className="w-3 h-3" /> {r}</>}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t", brd)}>
            <div>
              <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>Status</label>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls + " w-full"}>
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>Verified</label>
              <select value={verifiedFilter} onChange={e => { setVerifiedFilter(e.target.value); setPage(1); }} className={selectCls + " w-full"}>
                <option value="all">All</option>
                <option value="true">Verified Only</option>
                <option value="false">Unverified Only</option>
              </select>
            </div>
            <div>
              <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>From Date</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className={selectCls + " w-full"} />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>To Date</label>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className={selectCls + " w-full"} />
              </div>
              <button onClick={clearFilters} className={cn("h-[38px] px-3 rounded-[10px] border text-[13px] font-semibold flex items-center gap-1 shrink-0 transition-colors", brd, "text-[#ef4444] hover:bg-[#ef4444]/10")}>
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ──── BULK BAR ──── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-[14px] bg-[#2563eb] text-white text-sm font-semibold">
          <span>{selected.size} selected</span>
          <button onClick={() => handleBulk("approve")} className="ml-auto px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs flex items-center gap-1"><Check className="w-3 h-3" /> Approve</button>
          <button onClick={() => handleBulk("reject")} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs flex items-center gap-1"><XCircle className="w-3 h-3" /> Reject</button>
          <button onClick={() => handleExport("csv")} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs flex items-center gap-1"><Download className="w-3 h-3" /> Export</button>
          <button onClick={() => handleDelete(Array.from(selected))} className="px-3 py-1.5 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-xs flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
        </div>
      )}

      {/* ──── ERROR ──── */}
      {error && (
        <div className="rounded-[14px] border border-red-300 bg-red-50 p-4 text-sm text-red-600 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
          <button onClick={fetchReviews} className="ml-auto underline text-sm font-semibold">Retry</button>
        </div>
      )}

      {/* ──── TABLE ──── */}
      <div className={cn("rounded-[16px] border overflow-hidden", p, brd)}>
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={cn("flex items-center gap-4 px-4 py-4 border-b", brd)}>
                <div className={cn("w-4 h-4 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("w-8 h-8 rounded-full", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-4 rounded flex-1", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} style={{ maxWidth: `${80 + i * 10}px` }} />
                <div className={cn("h-4 w-20 rounded hidden md:block", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-4 w-16 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={cn("border-b", brd)}>
                    <th className="w-10 p-3"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" /></th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Customer</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Product</th>
                    <th onClick={() => handleSort("rating")} className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 cursor-pointer select-none", sub)}>
                      <span className="flex items-center gap-1">Rating <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden lg:table-cell", sub)}>Comment</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Status</th>
                    <th onClick={() => handleSort("created_at")} className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 cursor-pointer select-none", sub)}>
                      <span className="flex items-center gap-1">Date <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={cn("text-right text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => {
                    const sc = STATUS_COLORS[r.status || "published"] || STATUS_COLORS.published;
                    return (
                      <tr key={r.id} className={cn("border-b last:border-0 transition-colors", brd, hover)}>
                        <td className="p-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => setSelected(prev => { const n = new Set(prev); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} className="rounded" /></td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#2563eb] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                              {r.customer?.avatar_url ? <img src={r.customer.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" /> : ((r.customer?.full_name || r.customer?.email || "?")[0] || "?").toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className={cn("text-[13px] font-semibold truncate", txt)}>{r.customer?.full_name || "Anonymous"}</p>
                              <p className={cn("text-[11px] truncate", sub)}>{r.customer?.email || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-8 h-8 rounded-[8px] overflow-hidden shrink-0 flex items-center justify-center", dark ? "bg-[#252c36]" : "bg-[#f6f8fb]")}>
                              {r.product?.images?.[0] ? <img src={r.product.images[0]} alt="" className="w-8 h-8 object-cover" /> : <Package className={cn("w-3.5 h-3.5", sub)} />}
                            </div>
                            <p className={cn("text-[13px] font-semibold truncate max-w-[140px]", txt)}>{r.product?.name || "—"}</p>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <StarRating rating={r.rating} size={12} />
                            {r.is_verified && <Shield className="w-3.5 h-3.5 text-[#7c3aed]" />}
                          </div>
                        </td>
                        <td className={cn("p-3 hidden lg:table-cell", sub)}>
                          <p className="text-[12px] line-clamp-2 max-w-[240px]">{r.comment || <span className="italic">No comment</span>}</p>
                        </td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold capitalize" style={{ background: sc.bg, color: sc.text }}>{r.status || "published"}</span>
                        </td>
                        <td className={cn("p-3 text-[12px]", sub)}>{new Date(r.created_at).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openDetail(r)} className="p-1.5 rounded-lg hover:bg-[#2563eb]/10 text-[#2563eb] transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => handleStatusChange(r.id, r.status === "published" ? "rejected" : "published")} className={cn("p-1.5 rounded-lg transition-colors", r.status === "published" ? "hover:bg-[#ef4444]/10 text-[#ef4444]" : "hover:bg-[#16a34a]/10 text-[#16a34a]")} title={r.status === "published" ? "Reject" : "Approve"}>
                              {r.status === "published" ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            </button>
                            <button onClick={() => handleDelete([r.id])} className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-[#ef4444] transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {reviews.length === 0 && (
                    <tr><td colSpan={8} className={cn("p-12 text-center", sub)}>
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-semibold">No reviews found</p>
                      <p className="text-xs mt-1">Adjust your filters or search criteria.</p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}>
              {reviews.map((r) => {
                const sc = STATUS_COLORS[r.status || "published"] || STATUS_COLORS.published;
                return (
                  <div key={r.id} className={cn("p-4 transition-colors", hover)} onClick={() => openDetail(r)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#2563eb] flex items-center justify-center text-[11px] font-bold text-white">
                          {(r.customer?.full_name || "?")[0].toUpperCase()}
                        </div>
                        <span className={cn("text-[13px] font-semibold", txt)}>{r.customer?.full_name || "Anonymous"}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold capitalize" style={{ background: sc.bg, color: sc.text }}>{r.status || "published"}</span>
                    </div>
                    <div className="flex items-center justify-between mb-1.5">
                      <StarRating rating={r.rating} size={12} />
                      <span className={cn("text-[12px]", sub)}>{r.product?.name || "—"}</span>
                    </div>
                    {r.comment && <p className={cn("text-[12px] line-clamp-2 mt-1", sub)}>{r.comment}</p>}
                    <p className={cn("text-[11px] mt-2", sub)}>{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                );
              })}
              {reviews.length === 0 && (
                <div className={cn("p-8 text-center", sub)}>
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">No reviews found</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className={cn("flex items-center justify-between px-4 py-3 border-t", brd)}>
              <p className={cn("text-[12px]", sub)}>{total} review{total !== 1 ? "s" : ""} · Page {page} of {totalPages}</p>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30 transition-colors", hover)}><ChevronLeft className={cn("w-4 h-4", sub)} /></button>
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const pg = start + i;
                  if (pg > totalPages) return null;
                  return <button key={pg} onClick={() => setPage(pg)} className={cn("w-8 h-8 rounded-lg text-[12px] font-semibold transition-colors", pg === page ? "bg-[#2563eb] text-white" : cn(sub, hover))}>{pg}</button>;
                })}
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30 transition-colors", hover)}><ChevronRight className={cn("w-4 h-4", sub)} /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ──── DETAIL DRAWER ──── */}
      <Drawer open={!!detailReview} onClose={() => setDetailReview(null)} dark={dark} title="Review Details" width="2xl">
        {detailReview && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-1">
              {(["overview", "customer", "product", "reply", "analytics"] as DetailTab[]).map(tab => (
                <button key={tab} onClick={() => setDetailTab(tab)}
                  className={cn("px-3 py-1.5 rounded-full text-[12px] font-semibold capitalize transition-colors",
                    detailTab === tab ? "bg-[#2563eb] text-white" : dark ? "bg-[#1d242e] text-[#8b95a3] hover:bg-[#252c36]" : "bg-[#f6f8fb] text-[#8a929c] hover:bg-[#eef0f3]"
                  )}
                >{tab}</button>
              ))}
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" /></div>
            ) : (
              <>
                {/* OVERVIEW */}
                {detailTab === "overview" && (() => {
                  const r = detailData || detailReview;
                  const sc = STATUS_COLORS[r.status || "published"] || STATUS_COLORS.published;
                  return (
                    <div className="space-y-4">
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <div className="flex items-center justify-between mb-3">
                          <StarRating rating={r.rating} size={18} />
                          <span className="px-3 py-1 rounded-md text-[12px] font-bold capitalize" style={{ background: sc.bg, color: sc.text }}>{r.status || "published"}</span>
                        </div>
                        {r.title && <p className={cn("text-[16px] font-bold mb-2", txt)}>{r.title}</p>}
                        <p className={cn("text-[14px] leading-relaxed", txt)}>{r.comment || <span className={sub}>No comment provided.</span>}</p>
                        <div className="flex items-center gap-4 mt-3">
                          {r.is_verified && (
                            <span className="flex items-center gap-1 text-[12px] font-semibold text-[#7c3aed]"><Shield className="w-3.5 h-3.5" /> Verified Purchase</span>
                          )}
                          <span className={cn("text-[12px]", sub)}>{new Date(r.created_at).toLocaleString()}</span>
                        </div>
                        {(r.helpful_votes || r.not_helpful_votes) && (
                          <div className="flex items-center gap-4 mt-2">
                            <span className={cn("flex items-center gap-1 text-[12px]", sub)}><ThumbsUp className="w-3 h-3" /> {r.helpful_votes || 0} helpful</span>
                            <span className={cn("flex items-center gap-1 text-[12px]", sub)}><ThumbsDown className="w-3 h-3" /> {r.not_helpful_votes || 0} not helpful</span>
                          </div>
                        )}
                      </div>

                      {r.images && r.images.length > 0 && (
                        <div className={cn("rounded-[14px] border p-4", p, brd)}>
                          <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>Photos ({r.images.length})</p>
                          <div className="flex flex-wrap gap-2">
                            {r.images.map((img: string, i: number) => (
                              <img key={i} src={img} alt="" className="w-20 h-20 rounded-[10px] object-cover border border-transparent hover:border-[#2563eb] transition-colors cursor-pointer" />
                            ))}
                          </div>
                        </div>
                      )}

                      {r.admin_reply && (
                        <div className={cn("rounded-[14px] border p-4 border-l-4 border-l-[#2563eb]", p, brd)}>
                          <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", sub)}>Admin Reply</p>
                          <p className={cn("text-[13px]", txt)}>{r.admin_reply}</p>
                          {r.admin_reply_at && <p className={cn("text-[11px] mt-2", sub)}>Replied {new Date(r.admin_reply_at).toLocaleString()}</p>}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <select
                          value={r.status || "published"}
                          onChange={(e) => handleStatusChange(r.id, e.target.value)}
                          className={cn("h-[36px] rounded-[10px] border px-2.5 text-[12px] font-semibold outline-none", inp)}
                        >
                          <option value="published">Published</option>
                          <option value="pending">Pending</option>
                          <option value="rejected">Rejected</option>
                          <option value="hidden">Hidden</option>
                        </select>
                        <button onClick={() => handleDelete([r.id])} className="h-[36px] px-3 rounded-[10px] border border-[#ef4444] text-[#ef4444] text-[12px] font-semibold flex items-center gap-1.5 hover:bg-[#ef4444]/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* CUSTOMER */}
                {detailTab === "customer" && (() => {
                  const r = detailData || detailReview;
                  const c = r.customer;
                  return (
                    <div className="space-y-4">
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-[#2563eb] flex items-center justify-center text-white font-bold text-lg">
                            {c?.avatar_url ? <img src={c.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" /> : ((c?.full_name || "?")[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <p className={cn("text-[16px] font-bold", txt)}>{c?.full_name || "Anonymous"}</p>
                            <p className={cn("text-[13px]", sub)}>{c?.email || "—"}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                            <p className={cn("text-[11px] font-bold uppercase", sub)}>Points</p>
                            <p className={cn("text-[18px] font-extrabold", txt)}>{c?.points || 0}</p>
                          </div>
                          <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                            <p className={cn("text-[11px] font-bold uppercase", sub)}>Customer ID</p>
                            <p className={cn("text-[12px] font-mono truncate", txt)}>{c?.id || "—"}</p>
                          </div>
                        </div>
                      </div>
                      {(r as any).verified_purchase_info && (
                        <div className={cn("rounded-[14px] border p-4", p, brd)}>
                          <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", sub)}>Purchase Verification</p>
                          <div className="flex items-center gap-2">
                            {(r as any).verified_purchase_info.is_verified ? (
                              <><Shield className="w-4 h-4 text-[#16a34a]" /><span className={cn("text-[13px] font-semibold text-[#16a34a]")}>Verified Purchase</span></>
                            ) : (
                              <><AlertTriangle className="w-4 h-4 text-[#ea7317]" /><span className={cn("text-[13px] font-semibold text-[#ea7317]")}>Not Verified</span></>
                            )}
                          </div>
                          {(r as any).verified_purchase_info.order_number && (
                            <p className={cn("text-[12px] mt-1", sub)}>Order: {(r as any).verified_purchase_info.order_number}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* PRODUCT */}
                {detailTab === "product" && (() => {
                  const r = detailData || detailReview;
                  const prod = r.product;
                  return (
                    <div className="space-y-4">
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <div className="flex items-start gap-4">
                          <div className={cn("w-20 h-20 rounded-[12px] overflow-hidden shrink-0 flex items-center justify-center", dark ? "bg-[#252c36]" : "bg-[#f6f8fb]")}>
                            {prod?.images?.[0] ? <img src={prod.images[0]} alt="" className="w-20 h-20 object-cover" /> : <Package className={cn("w-8 h-8", sub)} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-[16px] font-bold", txt)}>{prod?.name || "—"}</p>
                            <p className={cn("text-[13px] mt-1", sub)}>Slug: {prod?.slug || "—"}</p>
                            <p className={cn("text-[16px] font-bold mt-2", txt)}>${(prod?.price || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* REPLY */}
                {detailTab === "reply" && (() => {
                  const r = detailData || detailReview;
                  return (
                    <div className="space-y-4">
                      {r.admin_reply && (
                        <div className={cn("rounded-[14px] border p-4 border-l-4 border-l-[#2563eb]", p, brd)}>
                          <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", sub)}>Current Reply</p>
                          <p className={cn("text-[13px]", txt)}>{r.admin_reply}</p>
                          {r.admin_reply_at && <p className={cn("text-[11px] mt-2", sub)}>{new Date(r.admin_reply_at).toLocaleString()}</p>}
                        </div>
                      )}
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>{r.admin_reply ? "Edit Reply" : "Write Reply"}</p>
                        <div className={cn("rounded-[10px] border p-3 mb-3", dark ? "bg-[#1d242e] border-[#252c36]" : "bg-[#f6f8fb] border-[#eef0f3]")}>
                          <div className="flex items-start gap-2 mb-2">
                            <StarRating rating={r.rating} size={12} />
                            <span className={cn("text-[12px] font-semibold", txt)}>{r.customer?.full_name || "Customer"}</span>
                          </div>
                          <p className={cn("text-[12px] line-clamp-3", sub)}>{r.comment || "No comment"}</p>
                        </div>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write your reply to this review..."
                          rows={4}
                          className={cn("w-full rounded-[10px] border px-3 py-2.5 text-[13px] outline-none resize-none transition-colors", inp, "focus:border-[#2563eb]")}
                        />
                        <div className="flex justify-end mt-3">
                          <button
                            onClick={() => handleReply(r.id)}
                            disabled={replySaving || !replyText.trim()}
                            className="h-[38px] px-4 rounded-[10px] bg-[#2563eb] text-white text-[13px] font-semibold flex items-center gap-2 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
                          >
                            {replySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {r.admin_reply ? "Update Reply" : "Send Reply"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ANALYTICS */}
                {detailTab === "analytics" && (() => {
                  const r = detailData || detailReview;
                  return (
                    <div className="space-y-4">
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>Review Metrics</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                            <p className={cn("text-[11px] font-bold uppercase", sub)}>Rating</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={cn("text-[22px] font-extrabold", txt)}>{r.rating}</span>
                              <Star className="w-5 h-5 fill-[#f59e0b] text-[#f59e0b]" />
                            </div>
                          </div>
                          <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                            <p className={cn("text-[11px] font-bold uppercase", sub)}>Helpful</p>
                            <p className={cn("text-[22px] font-extrabold mt-1", txt)}>{r.helpful_votes || 0}</p>
                          </div>
                          <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                            <p className={cn("text-[11px] font-bold uppercase", sub)}>Photos</p>
                            <p className={cn("text-[22px] font-extrabold mt-1", txt)}>{r.images?.length || 0}</p>
                          </div>
                          <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                            <p className={cn("text-[11px] font-bold uppercase", sub)}>Verified</p>
                            <p className={cn("text-[22px] font-extrabold mt-1", r.is_verified ? "text-[#16a34a]" : "text-[#ef4444]")}>{r.is_verified ? "Yes" : "No"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </Drawer>

      {/* TOAST */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200",
          toast.type === "success" && "bg-[#16a34a]", toast.type === "info" && "bg-[#2563eb]", toast.type === "error" && "bg-[#ef4444]"
        )}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
