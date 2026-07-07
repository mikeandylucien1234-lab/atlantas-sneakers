// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  HelpCircle, Eye, ThumbsUp, ThumbsDown, Search, Plus, FolderOpen,
  ChevronLeft, ChevronRight, Edit3, Trash2, Copy, Download, Tag,
  ArrowUpDown, Star, Clock, BarChart3, Globe, Archive, Send,
  BookOpen, MessageSquare, TrendingUp, Hash, X, Check, RefreshCw,
  ChevronDown, ChevronUp, Pin, Sparkles, FileText, Link, Image as ImageIcon,
  Film, Paperclip, Layers, Users, Shield, Zap, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";

const STATUS_MAP: Record<string, { label: string; color: string; darkColor: string }> = {
  published: { label: "Published", color: "bg-emerald-100 text-emerald-700", darkColor: "bg-emerald-900/40 text-emerald-300" },
  draft: { label: "Draft", color: "bg-amber-100 text-amber-700", darkColor: "bg-amber-900/40 text-amber-300" },
  archived: { label: "Archived", color: "bg-gray-100 text-gray-600", darkColor: "bg-gray-800 text-gray-400" },
};

const STATUSES = ["all", "published", "draft", "archived"];

export function AdminFaq({ dark }: { dark: boolean }) {
  const [kpis, setKpis] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortBy, setSortBy] = useState("order");
  const [sortDir, setSortDir] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const [detailDrawer, setDetailDrawer] = useState<any>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [editorDrawer, setEditorDrawer] = useState<any>(null);
  const [categoryDrawer, setCategoryDrawer] = useState(false);
  const [analyticsDrawer, setAnalyticsDrawer] = useState(false);
  const [seoDrawer, setSeoDrawer] = useState(false);

  const [form, setForm] = useState<any>({});
  const [catForm, setCatForm] = useState<any>({ name: "", slug: "", description: "", icon: "", order: 0, parent_id: "" });
  const [seoForm, setSeoForm] = useState<any>({ title: "", description: "", keywords: "", og_image: "", canonical_url: "" });
  const [analytics, setAnalytics] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const api = useCallback(async (method: string, params?: any) => {
    const isGet = method === "GET";
    const url = isGet ? `/api/admin/faq?${new URLSearchParams(params).toString()}` : "/api/admin/faq";
    const res = await fetch(url, isGet ? undefined : {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(params),
    });
    return res.json();
  }, []);

  const loadKpis = useCallback(async () => { setKpis(await api("GET", { section: "kpis" })); }, [api]);

  const loadList = useCallback(async () => {
    setLoading(true);
    const params: any = { section: "list", page: String(page), limit: String(limit), sortBy, sortDir };
    if (search) params.search = search;
    if (statusFilter !== "all") params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    const data = await api("GET", params);
    setRows(data.rows || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [api, page, limit, search, statusFilter, categoryFilter, sortBy, sortDir]);

  const loadCategories = useCallback(async () => {
    const data = await api("GET", { section: "categories" });
    setCategories(data.categories || []);
  }, [api]);

  useEffect(() => { loadKpis(); loadCategories(); }, [loadKpis, loadCategories]);
  useEffect(() => { loadList(); }, [loadList]);

  const openDetail = async (id: string) => {
    const data = await api("GET", { section: "detail", id });
    setDetailDrawer(data);
    setDetailTab("overview");
  };

  const openEditor = (faq?: any) => {
    if (faq) {
      setForm({ ...faq });
    } else {
      setForm({
        question: "", answer: "", summary: "", category_id: "", subcategory_id: "",
        tags: [], icon: "", image: "", video: "", attachment: "",
        related_products: [], related_categories: [], related_coupons: [],
        related_deals: [], related_blog: [],
        status: "draft", is_featured: false, is_pinned: false, order: 0,
        slug: "", meta_title: "", meta_description: "",
      });
    }
    setEditorDrawer(faq || "new");
  };

  const saveFaq = async () => {
    setSaving(true);
    if (editorDrawer === "new") {
      await api("POST", { action: "create_faq", ...form });
    } else {
      await api("PUT", { id: form.id, ...form });
    }
    setSaving(false);
    setEditorDrawer(null);
    loadList();
    loadKpis();
  };

  const deleteFaq = async (id: string) => {
    await fetch(`/api/admin/faq?id=${id}`, { method: "DELETE" });
    loadList();
    loadKpis();
  };

  const bulkAction = async (action: string) => {
    if (!selected.length) return;
    await api("PATCH", { action, ids: selected });
    setSelected([]);
    loadList();
    loadKpis();
  };

  const saveCategory = async () => {
    setSaving(true);
    await api("POST", { action: "create_category", ...catForm });
    setSaving(false);
    setCatForm({ name: "", slug: "", description: "", icon: "", order: 0, parent_id: "" });
    loadCategories();
    loadKpis();
  };

  const deleteCategory = async (id: string) => {
    await fetch(`/api/admin/faq?id=${id}&type=category`, { method: "DELETE" });
    loadCategories();
    loadKpis();
  };

  const loadAnalytics = async () => {
    const data = await api("GET", { section: "analytics" });
    setAnalytics(data);
    setAnalyticsDrawer(true);
  };

  const loadSeo = async () => {
    const data = await api("GET", { section: "seo" });
    setSeoForm(data);
    setSeoDrawer(true);
  };

  const saveSeo = async () => {
    setSaving(true);
    await api("POST", { action: "save_seo", seo: seoForm });
    setSaving(false);
    setSeoDrawer(false);
  };

  const exportCsv = async () => {
    const data = await api("GET", { section: "export" });
    const r = data.rows || [];
    if (!r.length) return;
    const keys = Object.keys(r[0]);
    const csv = [keys.join(","), ...r.map((row: any) => keys.map(k => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `faq-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(1);
  };

  const toggleSelect = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(s => s.length === rows.length ? [] : rows.map(r => r.id));
  const totalPages = Math.ceil(total / limit);
  const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

  const kpiCards = kpis ? [
    { label: "Total FAQs", value: kpis.totalFaqs, icon: HelpCircle },
    { label: "Published", value: kpis.publishedFaqs, icon: Globe },
    { label: "Drafts", value: kpis.draftFaqs, icon: Edit3 },
    { label: "Categories", value: kpis.categories, icon: FolderOpen },
    { label: "Monthly Views", value: kpis.viewsMonth?.toLocaleString(), icon: Eye },
    { label: "Helpful Votes", value: kpis.helpful, icon: ThumbsUp },
    { label: "Unhelpful Votes", value: kpis.unhelpful, icon: ThumbsDown },
    { label: "Searches", value: kpis.searches, icon: Search },
    { label: "Top FAQ", value: kpis.topFaq, icon: Star },
    { label: "Top Category", value: kpis.topCategory, icon: TrendingUp },
  ] : [];

  const Skel = ({ w = "w-full", h = "h-5" }: { w?: string; h?: string }) => (
    <div className={cn(w, h, "rounded-[8px] animate-pulse", dark ? "bg-[#252c36]" : "bg-[#e5e7eb]")} />
  );

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {kpis ? kpiCards.map((k, i) => (
          <div key={i} className={cn("rounded-[14px] border p-3", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
            <div className="flex items-center gap-2 mb-1">
              <k.icon className={cn("w-4 h-4", dark ? "text-[#8b95a3]" : "text-[#8a929c]")} />
              <span className={cn("text-[11px] font-medium truncate", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{k.label}</span>
            </div>
            <p className={cn("text-lg font-bold truncate", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{k.value}</p>
          </div>
        )) : Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={cn("rounded-[14px] border p-3 space-y-2", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
            <Skel w="w-2/3" h="h-3" /><Skel w="w-1/2" h="h-6" />
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className={cn("rounded-[14px] border p-4", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", dark ? "text-[#8b95a3]" : "text-[#8a929c]")} />
            <input
              className={cn("w-full pl-9 pr-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
              placeholder="Search questions, answers, tags..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button onClick={() => openEditor()} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8]">
            <Plus className="w-4 h-4" /> New FAQ
          </button>
          <button onClick={() => setCategoryDrawer(true)} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-[10px] border text-sm font-medium", dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]")}>
            <FolderOpen className="w-4 h-4" /> Categories
          </button>
          <button onClick={loadAnalytics} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-[10px] border text-sm font-medium", dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]")}>
            <BarChart3 className="w-4 h-4" /> Analytics
          </button>
          <button onClick={loadSeo} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-[10px] border text-sm font-medium", dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]")}>
            <Globe className="w-4 h-4" /> SEO
          </button>
          <button onClick={exportCsv} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-[10px] border text-sm font-medium", dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]")}>
            <Download className="w-4 h-4" /> Export
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn("px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                statusFilter === s ? "bg-[#2563eb] text-white border-[#2563eb]"
                  : dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]"
              )}>{s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
          {categories.length > 0 && (
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
              className={cn("px-2 py-1 rounded-[8px] border text-xs", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {/* Bulk */}
        {selected.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}>
            <span className={cn("text-xs font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{selected.length} selected</span>
            {[
              { label: "Publish", action: "publish", color: "text-emerald-500" },
              { label: "Draft", action: "draft", color: "text-amber-500" },
              { label: "Archive", action: "archive", color: "text-gray-500" },
              { label: "Duplicate", action: "duplicate", color: "text-blue-500" },
              { label: "Delete", action: "delete", color: "text-red-500" },
            ].map(b => (
              <button key={b.action} onClick={() => bulkAction(b.action)} className={cn("text-xs font-semibold px-2 py-1 rounded-[6px] hover:bg-black/5", b.color)}>{b.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className={cn("rounded-[14px] border overflow-hidden", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={cn("border-b", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                <th className="p-3 w-10"><input type="checkbox" checked={selected.length === rows.length && rows.length > 0} onChange={toggleAll} className="rounded" /></th>
                {[
                  { key: "question", label: "Question" },
                  { key: "category_id", label: "Category" },
                  { key: "views", label: "Views" },
                  { key: "helpful", label: "Helpful" },
                  { key: "unhelpful", label: "Unhelpful" },
                  { key: "status", label: "Status" },
                  { key: "updated_at", label: "Updated" },
                ].map(col => (
                  <th key={col.key} className={cn("p-3 text-left font-semibold cursor-pointer select-none", dark ? "text-[#8b95a3]" : "text-[#8a929c]")} onClick={() => toggleSort(col.key)}>
                    <span className="flex items-center gap-1">{col.label}{sortBy === col.key && <ArrowUpDown className="w-3 h-3" />}</span>
                  </th>
                ))}
                <th className={cn("p-3 text-right font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className={cn("border-b", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                  {Array.from({ length: 9 }).map((_, j) => <td key={j} className="p-3"><Skel h="h-4" /></td>)}
                </tr>
              )) : rows.length === 0 ? (
                <tr><td colSpan={9} className={cn("p-12 text-center", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No FAQs found</td></tr>
              ) : rows.map(row => {
                const st = STATUS_MAP[row.status] || STATUS_MAP.draft;
                return (
                  <tr key={row.id} className={cn("border-b cursor-pointer transition-colors", dark ? "border-[#252c36] hover:bg-[#1c2230]" : "border-[#eef0f3] hover:bg-[#f8f9fb]")} onClick={() => openDetail(row.id)}>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelect(row.id)} className="rounded" />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {row.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                        {row.is_featured && <Star className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />}
                        <p className={cn("font-semibold truncate max-w-[320px]", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{row.question}</p>
                      </div>
                      {row.author && <p className={cn("text-xs mt-0.5 truncate", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{row.author.full_name}</p>}
                    </td>
                    <td className={cn("p-3 text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{catMap[row.category_id] || "—"}</td>
                    <td className={cn("p-3", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{(row.views || 0).toLocaleString()}</td>
                    <td className="p-3 text-emerald-500 font-medium">{row.helpful || 0}</td>
                    <td className="p-3 text-red-500 font-medium">{row.unhelpful || 0}</td>
                    <td className="p-3"><span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", dark ? st.darkColor : st.color)}>{st.label}</span></td>
                    <td className={cn("p-3 text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{row.updated_at ? new Date(row.updated_at).toLocaleDateString() : "—"}</td>
                    <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditor(row)} className={cn("p-1.5 rounded-[8px]", dark ? "text-[#8b95a3] hover:bg-[#252c36]" : "text-[#8a929c] hover:bg-[#f4f6f9]")}><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => deleteFaq(row.id)} className="p-1.5 rounded-[8px] text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className={cn("flex items-center justify-between px-4 py-3 border-t", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
            <span className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={cn("p-1.5 rounded-[8px]", dark ? "text-[#8b95a3] hover:bg-[#252c36]" : "text-[#8a929c] hover:bg-[#f4f6f9]", page <= 1 && "opacity-40")}><ChevronLeft className="w-4 h-4" /></button>
              <span className={cn("text-xs px-2", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className={cn("p-1.5 rounded-[8px]", dark ? "text-[#8b95a3] hover:bg-[#252c36]" : "text-[#8a929c] hover:bg-[#f4f6f9]", page >= totalPages && "opacity-40")}><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <Drawer open={!!detailDrawer} onClose={() => setDetailDrawer(null)} dark={dark} width="lg">
        {detailDrawer && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {detailDrawer.is_pinned && <Pin className="w-4 h-4 text-amber-500" />}
                  {detailDrawer.is_featured && <Star className="w-4 h-4 text-yellow-500" />}
                </div>
                <h2 className={cn("text-xl font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{detailDrawer.question}</h2>
                {detailDrawer.author && <p className={cn("text-sm mt-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>By {detailDrawer.author.full_name}</p>}
              </div>
              <button onClick={() => { setDetailDrawer(null); openEditor(detailDrawer); }} className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-[#2563eb] text-white text-sm font-semibold">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>

            <div className={cn("flex gap-1 border-b pb-0", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
              {["overview", "feedback", "versions", "seo"].map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={cn("px-3 py-2 text-sm font-semibold rounded-t-[8px] -mb-px border-b-2 transition-all",
                    detailTab === t ? "border-[#2563eb] text-[#2563eb]" : cn("border-transparent", dark ? "text-[#8b95a3]" : "text-[#8a929c]")
                  )}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
              ))}
            </div>

            {detailTab === "overview" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Status", value: STATUS_MAP[detailDrawer.status]?.label || detailDrawer.status },
                    { label: "Category", value: catMap[detailDrawer.category_id] || "—" },
                    { label: "Views", value: (detailDrawer.views || 0).toLocaleString() },
                    { label: "Helpful", value: detailDrawer.helpful || 0 },
                    { label: "Unhelpful", value: detailDrawer.unhelpful || 0 },
                    { label: "Searches", value: detailDrawer.searches || 0 },
                    { label: "Pinned", value: detailDrawer.is_pinned ? "Yes" : "No" },
                    { label: "Featured", value: detailDrawer.is_featured ? "Yes" : "No" },
                  ].map((item, i) => (
                    <div key={i} className={cn("rounded-[10px] border p-3", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
                      <p className={cn("text-[11px] font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{item.label}</p>
                      <p className={cn("font-semibold mt-0.5", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{item.value}</p>
                    </div>
                  ))}
                </div>
                {detailDrawer.summary && (
                  <div>
                    <p className={cn("text-xs font-semibold mb-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Summary</p>
                    <p className={cn("text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{detailDrawer.summary}</p>
                  </div>
                )}
                <div>
                  <p className={cn("text-xs font-semibold mb-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Answer</p>
                  <div className={cn("rounded-[10px] border p-4 text-sm whitespace-pre-wrap", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f8f9fb] border-[#eef0f3] text-[#16181d]")}>
                    {detailDrawer.answer || "No answer yet."}
                  </div>
                </div>
                {detailDrawer.tags?.length > 0 && (
                  <div>
                    <p className={cn("text-xs font-semibold mb-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {detailDrawer.tags.map((t: string, i: number) => (
                        <span key={i} className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", dark ? "bg-[#252c36] text-[#8b95a3]" : "bg-[#f4f6f9] text-[#8a929c]")}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(detailDrawer.related_products?.length > 0 || detailDrawer.related_categories?.length > 0 || detailDrawer.related_coupons?.length > 0) && (
                  <div>
                    <p className={cn("text-xs font-semibold mb-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Related Content</p>
                    <div className="flex flex-wrap gap-1">
                      {(detailDrawer.related_products || []).map((id: string, i: number) => (
                        <span key={`p${i}`} className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", dark ? "bg-blue-900/30 text-blue-300" : "bg-blue-100 text-blue-700")}>Product: {id}</span>
                      ))}
                      {(detailDrawer.related_coupons || []).map((id: string, i: number) => (
                        <span key={`c${i}`} className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", dark ? "bg-emerald-900/30 text-emerald-300" : "bg-emerald-100 text-emerald-700")}>Coupon: {id}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {detailTab === "feedback" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className={cn("rounded-[10px] border p-4 text-center", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
                    <ThumbsUp className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                    <p className={cn("text-2xl font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{detailDrawer.helpful || 0}</p>
                    <p className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Helpful</p>
                  </div>
                  <div className={cn("rounded-[10px] border p-4 text-center", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
                    <ThumbsDown className="w-6 h-6 text-red-500 mx-auto mb-1" />
                    <p className={cn("text-2xl font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{detailDrawer.unhelpful || 0}</p>
                    <p className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Not Helpful</p>
                  </div>
                </div>
                {detailDrawer.feedback?.length > 0 ? detailDrawer.feedback.map((fb: any, i: number) => (
                  <div key={i} className={cn("flex items-start gap-3 p-3 rounded-[10px] border", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                    {fb.type === "helpful" ? <ThumbsUp className="w-4 h-4 text-emerald-500 mt-0.5" /> : <ThumbsDown className="w-4 h-4 text-red-500 mt-0.5" />}
                    <div>
                      <p className={cn("text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{fb.comment || "No comment"}</p>
                      <p className={cn("text-xs mt-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{fb.created_at ? new Date(fb.created_at).toLocaleString() : "—"}</p>
                    </div>
                  </div>
                )) : (
                  <p className={cn("text-sm text-center py-6", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No feedback yet.</p>
                )}
              </div>
            )}

            {detailTab === "versions" && (
              <div className="space-y-3">
                {detailDrawer.versions?.length > 0 ? detailDrawer.versions.map((v: any, i: number) => (
                  <div key={i} className={cn("p-3 rounded-[10px] border", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={cn("text-xs font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{v.created_at ? new Date(v.created_at).toLocaleString() : "—"}</p>
                    </div>
                    <p className={cn("text-sm font-semibold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{v.question}</p>
                    <p className={cn("text-xs mt-1 line-clamp-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{v.answer?.slice(0, 120)}</p>
                  </div>
                )) : (
                  <p className={cn("text-sm text-center py-6", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No previous versions.</p>
                )}
              </div>
            )}

            {detailTab === "seo" && (
              <div className="space-y-4">
                {[
                  { label: "Slug", value: detailDrawer.slug },
                  { label: "Meta Title", value: detailDrawer.meta_title },
                  { label: "Meta Description", value: detailDrawer.meta_description },
                ].map((item, i) => (
                  <div key={i}>
                    <p className={cn("text-xs font-semibold mb-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{item.label}</p>
                    <p className={cn("text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{item.value || "—"}</p>
                  </div>
                ))}
                <div className={cn("rounded-[10px] border p-4", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
                  <p className={cn("text-xs font-semibold mb-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Google Preview</p>
                  <p className="text-[#1a0dab] text-base font-medium truncate">{detailDrawer.meta_title || detailDrawer.question}</p>
                  <p className="text-[#006621] text-xs truncate">atlantasneakers.com/faq/{detailDrawer.slug}</p>
                  <p className={cn("text-xs mt-1 line-clamp-2", dark ? "text-[#8b95a3]" : "text-[#545454]")}>{detailDrawer.meta_description || detailDrawer.summary || ""}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Editor Drawer */}
      <Drawer open={!!editorDrawer} onClose={() => setEditorDrawer(null)} dark={dark} width="xl">
        <div className="space-y-4">
          <h2 className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>
            {editorDrawer === "new" ? "New FAQ" : "Edit FAQ"}
          </h2>

          <div>
            <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Question *</label>
            <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
              value={form.question || ""} onChange={e => setForm({ ...form, question: e.target.value })} />
          </div>

          <div>
            <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Summary</label>
            <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
              value={form.summary || ""} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Brief summary" />
          </div>

          <div>
            <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Answer</label>
            <textarea rows={8} className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm resize-none", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
              value={form.answer || ""} onChange={e => setForm({ ...form, answer: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Category</label>
              <select className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={form.category_id || ""} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                <option value="">No category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Status</label>
              <select className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={form.status || "draft"} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Order</label>
              <input type="number" className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={form.order || 0} onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Icon (emoji or name)</label>
              <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={form.icon || ""} onChange={e => setForm({ ...form, icon: e.target.value })} />
            </div>
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Slug</label>
              <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={form.slug || ""} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Image URL</label>
              <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={form.image || ""} onChange={e => setForm({ ...form, image: e.target.value })} />
            </div>
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Video URL</label>
              <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={form.video || ""} onChange={e => setForm({ ...form, video: e.target.value })} />
            </div>
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Attachment URL</label>
              <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={form.attachment || ""} onChange={e => setForm({ ...form, attachment: e.target.value })} />
            </div>
          </div>

          {/* SEO */}
          <div className={cn("rounded-[10px] border p-4", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
            <p className={cn("text-xs font-bold mb-3", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>SEO Settings</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={cn("text-[11px] font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Meta Title</label>
                <input className={cn("w-full mt-1 px-3 py-1.5 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                  value={form.meta_title || ""} onChange={e => setForm({ ...form, meta_title: e.target.value })} />
              </div>
              <div>
                <label className={cn("text-[11px] font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Meta Description</label>
                <input className={cn("w-full mt-1 px-3 py-1.5 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                  value={form.meta_description || ""} onChange={e => setForm({ ...form, meta_description: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_featured || false} onChange={e => setForm({ ...form, is_featured: e.target.checked })} className="rounded" />
              <span className={cn("text-sm font-medium", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Featured</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_pinned || false} onChange={e => setForm({ ...form, is_pinned: e.target.checked })} className="rounded" />
              <span className={cn("text-sm font-medium", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Pinned</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setEditorDrawer(null)} className={cn("px-4 py-2 rounded-[10px] text-sm font-semibold border", dark ? "border-[#252c36] text-[#8b95a3]" : "border-[#eef0f3] text-[#8a929c]")}>Cancel</button>
            <button onClick={saveFaq} disabled={saving || !form.question} className="px-4 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-40">
              {saving ? "Saving..." : editorDrawer === "new" ? "Create" : "Update"}
            </button>
          </div>
        </div>
      </Drawer>

      {/* Category Drawer */}
      <Drawer open={categoryDrawer} onClose={() => setCategoryDrawer(false)} dark={dark} width="md">
        <div className="space-y-4">
          <h2 className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Manage Categories</h2>
          {categories.length > 0 && (
            <div className="space-y-2">
              {categories.map(c => (
                <div key={c.id} className={cn("flex items-center justify-between px-3 py-2 rounded-[10px] border", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                  <div>
                    <p className={cn("font-semibold text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{c.icon ? `${c.icon} ` : ""}{c.name}</p>
                    <p className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{c.slug}{c.description ? ` — ${c.description}` : ""}</p>
                  </div>
                  <button onClick={() => deleteCategory(c.id)} className="p-1 rounded text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          <div className={cn("rounded-[10px] border p-4", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
            <p className={cn("text-xs font-bold mb-3", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Add Category</p>
            <div className="space-y-2">
              <input className={cn("w-full px-3 py-2 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                placeholder="Category name" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} />
              <input className={cn("w-full px-3 py-2 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                placeholder="Description (optional)" value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className={cn("px-3 py-2 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                  placeholder="Icon (emoji)" value={catForm.icon} onChange={e => setCatForm({ ...catForm, icon: e.target.value })} />
                <input type="number" className={cn("px-3 py-2 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                  placeholder="Order" value={catForm.order} onChange={e => setCatForm({ ...catForm, order: parseInt(e.target.value) || 0 })} />
              </div>
              {categories.length > 0 && (
                <select className={cn("w-full px-3 py-2 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                  value={catForm.parent_id || ""} onChange={e => setCatForm({ ...catForm, parent_id: e.target.value })}>
                  <option value="">No parent (root)</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <button onClick={saveCategory} disabled={saving || !catForm.name} className="w-full py-2 rounded-[8px] bg-[#2563eb] text-white text-sm font-semibold disabled:opacity-40">
                {saving ? "Creating..." : "Add Category"}
              </button>
            </div>
          </div>
        </div>
      </Drawer>

      {/* Analytics Drawer */}
      <Drawer open={analyticsDrawer} onClose={() => setAnalyticsDrawer(false)} dark={dark} width="lg">
        <div className="space-y-5">
          <h2 className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>FAQ Analytics</h2>
          {analytics ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: "Total Views", value: analytics.totalViews?.toLocaleString(), icon: Eye },
                  { label: "Helpful %", value: `${analytics.helpfulPct}%`, icon: ThumbsUp },
                  { label: "Helpful Votes", value: analytics.totalHelpful, icon: ThumbsUp },
                  { label: "Unhelpful Votes", value: analytics.totalUnhelpful, icon: ThumbsDown },
                  { label: "Searches", value: analytics.totalSearches, icon: Search },
                ].map((item, i) => (
                  <div key={i} className={cn("rounded-[10px] border p-3 flex items-center gap-3", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
                    <item.icon className={cn("w-5 h-5", dark ? "text-[#8b95a3]" : "text-[#8a929c]")} />
                    <div>
                      <p className={cn("text-[11px]", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{item.label}</p>
                      <p className={cn("font-bold text-lg", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {analytics.mostViewed?.length > 0 && (
                <div>
                  <p className={cn("text-xs font-bold mb-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Most Viewed</p>
                  <div className="space-y-2">
                    {analytics.mostViewed.slice(0, 5).map((f: any, i: number) => (
                      <div key={i} className={cn("flex items-center justify-between px-3 py-2 rounded-[8px] border", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                        <p className={cn("text-sm font-medium truncate flex-1 mr-3", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{f.question}</p>
                        <span className={cn("text-xs font-semibold flex-shrink-0", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{(f.views || 0).toLocaleString()} views</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics.mostHelpful?.length > 0 && (
                <div>
                  <p className={cn("text-xs font-bold mb-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Most Helpful</p>
                  <div className="space-y-2">
                    {analytics.mostHelpful.slice(0, 5).map((f: any, i: number) => (
                      <div key={i} className={cn("flex items-center justify-between px-3 py-2 rounded-[8px] border", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                        <p className={cn("text-sm font-medium truncate flex-1 mr-3", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{f.question}</p>
                        <span className="text-xs font-semibold text-emerald-500">{f.helpful || 0} votes</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics.leastViewed?.length > 0 && (
                <div>
                  <p className={cn("text-xs font-bold mb-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Least Viewed (needs attention)</p>
                  <div className="space-y-2">
                    {analytics.leastViewed.slice(0, 5).map((f: any, i: number) => (
                      <div key={i} className={cn("flex items-center justify-between px-3 py-2 rounded-[8px] border", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                        <p className={cn("text-sm font-medium truncate flex-1 mr-3", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{f.question}</p>
                        <span className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{f.views || 0} views</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} h="h-16" />)}</div>
          )}
        </div>
      </Drawer>

      {/* SEO Drawer */}
      <Drawer open={seoDrawer} onClose={() => setSeoDrawer(false)} dark={dark} width="md">
        <div className="space-y-4">
          <h2 className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>FAQ Page SEO</h2>
          {[
            { key: "title", label: "Meta Title" },
            { key: "description", label: "Meta Description" },
            { key: "keywords", label: "Keywords" },
            { key: "og_image", label: "OG Image URL" },
            { key: "canonical_url", label: "Canonical URL" },
          ].map(f => (
            <div key={f.key}>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{f.label}</label>
              <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={seoForm[f.key] || ""} onChange={e => setSeoForm({ ...seoForm, [f.key]: e.target.value })} />
            </div>
          ))}
          <div className={cn("rounded-[10px] border p-4", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
            <p className={cn("text-xs font-semibold mb-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Google Preview</p>
            <p className="text-[#1a0dab] text-base font-medium truncate">{seoForm.title || "FAQ - Atlanta Sneakers"}</p>
            <p className="text-[#006621] text-xs">atlantasneakers.com/faq</p>
            <p className={cn("text-xs mt-1 line-clamp-2", dark ? "text-[#8b95a3]" : "text-[#545454]")}>{seoForm.description || ""}</p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setSeoDrawer(false)} className={cn("px-4 py-2 rounded-[10px] text-sm font-semibold border", dark ? "border-[#252c36] text-[#8b95a3]" : "border-[#eef0f3] text-[#8a929c]")}>Cancel</button>
            <button onClick={saveSeo} disabled={saving} className="px-4 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-40">
              {saving ? "Saving..." : "Save SEO"}
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
