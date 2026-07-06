"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  Search, ChevronLeft, ChevronRight, Edit3, Eye, Download, RefreshCw,
  X, ChevronDown, ChevronUp, Loader2, Package, SlidersHorizontal,
  ArrowUpDown, AlertTriangle, XCircle, TrendingUp, DollarSign,
  CheckCircle2, Clock, Archive, Minus, Plus, BarChart3, Layers,
  Truck, ShieldCheck, Box, Tag, History, Settings2, Zap,
  ArrowDownUp, ArrowRightLeft, Filter, FileDown, FileUp, ClipboardList
} from "lucide-react";

type Props = { dark: boolean };
type SortKey = "name" | "stock" | "price" | "sku" | "updated_at";
type SortOrder = "asc" | "desc";
type DetailTab = "general" | "variants" | "stock" | "movements" | "analytics";

interface InventoryKpis {
  totalProducts: number;
  totalVariants: number;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  outOfStock: number;
  lowStock: number;
  inventoryValue: number;
  inventoryCost: number;
  potentialRevenue: number;
  avgStockPerVariant: number;
  stockAccuracy: number;
}

interface InventoryRow {
  variant_id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  sku: string;
  size: string;
  color: string;
  color_hex: string;
  stock: number;
  price: number;
  compare_price: number | null;
  category_name: string;
  brand_name: string;
  status: string;
  reserved: number;
  available: number;
  inventory_value: number;
  updated_at: string;
}

interface Movement {
  id: string;
  type: string;
  quantity: number;
  order_id: string;
  order_status: string;
  date: string;
  product_name: string;
  variant_info: string;
}

const defaultKpis: InventoryKpis = {
  totalProducts: 0, totalVariants: 0, totalStock: 0, reservedStock: 0,
  availableStock: 0, outOfStock: 0, lowStock: 0, inventoryValue: 0,
  inventoryCost: 0, potentialRevenue: 0, avgStockPerVariant: 0, stockAccuracy: 0,
};

const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
const fmtCurrency = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export function AdminInventory({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");
  const badge = (color: string) => cn("px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase", color);

  const [kpis, setKpis] = useState<InventoryKpis>(defaultKpis);
  const [items, setItems] = useState<InventoryRow[]>([]);
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
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("general");
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustVariantId, setAdjustVariantId] = useState<string | null>(null);
  const [adjustVariantLabel, setAdjustVariantLabel] = useState("");
  const [adjustValue, setAdjustValue] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustMode, setAdjustMode] = useState<"set" | "add" | "reduce">("set");
  const [adjustSaving, setAdjustSaving] = useState(false);

  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch filter options
  useEffect(() => {
    const supaFetch = async () => {
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
    supaFetch();
  }, []);

  const fetchKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const res = await fetch("/api/admin/inventory?section=kpis");
      if (!res.ok) throw new Error("Failed");
      setKpis(await res.json());
    } catch { /* silent */ } finally { setKpisLoading(false); }
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), per_page: String(perPage), sort: sortKey, order: sortOrder });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category_id", categoryFilter);
      if (brandFilter !== "all") params.set("brand_id", brandFilter);
      const res = await fetch(`/api/admin/inventory?${params}`);
      if (!res.ok) throw new Error("Failed to load inventory");
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }, [page, perPage, search, statusFilter, categoryFilter, brandFilter, sortKey, sortOrder]);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);
  useEffect(() => { fetchItems(); }, [fetchItems]);

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

  const allSelected = items.length > 0 && items.every(i => selected.has(i.variant_id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.variant_id)));
  };

  // Detail panel
  const openDetail = async (productId: string) => {
    setDetailProductId(productId);
    setDetailTab("general");
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetch(`/api/admin/inventory?section=detail&product_id=${productId}`);
      if (res.ok) setDetailData(await res.json());
    } catch { /* silent */ } finally { setDetailLoading(false); }
  };

  const fetchMovements = async (productId: string) => {
    setMovementsLoading(true);
    try {
      const res = await fetch(`/api/admin/inventory?section=movements&product_id=${productId}`);
      if (res.ok) { const d = await res.json(); setMovements(d.movements || []); }
    } catch { /* silent */ } finally { setMovementsLoading(false); }
  };

  // Adjust stock
  const openAdjust = (variantId: string, label: string, currentStock: number) => {
    setAdjustVariantId(variantId);
    setAdjustVariantLabel(label);
    setAdjustValue(currentStock);
    setAdjustMode("set");
    setAdjustReason("");
    setAdjustOpen(true);
  };

  const handleAdjust = async () => {
    if (!adjustVariantId) return;
    setAdjustSaving(true);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant_id: adjustVariantId,
          adjustment: adjustMode === "set" ? adjustValue : adjustMode === "add" ? adjustValue : -adjustValue,
          mode: adjustMode,
          reason: adjustReason,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast("Stock adjusted successfully");
      setAdjustOpen(false);
      fetchItems();
      fetchKpis();
      if (detailProductId) openDetail(detailProductId);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    } finally { setAdjustSaving(false); }
  };

  // Bulk actions
  const handleBulk = async (action: string) => {
    if (selected.size === 0) return;
    try {
      const body: Record<string, unknown> = { ids: Array.from(selected), action };
      if (action === "mark_out_of_stock") body.action = "mark_out_of_stock";
      const res = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`Bulk ${action.replace(/_/g, " ")} completed`);
      setSelected(new Set());
      fetchItems();
      fetchKpis();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  // Export
  const handleExport = async (format: "csv" | "json") => {
    try {
      const res = await fetch(`/api/admin/inventory?section=export`);
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const exportItems = data.items || [];
      if (format === "json") {
        const blob = new Blob([JSON.stringify(exportItems, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "inventory.json"; a.click();
        URL.revokeObjectURL(url);
      } else {
        if (exportItems.length === 0) return;
        const headers = Object.keys(exportItems[0]);
        const csv = [headers.join(","), ...exportItems.map((r: Record<string, unknown>) => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "inventory.csv"; a.click();
        URL.revokeObjectURL(url);
      }
      showToast(`Exported as ${format.toUpperCase()}`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Export error", "error");
    }
  };

  // Skeleton
  const Skeleton = ({ w = "100%", h = 14 }: { w?: string | number; h?: number }) => (
    <div className={cn("rounded-[6px] animate-pulse", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} style={{ width: w, height: h }} />
  );

  // Status badge
  const stockBadge = (stock: number, reserved: number) => {
    const avail = stock - reserved;
    if (stock === 0) return <span className={badge("bg-red-500/10 text-red-500")}>Out of Stock</span>;
    if (avail <= 0) return <span className={badge("bg-orange-500/10 text-orange-500")}>Reserved</span>;
    if (stock <= 5) return <span className={badge("bg-amber-500/10 text-amber-500")}>Low Stock</span>;
    return <span className={badge("bg-emerald-500/10 text-emerald-500")}>In Stock</span>;
  };

  // KPI config
  const kpiCards = useMemo(() => [
    { label: "Total Products", value: fmt(kpis.totalProducts), icon: Package, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Total Variants", value: fmt(kpis.totalVariants), icon: Layers, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Total Stock", value: fmt(kpis.totalStock), icon: Box, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { label: "Reserved Stock", value: fmt(kpis.reservedStock), icon: Clock, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Available Stock", value: fmt(kpis.availableStock), icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Out of Stock", value: fmt(kpis.outOfStock), icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Low Stock", value: fmt(kpis.lowStock), icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Inventory Value", value: fmtCurrency(kpis.inventoryValue), icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Inventory Cost", value: fmtCurrency(kpis.inventoryCost), icon: Tag, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Potential Revenue", value: fmtCurrency(kpis.potentialRevenue), icon: TrendingUp, color: "text-teal-500", bg: "bg-teal-500/10" },
    { label: "Avg Stock / Variant", value: fmt(Math.round(kpis.avgStockPerVariant)), icon: BarChart3, color: "text-sky-500", bg: "bg-sky-500/10" },
    { label: "Stock Accuracy", value: fmtPct(kpis.stockAccuracy), icon: ShieldCheck, color: "text-lime-500", bg: "bg-lime-500/10" },
  ], [kpis]);

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={cn("text-[22px] font-extrabold tracking-[-.02em]", txt)}>Inventory</h1>
          <p className={cn("text-sm mt-0.5", sub)}>Monitor and manage your inventory across all products.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleExport("csv")} className={cn("h-9 px-3.5 rounded-[10px] text-[13px] font-semibold border flex items-center gap-1.5 transition-colors", brd, sub, hover)}>
            <FileDown className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={() => handleExport("json")} className={cn("h-9 px-3.5 rounded-[10px] text-[13px] font-semibold border flex items-center gap-1.5 transition-colors", brd, sub, hover)}>
            <Download className="w-3.5 h-3.5" /> Export JSON
          </button>
          <button onClick={() => { fetchItems(); fetchKpis(); }} className={cn("h-9 px-3.5 rounded-[10px] text-[13px] font-semibold border flex items-center gap-1.5 transition-colors", brd, sub, hover)}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
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
            <input
              type="text"
              placeholder="Search by product name, SKU, variant..."
              className={cn(inpCls, "pl-9")}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={cn("h-[42px] px-4 rounded-[11px] text-[13px] font-semibold border flex items-center gap-2 transition-colors", brd, sub, hover, showFilters && "border-[#2563eb] text-[#2563eb]")}>
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={inpCls}>
              <option value="all">All Statuses</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
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
          <button onClick={() => handleBulk("mark_out_of_stock")} className="h-8 px-3 rounded-[8px] text-[12px] font-semibold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Mark Out of Stock
          </button>
          <button onClick={() => handleBulk("add_stock")} className="h-8 px-3 rounded-[8px] text-[12px] font-semibold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Stock (+10)
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
            <button onClick={fetchItems} className="mt-3 text-sm text-[#2563eb] font-semibold hover:underline">Retry</button>
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
                    <span className="flex items-center gap-1">Product / Variant <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className={cn("p-3 text-left font-semibold cursor-pointer select-none", sub)} onClick={() => handleSort("sku")}>
                    <span className="flex items-center gap-1">SKU <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className={cn("p-3 text-left font-semibold", sub)}>Category</th>
                  <th className={cn("p-3 text-left font-semibold", sub)}>Brand</th>
                  <th className={cn("p-3 text-right font-semibold cursor-pointer select-none", sub)} onClick={() => handleSort("stock")}>
                    <span className="flex items-center justify-end gap-1">Stock <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className={cn("p-3 text-right font-semibold", sub)}>Reserved</th>
                  <th className={cn("p-3 text-right font-semibold", sub)}>Available</th>
                  <th className={cn("p-3 text-right font-semibold cursor-pointer select-none", sub)} onClick={() => handleSort("price")}>
                    <span className="flex items-center justify-end gap-1">Value <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className={cn("p-3 text-left font-semibold", sub)}>Status</th>
                  <th className={cn("p-3 text-center font-semibold", sub)}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className={cn("border-b", brd)}>
                    <td className="p-3"><Skeleton w={16} h={16} /></td>
                    <td className="p-3"><Skeleton w={36} h={36} /></td>
                    <td className="p-3"><Skeleton w="80%" /><Skeleton w="50%" h={10} /></td>
                    <td className="p-3"><Skeleton w={60} /></td>
                    <td className="p-3"><Skeleton w={50} /></td>
                    <td className="p-3"><Skeleton w={50} /></td>
                    <td className="p-3"><Skeleton w={30} /></td>
                    <td className="p-3"><Skeleton w={30} /></td>
                    <td className="p-3"><Skeleton w={30} /></td>
                    <td className="p-3"><Skeleton w={50} /></td>
                    <td className="p-3"><Skeleton w={60} /></td>
                    <td className="p-3"><Skeleton w={50} /></td>
                  </tr>
                )) : items.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-12 text-center">
                      <Package className={cn("w-10 h-10 mx-auto mb-2", sub)} />
                      <p className={cn("text-sm font-semibold", txt)}>No inventory items found</p>
                      <p className={cn("text-xs mt-1", sub)}>Adjust your search or filters</p>
                    </td>
                  </tr>
                ) : items.map(item => (
                  <tr key={item.variant_id} className={cn("border-b transition-colors", brd, hover, selected.has(item.variant_id) && (dark ? "bg-blue-500/5" : "bg-blue-50/50"))}>
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(item.variant_id)} onChange={() => {
                        const s = new Set(selected);
                        s.has(item.variant_id) ? s.delete(item.variant_id) : s.add(item.variant_id);
                        setSelected(s);
                      }} className="rounded" />
                    </td>
                    <td className="p-3">
                      {item.product_image ? (
                        <img src={item.product_image} alt="" className="w-9 h-9 rounded-[8px] object-cover" />
                      ) : (
                        <div className={cn("w-9 h-9 rounded-[8px] flex items-center justify-center", dark ? "bg-[#252c36]" : "bg-[#f0f2f5]")}>
                          <Package className={cn("w-4 h-4", sub)} />
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <button onClick={() => openDetail(item.product_id)} className={cn("text-sm font-semibold text-left hover:text-[#2563eb] transition-colors", txt)}>{item.product_name}</button>
                      <p className={cn("text-xs mt-0.5", sub)}>
                        {item.size && `Size: ${item.size}`}
                        {item.size && item.color && " · "}
                        {item.color && (
                          <span className="inline-flex items-center gap-1">
                            {item.color_hex && <span className="w-2.5 h-2.5 rounded-full inline-block border border-black/10" style={{ background: item.color_hex }} />}
                            {item.color}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className={cn("p-3 font-mono text-xs", sub)}>{item.sku || "—"}</td>
                    <td className={cn("p-3 text-xs", sub)}>{item.category_name || "—"}</td>
                    <td className={cn("p-3 text-xs", sub)}>{item.brand_name || "—"}</td>
                    <td className={cn("p-3 text-right font-bold tabular-nums", txt)}>{item.stock}</td>
                    <td className={cn("p-3 text-right tabular-nums", item.reserved > 0 ? "text-orange-500 font-semibold" : sub)}>{item.reserved}</td>
                    <td className={cn("p-3 text-right tabular-nums font-semibold", item.available <= 0 ? "text-red-500" : item.available <= 5 ? "text-amber-500" : "text-emerald-500")}>{item.available}</td>
                    <td className={cn("p-3 text-right text-xs tabular-nums", sub)}>{fmtCurrency(item.inventory_value)}</td>
                    <td className="p-3">{stockBadge(item.stock, item.reserved)}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openDetail(item.product_id)} className={cn("w-7 h-7 rounded-[7px] flex items-center justify-center transition-colors", hover)} title="View">
                          <Eye className={cn("w-3.5 h-3.5", sub)} />
                        </button>
                        <button onClick={() => openAdjust(item.variant_id, `${item.product_name} (${item.size || ""} ${item.color || ""})`.trim(), item.stock)} className={cn("w-7 h-7 rounded-[7px] flex items-center justify-center transition-colors", hover)} title="Adjust Stock">
                          <Edit3 className={cn("w-3.5 h-3.5", sub)} />
                        </button>
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
            <p className={cn("text-xs", sub)}>
              Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors disabled:opacity-30", hover)}>
                <ChevronLeft className={cn("w-4 h-4", sub)} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const pg = start + i;
                if (pg > totalPages) return null;
                return (
                  <button key={pg} onClick={() => setPage(pg)} className={cn("w-8 h-8 rounded-[8px] text-xs font-semibold transition-colors", pg === page ? "bg-[#2563eb] text-white" : cn(sub, hover))}>
                    {pg}
                  </button>
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
      <Drawer open={!!detailProductId} onClose={() => setDetailProductId(null)} title="Inventory Details" className={dark ? "!bg-[#171c24] !text-[#e7ebf0]" : ""}>
        {detailLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" /></div>
        ) : detailData ? (
          <div className="space-y-4">
            {/* Tabs */}
            <div className={cn("flex gap-1 p-1 rounded-[10px]", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
              {(["general", "variants", "stock", "movements", "analytics"] as DetailTab[]).map(tab => (
                <button key={tab} onClick={() => {
                  setDetailTab(tab);
                  if (tab === "movements" && detailProductId) fetchMovements(detailProductId);
                }} className={cn("flex-1 h-8 rounded-[8px] text-xs font-semibold transition-colors capitalize", detailTab === tab ? "bg-[#2563eb] text-white" : cn(sub, hover))}>
                  {tab}
                </button>
              ))}
            </div>

            {/* General Tab */}
            {detailTab === "general" && (() => {
              const d = detailData as Record<string, any>;
              const product = d.product || {};
              return (
                <div className="space-y-3">
                  {product.images?.[0] && <img src={product.images[0]} alt="" className="w-full h-40 object-cover rounded-[12px]" />}
                  <div className="space-y-2">
                    <InfoRow dark={dark} label="Name" value={product.name} />
                    <InfoRow dark={dark} label="Status" value={product.status} />
                    <InfoRow dark={dark} label="Category" value={d.category_name || "—"} />
                    <InfoRow dark={dark} label="Brand" value={d.brand_name || "—"} />
                    <InfoRow dark={dark} label="Price" value={product.price ? fmtCurrency(product.price) : "—"} />
                    <InfoRow dark={dark} label="Compare Price" value={product.compare_price ? fmtCurrency(product.compare_price) : "—"} />
                    <InfoRow dark={dark} label="Created" value={product.created_at ? new Date(product.created_at).toLocaleDateString() : "—"} />
                  </div>
                </div>
              );
            })()}

            {/* Variants Tab */}
            {detailTab === "variants" && (() => {
              const d = detailData as Record<string, any>;
              const variants: any[] = d.variants || [];
              return (
                <div className="space-y-2">
                  {variants.length === 0 ? (
                    <p className={cn("text-sm text-center py-6", sub)}>No variants</p>
                  ) : variants.map((v: any) => (
                    <div key={v.id} className={cn("rounded-[12px] border p-3 flex items-center gap-3", p, brd)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {v.color_hex && <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: v.color_hex }} />}
                          <span className={cn("text-sm font-semibold", txt)}>{v.color || "—"} / {v.size || "—"}</span>
                        </div>
                        <p className={cn("text-xs mt-0.5 font-mono", sub)}>{v.sku || "No SKU"}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-bold tabular-nums", v.stock <= 0 ? "text-red-500" : v.stock <= 5 ? "text-amber-500" : "text-emerald-500")}>{v.stock}</p>
                        <p className={cn("text-[10px]", sub)}>in stock</p>
                      </div>
                      <button onClick={() => openAdjust(v.id, `${v.color || ""} / ${v.size || ""}`, v.stock)} className={cn("w-7 h-7 rounded-[7px] flex items-center justify-center transition-colors shrink-0", hover)}>
                        <Edit3 className={cn("w-3.5 h-3.5", sub)} />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Stock Tab */}
            {detailTab === "stock" && (() => {
              const d = detailData as Record<string, any>;
              const summary = d.stockSummary || {};
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard dark={dark} label="Total Stock" value={fmt(summary.totalStock || 0)} color="text-blue-500" />
                    <StatCard dark={dark} label="Reserved" value={fmt(summary.reservedStock || 0)} color="text-orange-500" />
                    <StatCard dark={dark} label="Available" value={fmt(summary.availableStock || 0)} color="text-emerald-500" />
                    <StatCard dark={dark} label="Variants" value={fmt(summary.variantCount || 0)} color="text-indigo-500" />
                    <StatCard dark={dark} label="Out of Stock" value={fmt(summary.outOfStockVariants || 0)} color="text-red-500" />
                    <StatCard dark={dark} label="Inventory Value" value={fmtCurrency(summary.inventoryValue || 0)} color="text-green-500" />
                  </div>
                  {/* Per-variant stock */}
                  <h3 className={cn("text-xs font-bold uppercase tracking-wider mt-3", sub)}>Per Variant</h3>
                  {(d.variants || []).map((v: any) => (
                    <div key={v.id} className={cn("flex items-center justify-between py-2 border-b", brd)}>
                      <div>
                        <span className={cn("text-xs font-semibold", txt)}>{v.color || "—"} / {v.size || "—"}</span>
                        <span className={cn("text-[10px] ml-2 font-mono", sub)}>{v.sku}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("text-xs", sub)}>Reserved: {v.reserved || 0}</span>
                        <span className={cn("text-sm font-bold tabular-nums", v.stock <= 0 ? "text-red-500" : "text-emerald-500")}>{v.stock}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Movements Tab */}
            {detailTab === "movements" && (
              <div className="space-y-2">
                {movementsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#2563eb]" /></div>
                ) : movements.length === 0 ? (
                  <p className={cn("text-sm text-center py-6", sub)}>No movements recorded</p>
                ) : movements.map((m) => (
                  <div key={m.id} className={cn("rounded-[10px] border p-3", p, brd)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                          m.order_status === "cancelled" || m.order_status === "refunded" ? "bg-green-500/10 text-green-500" : "bg-blue-500/10 text-blue-500"
                        )}>
                          {m.order_status === "cancelled" || m.order_status === "refunded" ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <p className={cn("text-xs font-semibold", txt)}>
                            {m.order_status === "cancelled" || m.order_status === "refunded" ? "Return" : "Sale"} — Order #{m.order_id.slice(0, 8)}
                          </p>
                          <p className={cn("text-[10px]", sub)}>{m.variant_info}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-bold tabular-nums", m.order_status === "cancelled" || m.order_status === "refunded" ? "text-green-500" : "text-blue-500")}>
                          {m.order_status === "cancelled" || m.order_status === "refunded" ? "+" : "-"}{m.quantity}
                        </p>
                        <p className={cn("text-[10px]", sub)}>{new Date(m.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="mt-1.5">
                      <span className={badge(
                        m.order_status === "delivered" ? "bg-emerald-500/10 text-emerald-500" :
                        m.order_status === "shipped" ? "bg-blue-500/10 text-blue-500" :
                        m.order_status === "processing" ? "bg-amber-500/10 text-amber-500" :
                        m.order_status === "cancelled" ? "bg-red-500/10 text-red-500" :
                        m.order_status === "refunded" ? "bg-purple-500/10 text-purple-500" :
                        "bg-gray-500/10 text-gray-500"
                      )}>{m.order_status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Analytics Tab */}
            {detailTab === "analytics" && (() => {
              const d = detailData as Record<string, any>;
              const stats = d.salesStats || {};
              const reviews = d.reviewStats || {};
              return (
                <div className="space-y-3">
                  <h3 className={cn("text-xs font-bold uppercase tracking-wider", sub)}>Sales</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard dark={dark} label="Total Sold" value={fmt(stats.totalSold || 0)} color="text-blue-500" />
                    <StatCard dark={dark} label="Revenue" value={fmtCurrency(stats.totalRevenue || 0)} color="text-green-500" />
                  </div>
                  <h3 className={cn("text-xs font-bold uppercase tracking-wider mt-3", sub)}>Reviews</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard dark={dark} label="Total Reviews" value={String(reviews.totalReviews || 0)} color="text-amber-500" />
                    <StatCard dark={dark} label="Avg Rating" value={(reviews.avgRating || 0).toFixed(1)} color="text-yellow-500" />
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <p className={cn("text-sm text-center py-6", sub)}>No data</p>
        )}
      </Drawer>

      {/* ADJUST STOCK DRAWER */}
      <Drawer open={adjustOpen} onClose={() => setAdjustOpen(false)} title="Adjust Stock" className={dark ? "!bg-[#171c24] !text-[#e7ebf0]" : ""}>
        <div className="space-y-4">
          <div>
            <label className={cn("text-xs font-semibold block mb-1.5", sub)}>Variant</label>
            <p className={cn("text-sm font-semibold", txt)}>{adjustVariantLabel}</p>
          </div>
          <div>
            <label className={cn("text-xs font-semibold block mb-1.5", sub)}>Mode</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["set", "add", "reduce"] as const).map(m => (
                <button key={m} onClick={() => setAdjustMode(m)} className={cn("h-9 rounded-[9px] text-xs font-semibold transition-colors capitalize", adjustMode === m ? "bg-[#2563eb] text-white" : cn("border", brd, sub, hover))}>
                  {m === "set" ? "Set to" : m === "add" ? "Add" : "Reduce"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={cn("text-xs font-semibold block mb-1.5", sub)}>
              {adjustMode === "set" ? "New Stock Value" : adjustMode === "add" ? "Quantity to Add" : "Quantity to Remove"}
            </label>
            <input type="number" min={0} value={adjustValue} onChange={e => setAdjustValue(Math.max(0, parseInt(e.target.value) || 0))} className={inpCls} />
          </div>
          <div>
            <label className={cn("text-xs font-semibold block mb-1.5", sub)}>Reason (optional)</label>
            <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="e.g. Restock, Correction, Sync..." className={inpCls} />
          </div>
          <button onClick={handleAdjust} disabled={adjustSaving} className="w-full h-[42px] rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {adjustSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {adjustSaving ? "Saving..." : "Apply Adjustment"}
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
