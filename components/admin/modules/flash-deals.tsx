"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  Search, Plus, ChevronLeft, ChevronRight, Edit3, Trash2, Eye, Copy,
  Download, RefreshCw, X, ChevronDown, ChevronUp, Loader2, Package,
  SlidersHorizontal, ArrowUpDown, AlertTriangle, XCircle, TrendingUp,
  DollarSign, CheckCircle2, Clock, Pause, Play, Zap, BarChart3,
  Calendar, Tag, Percent, ShoppingCart, Timer, Archive, FileDown,
  Image as ImageIcon, Star
} from "lucide-react";

type Props = { dark: boolean };
type SortKey = "created_at" | "ends_at" | "deal_price" | "discount" | "name";
type SortOrder = "asc" | "desc";
type DetailTab = "general" | "products" | "discount" | "analytics" | "history";

interface FlashDealKpis {
  activeDeals: number;
  scheduledDeals: number;
  expiredDeals: number;
  draftDeals: number;
  totalProducts: number;
  revenueGenerated: number;
  ordersGenerated: number;
  avgDiscount: number;
  totalDeals: number;
}

interface FlashDealRow {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  brand_name: string;
  category_name: string;
  deal_price: number;
  original_price: number;
  discount_pct: number;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  computed_status: string;
  remaining_seconds: number | null;
  revenue: number;
  orders: number;
}

const defaultKpis: FlashDealKpis = {
  activeDeals: 0, scheduledDeals: 0, expiredDeals: 0, draftDeals: 0,
  totalProducts: 0, revenueGenerated: 0, ordersGenerated: 0,
  avgDiscount: 0, totalDeals: 0,
};

const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
const fmtCurrency = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function formatRemaining(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "Expired";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AdminFlashDeals({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");
  const badge = (color: string) => cn("px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase", color);

  // State
  const [kpis, setKpis] = useState<FlashDealKpis>(defaultKpis);
  const [deals, setDeals] = useState<FlashDealRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [detailDeal, setDetailDeal] = useState<FlashDealRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("general");
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<FlashDealRow | null>(null);
  const [formProductSearch, setFormProductSearch] = useState("");
  const [formProducts, setFormProducts] = useState<{ id: string; name: string; price: number; image: string | null }[]>([]);
  const [formProductsLoading, setFormProductsLoading] = useState(false);
  const [formProductId, setFormProductId] = useState("");
  const [formProductName, setFormProductName] = useState("");
  const [formOriginalPrice, setFormOriginalPrice] = useState(0);
  const [formDealPrice, setFormDealPrice] = useState(0);
  const [formEndsAt, setFormEndsAt] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSaving, setFormSaving] = useState(false);

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const productSearchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Countdown timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch filter options
  useEffect(() => {
    const load = async () => {
      try {
        const [catRes, brandRes] = await Promise.all([
          fetch("/api/admin/categories?section=list&per_page=200"),
          fetch("/api/admin/brands?section=list&per_page=200"),
        ]);
        if (catRes.ok) {
          const d = await catRes.json();
          setCategories((d.categories || []).map((c: Record<string, string>) => ({ id: c.id, name: c.name })));
        }
        if (brandRes.ok) {
          const d = await brandRes.json();
          setBrands((d.brands || []).map((b: Record<string, string>) => ({ id: b.id, name: b.name })));
        }
      } catch { /* silent */ }
    };
    load();
  }, []);

  const fetchKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const res = await fetch("/api/admin/flash-deals?section=kpis");
      if (!res.ok) throw new Error("Failed");
      setKpis(await res.json());
    } catch { /* silent */ } finally { setKpisLoading(false); }
  }, []);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), per_page: String(perPage), sort: sortKey, order: sortOrder });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category_id", categoryFilter);
      if (brandFilter !== "all") params.set("brand_id", brandFilter);
      const res = await fetch(`/api/admin/flash-deals?${params}`);
      if (!res.ok) throw new Error("Failed to load flash deals");
      const data = await res.json();
      setDeals(data.deals || []);
      setTotal(data.total || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }, [page, perPage, search, statusFilter, categoryFilter, brandFilter, sortKey, sortOrder]);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);
  useEffect(() => { fetchDeals(); }, [fetchDeals]);

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

  const allSelected = deals.length > 0 && deals.every(d => selected.has(d.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(deals.map(d => d.id)));
  };

  // Product search for form
  const searchProducts = (q: string) => {
    setFormProductSearch(q);
    clearTimeout(productSearchTimeout.current);
    if (q.length < 2) { setFormProducts([]); return; }
    productSearchTimeout.current = setTimeout(async () => {
      setFormProductsLoading(true);
      try {
        const res = await fetch(`/api/admin/products?section=list&search=${encodeURIComponent(q)}&per_page=10`);
        if (res.ok) {
          const data = await res.json();
          setFormProducts((data.products || []).map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: p.name as string,
            price: p.price as number,
            image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null,
          })));
        }
      } catch { /* silent */ } finally { setFormProductsLoading(false); }
    }, 300);
  };

  const selectProduct = (product: { id: string; name: string; price: number }) => {
    setFormProductId(product.id);
    setFormProductName(product.name);
    setFormOriginalPrice(product.price);
    setFormDealPrice(Math.round(product.price * 0.8 * 100) / 100);
    setFormProducts([]);
    setFormProductSearch("");
  };

  // Create/Edit
  const openCreate = () => {
    setEditDeal(null);
    setFormProductId(""); setFormProductName(""); setFormOriginalPrice(0); setFormDealPrice(0);
    setFormEndsAt(""); setFormIsActive(true); setFormProductSearch("");
    setFormOpen(true);
  };

  const openEdit = (deal: FlashDealRow) => {
    setEditDeal(deal);
    setFormProductId(deal.product_id);
    setFormProductName(deal.product_name);
    setFormOriginalPrice(deal.original_price);
    setFormDealPrice(deal.deal_price);
    setFormEndsAt(deal.ends_at ? deal.ends_at.slice(0, 16) : "");
    setFormIsActive(deal.is_active);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formProductId) { showToast("Select a product", "error"); return; }
    if (formDealPrice <= 0) { showToast("Deal price must be positive", "error"); return; }
    if (formDealPrice >= formOriginalPrice) { showToast("Deal price must be lower than original", "error"); return; }
    if (!formEndsAt) { showToast("End date is required", "error"); return; }

    setFormSaving(true);
    try {
      const body: Record<string, unknown> = {
        product_id: formProductId,
        deal_price: formDealPrice,
        original_price: formOriginalPrice,
        ends_at: new Date(formEndsAt).toISOString(),
        is_active: formIsActive,
      };

      if (editDeal) {
        body.id = editDeal.id;
        const res = await fetch("/api/admin/flash-deals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
        showToast("Flash deal updated");
      } else {
        const res = await fetch("/api/admin/flash-deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
        showToast("Flash deal created");
      }
      setFormOpen(false);
      fetchDeals();
      fetchKpis();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    } finally { setFormSaving(false); }
  };

  // Detail
  const openDetail = async (deal: FlashDealRow) => {
    setDetailDeal(deal);
    setDetailTab("general");
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetch(`/api/admin/flash-deals?section=detail&id=${deal.id}`);
      if (res.ok) setDetailData(await res.json());
    } catch { /* silent */ } finally { setDetailLoading(false); }
  };

  // Delete
  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} flash deal(s)?`)) return;
    try {
      const res = await fetch("/api/admin/flash-deals", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`${ids.length} deal(s) deleted`);
      setSelected(new Set());
      fetchDeals();
      fetchKpis();
      if (detailDeal && ids.includes(detailDeal.id)) setDetailDeal(null);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  // Bulk
  const handleBulk = async (action: string) => {
    if (selected.size === 0) return;
    try {
      const res = await fetch("/api/admin/flash-deals", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`Bulk ${action} completed`);
      setSelected(new Set());
      fetchDeals();
      fetchKpis();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  // Export
  const handleExport = async (format: "csv" | "json") => {
    try {
      const res = await fetch("/api/admin/flash-deals?section=export");
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const items = data.deals || [];
      if (format === "json") {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "flash-deals.json"; a.click();
        URL.revokeObjectURL(url);
      } else {
        if (items.length === 0) return;
        const headers = Object.keys(items[0]);
        const csv = [headers.join(","), ...items.map((r: Record<string, unknown>) => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "flash-deals.csv"; a.click();
        URL.revokeObjectURL(url);
      }
      showToast(`Exported as ${format.toUpperCase()}`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Export error", "error");
    }
  };

  // Helpers
  const Skeleton = ({ w = "100%", h = 14 }: { w?: string | number; h?: number }) => (
    <div className={cn("rounded-[6px] animate-pulse", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} style={{ width: w, height: h }} />
  );

  const statusBadge = (status: string) => {
    switch (status) {
      case "active": return <span className={badge("bg-emerald-500/10 text-emerald-500")}>Active</span>;
      case "scheduled": return <span className={badge("bg-blue-500/10 text-blue-500")}>Scheduled</span>;
      case "expired": return <span className={badge("bg-gray-500/10 text-gray-500")}>Expired</span>;
      case "draft": return <span className={badge("bg-amber-500/10 text-amber-500")}>Draft</span>;
      default: return <span className={badge("bg-gray-500/10 text-gray-500")}>{status}</span>;
    }
  };

  const discountPct = formOriginalPrice > 0 ? Math.round((1 - formDealPrice / formOriginalPrice) * 100) : 0;

  // KPI config
  const kpiCards = useMemo(() => [
    { label: "Active Deals", value: fmt(kpis.activeDeals), icon: Zap, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Scheduled", value: fmt(kpis.scheduledDeals), icon: Calendar, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Expired", value: fmt(kpis.expiredDeals), icon: Clock, color: "text-gray-500", bg: "bg-gray-500/10" },
    { label: "Draft", value: fmt(kpis.draftDeals), icon: Archive, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Products in Deals", value: fmt(kpis.totalProducts), icon: Package, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Revenue Generated", value: fmtCurrency(kpis.revenueGenerated), icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Orders Generated", value: fmt(kpis.ordersGenerated), icon: ShoppingCart, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { label: "Avg Discount", value: fmtPct(kpis.avgDiscount), icon: Percent, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Total Deals", value: fmt(kpis.totalDeals), icon: Tag, color: "text-purple-500", bg: "bg-purple-500/10" },
  ], [kpis]);

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={cn("text-[22px] font-extrabold tracking-[-.02em]", txt)}>Flash Deals</h1>
          <p className={cn("text-sm mt-0.5", sub)}>Create, schedule and manage high-converting flash sale campaigns.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openCreate} className="h-9 px-4 rounded-[10px] text-[13px] font-semibold bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Create Flash Deal
          </button>
          <button onClick={() => handleExport("csv")} className={cn("h-9 px-3.5 rounded-[10px] text-[13px] font-semibold border flex items-center gap-1.5 transition-colors", brd, sub, hover)}>
            <FileDown className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={() => { fetchDeals(); fetchKpis(); }} className={cn("h-9 px-3.5 rounded-[10px] text-[13px] font-semibold border flex items-center gap-1.5 transition-colors", brd, sub, hover)}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpiCards.map((k) => (
          <div key={k.label} className={cn("rounded-[14px] border p-4 transition-all", p, brd, hover)}>
            {kpisLoading ? (
              <div className="space-y-2"><Skeleton w={40} h={40} /><Skeleton w="60%" /><Skeleton w="40%" /></div>
            ) : (
              <>
                <div className={cn("w-9 h-9 rounded-[10px] flex items-center justify-center mb-2.5", k.bg)}>
                  <k.icon className={cn("w-[18px] h-[18px]", k.color)} />
                </div>
                <p className={cn("text-[11px] font-semibold uppercase tracking-wider mb-0.5", sub)}>{k.label}</p>
                <p className={cn("text-lg font-extrabold tracking-tight", txt)}>{k.value}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* SEARCH + FILTERS */}
      <div className={cn("rounded-[14px] border p-4 space-y-3", p, brd)}>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 relative">
            <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", sub)} />
            <input type="text" placeholder="Search by product name, campaign..." className={cn(inpCls, "pl-9")} onChange={e => handleSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={cn("h-[42px] px-4 rounded-[11px] text-[13px] font-semibold border flex items-center gap-2 transition-colors", brd, sub, hover, showFilters && "border-[#2563eb] text-[#2563eb]")}>
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={inpCls}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="expired">Expired</option>
              <option value="draft">Draft</option>
            </select>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} className={inpCls}>
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1); }} className={inpCls}>
              <option value="all">All Brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* BULK ACTIONS */}
      {selected.size > 0 && (
        <div className={cn("rounded-[14px] border p-3 flex flex-wrap items-center gap-2", p, brd)}>
          <span className={cn("text-sm font-semibold", txt)}>{selected.size} selected</span>
          <div className="flex-1" />
          <button onClick={() => handleBulk("activate")} className="h-8 px-3 rounded-[8px] text-[12px] font-semibold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5" /> Activate
          </button>
          <button onClick={() => handleBulk("deactivate")} className="h-8 px-3 rounded-[8px] text-[12px] font-semibold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5">
            <Pause className="w-3.5 h-3.5" /> Deactivate
          </button>
          <button onClick={() => handleBulk("expire")} className="h-8 px-3 rounded-[8px] text-[12px] font-semibold bg-gray-500/10 text-gray-600 hover:bg-gray-500/20 transition-colors flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Expire
          </button>
          <button onClick={() => handleDelete(Array.from(selected))} className="h-8 px-3 rounded-[8px] text-[12px] font-semibold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button onClick={() => setSelected(new Set())} className={cn("h-8 px-3 rounded-[8px] text-[12px] font-semibold border transition-colors", brd, sub, hover)}>
            Clear
          </button>
        </div>
      )}

      {/* TABLE */}
      <div className={cn("rounded-[14px] border overflow-hidden", p, brd)}>
        {error ? (
          <div className="p-12 text-center">
            <XCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
            <p className={cn("text-sm font-semibold", txt)}>{error}</p>
            <button onClick={fetchDeals} className="mt-3 text-sm text-[#2563eb] font-semibold hover:underline">Retry</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn("border-b", brd)}>
                  <th className="w-10 p-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  <th className="p-3 text-left w-12" />
                  <th className={cn("p-3 text-left font-semibold cursor-pointer select-none", sub)} onClick={() => handleSort("name")}>
                    <span className="flex items-center gap-1">Product <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className={cn("p-3 text-right font-semibold", sub)}>Original</th>
                  <th className={cn("p-3 text-right font-semibold cursor-pointer select-none", sub)} onClick={() => handleSort("deal_price")}>
                    <span className="flex items-center justify-end gap-1">Deal Price <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className={cn("p-3 text-right font-semibold cursor-pointer select-none", sub)} onClick={() => handleSort("discount")}>
                    <span className="flex items-center justify-end gap-1">Discount <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className={cn("p-3 text-left font-semibold cursor-pointer select-none", sub)} onClick={() => handleSort("ends_at")}>
                    <span className="flex items-center gap-1">Remaining <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className={cn("p-3 text-left font-semibold", sub)}>Status</th>
                  <th className={cn("p-3 text-right font-semibold", sub)}>Revenue</th>
                  <th className={cn("p-3 text-center font-semibold", sub)}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className={cn("border-b", brd)}>
                    <td className="p-3"><Skeleton w={16} h={16} /></td>
                    <td className="p-3"><Skeleton w={36} h={36} /></td>
                    <td className="p-3"><Skeleton w="80%" /></td>
                    <td className="p-3"><Skeleton w={50} /></td>
                    <td className="p-3"><Skeleton w={50} /></td>
                    <td className="p-3"><Skeleton w={40} /></td>
                    <td className="p-3"><Skeleton w={50} /></td>
                    <td className="p-3"><Skeleton w={60} /></td>
                    <td className="p-3"><Skeleton w={50} /></td>
                    <td className="p-3"><Skeleton w={50} /></td>
                  </tr>
                )) : deals.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center">
                      <Zap className={cn("w-10 h-10 mx-auto mb-2", sub)} />
                      <p className={cn("text-sm font-semibold", txt)}>No flash deals found</p>
                      <p className={cn("text-xs mt-1", sub)}>Create your first flash deal campaign</p>
                      <button onClick={openCreate} className="mt-3 h-8 px-4 rounded-[8px] text-xs font-semibold bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors">
                        Create Flash Deal
                      </button>
                    </td>
                  </tr>
                ) : deals.map(deal => (
                  <tr key={deal.id} className={cn("border-b transition-colors", brd, hover, selected.has(deal.id) && (dark ? "bg-blue-500/5" : "bg-blue-50/50"))}>
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(deal.id)} onChange={() => {
                        const s = new Set(selected);
                        s.has(deal.id) ? s.delete(deal.id) : s.add(deal.id);
                        setSelected(s);
                      }} className="rounded" />
                    </td>
                    <td className="p-3">
                      {deal.product_image ? (
                        <img src={deal.product_image} alt="" className="w-9 h-9 rounded-[8px] object-cover" />
                      ) : (
                        <div className={cn("w-9 h-9 rounded-[8px] flex items-center justify-center", dark ? "bg-[#252c36]" : "bg-[#f0f2f5]")}>
                          <Zap className={cn("w-4 h-4", sub)} />
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <button onClick={() => openDetail(deal)} className={cn("text-sm font-semibold text-left hover:text-[#2563eb] transition-colors", txt)}>{deal.product_name}</button>
                      <p className={cn("text-xs mt-0.5", sub)}>{deal.brand_name}{deal.category_name ? ` · ${deal.category_name}` : ""}</p>
                    </td>
                    <td className={cn("p-3 text-right text-xs line-through tabular-nums", sub)}>{fmtCurrency(deal.original_price)}</td>
                    <td className={cn("p-3 text-right font-bold tabular-nums text-emerald-500")}>{fmtCurrency(deal.deal_price)}</td>
                    <td className="p-3 text-right">
                      <span className={badge("bg-red-500/10 text-red-500")}>-{deal.discount_pct.toFixed(0)}%</span>
                    </td>
                    <td className="p-3">
                      {deal.computed_status === "active" ? (
                        <span className={cn("text-xs font-semibold flex items-center gap-1", "text-emerald-500")}>
                          <Timer className="w-3 h-3" /> {formatRemaining(deal.remaining_seconds)}
                        </span>
                      ) : deal.computed_status === "scheduled" ? (
                        <span className={cn("text-xs font-semibold text-blue-500")}>Upcoming</span>
                      ) : (
                        <span className={cn("text-xs", sub)}>—</span>
                      )}
                    </td>
                    <td className="p-3">{statusBadge(deal.computed_status)}</td>
                    <td className={cn("p-3 text-right text-xs tabular-nums font-semibold", deal.revenue > 0 ? "text-green-500" : sub)}>{deal.revenue > 0 ? fmtCurrency(deal.revenue) : "—"}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openDetail(deal)} className={cn("w-7 h-7 rounded-[7px] flex items-center justify-center transition-colors", hover)} title="View"><Eye className={cn("w-3.5 h-3.5", sub)} /></button>
                        <button onClick={() => openEdit(deal)} className={cn("w-7 h-7 rounded-[7px] flex items-center justify-center transition-colors", hover)} title="Edit"><Edit3 className={cn("w-3.5 h-3.5", sub)} /></button>
                        <button onClick={() => handleDelete([deal.id])} className={cn("w-7 h-7 rounded-[7px] flex items-center justify-center transition-colors", hover)} title="Delete"><Trash2 className={cn("w-3.5 h-3.5", sub)} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {!error && !loading && total > 0 && (
          <div className={cn("flex items-center justify-between px-4 py-3 border-t", brd)}>
            <p className={cn("text-xs", sub)}>Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors disabled:opacity-30", hover)}>
                <ChevronLeft className={cn("w-4 h-4", sub)} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const pg = start + i;
                if (pg > totalPages) return null;
                return (
                  <button key={pg} onClick={() => setPage(pg)} className={cn("w-8 h-8 rounded-[8px] text-xs font-semibold transition-colors", pg === page ? "bg-[#2563eb] text-white" : cn(sub, hover))}>{pg}</button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors disabled:opacity-30", hover)}>
                <ChevronRight className={cn("w-4 h-4", sub)} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL PANEL */}
      <Drawer open={!!detailDeal} onClose={() => setDetailDeal(null)} title="Flash Deal Details" className={dark ? "!bg-[#171c24] !text-[#e7ebf0]" : ""}>
        {detailLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" /></div>
        ) : detailData ? (
          <div className="space-y-4">
            {/* Tabs */}
            <div className={cn("flex gap-1 p-1 rounded-[10px]", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
              {(["general", "products", "discount", "analytics", "history"] as DetailTab[]).map(tab => (
                <button key={tab} onClick={() => setDetailTab(tab)} className={cn("flex-1 h-8 rounded-[8px] text-xs font-semibold transition-colors capitalize", detailTab === tab ? "bg-[#2563eb] text-white" : cn(sub, hover))}>
                  {tab}
                </button>
              ))}
            </div>

            {/* General */}
            {detailTab === "general" && (() => {
              const d = detailData as Record<string, any>;
              const deal = d.deal || {};
              return (
                <div className="space-y-3">
                  <div className={cn("rounded-[12px] p-4 text-center", deal.computed_status === "active" ? "bg-emerald-500/10" : deal.computed_status === "scheduled" ? "bg-blue-500/10" : "bg-gray-500/10")}>
                    <p className={cn("text-2xl font-extrabold", deal.computed_status === "active" ? "text-emerald-500" : deal.computed_status === "scheduled" ? "text-blue-500" : sub)}>
                      {deal.computed_status === "active" ? formatRemaining(deal.remaining_seconds) : deal.computed_status?.toUpperCase()}
                    </p>
                    <p className={cn("text-xs mt-1", sub)}>{deal.computed_status === "active" ? "remaining" : "status"}</p>
                  </div>
                  <InfoRow dark={dark} label="Product" value={d.product?.name || "—"} />
                  <InfoRow dark={dark} label="Brand" value={d.brand_name || "—"} />
                  <InfoRow dark={dark} label="Category" value={d.category_name || "—"} />
                  <InfoRow dark={dark} label="Original Price" value={fmtCurrency(deal.original_price || 0)} />
                  <InfoRow dark={dark} label="Deal Price" value={fmtCurrency(deal.deal_price || 0)} />
                  <InfoRow dark={dark} label="Discount" value={`${deal.discount_pct?.toFixed(1) || 0}%`} />
                  <InfoRow dark={dark} label="Ends At" value={deal.ends_at ? new Date(deal.ends_at).toLocaleString() : "—"} />
                  <InfoRow dark={dark} label="Active" value={deal.is_active ? "Yes" : "No"} />
                  <InfoRow dark={dark} label="Created" value={deal.created_at ? new Date(deal.created_at).toLocaleDateString() : "—"} />
                </div>
              );
            })()}

            {/* Products */}
            {detailTab === "products" && (() => {
              const d = detailData as Record<string, any>;
              const product = d.product || {};
              const variants: any[] = d.variants || [];
              return (
                <div className="space-y-3">
                  {product.images?.[0] && <img src={product.images[0]} alt="" className="w-full h-40 object-cover rounded-[12px]" />}
                  <InfoRow dark={dark} label="Name" value={product.name || "—"} />
                  <InfoRow dark={dark} label="Price" value={fmtCurrency(product.price || 0)} />
                  <InfoRow dark={dark} label="Status" value={product.status || "—"} />
                  <h3 className={cn("text-xs font-bold uppercase tracking-wider mt-3", sub)}>Variants ({variants.length})</h3>
                  {variants.map((v: any) => (
                    <div key={v.id} className={cn("flex items-center justify-between py-2 border-b", brd)}>
                      <div className="flex items-center gap-2">
                        {v.color_hex && <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: v.color_hex }} />}
                        <span className={cn("text-xs font-semibold", txt)}>{v.color || "—"} / {v.size || "—"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("text-[10px] font-mono", sub)}>{v.sku}</span>
                        <span className={cn("text-xs font-bold", v.stock <= 0 ? "text-red-500" : "text-emerald-500")}>{v.stock} in stock</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Discount */}
            {detailTab === "discount" && (() => {
              const d = detailData as Record<string, any>;
              const deal = d.deal || {};
              const savings = (deal.original_price || 0) - (deal.deal_price || 0);
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard dark={dark} label="Original Price" value={fmtCurrency(deal.original_price || 0)} color="text-gray-500" />
                    <StatCard dark={dark} label="Deal Price" value={fmtCurrency(deal.deal_price || 0)} color="text-emerald-500" />
                    <StatCard dark={dark} label="Savings" value={fmtCurrency(savings)} color="text-red-500" />
                    <StatCard dark={dark} label="Discount" value={`${deal.discount_pct?.toFixed(1) || 0}%`} color="text-orange-500" />
                  </div>
                  <div className={cn("rounded-[12px] border p-4", p, brd)}>
                    <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2", sub)}>Discount Visualization</p>
                    <div className="h-6 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all" style={{ width: `${100 - (deal.discount_pct || 0)}%` }} />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className={cn("text-[10px]", sub)}>Deal Price ({(100 - (deal.discount_pct || 0)).toFixed(0)}%)</span>
                      <span className={cn("text-[10px] text-red-500")}>Savings ({(deal.discount_pct || 0).toFixed(0)}%)</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Analytics */}
            {detailTab === "analytics" && (() => {
              const d = detailData as Record<string, any>;
              const sales = d.salesStats || {};
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard dark={dark} label="Revenue" value={fmtCurrency(sales.totalRevenue || 0)} color="text-green-500" />
                    <StatCard dark={dark} label="Orders" value={fmt(sales.totalOrders || 0)} color="text-blue-500" />
                    <StatCard dark={dark} label="Units Sold" value={fmt(sales.totalSold || 0)} color="text-indigo-500" />
                    <StatCard dark={dark} label="Avg Order" value={fmtCurrency(sales.avgOrderValue || 0)} color="text-purple-500" />
                  </div>
                </div>
              );
            })()}

            {/* History */}
            {detailTab === "history" && (() => {
              const d = detailData as Record<string, any>;
              const deal = d.deal || {};
              return (
                <div className="space-y-2">
                  <TimelineItem dark={dark} label="Created" date={deal.created_at} icon={<Plus className="w-3 h-3" />} color="bg-blue-500" />
                  {deal.is_active && <TimelineItem dark={dark} label="Activated" date={deal.created_at} icon={<Zap className="w-3 h-3" />} color="bg-emerald-500" />}
                  {deal.ends_at && new Date(deal.ends_at) < new Date() && <TimelineItem dark={dark} label="Expired" date={deal.ends_at} icon={<Clock className="w-3 h-3" />} color="bg-gray-500" />}
                </div>
              );
            })()}
          </div>
        ) : (
          <p className={cn("text-sm text-center py-6", sub)}>No data</p>
        )}
      </Drawer>

      {/* CREATE/EDIT DRAWER */}
      <Drawer open={formOpen} onClose={() => setFormOpen(false)} title={editDeal ? "Edit Flash Deal" : "Create Flash Deal"} className={dark ? "!bg-[#171c24] !text-[#e7ebf0]" : ""}>
        <div className="space-y-4">
          {/* Product selection */}
          {!editDeal && (
            <div>
              <label className={cn("text-xs font-semibold block mb-1.5", sub)}>Product *</label>
              {formProductId ? (
                <div className={cn("flex items-center gap-2 p-2.5 rounded-[11px] border", brd)}>
                  <Package className={cn("w-4 h-4 shrink-0", sub)} />
                  <span className={cn("text-sm font-semibold flex-1", txt)}>{formProductName}</span>
                  <button onClick={() => { setFormProductId(""); setFormProductName(""); setFormOriginalPrice(0); setFormDealPrice(0); }} className={cn("w-6 h-6 rounded-full flex items-center justify-center", hover)}>
                    <X className={cn("w-3.5 h-3.5", sub)} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input type="text" value={formProductSearch} onChange={e => searchProducts(e.target.value)} placeholder="Search products..." className={inpCls} />
                  {formProductsLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#2563eb]" />}
                  {formProducts.length > 0 && (
                    <div className={cn("absolute top-full left-0 right-0 mt-1 rounded-[11px] border shadow-lg z-10 max-h-48 overflow-y-auto", p, brd)}>
                      {formProducts.map(pr => (
                        <button key={pr.id} onClick={() => selectProduct(pr)} className={cn("w-full flex items-center gap-2.5 p-2.5 text-left transition-colors", hover)}>
                          {pr.image ? <img src={pr.image} alt="" className="w-8 h-8 rounded-[6px] object-cover" /> : <Package className={cn("w-8 h-8 p-1.5 rounded-[6px]", dark ? "bg-[#252c36]" : "bg-[#f0f2f5]", sub)} />}
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-semibold truncate", txt)}>{pr.name}</p>
                            <p className={cn("text-xs", sub)}>{fmtCurrency(pr.price)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {editDeal && (
            <div>
              <label className={cn("text-xs font-semibold block mb-1.5", sub)}>Product</label>
              <p className={cn("text-sm font-semibold", txt)}>{formProductName}</p>
            </div>
          )}

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cn("text-xs font-semibold block mb-1.5", sub)}>Original Price *</label>
              <input type="number" min={0} step={0.01} value={formOriginalPrice} onChange={e => setFormOriginalPrice(parseFloat(e.target.value) || 0)} className={inpCls} />
            </div>
            <div>
              <label className={cn("text-xs font-semibold block mb-1.5", sub)}>Deal Price *</label>
              <input type="number" min={0} step={0.01} value={formDealPrice} onChange={e => setFormDealPrice(parseFloat(e.target.value) || 0)} className={inpCls} />
            </div>
          </div>

          {/* Discount preview */}
          {formOriginalPrice > 0 && formDealPrice > 0 && (
            <div className={cn("rounded-[11px] p-3 flex items-center justify-between", formDealPrice < formOriginalPrice ? "bg-emerald-500/10" : "bg-red-500/10")}>
              <span className={cn("text-xs font-semibold", formDealPrice < formOriginalPrice ? "text-emerald-600" : "text-red-600")}>
                {formDealPrice < formOriginalPrice ? `${discountPct}% discount — Save ${fmtCurrency(formOriginalPrice - formDealPrice)}` : "Deal price must be lower than original"}
              </span>
              <Percent className={cn("w-4 h-4", formDealPrice < formOriginalPrice ? "text-emerald-500" : "text-red-500")} />
            </div>
          )}

          {/* End date */}
          <div>
            <label className={cn("text-xs font-semibold block mb-1.5", sub)}>End Date & Time *</label>
            <input type="datetime-local" value={formEndsAt} onChange={e => setFormEndsAt(e.target.value)} className={inpCls} />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <label className={cn("text-sm font-semibold", txt)}>Activate immediately</label>
            <button onClick={() => setFormIsActive(!formIsActive)} className={cn("w-11 h-6 rounded-full transition-colors relative", formIsActive ? "bg-[#2563eb]" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}>
              <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", formIsActive ? "translate-x-[22px]" : "translate-x-0.5")} />
            </button>
          </div>

          {/* CJ Warning */}
          <div className={cn("rounded-[11px] border p-3 flex items-start gap-2.5", brd, "bg-amber-500/5")}>
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className={cn("text-xs font-semibold text-amber-600")}>CJ Dropshipping Notice</p>
              <p className={cn("text-[11px] mt-0.5", sub)}>Ensure the deal price covers your cost from CJ Dropshipping. Deals with negative margins will result in losses.</p>
            </div>
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={formSaving} className="w-full h-[42px] rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {formSaving ? "Saving..." : editDeal ? "Update Flash Deal" : "Create Flash Deal"}
          </button>
        </div>
      </Drawer>

      {/* TOAST */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg",
          toast.type === "success" && "bg-[#16a34a]",
          toast.type === "error" && "bg-[#dc2626]",
          toast.type === "info" && "bg-[#2563eb]",
        )}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// Helper components
function InfoRow({ dark, label, value }: { dark: boolean; label: string; value: string }) {
  return (
    <div className={cn("flex justify-between py-1.5 border-b", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
      <span className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{label}</span>
      <span className={cn("text-xs font-semibold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{value}</span>
    </div>
  );
}

function StatCard({ dark, label, value, color }: { dark: boolean; label: string; value: string; color: string }) {
  return (
    <div className={cn("rounded-[10px] border p-3", dark ? "bg-[#1d242e] border-[#252c36]" : "bg-[#f6f8fb] border-[#eef0f3]")}>
      <p className={cn("text-[10px] font-semibold uppercase tracking-wider", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{label}</p>
      <p className={cn("text-lg font-extrabold mt-0.5", color)}>{value}</p>
    </div>
  );
}

function TimelineItem({ dark, label, date, icon, color }: { dark: boolean; label: string; date: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0", color)}>{icon}</div>
      <div className="flex-1">
        <p className={cn("text-xs font-semibold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{label}</p>
        <p className={cn("text-[10px]", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{date ? new Date(date).toLocaleString() : "—"}</p>
      </div>
    </div>
  );
}
