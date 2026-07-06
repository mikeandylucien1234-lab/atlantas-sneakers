"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Search, Plus, ChevronLeft, ChevronRight, Edit3, Trash2, Eye, Copy,
  Download, RefreshCw, X, ChevronDown, ChevronUp,
  CheckCircle2, EyeOff, Star, TrendingUp, ImageIcon, DollarSign,
  Loader2, Package, SlidersHorizontal, ArrowUpDown, Tag,
  AlertTriangle, XCircle, Globe, ShieldCheck
} from "lucide-react";
import type { Brand, Product, Category } from "@/types";

type Props = { dark: boolean };
type SortKey = "name" | "created_at" | "products_count" | "revenue";
type SortOrder = "asc" | "desc";
type DetailTab = "general" | "products" | "categories" | "analytics";

interface BrandKpis {
  totalBrands: number;
  activeBrands: number;
  hiddenBrands: number;
  brandsWithoutLogo: number;
  brandsWithoutProducts: number;
  topSellingBrand: { name: string; revenue: number } | null;
  mostProductsBrand: { name: string; count: number } | null;
}

interface BrandRow extends Brand {
  productCount: number;
  revenue: number;
  avgRating: number;
}

const defaultKpis: BrandKpis = {
  totalBrands: 0, activeBrands: 0, hiddenBrands: 0,
  brandsWithoutLogo: 0, brandsWithoutProducts: 0,
  topSellingBrand: null, mostProductsBrand: null,
};

export function AdminBrands({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");

  const [kpis, setKpis] = useState<BrandKpis>(defaultKpis);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [hasProductsFilter, setHasProductsFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [detailBrand, setDetailBrand] = useState<BrandRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("general");
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editBrand, setEditBrand] = useState<Brand | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formLogoUrl, setFormLogoUrl] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSaving, setFormSaving] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const res = await fetch("/api/admin/brands?section=kpis");
      if (!res.ok) throw new Error("Failed");
      setKpis(await res.json());
    } catch { /* silent */ } finally { setKpisLoading(false); }
  }, []);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), per_page: String(perPage), sort: sortKey, order: sortOrder });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (hasProductsFilter !== "all") params.set("has_products", hasProductsFilter);
      const res = await fetch(`/api/admin/brands?${params}`);
      if (!res.ok) throw new Error("Failed to load brands");
      const data = await res.json();
      setBrands(data.brands || []);
      setTotal(data.total || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load brands");
    } finally { setLoading(false); }
  }, [page, perPage, search, statusFilter, hasProductsFilter, sortKey, sortOrder]);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);
  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  const handleSearch = (v: string) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setSearch(v); setPage(1); }, 300);
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortOrder("asc"); }
    setPage(1);
  };

  const allSelected = brands.length > 0 && brands.every(b => selected.has(b.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(brands.map(b => b.id)));
  };

  const openCreate = () => {
    setEditBrand(null);
    setFormName(""); setFormSlug(""); setFormLogoUrl(""); setFormIsActive(true);
    setFormOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditBrand(brand);
    setFormName(brand.name);
    setFormSlug(brand.slug);
    setFormLogoUrl(brand.logo_url || "");
    setFormIsActive(brand.is_active);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formName) return;
    setFormSaving(true);
    try {
      const slug = formSlug || formName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const payload = { name: formName, slug, logo_url: formLogoUrl || null, is_active: formIsActive };

      if (editBrand) {
        const res = await fetch("/api/admin/brands", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editBrand.id, ...payload }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Update failed"); }
        showToast("Brand updated");
      } else {
        const res = await fetch("/api/admin/brands", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Create failed"); }
        showToast("Brand created");
      }
      setFormOpen(false);
      fetchBrands(); fetchKpis();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally { setFormSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this brand?")) return;
    try {
      const res = await fetch("/api/admin/brands", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Delete failed"); }
      showToast("Brand deleted");
      fetchBrands(); fetchKpis();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Delete failed", "error"); }
  };

  const handleDuplicate = async (brand: BrandRow) => {
    try {
      const res = await fetch("/api/admin/brands", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: brand.name + " (Copy)", logo_url: brand.logo_url, is_active: false }),
      });
      if (!res.ok) throw new Error("Duplicate failed");
      showToast("Brand duplicated as hidden");
      fetchBrands(); fetchKpis();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Duplicate failed", "error"); }
  };

  const handleBulkAction = async (action: string) => {
    if (selected.size === 0) return;
    const ids = [...selected];
    if (action === "delete") {
      if (!window.confirm(`Delete ${ids.length} brand(s)?`)) return;
      try {
        const res = await fetch("/api/admin/brands", {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Bulk delete failed"); }
        showToast(`${ids.length} brand(s) deleted`);
      } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Failed", "error"); return; }
    } else {
      try {
        const res = await fetch("/api/admin/brands", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action }),
        });
        if (!res.ok) throw new Error("Bulk action failed");
        showToast(`${ids.length} brand(s) updated`);
      } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Failed", "error"); return; }
    }
    setSelected(new Set());
    fetchBrands(); fetchKpis();
  };

  const handleExport = async (format: "csv" | "json") => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("brands").select("*").order("name");
      const items = data || [];
      if (format === "json") {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `brands-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
      } else {
        const headers = ["ID", "Name", "Slug", "Logo URL", "Active", "Created"];
        const rows = items.map(b => [b.id, b.name, b.slug, b.logo_url || "", b.is_active, b.created_at]);
        const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `brands-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
      }
      showToast(`Exported ${items.length} brands`);
    } catch { showToast("Export failed", "error"); }
  };

  const openDetail = async (brand: BrandRow) => {
    setDetailBrand(brand);
    setDetailTab("general");
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/brands?section=detail&id=${brand.id}`);
      if (!res.ok) throw new Error("Failed");
      setDetailData(await res.json());
    } catch { setDetailData(null); }
    finally { setDetailLoading(false); }
  };

  const activeFilterCount = [statusFilter !== "all", hasProductsFilter !== "all"].filter(Boolean).length;
  const clearFilters = () => { setStatusFilter("all"); setHasProductsFilter("all"); setPage(1); };

  const kpiCards = [
    { key: "total", label: "Total Brands", icon: Tag, value: kpis.totalBrands, color: "#2563eb" },
    { key: "active", label: "Active", icon: CheckCircle2, value: kpis.activeBrands, color: "#16a34a" },
    { key: "hidden", label: "Hidden", icon: EyeOff, value: kpis.hiddenBrands, color: "#64748b" },
    { key: "noLogo", label: "No Logo", icon: ImageIcon, value: kpis.brandsWithoutLogo, color: "#ef4444" },
    { key: "noProducts", label: "No Products", icon: AlertTriangle, value: kpis.brandsWithoutProducts, color: "#f97316" },
    { key: "topSelling", label: "Top Selling", icon: TrendingUp, value: kpis.topSellingBrand?.name || "—", color: "#8b5cf6" },
    { key: "topRevenue", label: "Top Revenue", icon: DollarSign, value: kpis.topSellingBrand ? `$${kpis.topSellingBrand.revenue.toLocaleString()}` : "—", color: "#10b981" },
    { key: "mostProducts", label: "Most Products", icon: Package, value: kpis.mostProductsBrand ? `${kpis.mostProductsBrand.name} (${kpis.mostProductsBrand.count})` : "—", color: "#eab308" },
  ];

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-[24px] font-extrabold tracking-tight", txt)}>Brands</h1>
          <p className={cn("text-sm mt-0.5", sub)}>Manage all brands available on your marketplace.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openCreate} className="h-[40px] px-4 rounded-[11px] bg-[#2563eb] text-white text-[13px] font-semibold flex items-center gap-2 hover:bg-[#1d4ed8] transition-colors">
            <Plus className="w-4 h-4" /> Add Brand
          </button>
          <button onClick={() => handleExport("csv")} className={cn("h-[40px] px-3 rounded-[11px] border text-[13px] font-semibold flex items-center gap-2 transition-colors", brd, txt, hover)}>
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => { fetchBrands(); fetchKpis(); }} className={cn("h-[40px] w-[40px] rounded-[11px] border flex items-center justify-center transition-colors", brd, txt, hover)}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {kpiCards.map(k => (
          <div key={k.key} className={cn("rounded-[14px] border p-3.5 transition-all", p, brd, hover)}>
            {kpisLoading ? (
              <div className="animate-pulse space-y-2">
                <div className={cn("h-3 w-14 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-5 w-8 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 mb-1">
                  <k.icon className="w-3.5 h-3.5" style={{ color: k.color }} />
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wider", sub)}>{k.label}</span>
                </div>
                <p className={cn("text-[17px] font-extrabold truncate", txt)}>{k.value}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* SEARCH & FILTERS */}
      <div className={cn("rounded-[16px] border p-4", p, brd)}>
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn("flex items-center gap-2 h-[42px] px-3 rounded-[11px] border flex-1 min-w-[200px]", inp)}>
            <Search className="w-4 h-4 shrink-0 opacity-50" />
            <input defaultValue={search} onChange={e => handleSearch(e.target.value)} placeholder="Search brands..." className="bg-transparent outline-none w-full text-sm" />
          </div>
          <div className="flex gap-1.5">
            {["all", "active", "hidden"].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={cn("px-3 py-1.5 rounded-full text-[12px] font-semibold capitalize transition-colors",
                  statusFilter === s ? "bg-[#2563eb] text-white" : dark ? "bg-[#1d242e] text-[#8b95a3] hover:bg-[#252c36]" : "bg-[#f6f8fb] text-[#8a929c] hover:bg-[#eef0f3]"
                )}>{s}</button>
            ))}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={cn("h-[42px] px-3 rounded-[11px] border text-[13px] font-semibold flex items-center gap-2 transition-colors",
              showFilters ? "bg-[#2563eb] text-white border-[#2563eb]" : cn(brd, txt, hover)
            )}>
            <SlidersHorizontal className="w-4 h-4" /> Filters
            {activeFilterCount > 0 && <span className="bg-[#ef4444] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>}
          </button>
        </div>
        {showFilters && (
          <div className={cn("mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-3 gap-3", brd)}>
            <div>
              <label className={cn("text-[11px] font-semibold mb-1 block", sub)}>Products</label>
              <select value={hasProductsFilter} onChange={e => { setHasProductsFilter(e.target.value); setPage(1); }} className={cn(inpCls, "h-[38px]")}>
                <option value="all">All</option>
                <option value="true">Has Products</option>
                <option value="false">No Products</option>
              </select>
            </div>
            {activeFilterCount > 0 && (
              <div className="col-span-full">
                <button onClick={clearFilters} className="text-[#2563eb] text-[12px] font-semibold hover:underline flex items-center gap-1"><X className="w-3 h-3" /> Clear filters</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BULK ACTIONS */}
      {selected.size > 0 && (
        <div className={cn("rounded-[14px] border px-4 py-3 flex items-center justify-between", dark ? "bg-[#1a2233] border-[#2563eb]/30" : "bg-[#eff6ff] border-[#2563eb]/20")}>
          <span className={cn("text-sm font-semibold", txt)}>{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => handleBulkAction("activate")} className="px-3 py-1.5 rounded-lg bg-[#16a34a] text-white text-[12px] font-semibold hover:bg-[#15803d] transition-colors">Activate</button>
            <button onClick={() => handleBulkAction("hide")} className="px-3 py-1.5 rounded-lg bg-[#64748b] text-white text-[12px] font-semibold hover:bg-[#475569] transition-colors">Hide</button>
            <button onClick={() => handleBulkAction("delete")} className="px-3 py-1.5 rounded-lg bg-[#ef4444] text-white text-[12px] font-semibold hover:bg-[#dc2626] transition-colors">Delete</button>
            <button onClick={() => setSelected(new Set())} className={cn("px-3 py-1.5 rounded-lg text-[12px] font-semibold", txt, hover)}>Cancel</button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-[14px] border border-red-300 bg-red-50 p-4 text-sm text-red-600">
          {error} <button onClick={fetchBrands} className="ml-3 underline">Retry</button>
        </div>
      )}

      {/* TABLE */}
      <div className={cn("rounded-[16px] border overflow-hidden", p, brd)}>
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#2563eb] mx-auto" />
            <p className={cn("text-sm mt-3", sub)}>Loading brands...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={cn("border-b", brd)}>
                    <th className="w-10 p-3"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" /></th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Brand</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden md:table-cell", sub)}>Slug</th>
                    <SortTH label="Products" sortKey="products_count" currentKey={sortKey} order={sortOrder} onSort={handleSort} dark={dark} />
                    <SortTH label="Revenue" sortKey="revenue" currentKey={sortKey} order={sortOrder} onSort={handleSort} dark={dark} className="hidden lg:table-cell" />
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden xl:table-cell", sub)}>Rating</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Status</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden md:table-cell", sub)}>Logo</th>
                    <th className={cn("text-right text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map(brand => (
                    <tr key={brand.id} className={cn("border-b last:border-0 transition-colors", brd, hover, selected.has(brand.id) && (dark ? "bg-[#2563eb]/5" : "bg-[#2563eb]/[.03]"))}>
                      <td className="p-3">
                        <input type="checkbox" checked={selected.has(brand.id)} onChange={() => {
                          const n = new Set(selected); n.has(brand.id) ? n.delete(brand.id) : n.add(brand.id); setSelected(n);
                        }} className="rounded" />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-[10px] shrink-0 overflow-hidden flex items-center justify-center", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                            {brand.logo_url ? <img src={brand.logo_url} alt="" className="w-10 h-10 object-contain p-1" /> : <Tag className={cn("w-4 h-4 opacity-40", sub)} />}
                          </div>
                          <div className="min-w-0">
                            <button onClick={() => openDetail(brand)} className={cn("text-sm font-semibold truncate block text-left hover:text-[#2563eb] transition-colors", txt)}>{brand.name}</button>
                          </div>
                        </div>
                      </td>
                      <td className={cn("p-3 text-sm hidden md:table-cell font-mono text-[12px]", sub)}>/{brand.slug}</td>
                      <td className={cn("p-3 text-sm font-semibold", brand.productCount === 0 ? "text-[#f97316]" : txt)}>{brand.productCount}</td>
                      <td className={cn("p-3 text-sm hidden lg:table-cell font-semibold", sub)}>${brand.revenue.toFixed(0)}</td>
                      <td className="p-3 hidden xl:table-cell">
                        {brand.avgRating > 0 ? (
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-[#eab308] fill-[#eab308]" />
                            <span className={cn("text-sm font-semibold", txt)}>{brand.avgRating.toFixed(1)}</span>
                          </div>
                        ) : <span className={cn("text-sm", sub)}>—</span>}
                      </td>
                      <td className="p-3">
                        <span className={cn("inline-block px-2.5 py-1 rounded-md text-[11px] font-bold",
                          brand.is_active
                            ? dark ? "bg-[#16a34a]/15 text-[#4ade80]" : "bg-[#e8f7ee] text-[#16a34a]"
                            : dark ? "bg-[#64748b]/15 text-[#94a3b8]" : "bg-[#f1f5f9] text-[#64748b]"
                        )}>{brand.is_active ? "Active" : "Hidden"}</span>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        {brand.logo_url ? <CheckCircle2 className="w-4 h-4 text-[#16a34a]" /> : <XCircle className="w-4 h-4 text-[#ef4444] opacity-50" />}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => openDetail(brand)} title="View" className="p-1.5 rounded-lg hover:bg-[#2563eb]/10 text-[#2563eb] transition-colors"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => openEdit(brand)} title="Edit" className="p-1.5 rounded-lg hover:bg-[#2563eb]/10 text-[#2563eb] transition-colors"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => handleDuplicate(brand)} title="Duplicate" className={cn("p-1.5 rounded-lg transition-colors", dark ? "hover:bg-white/10 text-[#8b95a3]" : "hover:bg-black/5 text-[#8a929c]")}><Copy className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(brand.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-[#ef4444] transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {brands.length === 0 && (
                    <tr><td colSpan={9} className={cn("p-12 text-center", sub)}>
                      <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-semibold">No brands found</p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className={cn("flex items-center justify-between px-4 py-3 border-t", brd)}>
              <p className={cn("text-[12px]", sub)}>{total} brand{total !== 1 ? "s" : ""} · Page {page}/{totalPages}</p>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30", hover)}><ChevronLeft className="w-4 h-4" /></button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pn: number;
                  if (totalPages <= 5) pn = i + 1;
                  else if (page <= 3) pn = i + 1;
                  else if (page >= totalPages - 2) pn = totalPages - 4 + i;
                  else pn = page - 2 + i;
                  return <button key={pn} onClick={() => setPage(pn)} className={cn("w-8 h-8 rounded-lg text-[12px] font-semibold transition-colors", page === pn ? "bg-[#2563eb] text-white" : cn(txt, hover))}>{pn}</button>;
                })}
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30", hover)}><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* CREATE / EDIT DRAWER */}
      {formOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" onClick={() => setFormOpen(false)} />
          <div className={cn("absolute top-0 right-0 h-full w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right duration-200", dark ? "bg-[#171c24]" : "bg-white")}>
            <div className={cn("flex items-center justify-between px-6 py-4 border-b shrink-0", brd)}>
              <h2 className={cn("text-[18px] font-extrabold", txt)}>{editBrand ? "Edit Brand" : "Add Brand"}</h2>
              <button onClick={() => setFormOpen(false)} className={cn("h-8 w-8 rounded-full flex items-center justify-center", hover)}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className={cn("rounded-[12px] border p-3 flex items-start gap-2", dark ? "bg-[#1a1f2a] border-[#2a3040]" : "bg-[#fffbeb] border-[#fde68a]")}>
                <ShieldCheck className="w-4 h-4 mt-0.5 text-[#d97706] shrink-0" />
                <p className={cn("text-[12px]", dark ? "text-[#fbbf24]" : "text-[#92400e]")}>
                  Only add brands you are authorized to sell. Protected brands (Nike, Adidas, etc.) require legal authorization. Use private labels or CJ Dropshipping authorized brands.
                </p>
              </div>
              <div>
                <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Brand Name *</label>
                <input value={formName} onChange={e => { setFormName(e.target.value); if (!editBrand) setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")); }} className={inpCls} placeholder="Brand name" />
              </div>
              <div>
                <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Slug</label>
                <input value={formSlug} onChange={e => setFormSlug(e.target.value)} className={inpCls} placeholder="brand-name" />
              </div>
              <div>
                <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Logo URL</label>
                <input value={formLogoUrl} onChange={e => setFormLogoUrl(e.target.value)} className={inpCls} placeholder="https://..." />
                {formLogoUrl && (
                  <div className={cn("mt-2 w-20 h-20 rounded-[10px] overflow-hidden border flex items-center justify-center", brd, dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <img src={formLogoUrl} alt="" className="max-w-full max-h-full object-contain p-2" onError={e => (e.currentTarget.style.display = "none")} />
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formIsActive} onChange={e => setFormIsActive(e.target.checked)} className="rounded" />
                <span className={cn("text-sm font-semibold", txt)}>Active (visible on storefront)</span>
              </label>
            </div>
            <div className={cn("px-6 py-4 border-t shrink-0", brd)}>
              <div className="flex gap-3">
                <button onClick={() => setFormOpen(false)} className={cn("flex-1 h-[44px] rounded-[11px] border text-sm font-semibold", brd, txt, hover)}>Cancel</button>
                <button onClick={handleSave} disabled={formSaving || !formName} className="flex-1 h-[44px] rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {formSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {formSaving ? "Saving..." : editBrand ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL PANEL */}
      {detailBrand && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" onClick={() => setDetailBrand(null)} />
          <div className={cn("absolute top-0 right-0 h-full w-full max-w-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-200", dark ? "bg-[#171c24]" : "bg-white")}>
            <div className={cn("flex items-center justify-between px-6 py-4 border-b shrink-0", brd)}>
              <div className="flex items-center gap-3">
                {detailBrand.logo_url && (
                  <div className={cn("w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <img src={detailBrand.logo_url} alt="" className="max-w-full max-h-full object-contain p-1" />
                  </div>
                )}
                <div>
                  <h2 className={cn("text-[16px] font-extrabold", txt)}>{detailBrand.name}</h2>
                  <p className={cn("text-[11px]", sub)}>/{detailBrand.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setDetailBrand(null); openEdit(detailBrand); }} className="h-8 px-3 rounded-lg bg-[#2563eb] text-white text-[12px] font-semibold hover:bg-[#1d4ed8] transition-colors flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={() => setDetailBrand(null)} className={cn("h-8 w-8 rounded-full flex items-center justify-center", hover)}><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className={cn("flex overflow-x-auto px-6 border-b shrink-0", brd)}>
              {(["general", "products", "categories", "analytics"] as DetailTab[]).map(tab => (
                <button key={tab} onClick={() => setDetailTab(tab)}
                  className={cn("px-4 py-3 text-[12px] font-semibold capitalize whitespace-nowrap border-b-2 transition-colors",
                    detailTab === tab ? "border-[#2563eb] text-[#2563eb]" : cn("border-transparent", sub, "hover:text-[#2563eb]")
                  )}>{tab}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {detailLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" /></div>
              ) : (
                <BrandDetailContent tab={detailTab} brand={detailBrand} data={detailData} dark={dark} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={cn("fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200",
          toast.type === "success" && "bg-[#16a34a]", toast.type === "error" && "bg-[#ef4444]", toast.type === "info" && "bg-[#2563eb]"
        )}>{toast.message}</div>
      )}
    </div>
  );
}

function SortTH({ label, sortKey, currentKey, order, onSort, dark, className }: {
  label: string; sortKey: SortKey; currentKey: SortKey; order: SortOrder;
  onSort: (k: SortKey) => void; dark: boolean; className?: string;
}) {
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const active = currentKey === sortKey;
  return (
    <th className={cn("text-left p-3", className)}>
      <button onClick={() => onSort(sortKey)} className={cn("text-[11px] font-bold uppercase tracking-wider flex items-center gap-1", active ? "text-[#2563eb]" : sub)}>
        {label}
        {active ? (order === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );
}

function BrandDetailContent({ tab, brand, data, dark }: {
  tab: DetailTab; brand: BrandRow; data: Record<string, unknown> | null; dark: boolean;
}) {
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";

  const detail = data || {};
  const products = (detail.products as Product[]) || [];
  const categories = (detail.categories as string[]) || [];
  const salesStats = detail.salesStats as { totalSold: number; totalRevenue: number; topProduct: string } | undefined;
  const reviewStats = detail.reviewStats as { avgRating: number; totalReviews: number } | undefined;

  switch (tab) {
    case "general":
      return (
        <div className="space-y-5">
          <Field label="Name" value={brand.name} dark={dark} />
          <Field label="Slug" value={`/${brand.slug}`} dark={dark} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status" value={brand.is_active ? "Active" : "Hidden"} dark={dark} />
            <Field label="Products" value={String(brand.productCount)} dark={dark} />
          </div>
          <Field label="Created" value={new Date(brand.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} dark={dark} />
          {brand.logo_url && (
            <div>
              <p className={cn("text-[11px] font-semibold uppercase tracking-wider mb-2", sub)}>Logo</p>
              <div className={cn("w-24 h-24 rounded-[12px] overflow-hidden border flex items-center justify-center", brd, dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                <img src={brand.logo_url} alt="" className="max-w-full max-h-full object-contain p-2" />
              </div>
            </div>
          )}
        </div>
      );

    case "products":
      return (
        <div>
          <h3 className={cn("text-sm font-bold mb-4", txt)}>{products.length} Product{products.length !== 1 ? "s" : ""}</h3>
          {products.length > 0 ? (
            <div className="space-y-2">
              {products.map((prod: Product) => (
                <div key={prod.id} className={cn("flex items-center gap-3 py-2.5 px-3 rounded-[10px] border", brd)}>
                  <div className={cn("w-9 h-9 rounded-lg shrink-0 overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    {prod.images?.[0] ? <img src={prod.images[0]} alt="" className="w-9 h-9 object-cover" /> : <Package className="w-4 h-4 opacity-30 m-auto mt-2.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold truncate", txt)}>{prod.name}</p>
                    <p className={cn("text-[11px]", sub)}>${prod.price.toFixed(2)} · {prod.variants?.reduce((s, v) => s + v.stock, 0) || 0} in stock</p>
                  </div>
                  <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded",
                    prod.status === "active" ? (dark ? "bg-[#16a34a]/15 text-[#4ade80]" : "bg-[#e8f7ee] text-[#16a34a]") : (dark ? "bg-[#64748b]/15 text-[#94a3b8]" : "bg-[#f1f5f9] text-[#64748b]")
                  )}>{prod.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={cn("text-center py-12", sub)}>
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No products for this brand</p>
            </div>
          )}
        </div>
      );

    case "categories":
      return (
        <div>
          <h3 className={cn("text-sm font-bold mb-4", txt)}>Categories with {brand.name} products</h3>
          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat, i) => (
                <span key={i} className={cn("px-3 py-1.5 rounded-lg text-[12px] font-semibold border", brd, txt)}>{cat}</span>
              ))}
            </div>
          ) : (
            <p className={cn("text-sm", sub)}>No categories found.</p>
          )}
        </div>
      );

    case "analytics":
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={cn("rounded-[12px] border p-4 text-center", brd)}>
              <p className={cn("text-[22px] font-extrabold", txt)}>{brand.productCount}</p>
              <p className={cn("text-[11px] font-semibold mt-1", sub)}>Products</p>
            </div>
            <div className={cn("rounded-[12px] border p-4 text-center", brd)}>
              <p className={cn("text-[22px] font-extrabold", txt)}>{salesStats?.totalSold || 0}</p>
              <p className={cn("text-[11px] font-semibold mt-1", sub)}>Units Sold</p>
            </div>
            <div className={cn("rounded-[12px] border p-4 text-center", brd)}>
              <p className={cn("text-[22px] font-extrabold", txt)}>${(salesStats?.totalRevenue || 0).toFixed(0)}</p>
              <p className={cn("text-[11px] font-semibold mt-1", sub)}>Revenue</p>
            </div>
            <div className={cn("rounded-[12px] border p-4 text-center", brd)}>
              {reviewStats && reviewStats.avgRating > 0 ? (
                <>
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-4 h-4 text-[#eab308] fill-[#eab308]" />
                    <p className={cn("text-[22px] font-extrabold", txt)}>{reviewStats.avgRating.toFixed(1)}</p>
                  </div>
                  <p className={cn("text-[11px] font-semibold mt-1", sub)}>{reviewStats.totalReviews} reviews</p>
                </>
              ) : (
                <>
                  <p className={cn("text-[22px] font-extrabold", txt)}>—</p>
                  <p className={cn("text-[11px] font-semibold mt-1", sub)}>No reviews</p>
                </>
              )}
            </div>
          </div>
          {salesStats?.topProduct && <Field label="Top Product" value={salesStats.topProduct} dark={dark} />}
        </div>
      );

    default:
      return <p className={cn("text-sm", sub)}>Coming soon.</p>;
  }
}

function Field({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  return (
    <div>
      <p className={cn("text-[11px] font-semibold uppercase tracking-wider mb-1", sub)}>{label}</p>
      <p className={cn("text-sm", txt)}>{value}</p>
    </div>
  );
}
