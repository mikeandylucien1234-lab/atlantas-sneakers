"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Search, Plus, ChevronLeft, ChevronRight, Edit3, Trash2, Eye, Copy, Archive,
  Download, Upload, RefreshCw, Filter, X, ChevronDown, MoreHorizontal,
  Package, CheckCircle2, FileText, AlertTriangle, Star, TrendingUp,
  Zap, ImageIcon, FolderOpen, Tag, BarChart3, ArrowUpDown, ExternalLink,
  Layers, Box, DollarSign, Truck, Globe, MessageSquare, Clock, SlidersHorizontal,
  Loader2, Check, XCircle, ChevronUp, Palette, Ruler, Hash
} from "lucide-react";
import type { Product, Category, Brand, ProductVariant, Review, FlashDeal } from "@/types";

type Props = { dark: boolean; onNavigate?: (m: string) => void };

type SortKey = "name" | "price" | "stock" | "created_at" | "rating" | "sales";
type SortOrder = "asc" | "desc";
type StockFilter = "all" | "out" | "low" | "ok";
type ViewMode = "table" | "grid";
type DetailTab = "general" | "media" | "variants" | "inventory" | "pricing" | "shipping" | "seo" | "reviews" | "analytics" | "history";

interface ProductKpis {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  archivedProducts: number;
  outOfStock: number;
  lowStock: number;
  bestSellers: number;
  newProducts: number;
  flashDealProducts: number;
  averageRating: number;
  totalInventoryValue: number;
  noImageProducts: number;
  noCategoryProducts: number;
}

interface ProductRow extends Product {
  totalStock: number;
  totalSold: number;
  avgRating: number;
  reviewCount: number;
  hasFlashDeal: boolean;
  supplier_id?: string | null;
  cj_product_id?: string | null;
  cj_sku?: string | null;
}

interface VariantRow {
  id?: string;
  size: string;
  color: string;
  color_hex: string;
  stock: number;
  sku: string;
}

const defaultKpis: ProductKpis = {
  totalProducts: 0, activeProducts: 0, draftProducts: 0, archivedProducts: 0,
  outOfStock: 0, lowStock: 0, bestSellers: 0, newProducts: 0,
  flashDealProducts: 0, averageRating: 0, totalInventoryValue: 0,
  noImageProducts: 0, noCategoryProducts: 0,
};

const statusColors: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  active: { bg: "bg-[#e8f7ee]", text: "text-[#16a34a]", darkBg: "bg-[#16a34a]/15", darkText: "text-[#4ade80]" },
  draft: { bg: "bg-[#fef3c7]", text: "text-[#d97706]", darkBg: "bg-[#d97706]/15", darkText: "text-[#fbbf24]" },
  archived: { bg: "bg-[#f1f5f9]", text: "text-[#64748b]", darkBg: "bg-[#64748b]/15", darkText: "text-[#94a3b8]" },
};

// ──────────────────────────── MAIN COMPONENT ────────────────────────────

export function AdminProducts({ dark, onNavigate }: Props) {
  // Theme helpers
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");

  // Data
  const [kpis, setKpis] = useState<ProductKpis>(defaultKpis);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [featuredFilter, setFeaturedFilter] = useState("all");
  const [newFilter, setNewFilter] = useState("all");
  const [flashDealFilter, setFlashDealFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);

  // Detail / Edit
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("general");
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create / Edit form
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formBrandId, setFormBrandId] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formComparePrice, setFormComparePrice] = useState("");
  const [formImages, setFormImages] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "draft">("active");
  const [formFeatured, setFormFeatured] = useState(false);
  const [formNew, setFormNew] = useState(false);
  const [formTrending, setFormTrending] = useState(false);
  const [formBestSeller, setFormBestSeller] = useState(false);
  const [formFlashSale, setFormFlashSale] = useState(false);
  const [formVariants, setFormVariants] = useState<VariantRow[]>([{ size: "", color: "", color_hex: "", stock: 0, sku: "" }]);
  const [formSaving, setFormSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Refs
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ──── FETCH KPIs ────
  const fetchKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const res = await fetch("/api/admin/products?section=kpis");
      if (!res.ok) throw new Error("Failed to load KPIs");
      const data = await res.json();
      setKpis(data);
    } catch {
      // silent
    } finally {
      setKpisLoading(false);
    }
  }, []);

  // ──── FETCH PRODUCTS LIST ────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), per_page: String(perPage), sort: sortKey, order: sortOrder });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (brandFilter !== "all") params.set("brand", brandFilter);
      if (stockFilter !== "all") params.set("stock", stockFilter);
      if (featuredFilter !== "all") params.set("featured", featuredFilter);
      if (newFilter !== "all") params.set("is_new", newFilter);
      if (flashDealFilter !== "all") params.set("has_flash_deal", flashDealFilter);

      const res = await fetch(`/api/admin/products?${params}`);
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, statusFilter, categoryFilter, brandFilter, stockFilter, featuredFilter, newFilter, flashDealFilter, sortKey, sortOrder]);

  // ──── FETCH CATEGORIES & BRANDS ────
  const fetchMeta = useCallback(async () => {
    const supabase = createClient();
    const [{ data: cats }, { data: brs }] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("brands").select("*").order("name"),
    ]);
    setCategories((cats as Category[]) || []);
    setBrands((brs as Brand[]) || []);
  }, []);

  useEffect(() => { fetchKpis(); fetchMeta(); }, [fetchKpis, fetchMeta]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Debounced search
  const handleSearch = (v: string) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(v);
      setPage(1);
    }, 300);
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // ──── SORT HANDLER ────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
    setPage(1);
  };

  // ──── SELECT ALL ────
  const allSelected = products.length > 0 && products.every(p => selected.has(p.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(products.map(p => p.id)));
  };

  // ──── OPEN FORM ────
  const openCreate = () => {
    setEditProduct(null);
    setFormName(""); setFormDescription(""); setFormCategoryId(""); setFormBrandId("");
    setFormPrice(""); setFormComparePrice(""); setFormImages(""); setFormTags("");
    setFormStatus("active"); setFormFeatured(false); setFormNew(false);
    setFormTrending(false); setFormBestSeller(false); setFormFlashSale(false);
    setFormVariants([{ size: "", color: "", color_hex: "", stock: 0, sku: "" }]);
    setFormOpen(true);
  };

  const openEdit = (prod: Product) => {
    setEditProduct(prod);
    setFormName(prod.name);
    setFormDescription(prod.description || "");
    setFormCategoryId(prod.category_id || "");
    setFormBrandId(prod.brand_id || "");
    setFormPrice(String(prod.price));
    setFormComparePrice(prod.compare_price ? String(prod.compare_price) : "");
    setFormImages(prod.images?.join(", ") || "");
    setFormTags(prod.tags?.join(", ") || "");
    setFormStatus(prod.status === "archived" ? "draft" : prod.status as "active" | "draft");
    setFormFeatured(prod.is_featured);
    setFormNew(prod.is_new);
    setFormTrending((prod as any).is_trending || false);
    setFormBestSeller((prod as any).is_best_seller || false);
    setFormFlashSale(false);
    // Detect active Flash Sale membership from the DB.
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.from("flash_deals").select("id").eq("product_id", prod.id).eq("is_active", true).limit(1);
        if (data && data.length) setFormFlashSale(true);
      } catch { /* ignore */ }
    })();
    setFormVariants(
      (prod.variants || []).map(v => ({
        id: v.id, size: v.size, color: v.color || "",
        color_hex: v.color_hex || "", stock: v.stock, sku: v.sku || ""
      }))
    );
    if (formVariants.length === 0) setFormVariants([{ size: "", color: "", color_hex: "", stock: 0, sku: "" }]);
    setFormOpen(true);
  };

  // ──── SAVE PRODUCT ────
  const handleSave = async () => {
    if (!formName || !formPrice) return;
    setFormSaving(true);
    try {
      const slug = formName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const payload = {
        name: formName, slug, description: formDescription || null,
        category_id: formCategoryId || null, brand_id: formBrandId || null,
        price: Number(formPrice), compare_price: formComparePrice ? Number(formComparePrice) : null,
        images: formImages ? formImages.split(",").map(s => s.trim()).filter(Boolean) : [],
        tags: formTags ? formTags.split(",").map(s => s.trim()).filter(Boolean) : [],
        status: formStatus, is_featured: formFeatured, is_new: formNew,
        is_trending: formTrending, is_best_seller: formBestSeller,
        variants: formVariants.filter(v => v.size),
      };

      let savedId = editProduct?.id;
      const apiMethod = editProduct ? "PUT" : "POST";
      let apiOk = false;
      try {
        const res = await fetch("/api/admin/products", {
          method: apiMethod,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editProduct ? { id: editProduct.id, ...payload } : payload),
        });
        apiOk = res.ok;
        if (res.ok) { const j = await res.json().catch(() => ({})); savedId = j?.id || j?.product?.id || savedId; }
      } catch { /* method blocked — fall through */ }

      if (!apiOk) {
        // Direct authenticated fallback (o2switch blocks PUT/POST on API routes).
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) throw new Error("Session expired — refresh and sign in again.");
        const { variants, ...prodFields } = payload;
        if (editProduct) {
          const { error } = await supabase.from("products").update(prodFields).eq("id", editProduct.id);
          if (error) throw new Error(error.message);
          savedId = editProduct.id;
        } else {
          const { data: created, error } = await supabase.from("products").insert(prodFields).select("id").single();
          if (error) throw new Error(error.message);
          savedId = created.id;
        }
        // Sync variants
        if (savedId) {
          await supabase.from("product_variants").delete().eq("product_id", savedId);
          const vrows = variants.map(v => ({ product_id: savedId, size: v.size || null, color: v.color || null, color_hex: v.color_hex || null, stock: v.stock ?? 0, sku: v.sku || null }));
          if (vrows.length) await supabase.from("product_variants").insert(vrows);
        }
      }

      // Flash Sale membership
      if (savedId) await syncFlashSale(savedId, formFlashSale, Number(formPrice));

      showToast(editProduct ? "Product updated" : "Product created");
      setFormOpen(false);
      fetchProducts();
      fetchKpis();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setFormSaving(false);
    }
  };

  // ──── DELETE ────
  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this product permanently?")) return;
    try {
      await deleteProductsResilient([id]);
      showToast("Product deleted");
      fetchProducts();
      fetchKpis();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  };

  // Deletes via the API, falling back to a direct (authenticated) Supabase
  // delete when the host blocks the DELETE method (o2switch returns 405/403 on
  // DELETE/PATCH/PUT). Admin RLS permits the direct delete.
  const deleteProductsResilient = async (ids: string[]) => {
    try {
      const res = await fetch("/api/admin/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) return;
    } catch { /* network/method blocked — fall through */ }
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) throw new Error("Session expired — refresh and sign in again.");
    // Remove dependent rows first (in case cascade isn't configured), then the product.
    await supabase.from("product_variants").delete().in("product_id", ids);
    const { error } = await supabase.from("products").delete().in("id", ids);
    if (error) throw new Error(error.message);
  };

  // Add/remove a product from Flash Sales. Enabling creates an active
  // flash_deals row (30-day window, deal price = current sale price);
  // disabling deactivates any existing deals for the product.
  const syncFlashSale = async (productId: string, enabled: boolean, price: number) => {
    try {
      const supabase = createClient();
      if (enabled) {
        const { data: existing } = await supabase.from("flash_deals").select("id").eq("product_id", productId).limit(1);
        const now = new Date();
        const ends = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
        if (existing && existing.length) {
          await supabase.from("flash_deals").update({ is_active: true, deal_price: price, starts_at: now.toISOString(), ends_at: ends.toISOString() }).eq("product_id", productId);
        } else {
          await supabase.from("flash_deals").insert({ product_id: productId, deal_price: price, starts_at: now.toISOString(), ends_at: ends.toISOString(), is_active: true });
        }
      } else {
        await supabase.from("flash_deals").update({ is_active: false }).eq("product_id", productId);
      }
    } catch { /* non-fatal */ }
  };

  // ──── ARCHIVE ────
  // Sets status; falls back to a direct Supabase update when PATCH is blocked.
  const setProductsStatusResilient = async (ids: string[], status: string, apiAction: string) => {
    try {
      const res = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: apiAction }),
      });
      if (res.ok) return;
    } catch { /* method blocked — fall through */ }
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) throw new Error("Session expired — refresh and sign in again.");
    const { error } = await supabase.from("products").update({ status }).in("id", ids);
    if (error) throw new Error(error.message);
  };

  const handleArchive = async (id: string) => {
    try {
      await setProductsStatusResilient([id], "archived", "archive");
      showToast("Product archived");
      fetchProducts();
      fetchKpis();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Archive failed", "error");
    }
  };

  // ──── DUPLICATE ────
  const handleDuplicate = async (prod: ProductRow) => {
    try {
      const payload = {
        name: prod.name + " (Copy)",
        slug: prod.slug + "-copy-" + Date.now(),
        description: prod.description,
        category_id: prod.category_id,
        brand_id: prod.brand_id,
        price: prod.price,
        compare_price: prod.compare_price,
        images: prod.images,
        tags: prod.tags,
        status: "draft" as const,
        is_featured: false,
        is_new: false,
        variants: (prod.variants || []).map(v => ({
          size: v.size, color: v.color || "", color_hex: v.color_hex || "",
          stock: v.stock, sku: v.sku ? v.sku + "-COPY" : "",
        })),
      };
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to duplicate");
      showToast("Product duplicated as draft");
      fetchProducts();
      fetchKpis();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Duplicate failed", "error");
    }
  };

  // ──── BULK ACTIONS ────
  const handleBulkAction = async (action: string) => {
    if (selected.size === 0) return;
    const ids = [...selected];
    setBulkMenuOpen(false);

    if (action === "delete") {
      if (!window.confirm(`Delete ${ids.length} product(s) permanently?`)) return;
      try {
        await deleteProductsResilient(ids);
        showToast(`${ids.length} product(s) deleted`);
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : "Bulk action failed", "error");
        return;
      }
    } else {
      try {
        const statusMap: Record<string, string> = { archive: "archived", activate: "active", draft: "draft", publish: "active" };
        await setProductsStatusResilient(ids, statusMap[action] || "active", action);
        showToast(`${ids.length} product(s) updated`);
      } catch (e: unknown) {
        showToast(e instanceof Error ? e.message : "Bulk action failed", "error");
        return;
      }
    }
    setSelected(new Set());
    fetchProducts();
    fetchKpis();
  };

  // ──── EXPORT ────
  const handleExport = async (format: "csv" | "json") => {
    try {
      const res = await fetch("/api/admin/products?section=export");
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const products = data.products || [];

      if (format === "json") {
        const blob = new Blob([JSON.stringify(products, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `products-${new Date().toISOString().slice(0, 10)}.json`;
        a.click(); URL.revokeObjectURL(url);
      } else {
        const headers = ["ID", "Name", "SKU", "Category", "Brand", "Price", "Compare Price", "Status", "Stock", "Rating", "Created"];
        const rows = products.map((p: ProductRow) => [
          p.id, p.name, p.variants?.[0]?.sku || "", p.category?.name || "", p.brand?.name || "",
          p.price, p.compare_price || "", p.status, p.totalStock || 0, p.avgRating || 0, p.created_at
        ]);
        const csv = [headers.join(","), ...rows.map((r: (string | number)[]) => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
      }
      showToast(`Exported ${products.length} products as ${format.toUpperCase()}`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Export failed", "error");
    }
  };

  // ──── PRODUCT DETAIL ────
  const openDetail = async (prod: Product) => {
    setDetailProduct(prod);
    setDetailTab("general");
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/products?section=detail&id=${prod.id}`);
      if (!res.ok) throw new Error("Failed to load details");
      const data = await res.json();
      setDetailData(data);
    } catch {
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // ──── VARIANT HELPERS ────
  const addVariant = () => setFormVariants([...formVariants, { size: "", color: "", color_hex: "", stock: 0, sku: "" }]);
  const removeVariant = (i: number) => setFormVariants(formVariants.filter((_, idx) => idx !== i));
  const updateVariant = (i: number, field: keyof VariantRow, value: string | number) => {
    const updated = [...formVariants];
    (updated[i] as unknown as Record<string, string | number>)[field] = value;
    setFormVariants(updated);
  };

  // ──── Active filters count ────
  const activeFilterCount = [
    statusFilter !== "all", categoryFilter !== "all", brandFilter !== "all",
    stockFilter !== "all", featuredFilter !== "all", newFilter !== "all", flashDealFilter !== "all"
  ].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter("all"); setCategoryFilter("all"); setBrandFilter("all");
    setStockFilter("all"); setFeaturedFilter("all"); setNewFilter("all");
    setFlashDealFilter("all"); setPage(1);
  };

  // ──── KPI CONFIG ────
  const kpiCards = [
    { key: "totalProducts", label: "Total Products", icon: Package, value: kpis.totalProducts, color: "#2563eb" },
    { key: "activeProducts", label: "Active", icon: CheckCircle2, value: kpis.activeProducts, color: "#16a34a" },
    { key: "draftProducts", label: "Draft", icon: FileText, value: kpis.draftProducts, color: "#d97706" },
    { key: "archivedProducts", label: "Archived", icon: Archive, value: kpis.archivedProducts, color: "#64748b" },
    { key: "outOfStock", label: "Out of Stock", icon: XCircle, value: kpis.outOfStock, color: "#ef4444" },
    { key: "lowStock", label: "Low Stock", icon: AlertTriangle, value: kpis.lowStock, color: "#f97316" },
    { key: "bestSellers", label: "Best Sellers", icon: TrendingUp, value: kpis.bestSellers, color: "#8b5cf6" },
    { key: "newProducts", label: "New Products", icon: Zap, value: kpis.newProducts, color: "#06b6d4" },
    { key: "flashDealProducts", label: "Flash Deals", icon: Zap, value: kpis.flashDealProducts, color: "#ec4899" },
    { key: "averageRating", label: "Avg Rating", icon: Star, value: kpis.averageRating.toFixed(1), color: "#eab308" },
    { key: "totalInventoryValue", label: "Inventory Value", icon: DollarSign, value: `$${kpis.totalInventoryValue.toLocaleString()}`, color: "#10b981" },
    { key: "noImageProducts", label: "No Image", icon: ImageIcon, value: kpis.noImageProducts, color: "#ef4444" },
    { key: "noCategoryProducts", label: "No Category", icon: FolderOpen, value: kpis.noCategoryProducts, color: "#f97316" },
  ];

  // ════════════════════════════ RENDER ════════════════════════════

  return (
    <div className="space-y-5">
      {/* ──── HEADER ──── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-[24px] font-extrabold tracking-tight", txt)}>Products</h1>
          <p className={cn("text-sm mt-0.5", sub)}>Manage your complete product catalog.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => onNavigate ? onNavigate("addproduct") : openCreate()} className="h-[40px] px-4 rounded-[11px] bg-[#2563eb] text-white text-[13px] font-semibold flex items-center gap-2 hover:bg-[#1d4ed8] transition-colors">
            <Plus className="w-4 h-4" /> Add Product
          </button>
          <button onClick={() => handleExport("csv")} className={cn("h-[40px] px-3 rounded-[11px] border text-[13px] font-semibold flex items-center gap-2 transition-colors", brd, txt, hover)}>
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => { fetchProducts(); fetchKpis(); }} className={cn("h-[40px] w-[40px] rounded-[11px] border flex items-center justify-center transition-colors", brd, txt, hover)}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ──── KPI CARDS ──── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
        {kpiCards.map(k => (
          <div key={k.key} className={cn("rounded-[14px] border p-3.5 transition-all", p, brd, hover)}>
            {kpisLoading ? (
              <div className="animate-pulse space-y-2">
                <div className={cn("h-3 w-16 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-6 w-10 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1.5">
                  <k.icon className="w-3.5 h-3.5" style={{ color: k.color }} />
                  <span className={cn("text-[11px] font-semibold uppercase tracking-wider", sub)}>{k.label}</span>
                </div>
                <p className={cn("text-[20px] font-extrabold", txt)}>{k.value}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ──── SEARCH & FILTERS BAR ──── */}
      <div className={cn("rounded-[16px] border p-4", p, brd)}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className={cn("flex items-center gap-2 h-[42px] px-3 rounded-[11px] border flex-1 min-w-[220px]", inp)}>
            <Search className="w-4 h-4 shrink-0 opacity-50" />
            <input
              ref={searchRef}
              defaultValue={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by name, SKU, description..."
              className="bg-transparent outline-none w-full text-sm"
            />
          </div>

          {/* Status pills */}
          <div className="flex gap-1.5">
            {["all", "active", "draft", "archived"].map(s => (
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
                {s}
              </button>
            ))}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "h-[42px] px-3 rounded-[11px] border text-[13px] font-semibold flex items-center gap-2 transition-colors",
              showFilters ? "bg-[#2563eb] text-white border-[#2563eb]" : cn(brd, txt, hover)
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-[#ef4444] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className={cn("mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3", brd)}>
            <div>
              <label className={cn("text-[11px] font-semibold mb-1 block", sub)}>Category</label>
              <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} className={cn(inpCls, "h-[38px]")}>
                <option value="all">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={cn("text-[11px] font-semibold mb-1 block", sub)}>Brand</label>
              <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1); }} className={cn(inpCls, "h-[38px]")}>
                <option value="all">All Brands</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className={cn("text-[11px] font-semibold mb-1 block", sub)}>Stock</label>
              <select value={stockFilter} onChange={e => { setStockFilter(e.target.value as StockFilter); setPage(1); }} className={cn(inpCls, "h-[38px]")}>
                <option value="all">All Stock</option>
                <option value="out">Out of Stock</option>
                <option value="low">Low Stock (1-5)</option>
                <option value="ok">In Stock (5+)</option>
              </select>
            </div>
            <div>
              <label className={cn("text-[11px] font-semibold mb-1 block", sub)}>Featured</label>
              <select value={featuredFilter} onChange={e => { setFeaturedFilter(e.target.value); setPage(1); }} className={cn(inpCls, "h-[38px]")}>
                <option value="all">All</option>
                <option value="true">Featured</option>
                <option value="false">Not Featured</option>
              </select>
            </div>
            <div>
              <label className={cn("text-[11px] font-semibold mb-1 block", sub)}>New Arrival</label>
              <select value={newFilter} onChange={e => { setNewFilter(e.target.value); setPage(1); }} className={cn(inpCls, "h-[38px]")}>
                <option value="all">All</option>
                <option value="true">New</option>
                <option value="false">Not New</option>
              </select>
            </div>
            <div>
              <label className={cn("text-[11px] font-semibold mb-1 block", sub)}>Flash Deal</label>
              <select value={flashDealFilter} onChange={e => { setFlashDealFilter(e.target.value); setPage(1); }} className={cn(inpCls, "h-[38px]")}>
                <option value="all">All</option>
                <option value="true">Has Deal</option>
              </select>
            </div>
            {activeFilterCount > 0 && (
              <div className="col-span-full">
                <button onClick={clearFilters} className="text-[#2563eb] text-[12px] font-semibold hover:underline flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ──── BULK ACTIONS BAR ──── */}
      {selected.size > 0 && (
        <div className={cn("rounded-[14px] border px-4 py-3 flex items-center justify-between", dark ? "bg-[#1a2233] border-[#2563eb]/30" : "bg-[#eff6ff] border-[#2563eb]/20")}>
          <span className={cn("text-sm font-semibold", txt)}>{selected.size} product{selected.size > 1 ? "s" : ""} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => handleBulkAction("activate")} className="px-3 py-1.5 rounded-lg bg-[#16a34a] text-white text-[12px] font-semibold hover:bg-[#15803d] transition-colors">Activate</button>
            <button onClick={() => handleBulkAction("draft")} className="px-3 py-1.5 rounded-lg bg-[#d97706] text-white text-[12px] font-semibold hover:bg-[#b45309] transition-colors">Draft</button>
            <button onClick={() => handleBulkAction("archive")} className="px-3 py-1.5 rounded-lg bg-[#64748b] text-white text-[12px] font-semibold hover:bg-[#475569] transition-colors">Archive</button>
            <button onClick={() => handleBulkAction("delete")} className="px-3 py-1.5 rounded-lg bg-[#ef4444] text-white text-[12px] font-semibold hover:bg-[#dc2626] transition-colors">Delete</button>
            <button onClick={() => setSelected(new Set())} className={cn("px-3 py-1.5 rounded-lg text-[12px] font-semibold", txt, hover)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ──── ERROR ──── */}
      {error && (
        <div className="rounded-[14px] border border-red-300 bg-red-50 p-4 text-sm text-red-600">
          {error}
          <button onClick={fetchProducts} className="ml-3 underline">Retry</button>
        </div>
      )}

      {/* ──── PRODUCTS TABLE ──── */}
      <div className={cn("rounded-[16px] border overflow-hidden", p, brd)}>
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#2563eb] mx-auto" />
            <p className={cn("text-sm mt-3", sub)}>Loading products...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={cn("border-b", brd)}>
                    <th className="w-10 p-3">
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" />
                    </th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Product</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden lg:table-cell", sub)}>SKU</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden md:table-cell", sub)}>Category</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden lg:table-cell", sub)}>Brand</th>
                    <SortHeader label="Price" sortKey="price" currentKey={sortKey} order={sortOrder} onSort={handleSort} dark={dark} />
                    <SortHeader label="Stock" sortKey="stock" currentKey={sortKey} order={sortOrder} onSort={handleSort} dark={dark} className="hidden md:table-cell" />
                    <SortHeader label="Sold" sortKey="sales" currentKey={sortKey} order={sortOrder} onSort={handleSort} dark={dark} className="hidden xl:table-cell" />
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden xl:table-cell", sub)}>Rating</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Status</th>
                    <th className={cn("text-right text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(prod => {
                    const sc = statusColors[prod.status] || statusColors.draft;
                    return (
                      <tr
                        key={prod.id}
                        className={cn("border-b last:border-0 transition-colors", brd, hover, selected.has(prod.id) && (dark ? "bg-[#2563eb]/5" : "bg-[#2563eb]/[.03]"))}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected.has(prod.id)}
                            onChange={() => {
                              const n = new Set(selected);
                              n.has(prod.id) ? n.delete(prod.id) : n.add(prod.id);
                              setSelected(n);
                            }}
                            className="rounded"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-11 h-11 rounded-[10px] shrink-0 overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                              {prod.images?.[0] ? (
                                <img src={prod.images[0]} alt="" className="w-11 h-11 object-cover" />
                              ) : (
                                <div className={cn("w-full h-full flex items-center justify-center", sub)}>
                                  <ImageIcon className="w-4 h-4 opacity-40" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <button onClick={() => openDetail(prod)} className={cn("text-sm font-semibold truncate block text-left hover:text-[#2563eb] transition-colors", txt)}>
                                {prod.name}
                              </button>
                              <p className={cn("text-[11px] truncate max-w-[200px]", sub)}>{prod.slug}</p>
                              {prod.supplier_id && (prod.cj_sku || prod.cj_product_id) && (
                                <p className={cn("text-[10px] font-mono truncate max-w-[200px]", sub)} title="CJ SKU / Product ID — real, from the supplier, never invented">
                                  CJ: {prod.cj_sku || prod.cj_product_id}
                                </p>
                              )}
                              <div className="flex gap-1 mt-0.5">
                                {prod.is_featured && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#8b5cf6]/10 text-[#8b5cf6]">FEATURED</span>}
                                {prod.is_new && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#06b6d4]/10 text-[#06b6d4]">NEW</span>}
                                {prod.hasFlashDeal && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#ec4899]/10 text-[#ec4899]">DEAL</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={cn("p-3 text-[12px] font-mono hidden lg:table-cell", sub)}>
                          {prod.variants?.[0]?.sku || "—"}
                        </td>
                        <td className={cn("p-3 text-sm hidden md:table-cell", sub)}>
                          {prod.category?.name || <span className="text-[#ef4444]">—</span>}
                        </td>
                        <td className={cn("p-3 text-sm hidden lg:table-cell", sub)}>
                          {prod.brand?.name || "—"}
                        </td>
                        <td className={cn("p-3", txt)}>
                          <span className="text-sm font-bold">${prod.price.toFixed(2)}</span>
                          {prod.compare_price && prod.compare_price > prod.price && (
                            <span className={cn("text-[11px] line-through ml-1.5", sub)}>${prod.compare_price.toFixed(2)}</span>
                          )}
                        </td>
                        <td className={cn("p-3 text-sm hidden md:table-cell font-semibold", prod.totalStock === 0 ? "text-[#ef4444]" : prod.totalStock <= 5 ? "text-[#f97316]" : sub)}>
                          {prod.totalStock}
                        </td>
                        <td className={cn("p-3 text-sm hidden xl:table-cell font-semibold", sub)}>
                          {prod.totalSold}
                        </td>
                        <td className={cn("p-3 hidden xl:table-cell")}>
                          {prod.avgRating > 0 ? (
                            <div className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-[#eab308] fill-[#eab308]" />
                              <span className={cn("text-sm font-semibold", txt)}>{prod.avgRating.toFixed(1)}</span>
                              <span className={cn("text-[11px]", sub)}>({prod.reviewCount})</span>
                            </div>
                          ) : (
                            <span className={cn("text-sm", sub)}>—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={cn(
                            "inline-block px-2.5 py-1 rounded-md text-[11px] font-bold capitalize",
                            dark ? cn(sc.darkBg, sc.darkText) : cn(sc.bg, sc.text)
                          )}>
                            {prod.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => openDetail(prod)} title="View" className="p-1.5 rounded-lg hover:bg-[#2563eb]/10 text-[#2563eb] transition-colors">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEdit(prod)} title="Edit" className="p-1.5 rounded-lg hover:bg-[#2563eb]/10 text-[#2563eb] transition-colors">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDuplicate(prod)} title="Duplicate" className={cn("p-1.5 rounded-lg transition-colors", dark ? "hover:bg-white/10 text-[#8b95a3]" : "hover:bg-black/5 text-[#8a929c]")}>
                              <Copy className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleArchive(prod.id)} title="Archive" className={cn("p-1.5 rounded-lg transition-colors", dark ? "hover:bg-white/10 text-[#8b95a3]" : "hover:bg-black/5 text-[#8a929c]")}>
                              <Archive className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(prod.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-[#ef4444] transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={11} className={cn("p-12 text-center", sub)}>
                        <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-semibold">No products found</p>
                        <p className="text-[12px] mt-1">Try adjusting your filters or add a new product.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className={cn("flex items-center justify-between px-4 py-3 border-t", brd)}>
              <p className={cn("text-[12px]", sub)}>
                {total} product{total !== 1 ? "s" : ""} · Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30 transition-colors", hover)}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (page <= 3) pageNum = i + 1;
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = page - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-[12px] font-semibold transition-colors",
                        page === pageNum
                          ? "bg-[#2563eb] text-white"
                          : cn(txt, hover)
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30 transition-colors", hover)}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════ CREATE / EDIT DRAWER ══════════════════════ */}
      {formOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" onClick={() => setFormOpen(false)} />
          <div className={cn(
            "absolute top-0 right-0 h-full w-full max-w-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-200",
            dark ? "bg-[#171c24]" : "bg-white"
          )}>
            {/* Drawer header */}
            <div className={cn("flex items-center justify-between px-6 py-4 border-b shrink-0", brd)}>
              <h2 className={cn("text-[18px] font-extrabold", txt)}>
                {editProduct ? "Edit Product" : "Add Product"}
              </h2>
              <button onClick={() => setFormOpen(false)} className={cn("h-8 w-8 rounded-full flex items-center justify-center transition-colors", hover)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Name */}
              <div>
                <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Product Name *</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} className={inpCls} placeholder="Nike Air Max 90" />
              </div>

              {/* Description */}
              <div>
                <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Description</label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={4} className={cn(inpCls, "h-auto py-3")} placeholder="Product description..." />
              </div>

              {/* Category & Brand */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Category</label>
                  <select value={formCategoryId} onChange={e => setFormCategoryId(e.target.value)} className={inpCls}>
                    <option value="">Select category...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Brand</label>
                  <select value={formBrandId} onChange={e => setFormBrandId(e.target.value)} className={inpCls}>
                    <option value="">Select brand...</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Price *</label>
                  <input type="number" step="0.01" value={formPrice} onChange={e => setFormPrice(e.target.value)} className={inpCls} placeholder="0.00" />
                </div>
                <div>
                  <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Compare-at Price</label>
                  <input type="number" step="0.01" value={formComparePrice} onChange={e => setFormComparePrice(e.target.value)} className={inpCls} placeholder="0.00" />
                </div>
              </div>

              {/* Images */}
              <div>
                <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Image URLs (comma separated)</label>
                <input value={formImages} onChange={e => setFormImages(e.target.value)} className={inpCls} placeholder="https://example.com/image1.jpg, https://..." />
                {formImages && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {formImages.split(",").map((url, i) => url.trim() && (
                      <div key={i} className={cn("w-14 h-14 rounded-lg overflow-hidden border", brd)}>
                        <img src={url.trim()} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = "none")} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className={cn("text-[12px] font-semibold mb-1.5 block", txt)}>Tags (comma separated)</label>
                <input value={formTags} onChange={e => setFormTags(e.target.value)} className={inpCls} placeholder="running, lifestyle, premium" />
              </div>

              {/* Flags */}
              <div className="flex flex-wrap items-center gap-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formStatus === "active"} onChange={e => setFormStatus(e.target.checked ? "active" : "draft")} className="rounded" />
                  <span className={cn("text-sm font-semibold", txt)}>Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formFeatured} onChange={e => setFormFeatured(e.target.checked)} className="rounded" />
                  <span className={cn("text-sm font-semibold", txt)}>Featured</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formNew} onChange={e => setFormNew(e.target.checked)} className="rounded" />
                  <span className={cn("text-sm font-semibold", txt)}>New Arrival</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formTrending} onChange={e => setFormTrending(e.target.checked)} className="rounded" />
                  <span className={cn("text-sm font-semibold", txt)}>Trending Now</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formBestSeller} onChange={e => setFormBestSeller(e.target.checked)} className="rounded" />
                  <span className={cn("text-sm font-semibold", txt)}>Best Seller</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formFlashSale} onChange={e => setFormFlashSale(e.target.checked)} className="rounded" />
                  <span className={cn("text-sm font-semibold", txt)}>Flash Sale</span>
                </label>
              </div>

              {/* Variants */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className={cn("text-sm font-bold", txt)}>Variants</label>
                  <button onClick={addVariant} className="text-[#2563eb] text-[12px] font-semibold flex items-center gap-1 hover:underline">
                    <Plus className="w-3.5 h-3.5" /> Add Variant
                  </button>
                </div>
                <div className={cn("border rounded-[12px] overflow-hidden", brd)}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={cn("border-b", brd)}>
                        <th className={cn("text-left p-2.5 text-[11px] font-bold uppercase", sub)}>Size</th>
                        <th className={cn("text-left p-2.5 text-[11px] font-bold uppercase", sub)}>Color</th>
                        <th className={cn("text-left p-2.5 text-[11px] font-bold uppercase", sub)}>Hex</th>
                        <th className={cn("text-left p-2.5 text-[11px] font-bold uppercase", sub)}>Stock</th>
                        <th className={cn("text-left p-2.5 text-[11px] font-bold uppercase", sub)}>SKU</th>
                        <th className="w-9" />
                      </tr>
                    </thead>
                    <tbody>
                      {formVariants.map((v, i) => (
                        <tr key={i} className={cn("border-b last:border-0", brd)}>
                          <td className="p-2"><input value={v.size} onChange={e => updateVariant(i, "size", e.target.value)} className={cn("w-full h-8 rounded-lg border px-2 text-[12px]", inp)} placeholder="US 10" /></td>
                          <td className="p-2"><input value={v.color} onChange={e => updateVariant(i, "color", e.target.value)} className={cn("w-full h-8 rounded-lg border px-2 text-[12px]", inp)} placeholder="Black" /></td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <input type="color" value={v.color_hex || "#000000"} onChange={e => updateVariant(i, "color_hex", e.target.value)} className="w-7 h-7 rounded border-0 cursor-pointer" />
                            </div>
                          </td>
                          <td className="p-2"><input type="number" value={v.stock} onChange={e => updateVariant(i, "stock", Number(e.target.value))} className={cn("w-full h-8 rounded-lg border px-2 text-[12px]", inp)} /></td>
                          <td className="p-2"><input value={v.sku} onChange={e => updateVariant(i, "sku", e.target.value)} className={cn("w-full h-8 rounded-lg border px-2 text-[12px]", inp)} placeholder="SKU-001" /></td>
                          <td className="p-2">
                            <button onClick={() => removeVariant(i)} className="text-[#ef4444] hover:bg-[#ef4444]/10 p-1 rounded transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sticky save bar */}
            <div className={cn("px-6 py-4 border-t shrink-0", brd)}>
              <div className="flex gap-3">
                <button onClick={() => setFormOpen(false)} className={cn("flex-1 h-[44px] rounded-[11px] border text-sm font-semibold transition-colors", brd, txt, hover)}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={formSaving || !formName || !formPrice} className="flex-1 h-[44px] rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {formSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {formSaving ? "Saving..." : editProduct ? "Update Product" : "Create Product"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ PRODUCT DETAIL PANEL ══════════════════════ */}
      {detailProduct && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" onClick={() => setDetailProduct(null)} />
          <div className={cn(
            "absolute top-0 right-0 h-full w-full max-w-3xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-200",
            dark ? "bg-[#171c24]" : "bg-white"
          )}>
            {/* Header */}
            <div className={cn("flex items-center justify-between px-6 py-4 border-b shrink-0", brd)}>
              <div className="flex items-center gap-3">
                {detailProduct.images?.[0] && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden">
                    <img src={detailProduct.images[0]} alt="" className="w-10 h-10 object-cover" />
                  </div>
                )}
                <div>
                  <h2 className={cn("text-[16px] font-extrabold", txt)}>{detailProduct.name}</h2>
                  <p className={cn("text-[11px]", sub)}>{detailProduct.slug}</p>
                  {(() => {
                    const cjSku = detailData?.cj_sku as string | null | undefined;
                    const cjProductId = detailData?.cj_product_id as string | null | undefined;
                    if (!cjSku && !cjProductId) return null;
                    return (
                      <p className={cn("text-[11px] font-mono mt-0.5", sub)}>
                        CJ SKU: <span className={txt}>{cjSku || "—"}</span>
                        {" · "}Product ID: <span className={txt}>{cjProductId || "—"}</span>
                      </p>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setDetailProduct(null); openEdit(detailProduct); }} className="h-8 px-3 rounded-lg bg-[#2563eb] text-white text-[12px] font-semibold hover:bg-[#1d4ed8] transition-colors flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => setDetailProduct(null)} className={cn("h-8 w-8 rounded-full flex items-center justify-center transition-colors", hover)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className={cn("flex overflow-x-auto px-6 border-b shrink-0 gap-0", brd)}>
              {(["general", "media", "variants", "inventory", "pricing", "seo", "reviews", "analytics"] as DetailTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={cn(
                    "px-4 py-3 text-[12px] font-semibold capitalize whitespace-nowrap border-b-2 transition-colors",
                    detailTab === tab
                      ? "border-[#2563eb] text-[#2563eb]"
                      : cn("border-transparent", sub, "hover:text-[#2563eb]")
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {detailLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />
                </div>
              ) : (
                <DetailTabContent
                  tab={detailTab}
                  product={detailProduct}
                  data={detailData}
                  dark={dark}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──── TOAST ──── */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200",
          toast.type === "success" && "bg-[#16a34a]",
          toast.type === "error" && "bg-[#ef4444]",
          toast.type === "info" && "bg-[#2563eb]"
        )}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────── SORT HEADER ────────────────────────────

function SortHeader({ label, sortKey, currentKey, order, onSort, dark, className }: {
  label: string; sortKey: SortKey; currentKey: SortKey; order: SortOrder;
  onSort: (key: SortKey) => void; dark: boolean; className?: string;
}) {
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const isActive = currentKey === sortKey;
  return (
    <th className={cn("text-left p-3", className)}>
      <button onClick={() => onSort(sortKey)} className={cn("text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors", isActive ? "text-[#2563eb]" : sub)}>
        {label}
        {isActive ? (order === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );
}

// ──────────────────────────── DETAIL TAB CONTENT ────────────────────────────

function DetailTabContent({ tab, product, data, dark }: {
  tab: DetailTab; product: Product; data: Record<string, unknown> | null; dark: boolean;
}) {
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const p = dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]";

  const detail = data as Record<string, unknown> | null;
  const variants = (detail?.variants as ProductVariant[]) || product.variants || [];
  const reviews = (detail?.reviews as (Review & { profile?: { full_name: string; email: string } })[]) || [];
  const flashDeals = (detail?.flashDeals as FlashDeal[]) || [];
  const salesStats = detail?.salesStats as { totalSold: number; totalRevenue: number; avgOrderValue: number } | undefined;

  switch (tab) {
    case "general":
      return (
        <div className="space-y-5">
          <DetailField label="Name" value={product.name} dark={dark} />
          <DetailField label="Slug" value={product.slug} dark={dark} />
          <DetailField label="Description" value={product.description || "No description"} dark={dark} />
          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Category" value={product.category?.name || "None"} dark={dark} />
            <DetailField label="Brand" value={product.brand?.name || "None"} dark={dark} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <DetailField label="Status" value={product.status} dark={dark} />
            <DetailField label="Featured" value={product.is_featured ? "Yes" : "No"} dark={dark} />
            <DetailField label="New Arrival" value={product.is_new ? "Yes" : "No"} dark={dark} />
          </div>
          <DetailField label="Tags" value={product.tags?.join(", ") || "None"} dark={dark} />
          <DetailField label="Created" value={new Date(product.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} dark={dark} />
        </div>
      );

    case "media":
      return (
        <div>
          <h3 className={cn("text-sm font-bold mb-4", txt)}>Product Images</h3>
          {product.images?.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {product.images.map((img, i) => (
                <div key={i} className={cn("aspect-square rounded-[12px] overflow-hidden border", brd)}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className={cn("text-center py-12 rounded-[12px] border", brd)}>
              <ImageIcon className={cn("w-8 h-8 mx-auto mb-2 opacity-30", sub)} />
              <p className={cn("text-sm", sub)}>No images uploaded</p>
            </div>
          )}
        </div>
      );

    case "variants":
      return (
        <div>
          <h3 className={cn("text-sm font-bold mb-4", txt)}>{variants.length} Variant{variants.length !== 1 ? "s" : ""}</h3>
          {variants.length > 0 ? (
            <div className={cn("border rounded-[12px] overflow-hidden", brd)}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn("border-b", brd)}>
                    <th className={cn("text-left p-3 text-[11px] font-bold uppercase", sub)}>Size</th>
                    <th className={cn("text-left p-3 text-[11px] font-bold uppercase", sub)}>Color</th>
                    <th className={cn("text-left p-3 text-[11px] font-bold uppercase", sub)}>Stock</th>
                    <th className={cn("text-left p-3 text-[11px] font-bold uppercase", sub)}>SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map(v => (
                    <tr key={v.id} className={cn("border-b last:border-0", brd)}>
                      <td className={cn("p-3 font-semibold", txt)}>{v.size}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {v.color_hex && <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: v.color_hex }} />}
                          <span className={sub}>{v.color || "—"}</span>
                        </div>
                      </td>
                      <td className={cn("p-3 font-semibold", v.stock === 0 ? "text-[#ef4444]" : v.stock <= 5 ? "text-[#f97316]" : txt)}>{v.stock}</td>
                      <td className={cn("p-3 font-mono text-[12px]", sub)}>{v.sku || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={cn("text-sm", sub)}>No variants defined.</p>
          )}
        </div>
      );

    case "inventory":
      const totalStock = variants.reduce((s, v) => s + v.stock, 0);
      const outOfStockVars = variants.filter(v => v.stock === 0).length;
      const lowStockVars = variants.filter(v => v.stock > 0 && v.stock <= 5).length;
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className={cn("rounded-[12px] border p-4 text-center", brd)}>
              <p className={cn("text-[22px] font-extrabold", txt)}>{totalStock}</p>
              <p className={cn("text-[11px] font-semibold mt-1", sub)}>Total Stock</p>
            </div>
            <div className={cn("rounded-[12px] border p-4 text-center", brd)}>
              <p className="text-[22px] font-extrabold text-[#ef4444]">{outOfStockVars}</p>
              <p className={cn("text-[11px] font-semibold mt-1", sub)}>Out of Stock</p>
            </div>
            <div className={cn("rounded-[12px] border p-4 text-center", brd)}>
              <p className="text-[22px] font-extrabold text-[#f97316]">{lowStockVars}</p>
              <p className={cn("text-[11px] font-semibold mt-1", sub)}>Low Stock</p>
            </div>
          </div>
          <h3 className={cn("text-sm font-bold", txt)}>Stock by Variant</h3>
          {variants.map(v => (
            <div key={v.id} className={cn("flex items-center justify-between py-2 border-b last:border-0", brd)}>
              <span className={cn("text-sm", txt)}>{v.size} {v.color ? `/ ${v.color}` : ""}</span>
              <span className={cn("text-sm font-bold", v.stock === 0 ? "text-[#ef4444]" : v.stock <= 5 ? "text-[#f97316]" : txt)}>{v.stock} units</span>
            </div>
          ))}
        </div>
      );

    case "pricing":
      const margin = product.compare_price && product.compare_price > 0
        ? ((product.compare_price - product.price) / product.compare_price * 100).toFixed(1)
        : null;
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <DetailField label="Price" value={`$${product.price.toFixed(2)}`} dark={dark} />
            <DetailField label="Compare-at Price" value={product.compare_price ? `$${product.compare_price.toFixed(2)}` : "—"} dark={dark} />
          </div>
          {margin && (
            <DetailField label="Discount" value={`${margin}% off`} dark={dark} />
          )}
          {flashDeals.length > 0 && (
            <div>
              <h3 className={cn("text-sm font-bold mb-3", txt)}>Flash Deals</h3>
              {flashDeals.map(d => (
                <div key={d.id} className={cn("rounded-[12px] border p-3 mb-2", brd)}>
                  <div className="flex justify-between">
                    <span className={cn("text-sm font-semibold", txt)}>Deal Price: ${d.deal_price.toFixed(2)}</span>
                    <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded", d.is_active ? "bg-[#e8f7ee] text-[#16a34a]" : "bg-[#f1f5f9] text-[#64748b]")}>
                      {d.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className={cn("text-[11px] mt-1", sub)}>Ends: {new Date(d.ends_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
          <DetailField label="Inventory Value" value={`$${(product.price * variants.reduce((s, v) => s + v.stock, 0)).toFixed(2)}`} dark={dark} />
        </div>
      );

    case "seo":
      return (
        <div className="space-y-5">
          <h3 className={cn("text-sm font-bold", txt)}>Search Engine Preview</h3>
          <div className={cn("rounded-[12px] border p-4", brd)}>
            <p className="text-[#1a0dab] text-[16px] font-medium truncate">{product.name} | Atlanta Sneakers</p>
            <p className="text-[#006621] text-[13px] truncate">atlantasneaker.com/product/{product.slug}</p>
            <p className="text-[#545454] text-[13px] mt-1 line-clamp-2">{product.description || "No description available."}</p>
          </div>
          <DetailField label="URL Slug" value={`/product/${product.slug}`} dark={dark} />
          <DetailField label="Tags (Keywords)" value={product.tags?.join(", ") || "None"} dark={dark} />
        </div>
      );

    case "reviews":
      return (
        <div>
          <h3 className={cn("text-sm font-bold mb-4", txt)}>{reviews.length} Review{reviews.length !== 1 ? "s" : ""}</h3>
          {reviews.length > 0 ? (
            <div className="space-y-3">
              {reviews.map(r => (
                <div key={r.id} className={cn("rounded-[12px] border p-4", brd)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} className={cn("w-3.5 h-3.5", i < r.rating ? "text-[#eab308] fill-[#eab308]" : "text-[#d1d5db]")} />
                        ))}
                      </div>
                      <span className={cn("text-sm font-semibold", txt)}>{r.profile?.full_name || "Anonymous"}</span>
                    </div>
                    <span className={cn("text-[11px]", sub)}>{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.title && <p className={cn("text-sm font-semibold mb-1", txt)}>{r.title}</p>}
                  <p className={cn("text-sm", sub)}>{r.comment || "No comment"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className={cn("text-sm", sub)}>No reviews yet.</p>
          )}
        </div>
      );

    case "analytics":
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className={cn("rounded-[12px] border p-4 text-center", brd)}>
              <p className={cn("text-[22px] font-extrabold", txt)}>{salesStats?.totalSold || 0}</p>
              <p className={cn("text-[11px] font-semibold mt-1", sub)}>Units Sold</p>
            </div>
            <div className={cn("rounded-[12px] border p-4 text-center", brd)}>
              <p className={cn("text-[22px] font-extrabold", txt)}>${(salesStats?.totalRevenue || 0).toFixed(2)}</p>
              <p className={cn("text-[11px] font-semibold mt-1", sub)}>Total Revenue</p>
            </div>
            <div className={cn("rounded-[12px] border p-4 text-center", brd)}>
              <p className={cn("text-[22px] font-extrabold", txt)}>${(salesStats?.avgOrderValue || 0).toFixed(2)}</p>
              <p className={cn("text-[11px] font-semibold mt-1", sub)}>Avg Order Value</p>
            </div>
          </div>
        </div>
      );

    default:
      return <p className={cn("text-sm", sub)}>Coming soon.</p>;
  }
}

// ──────────────────────────── DETAIL FIELD ────────────────────────────

function DetailField({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  return (
    <div>
      <p className={cn("text-[11px] font-semibold uppercase tracking-wider mb-1", sub)}>{label}</p>
      <p className={cn("text-sm", txt)}>{value}</p>
    </div>
  );
}
