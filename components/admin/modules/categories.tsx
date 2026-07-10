"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Search, Plus, ChevronLeft, ChevronRight, Edit3, Trash2, Eye, Copy, Archive,
  Download, RefreshCw, X, ChevronDown, ChevronUp, ChevronRight as ChevRight,
  FolderOpen, FolderTree, CheckCircle2, EyeOff, Star, TrendingUp,
  ImageIcon, Globe, BarChart3, ArrowUpDown, Layers, DollarSign,
  Loader2, Package, SlidersHorizontal, GripVertical, LayoutGrid, List,
  Hash, Tag, AlertTriangle, XCircle,
  Zap, Filter, Menu, Home, Upload
} from "lucide-react";
import type { Category, Product, ProductVariant } from "@/types";

type Props = { dark: boolean };
type SortKey = "name" | "created_at" | "products_count";
type SortOrder = "asc" | "desc";
type ViewMode = "table" | "tree";
type DetailTab = "general" | "banner" | "seo" | "products" | "analytics";

interface CategoryKpis {
  totalCategories: number;
  activeCategories: number;
  hiddenCategories: number;
  rootCategories: number;
  subcategories: number;
  categoriesWithoutProducts: number;
  categoriesWithoutImage: number;
  highestRevenueCategory: { name: string; revenue: number } | null;
  mostProductsCategory: { name: string; count: number } | null;
}

interface CategoryRow extends Category {
  productCount: number;
  childrenCount: number;
  level: number;
  revenue: number;
}

interface TreeNode {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  is_active: boolean;
  parent_id: string | null;
  productCount: number;
  children: TreeNode[];
}

const defaultKpis: CategoryKpis = {
  totalCategories: 0, activeCategories: 0, hiddenCategories: 0,
  rootCategories: 0, subcategories: 0, categoriesWithoutProducts: 0,
  categoriesWithoutImage: 0, highestRevenueCategory: null, mostProductsCategory: null,
};

const FILTER_ATTRIBUTES = ["Brand", "Color", "Size", "Material", "Storage", "RAM", "Gender", "Capacity", "Style"];

const emptyForm = {
  name: "", slug: "", parent_id: "", category_type: "physical", sort_order: "0",
  is_active: true, banner_url: "", icon_url: "", cover_url: "",
  meta_title: "", meta_description: "", filter_attributes: [] as string[],
  is_featured: false, show_in_nav: true, show_on_homepage: false,
};
type CategoryForm = typeof emptyForm;

function slugifyClient(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function AdminCategories({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");

  // Data
  const [kpis, setKpis] = useState<CategoryKpis>(defaultKpis);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [parentFilter, setParentFilter] = useState("all");
  const [hasProductsFilter, setHasProductsFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Detail
  const [detailCategory, setDetailCategory] = useState<CategoryRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("general");
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>({ ...emptyForm });
  const [formSaving, setFormSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const setField = <K extends keyof CategoryForm>(k: K, v: CategoryForm[K]) => setForm(f => ({ ...f, [k]: v }));

  // Tree expand
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ──── FETCH KPIs ────
  const fetchKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const res = await fetch("/api/admin/categories?section=kpis");
      if (!res.ok) throw new Error("Failed to load KPIs");
      setKpis(await res.json());
    } catch { /* silent */ } finally { setKpisLoading(false); }
  }, []);

  // ──── FETCH LIST ────
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), per_page: String(perPage), sort: sortKey, order: sortOrder });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (parentFilter !== "all") params.set("parent", parentFilter);
      if (hasProductsFilter !== "all") params.set("has_products", hasProductsFilter);

      const res = await fetch(`/api/admin/categories?${params}`);
      if (!res.ok) throw new Error("Failed to load categories");
      const data = await res.json();
      setCategories(data.categories || []);
      setTotal(data.total || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load categories");
    } finally { setLoading(false); }
  }, [page, perPage, search, statusFilter, parentFilter, hasProductsFilter, sortKey, sortOrder]);

  // ──── FETCH TREE ────
  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories?section=tree");
      if (!res.ok) return;
      const data = await res.json();
      setTreeData(data.tree || []);
    } catch { /* silent */ }
  }, []);

  // ──── FETCH ALL (for parent selector) ────
  const fetchAllCategories = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("categories").select("*").order("name");
    setAllCategories((data as Category[]) || []);
  }, []);

  useEffect(() => { fetchKpis(); fetchAllCategories(); }, [fetchKpis, fetchAllCategories]);
  useEffect(() => {
    if (viewMode === "table") fetchCategories();
    else fetchTree();
  }, [viewMode, fetchCategories, fetchTree]);

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

  const allSelected = categories.length > 0 && categories.every(c => selected.has(c.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(categories.map(c => c.id)));
  };

  // ──── FORM ────
  const openCreate = (parentId?: string) => {
    setEditCategory(null);
    setSlugEdited(false);
    setForm({ ...emptyForm, parent_id: parentId || "" });
    setFormOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditCategory(cat);
    setSlugEdited(true);
    const c = cat as Record<string, unknown>;
    setForm({
      name: cat.name, slug: cat.slug, parent_id: cat.parent_id || "",
      category_type: (c.category_type as string) || "physical",
      sort_order: String((c.sort_order as number) ?? 0),
      is_active: cat.is_active,
      banner_url: (c.banner_url as string) || cat.image_url || "",
      icon_url: (c.icon_url as string) || "",
      cover_url: (c.cover_url as string) || "",
      meta_title: (c.meta_title as string) || "",
      meta_description: (c.meta_description as string) || "",
      filter_attributes: Array.isArray(c.filter_attributes) ? (c.filter_attributes as string[]) : [],
      is_featured: !!c.is_featured,
      show_in_nav: c.show_in_nav !== false,
      show_on_homepage: !!c.show_on_homepage,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast("Category name is required", "error"); return; }
    setFormSaving(true);
    try {
      const slug = slugifyClient(form.slug || form.name);
      // image_url (used for list thumbnails) mirrors icon → banner → cover for backward compat
      const image_url = form.icon_url || form.banner_url || form.cover_url || null;
      const payload = {
        name: form.name.trim(), slug,
        parent_id: form.parent_id || null,
        category_type: form.category_type,
        sort_order: parseInt(form.sort_order) || 0,
        is_active: form.is_active,
        image_url,
        banner_url: form.banner_url || null,
        icon_url: form.icon_url || null,
        cover_url: form.cover_url || null,
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        filter_attributes: form.filter_attributes,
        is_featured: form.is_featured,
        show_in_nav: form.show_in_nav,
        show_on_homepage: form.show_on_homepage,
      };

      const viaApi = async () => {
        const method = editCategory ? "PUT" : "POST";
        const body = editCategory ? { id: editCategory.id, ...payload } : payload;
        const res = await fetch("/api/admin/categories", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const text = await res.text();
        let d: Record<string, unknown> = {};
        try { d = text ? JSON.parse(text) : {}; } catch { const e = new Error("nonjson") as Error & { nonJson?: boolean }; e.nonJson = true; throw e; }
        if (!res.ok) throw new Error((d.error as string) || "Save failed");
      };

      const viaSupabase = async () => {
        const supabase = createClient();
        if (editCategory) {
          const { error } = await supabase.from("categories").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editCategory.id);
          if (error) throw new Error(error.message);
        } else {
          const { data: dup } = await supabase.from("categories").select("id").eq("slug", slug).maybeSingle();
          const finalSlug = dup ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug;
          const { error } = await supabase.from("categories").insert({ ...payload, slug: finalSlug });
          if (error) throw new Error(error.message);
        }
      };

      try { await viaApi(); }
      catch (e) { if ((e as { nonJson?: boolean }).nonJson) await viaSupabase(); else throw e; }

      showToast(editCategory ? "Category updated" : "Category created");
      setFormOpen(false);
      fetchCategories(); fetchKpis(); fetchTree(); fetchAllCategories();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally { setFormSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this category? Products in it will lose their category.")) return;
    try {
      const res = await fetch("/api/admin/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Delete failed"); }
      showToast("Category deleted");
      fetchCategories(); fetchKpis(); fetchTree(); fetchAllCategories();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  const handleDuplicate = async (cat: CategoryRow) => {
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cat.name + " (Copy)",
          parent_id: cat.parent_id || null,
          image_url: cat.image_url,
          is_active: false,
        }),
      });
      if (!res.ok) throw new Error("Duplicate failed");
      showToast("Category duplicated as hidden");
      fetchCategories(); fetchKpis(); fetchTree(); fetchAllCategories();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Duplicate failed", "error");
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selected.size === 0) return;
    const ids = [...selected];
    if (action === "delete") {
      if (!window.confirm(`Delete ${ids.length} categorie(s)?`)) return;
      try {
        const res = await fetch("/api/admin/categories", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Bulk delete failed"); }
        showToast(`${ids.length} categorie(s) deleted`);
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : "Bulk action failed", "error");
        return;
      }
    } else {
      try {
        const res = await fetch("/api/admin/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action }),
        });
        if (!res.ok) throw new Error("Bulk action failed");
        showToast(`${ids.length} categorie(s) updated`);
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : "Bulk action failed", "error");
        return;
      }
    }
    setSelected(new Set());
    fetchCategories(); fetchKpis(); fetchTree();
  };

  const handleExport = async (format: "csv" | "json") => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("categories").select("*").order("name");
      const cats = data || [];
      if (format === "json") {
        const blob = new Blob([JSON.stringify(cats, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `categories-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
      } else {
        const headers = ["ID", "Name", "Slug", "Parent ID", "Image URL", "Active", "Created"];
        const rows = cats.map(c => [c.id, c.name, c.slug, c.parent_id || "", c.image_url || "", c.is_active, c.created_at]);
        const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `categories-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
      }
      showToast(`Exported ${cats.length} categories`);
    } catch { showToast("Export failed", "error"); }
  };

  const openDetail = async (cat: CategoryRow) => {
    setDetailCategory(cat);
    setDetailTab("general");
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/categories?section=detail&id=${cat.id}`);
      if (!res.ok) throw new Error("Failed");
      setDetailData(await res.json());
    } catch { setDetailData(null); }
    finally { setDetailLoading(false); }
  };

  // Tree toggle
  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const expandAll = () => {
    const ids = new Set<string>();
    const walk = (nodes: TreeNode[]) => { nodes.forEach(n => { ids.add(n.id); walk(n.children); }); };
    walk(treeData);
    setExpanded(ids);
  };

  const activeFilterCount = [statusFilter !== "all", parentFilter !== "all", hasProductsFilter !== "all"].filter(Boolean).length;

  const clearFilters = () => { setStatusFilter("all"); setParentFilter("all"); setHasProductsFilter("all"); setPage(1); };

  const kpiCards = [
    { key: "totalCategories", label: "Total", icon: FolderOpen, value: kpis.totalCategories, color: "#2563eb" },
    { key: "activeCategories", label: "Active", icon: CheckCircle2, value: kpis.activeCategories, color: "#16a34a" },
    { key: "hiddenCategories", label: "Hidden", icon: EyeOff, value: kpis.hiddenCategories, color: "#64748b" },
    { key: "rootCategories", label: "Root", icon: FolderTree, value: kpis.rootCategories, color: "#8b5cf6" },
    { key: "subcategories", label: "Sub-categories", icon: Layers, value: kpis.subcategories, color: "#06b6d4" },
    { key: "noProducts", label: "Empty", icon: AlertTriangle, value: kpis.categoriesWithoutProducts, color: "#f97316" },
    { key: "noImage", label: "No Image", icon: ImageIcon, value: kpis.categoriesWithoutImage, color: "#ef4444" },
    { key: "topRevenue", label: "Top Revenue", icon: DollarSign, value: kpis.highestRevenueCategory?.name || "—", color: "#10b981" },
    { key: "topProducts", label: "Most Products", icon: Package, value: kpis.mostProductsCategory?.name || "—", color: "#eab308" },
  ];

  // ════════════════════════════ RENDER ════════════════════════════

  return (
    <div className="space-y-5">
      {/* ──── HEADER ──── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-[24px] font-extrabold tracking-tight", txt)}>Categories</h1>
          <p className={cn("text-sm mt-0.5", sub)}>Organize and manage your complete product catalog.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => openCreate()} className="h-[40px] px-4 rounded-[11px] bg-[#2563eb] text-white text-[13px] font-semibold flex items-center gap-2 hover:bg-[#1d4ed8] transition-colors">
            <Plus className="w-4 h-4" /> Add Category
          </button>
          <button onClick={() => handleExport("csv")} className={cn("h-[40px] px-3 rounded-[11px] border text-[13px] font-semibold flex items-center gap-2 transition-colors", brd, txt, hover)}>
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => { fetchCategories(); fetchKpis(); fetchTree(); }} className={cn("h-[40px] w-[40px] rounded-[11px] border flex items-center justify-center transition-colors", brd, txt, hover)}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ──── KPI CARDS ──── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
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
                <p className={cn("text-[18px] font-extrabold truncate", txt)}>{k.value}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ──── VIEW TOGGLE + SEARCH + FILTERS ──── */}
      <div className={cn("rounded-[16px] border p-4", p, brd)}>
        <div className="flex flex-wrap items-center gap-3">
          {/* View toggle */}
          <div className={cn("flex rounded-[10px] border overflow-hidden", brd)}>
            <button onClick={() => setViewMode("table")} className={cn("px-3 py-2 text-[12px] font-semibold flex items-center gap-1.5 transition-colors", viewMode === "table" ? "bg-[#2563eb] text-white" : cn(txt, hover))}>
              <List className="w-3.5 h-3.5" /> Table
            </button>
            <button onClick={() => setViewMode("tree")} className={cn("px-3 py-2 text-[12px] font-semibold flex items-center gap-1.5 transition-colors border-l", brd, viewMode === "tree" ? "bg-[#2563eb] text-white" : cn(txt, hover))}>
              <FolderTree className="w-3.5 h-3.5" /> Tree
            </button>
          </div>

          {/* Search */}
          {viewMode === "table" && (
            <>
              <div className={cn("flex items-center gap-2 h-[42px] px-3 rounded-[11px] border flex-1 min-w-[200px]", inp)}>
                <Search className="w-4 h-4 shrink-0 opacity-50" />
                <input defaultValue={search} onChange={e => handleSearch(e.target.value)} placeholder="Search categories..." className="bg-transparent outline-none w-full text-sm" />
              </div>

              {/* Status pills */}
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
            </>
          )}

          {viewMode === "tree" && (
            <div className="flex gap-2 ml-auto">
              <button onClick={expandAll} className={cn("px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors", txt, hover)}>Expand All</button>
              <button onClick={() => setExpanded(new Set())} className={cn("px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors", txt, hover)}>Collapse All</button>
            </div>
          )}
        </div>

        {/* Expanded filters */}
        {showFilters && viewMode === "table" && (
          <div className={cn("mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3", brd)}>
            <div>
              <label className={cn("text-[11px] font-semibold mb-1 block", sub)}>Parent</label>
              <select value={parentFilter} onChange={e => { setParentFilter(e.target.value); setPage(1); }} className={cn(inpCls, "h-[38px]")}>
                <option value="all">All</option>
                <option value="root">Root Only</option>
                {allCategories.filter(c => !c.parent_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={cn("text-[11px] font-semibold mb-1 block", sub)}>Products</label>
              <select value={hasProductsFilter} onChange={e => { setHasProductsFilter(e.target.value); setPage(1); }} className={cn(inpCls, "h-[38px]")}>
                <option value="all">All</option>
                <option value="true">Has Products</option>
                <option value="false">Empty</option>
              </select>
            </div>
            {activeFilterCount > 0 && (
              <div className="col-span-full">
                <button onClick={clearFilters} className="text-[#2563eb] text-[12px] font-semibold hover:underline flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ──── BULK ACTIONS ──── */}
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
          {error} <button onClick={fetchCategories} className="ml-3 underline">Retry</button>
        </div>
      )}

      {/* ══════════════════════ TABLE VIEW ══════════════════════ */}
      {viewMode === "table" && (
        <div className={cn("rounded-[16px] border overflow-hidden", p, brd)}>
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#2563eb] mx-auto" />
              <p className={cn("text-sm mt-3", sub)}>Loading categories...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn("border-b", brd)}>
                      <th className="w-10 p-3"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" /></th>
                      <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Category</th>
                      <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden md:table-cell", sub)}>Parent</th>
                      <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden lg:table-cell", sub)}>Level</th>
                      <SortTH label="Products" sortKey="products_count" currentKey={sortKey} order={sortOrder} onSort={handleSort} dark={dark} />
                      <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden xl:table-cell", sub)}>Revenue</th>
                      <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Status</th>
                      <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden lg:table-cell", sub)}>Image</th>
                      <th className={cn("text-right text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(cat => (
                      <tr key={cat.id} className={cn("border-b last:border-0 transition-colors", brd, hover, selected.has(cat.id) && (dark ? "bg-[#2563eb]/5" : "bg-[#2563eb]/[.03]"))}>
                        <td className="p-3">
                          <input type="checkbox" checked={selected.has(cat.id)} onChange={() => {
                            const n = new Set(selected); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); setSelected(n);
                          }} className="rounded" />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-[10px] shrink-0 overflow-hidden flex items-center justify-center", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                              {cat.image_url ? <img src={cat.image_url} alt="" className="w-10 h-10 object-cover" /> : <FolderOpen className={cn("w-4 h-4 opacity-40", sub)} />}
                            </div>
                            <div className="min-w-0">
                              <button onClick={() => openDetail(cat)} className={cn("text-sm font-semibold truncate block text-left hover:text-[#2563eb] transition-colors", txt)}>{cat.name}</button>
                              <p className={cn("text-[11px] truncate", sub)}>/{cat.slug}</p>
                              {cat.childrenCount > 0 && <span className={cn("text-[10px] font-semibold", sub)}>{cat.childrenCount} sub-categories</span>}
                            </div>
                          </div>
                        </td>
                        <td className={cn("p-3 text-sm hidden md:table-cell", sub)}>
                          {cat.parent_id ? allCategories.find(c => c.id === cat.parent_id)?.name || "—" : <span className="text-[#8b5cf6] font-semibold">Root</span>}
                        </td>
                        <td className={cn("p-3 text-sm hidden lg:table-cell", sub)}>
                          <span className={cn("inline-block px-2 py-0.5 rounded text-[11px] font-bold", dark ? "bg-[#252c36]" : "bg-[#f1f5f9]")}>L{cat.level}</span>
                        </td>
                        <td className={cn("p-3 text-sm font-semibold", cat.productCount === 0 ? "text-[#f97316]" : txt)}>{cat.productCount}</td>
                        <td className={cn("p-3 text-sm hidden xl:table-cell font-semibold", sub)}>${cat.revenue.toFixed(0)}</td>
                        <td className="p-3">
                          <span className={cn("inline-block px-2.5 py-1 rounded-md text-[11px] font-bold",
                            cat.is_active
                              ? dark ? "bg-[#16a34a]/15 text-[#4ade80]" : "bg-[#e8f7ee] text-[#16a34a]"
                              : dark ? "bg-[#64748b]/15 text-[#94a3b8]" : "bg-[#f1f5f9] text-[#64748b]"
                          )}>{cat.is_active ? "Active" : "Hidden"}</span>
                        </td>
                        <td className={cn("p-3 hidden lg:table-cell")}>
                          {cat.image_url
                            ? <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                            : <XCircle className="w-4 h-4 text-[#ef4444] opacity-50" />}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => openDetail(cat)} title="View" className="p-1.5 rounded-lg hover:bg-[#2563eb]/10 text-[#2563eb] transition-colors"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => openEdit(cat)} title="Edit" className="p-1.5 rounded-lg hover:bg-[#2563eb]/10 text-[#2563eb] transition-colors"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={() => openCreate(cat.id)} title="Add Sub" className={cn("p-1.5 rounded-lg transition-colors", dark ? "hover:bg-white/10 text-[#8b95a3]" : "hover:bg-black/5 text-[#8a929c]")}><Plus className="w-4 h-4" /></button>
                            <button onClick={() => handleDuplicate(cat)} title="Duplicate" className={cn("p-1.5 rounded-lg transition-colors", dark ? "hover:bg-white/10 text-[#8b95a3]" : "hover:bg-black/5 text-[#8a929c]")}><Copy className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(cat.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-[#ef4444] transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {categories.length === 0 && (
                      <tr><td colSpan={9} className={cn("p-12 text-center", sub)}>
                        <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-semibold">No categories found</p>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className={cn("flex items-center justify-between px-4 py-3 border-t", brd)}>
                <p className={cn("text-[12px]", sub)}>{total} categorie{total !== 1 ? "s" : ""} · Page {page}/{totalPages}</p>
                <div className="flex items-center gap-1">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30", hover)}><ChevronLeft className="w-4 h-4" /></button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pn: number;
                    if (totalPages <= 5) pn = i + 1;
                    else if (page <= 3) pn = i + 1;
                    else if (page >= totalPages - 2) pn = totalPages - 4 + i;
                    else pn = page - 2 + i;
                    return (
                      <button key={pn} onClick={() => setPage(pn)} className={cn("w-8 h-8 rounded-lg text-[12px] font-semibold transition-colors", page === pn ? "bg-[#2563eb] text-white" : cn(txt, hover))}>{pn}</button>
                    );
                  })}
                  <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30", hover)}><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════ TREE VIEW ══════════════════════ */}
      {viewMode === "tree" && (
        <div className={cn("rounded-[16px] border p-4", p, brd)}>
          {treeData.length === 0 ? (
            <div className={cn("text-center py-12", sub)}>
              <FolderTree className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold">No categories</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {treeData.map(node => (
                <TreeNodeItem key={node.id} node={node} level={0} dark={dark} expanded={expanded} onToggle={toggleExpand}
                  onEdit={(id) => { const c = allCategories.find(c => c.id === id); if (c) openEdit(c); }}
                  onAddSub={(id) => openCreate(id)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════ CREATE / EDIT DRAWER ══════════════════════ */}
      {formOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" onClick={() => setFormOpen(false)} />
          <div className={cn("absolute top-0 right-0 h-full w-full max-w-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-200", dark ? "bg-[#0f1318]" : "bg-[#f4f6f9]")}>
            <div className={cn("flex items-center justify-between px-6 py-4 border-b shrink-0", brd, dark ? "bg-[#171c24]" : "bg-white")}>
              <div>
                <h2 className={cn("text-[18px] font-extrabold", txt)}>{editCategory ? "Edit Category" : "Add Category"}</h2>
                <p className={cn("text-[11px]", sub)}>{editCategory ? "Update this category's details and display settings." : "Create a new category for your storefront."}</p>
              </div>
              <button onClick={() => setFormOpen(false)} className={cn("h-8 w-8 rounded-full flex items-center justify-center", hover)}><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
              {/* 1. GENERAL */}
              <CatSection dark={dark} icon={FolderOpen} title="General Information">
                <div className="space-y-4">
                  <div>
                    <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Category Name <span className="text-red-500">*</span></label>
                    <input value={form.name}
                      onChange={e => { setField("name", e.target.value); if (!slugEdited) setField("slug", slugifyClient(e.target.value)); }}
                      className={cn(inpCls, !form.name.trim() && "border-red-500/40")} placeholder="e.g. Sneakers" />
                    {!form.name.trim() && <p className="text-[11px] text-red-500 mt-1">Category name is required</p>}
                  </div>
                  <div>
                    <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Category Slug</label>
                    <div className={cn("flex items-center rounded-[11px] border-[1.5px] overflow-hidden", inp)}>
                      <span className={cn("pl-3 text-sm shrink-0", sub)}>/category/</span>
                      <input value={form.slug} onChange={e => { setSlugEdited(true); setField("slug", e.target.value); }}
                        className="flex-1 h-[42px] bg-transparent px-1 text-sm outline-none" placeholder="sneakers" />
                    </div>
                    <p className={cn("text-[11px] mt-1", sub)}>Auto-generated from the name — click to customize.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Category Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[["physical", "Physical", Package], ["digital", "Digital", Zap]].map(([val, lbl, Ico]) => (
                          <button key={val as string} type="button" onClick={() => setField("category_type", val as string)}
                            className={cn("h-[42px] rounded-[11px] border-[1.5px] text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors",
                              form.category_type === val ? "border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]" : cn(brd, sub, hover))}>
                            <Ico className="w-3.5 h-3.5" /> {lbl as string}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Ordering Number</label>
                      <input type="number" value={form.sort_order} onChange={e => setField("sort_order", e.target.value)} className={inpCls} placeholder="0" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Parent Category</label>
                      <select value={form.parent_id} onChange={e => setField("parent_id", e.target.value)} className={inpCls}>
                        <option value="">None (Root category)</option>
                        {allCategories.filter(c => c.id !== editCategory?.id).map(c => <option key={c.id} value={c.id}>{c.parent_id ? "└ " : ""}{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Status</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[["active", true], ["inactive", false]].map(([lbl, val]) => (
                          <button key={lbl as string} type="button" onClick={() => setField("is_active", val as boolean)}
                            className={cn("h-[42px] rounded-[11px] border-[1.5px] text-[13px] font-semibold capitalize transition-colors",
                              form.is_active === val ? (val ? "border-emerald-500 bg-emerald-500/5 text-emerald-600" : "border-[#8a929c] bg-[#8a929c]/5 " + txt) : cn(brd, sub, hover))}>
                            {lbl as string}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CatSection>

              {/* 2. IMAGES */}
              <CatSection dark={dark} icon={ImageIcon} title="Images">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <CategoryImageUpload dark={dark} label="Banner" hint="1920×480" value={form.banner_url} onChange={v => setField("banner_url", v)} />
                  <CategoryImageUpload dark={dark} label="Icon" hint="128×128" value={form.icon_url} onChange={v => setField("icon_url", v)} />
                  <CategoryImageUpload dark={dark} label="Cover Image" hint="800×600" value={form.cover_url} onChange={v => setField("cover_url", v)} />
                </div>
              </CatSection>

              {/* 3. SEO */}
              <CatSection dark={dark} icon={Search} title="SEO">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={cn("text-[12px] font-semibold", txt)}>Meta Title</label>
                      <span className={cn("text-[11px]", form.meta_title.length > 60 ? "text-amber-500" : sub)}>{form.meta_title.length}/60</span>
                    </div>
                    <input value={form.meta_title} onChange={e => setField("meta_title", e.target.value)} className={inpCls} placeholder={form.name || "Category title for search engines"} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className={cn("text-[12px] font-semibold", txt)}>Meta Description</label>
                      <span className={cn("text-[11px]", form.meta_description.length > 160 ? "text-amber-500" : sub)}>{form.meta_description.length}/160</span>
                    </div>
                    <textarea value={form.meta_description} onChange={e => setField("meta_description", e.target.value)} rows={3}
                      className={cn("w-full rounded-[11px] border-[1.5px] p-3 text-sm outline-none resize-y", inp, "focus:border-[#2563eb]")} placeholder="Brief description shown in search results..." />
                  </div>
                </div>
              </CatSection>

              {/* 4. FILTERING ATTRIBUTES */}
              <CatSection dark={dark} icon={Filter} title="Filtering Attributes">
                <p className={cn("text-[11px] mb-3", sub)}>Attributes customers can filter by on this category's product listing.</p>
                <div className="flex flex-wrap gap-2">
                  {FILTER_ATTRIBUTES.map(attr => {
                    const on = form.filter_attributes.includes(attr);
                    return (
                      <button key={attr} type="button"
                        onClick={() => setField("filter_attributes", on ? form.filter_attributes.filter(a => a !== attr) : [...form.filter_attributes, attr])}
                        className={cn("h-8 px-3 rounded-full border-[1.5px] text-[12px] font-semibold flex items-center gap-1.5 transition-colors",
                          on ? "border-[#2563eb] bg-[#2563eb] text-white" : cn(brd, sub, hover))}>
                        {on && <CheckCircle2 className="w-3.5 h-3.5" />} {attr}
                      </button>
                    );
                  })}
                </div>
              </CatSection>

              {/* 5. DISPLAY OPTIONS */}
              <CatSection dark={dark} icon={Eye} title="Display Options">
                <div className="space-y-1">
                  {[
                    ["is_featured", "Featured Category", "Highlight this category in featured sections", Star],
                    ["show_in_nav", "Show in Navigation", "Display in the main navigation menu", Menu],
                    ["show_on_homepage", "Show on Homepage", "Feature this category on the homepage", Home],
                  ].map(([key, label, desc, Ico]) => (
                    <label key={key as string} className={cn("flex items-center gap-3 py-2.5 cursor-pointer")}>
                      <div className={cn("w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}>
                        <Ico className={cn("w-4 h-4", sub)} />
                      </div>
                      <div className="flex-1">
                        <p className={cn("text-[13px] font-semibold", txt)}>{label as string}</p>
                        <p className={cn("text-[11px]", sub)}>{desc as string}</p>
                      </div>
                      <button type="button" onClick={() => setField(key as keyof CategoryForm, !form[key as keyof CategoryForm] as never)}
                        className={cn("w-11 h-6 rounded-full transition-colors relative shrink-0", form[key as keyof CategoryForm] ? "bg-[#2563eb]" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}>
                        <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", form[key as keyof CategoryForm] ? "translate-x-[22px]" : "translate-x-0.5")} />
                      </button>
                    </label>
                  ))}
                </div>
              </CatSection>
            </div>

            <div className={cn("px-6 py-4 border-t shrink-0", brd, dark ? "bg-[#171c24]" : "bg-white")}>
              <div className="flex gap-3">
                <button onClick={() => setFormOpen(false)} className={cn("flex-1 h-[44px] rounded-[11px] border text-sm font-semibold", brd, txt, hover)}>Cancel</button>
                <button onClick={handleSave} disabled={formSaving || !form.name.trim()} className="flex-1 h-[44px] rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {formSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {formSaving ? "Saving..." : editCategory ? "Update Category" : "Create Category"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ DETAIL PANEL ══════════════════════ */}
      {detailCategory && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" onClick={() => setDetailCategory(null)} />
          <div className={cn("absolute top-0 right-0 h-full w-full max-w-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-200", dark ? "bg-[#171c24]" : "bg-white")}>
            <div className={cn("flex items-center justify-between px-6 py-4 border-b shrink-0", brd)}>
              <div className="flex items-center gap-3">
                {detailCategory.image_url && <div className="w-9 h-9 rounded-lg overflow-hidden"><img src={detailCategory.image_url} alt="" className="w-9 h-9 object-cover" /></div>}
                <div>
                  <h2 className={cn("text-[16px] font-extrabold", txt)}>{detailCategory.name}</h2>
                  <p className={cn("text-[11px]", sub)}>/{detailCategory.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setDetailCategory(null); openEdit(detailCategory); }} className="h-8 px-3 rounded-lg bg-[#2563eb] text-white text-[12px] font-semibold hover:bg-[#1d4ed8] transition-colors flex items-center gap-1.5"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={() => setDetailCategory(null)} className={cn("h-8 w-8 rounded-full flex items-center justify-center", hover)}><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className={cn("flex overflow-x-auto px-6 border-b shrink-0", brd)}>
              {(["general", "products", "analytics"] as DetailTab[]).map(tab => (
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
                <CategoryDetailContent tab={detailTab} category={detailCategory} data={detailData} dark={dark} allCategories={allCategories} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn("fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200",
          toast.type === "success" && "bg-[#16a34a]", toast.type === "error" && "bg-[#ef4444]", toast.type === "info" && "bg-[#2563eb]"
        )}>{toast.message}</div>
      )}
    </div>
  );
}

// ──────────────────────────── SORT TH ────────────────────────────

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

// ──────────────────────────── TREE NODE ────────────────────────────

function TreeNodeItem({ node, level, dark, expanded, onToggle, onEdit, onAddSub, onDelete }: {
  node: TreeNode; level: number; dark: boolean; expanded: Set<string>;
  onToggle: (id: string) => void; onEdit: (id: string) => void;
  onAddSub: (id: string) => void; onDelete: (id: string) => void;
}) {
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div className={cn("flex items-center gap-2 py-2 px-3 rounded-[10px] transition-colors group", hover)} style={{ paddingLeft: `${level * 24 + 12}px` }}>
        {hasChildren ? (
          <button onClick={() => onToggle(node.id)} className={cn("w-5 h-5 flex items-center justify-center rounded transition-colors", dark ? "hover:bg-white/10" : "hover:bg-black/5")}>
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <div className="w-5 h-5 flex items-center justify-center">
            <div className={cn("w-1.5 h-1.5 rounded-full", dark ? "bg-[#252c36]" : "bg-[#d1d5db]")} />
          </div>
        )}

        <div className={cn("w-7 h-7 rounded-lg shrink-0 overflow-hidden flex items-center justify-center", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
          {node.image_url ? <img src={node.image_url} alt="" className="w-7 h-7 object-cover" /> : <FolderOpen className="w-3.5 h-3.5 opacity-40" />}
        </div>

        <span className={cn("text-sm font-semibold flex-1 truncate", txt)}>{node.name}</span>

        <span className={cn("text-[11px] font-semibold tabular-nums", sub)}>{node.productCount} products</span>

        <span className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-bold",
          node.is_active ? (dark ? "bg-[#16a34a]/15 text-[#4ade80]" : "bg-[#e8f7ee] text-[#16a34a]") : (dark ? "bg-[#64748b]/15 text-[#94a3b8]" : "bg-[#f1f5f9] text-[#64748b]")
        )}>{node.is_active ? "Active" : "Hidden"}</span>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(node.id)} className="p-1 rounded hover:bg-[#2563eb]/10 text-[#2563eb] transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => onAddSub(node.id)} className={cn("p-1 rounded transition-colors", dark ? "hover:bg-white/10 text-[#8b95a3]" : "hover:bg-black/5 text-[#8a929c]")}><Plus className="w-3.5 h-3.5" /></button>
          <button onClick={() => onDelete(node.id)} className="p-1 rounded hover:bg-[#ef4444]/10 text-[#ef4444] transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNodeItem key={child.id} node={child} level={level + 1} dark={dark} expanded={expanded}
              onToggle={onToggle} onEdit={onEdit} onAddSub={onAddSub} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────── DETAIL CONTENT ────────────────────────────

function CategoryDetailContent({ tab, category, data, dark, allCategories }: {
  tab: DetailTab; category: CategoryRow; data: Record<string, unknown> | null;
  dark: boolean; allCategories: Category[];
}) {
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";

  const detail = data || {};
  const products = (detail.products as Product[]) || [];
  const children = (detail.children as Category[]) || [];
  const salesStats = detail.salesStats as { totalSold: number; totalRevenue: number; topProduct: string } | undefined;

  switch (tab) {
    case "general":
      return (
        <div className="space-y-5">
          <Field label="Name" value={category.name} dark={dark} />
          <Field label="Slug" value={`/${category.slug}`} dark={dark} />
          <Field label="Parent" value={category.parent_id ? (allCategories.find(c => c.id === category.parent_id)?.name || "—") : "Root category"} dark={dark} />
          <div className="grid grid-cols-3 gap-4">
            <Field label="Status" value={category.is_active ? "Active" : "Hidden"} dark={dark} />
            <Field label="Level" value={`Level ${category.level}`} dark={dark} />
            <Field label="Products" value={String(category.productCount)} dark={dark} />
          </div>
          <Field label="Created" value={new Date(category.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} dark={dark} />
          {category.image_url && (
            <div>
              <p className={cn("text-[11px] font-semibold uppercase tracking-wider mb-2", sub)}>Image</p>
              <div className={cn("w-32 h-32 rounded-[12px] overflow-hidden border", brd)}>
                <img src={category.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
          {children.length > 0 && (
            <div>
              <p className={cn("text-[11px] font-semibold uppercase tracking-wider mb-2", sub)}>Sub-categories ({children.length})</p>
              <div className="flex flex-wrap gap-2">
                {children.map(c => (
                  <span key={c.id} className={cn("px-3 py-1.5 rounded-lg text-[12px] font-semibold border", brd, txt)}>{c.name}</span>
                ))}
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
                    <p className={cn("text-[11px]", sub)}>${prod.price.toFixed(2)}</p>
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
              <p className="text-sm">No products in this category</p>
            </div>
          )}
        </div>
      );

    case "analytics":
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className={cn("rounded-[12px] border p-4 text-center", brd)}>
              <p className={cn("text-[22px] font-extrabold", txt)}>{category.productCount}</p>
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
          </div>
          {salesStats?.topProduct && (
            <Field label="Top Product" value={salesStats.topProduct} dark={dark} />
          )}
          <Field label="Sub-categories" value={String(category.childrenCount)} dark={dark} />
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

// ──────────────────────────── FORM SECTION CARD ────────────────────────────

function CatSection({ dark, icon: Icon, title, children }: { dark: boolean; icon: typeof FolderOpen; title: string; children: React.ReactNode }) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  return (
    <div className={cn("rounded-[16px] border", p, brd)}>
      <div className={cn("flex items-center gap-2.5 px-4 sm:px-5 py-3.5 border-b", brd)}>
        <div className="w-7 h-7 rounded-[8px] bg-[#2563eb]/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#2563eb]" />
        </div>
        <h3 className={cn("text-[14px] font-extrabold", txt)}>{title}</h3>
      </div>
      <div className="px-4 sm:px-5 py-4">{children}</div>
    </div>
  );
}

// ──────────────────────────── CATEGORY IMAGE UPLOAD ────────────────────────────

const CAT_IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];
const CAT_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/svg+xml": "svg" };

function CategoryImageUpload({ dark, label, hint, value, onChange }: { dark: boolean; label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    setError("");
    if (!CAT_IMG_TYPES.includes(file.type)) { setError("Use JPG, PNG, WebP, GIF, AVIF or SVG"); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Image exceeds 8MB"); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = CAT_EXT[file.type] || "bin";
      const path = `categories/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("category-images").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        const fd = new FormData();
        fd.append("files", file); fd.append("bucket", "category-images"); fd.append("folder", "categories");
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.files?.[0]?.url) throw new Error(d.error || upErr.message || "Upload failed");
        onChange(d.files[0].url);
      } else {
        const { data: pub } = supabase.storage.from("category-images").getPublicUrl(path);
        onChange(pub.publicUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <label className={cn("text-[11px] font-bold mb-1.5 block", sub)}>{label}</label>
      <input ref={fileRef} type="file" accept={CAT_IMG_TYPES.join(",")} className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
      {value ? (
        <div className={cn("relative rounded-[12px] border overflow-hidden group aspect-[4/3]", brd)}>
          <img src={value} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.opacity = "0.3")} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="px-2.5 h-7 rounded-[7px] bg-white text-black text-[10px] font-bold flex items-center gap-1">
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Replace
            </button>
            <button type="button" onClick={() => onChange("")} className="px-2.5 h-7 rounded-[7px] bg-red-500 text-white text-[10px] font-bold flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (!uploading && e.dataTransfer.files?.[0]) upload(e.dataTransfer.files[0]); }}
          className={cn("rounded-[12px] border-2 border-dashed aspect-[4/3] flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-colors px-2",
            dragOver ? "border-[#2563eb] bg-[#2563eb]/5" : brd, uploading && "opacity-60 pointer-events-none")}>
          {uploading ? <Loader2 className="w-5 h-5 animate-spin text-[#2563eb]" /> : <Upload className={cn("w-5 h-5", dragOver ? "text-[#2563eb]" : sub)} />}
          <p className={cn("text-[11px] font-semibold", txt)}>{uploading ? "Uploading…" : "Choose or drop"}</p>
          <p className={cn("text-[9px]", sub)}>{hint}</p>
        </div>
      )}
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
