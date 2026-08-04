// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Eye, MessageSquare, Heart, Share2, Clock, Search, Plus,
  ChevronLeft, ChevronRight, MoreHorizontal, Edit3, Trash2, Copy,
  Download, Filter, Tag, FolderOpen, TrendingUp, BarChart3, Globe,
  Star, Archive, Send, BookOpen, Users, Layers, Hash, X, Check,
  RefreshCw, ArrowUpDown, Image as ImageIcon, ExternalLink, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";

type Article = any;
type Category = any;
type Tag_ = any;

const STATUS_MAP: Record<string, { label: string; color: string; darkColor: string }> = {
  published: { label: "Published", color: "bg-emerald-100 text-emerald-700", darkColor: "bg-emerald-900/40 text-emerald-300" },
  draft: { label: "Draft", color: "bg-amber-100 text-amber-700", darkColor: "bg-amber-900/40 text-amber-300" },
  scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-700", darkColor: "bg-blue-900/40 text-blue-300" },
  archived: { label: "Archived", color: "bg-gray-100 text-gray-600", darkColor: "bg-gray-800 text-gray-400" },
};

const STATUSES = ["all", "published", "draft", "scheduled", "archived"];

export function AdminBlog({ dark }: { dark: boolean }) {
  const [kpis, setKpis] = useState<any>(null);
  const [rows, setRows] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag_[]>([]);

  const [detailDrawer, setDetailDrawer] = useState<Article | null>(null);
  const [editorDrawer, setEditorDrawer] = useState<Article | null | "new">(null);
  const [categoryDrawer, setCategoryDrawer] = useState(false);
  const [tagDrawer, setTagDrawer] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");

  const [form, setForm] = useState<any>({});
  const [catForm, setCatForm] = useState<any>({ name: "", slug: "", description: "", image: "" });
  const [tagForm, setTagForm] = useState<any>({ name: "", slug: "" });
  const [saving, setSaving] = useState(false);

  const api = useCallback(async (method: string, params?: any) => {
    const isGet = method === "GET";
    const url = isGet ? `/api/admin/blog?${new URLSearchParams(params).toString()}` : "/api/admin/blog";
    const res = await fetch(url, isGet ? undefined : {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(params),
    });
    return res.json();
  }, []);

  const loadKpis = useCallback(async () => {
    const data = await api("GET", { section: "kpis" });
    setKpis(data);
  }, [api]);

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

  const loadMeta = useCallback(async () => {
    const [c, t] = await Promise.all([
      api("GET", { section: "categories" }),
      api("GET", { section: "tags" }),
    ]);
    setCategories(c.categories || []);
    setTags(t.tags || []);
  }, [api]);

  useEffect(() => { loadKpis(); loadMeta(); }, [loadKpis, loadMeta]);
  useEffect(() => { loadList(); }, [loadList]);

  const openDetail = async (id: string) => {
    const data = await api("GET", { section: "detail", id });
    setDetailDrawer(data);
    setDetailTab("overview");
  };

  const openEditor = (article?: Article) => {
    if (article) {
      setForm({ ...article });
    } else {
      setForm({
        title: "", slug: "", excerpt: "", content: "", category_id: "", tags: [],
        featured_image: "", status: "draft", meta_title: "", meta_description: "",
        focus_keyword: "", canonical_url: "", og_image: "", reading_time: 0,
        is_featured: false, published_at: "",
      });
    }
    setEditorDrawer(article || "new");
  };

  const saveArticle = async () => {
    setSaving(true);
    if (editorDrawer === "new") {
      await api("POST", { action: "create_article", ...form });
    } else {
      await api("PUT", { id: form.id, ...form });
    }
    setSaving(false);
    setEditorDrawer(null);
    loadList();
    loadKpis();
  };

  const deleteArticle = async (id: string) => {
    await fetch(`/api/admin/blog?id=${id}`, { method: "DELETE" });
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
    setCategoryDrawer(false);
    setCatForm({ name: "", slug: "", description: "", image: "" });
    loadMeta();
    loadKpis();
  };

  const saveTag = async () => {
    setSaving(true);
    await api("POST", { action: "create_tag", ...tagForm });
    setSaving(false);
    setTagDrawer(false);
    setTagForm({ name: "", slug: "" });
    loadMeta();
    loadKpis();
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
    a.download = `blog-export-${new Date().toISOString().slice(0, 10)}.csv`;
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

  const kpiCards = kpis ? [
    { label: "Total Articles", value: kpis.totalArticles, icon: FileText },
    { label: "Published", value: kpis.publishedArticles, icon: Globe },
    { label: "Drafts", value: kpis.draftArticles, icon: Edit3 },
    { label: "Scheduled", value: kpis.scheduledArticles, icon: Clock },
    { label: "Archived", value: kpis.archivedArticles, icon: Archive },
    { label: "Categories", value: kpis.totalCategories, icon: FolderOpen },
    { label: "Tags", value: kpis.totalTags, icon: Tag },
    { label: "Authors", value: kpis.totalAuthors, icon: Users },
    { label: "Monthly Views", value: kpis.monthlyViews?.toLocaleString(), icon: Eye },
    { label: "Avg Read Time", value: `${kpis.avgReadTime}m`, icon: BookOpen },
    { label: "Comments", value: kpis.comments, icon: MessageSquare },
    { label: "Likes", value: kpis.likes, icon: Heart },
    { label: "Shares", value: kpis.shares, icon: Share2 },
    { label: "Top Article", value: kpis.topArticle, icon: Star },
  ] : [];

  const Skel = ({ w = "w-full", h = "h-5" }: { w?: string; h?: string }) => (
    <div className={cn(w, h, "rounded-[8px] animate-pulse", dark ? "bg-[#252c36]" : "bg-[#e5e7eb]")} />
  );

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis ? kpiCards.map((k, i) => (
          <div key={i} className={cn("rounded-[14px] border p-3", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
            <div className="flex items-center gap-2 mb-1">
              <k.icon className={cn("w-4 h-4", dark ? "text-[#8b95a3]" : "text-[#8a929c]")} />
              <span className={cn("text-[11px] font-medium truncate", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{k.label}</span>
            </div>
            <p className={cn("text-lg font-bold truncate", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{k.value}</p>
          </div>
        )) : Array.from({ length: 14 }).map((_, i) => (
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
              placeholder="Search articles..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button onClick={() => openEditor()} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8]">
            <Plus className="w-4 h-4" /> New Article
          </button>
          <button onClick={() => setCategoryDrawer(true)} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-[10px] border text-sm font-medium", dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]")}>
            <FolderOpen className="w-4 h-4" /> Categories
          </button>
          <button onClick={() => setTagDrawer(true)} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-[10px] border text-sm font-medium", dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]")}>
            <Hash className="w-4 h-4" /> Tags
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
                statusFilter === s
                  ? "bg-[#2563eb] text-white border-[#2563eb]"
                  : dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]"
              )}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
              className={cn("px-2 py-1 rounded-[8px] border text-xs", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
            >
              <option value="">All Categories</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {/* Bulk actions */}
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
              <button key={b.action} onClick={() => bulkAction(b.action)} className={cn("text-xs font-semibold px-2 py-1 rounded-[6px] hover:bg-black/5", b.color)}>
                {b.label}
              </button>
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
                <th className="p-3 w-10">
                  <input type="checkbox" checked={selected.length === rows.length && rows.length > 0} onChange={toggleAll} className="rounded" />
                </th>
                {[
                  { key: "title", label: "Title" },
                  { key: "status", label: "Status" },
                  { key: "views", label: "Views" },
                  { key: "comments_count", label: "Comments" },
                  { key: "reading_time", label: "Read Time" },
                  { key: "created_at", label: "Created" },
                ].map(col => (
                  <th key={col.key} className={cn("p-3 text-left font-semibold cursor-pointer select-none", dark ? "text-[#8b95a3]" : "text-[#8a929c]")} onClick={() => toggleSort(col.key)}>
                    <span className="flex items-center gap-1">{col.label} {sortBy === col.key && <ArrowUpDown className="w-3 h-3" />}</span>
                  </th>
                ))}
                <th className={cn("p-3 text-right font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className={cn("border-b", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                  {Array.from({ length: 8 }).map((_, j) => <td key={j} className="p-3"><Skel w="w-full" h="h-4" /></td>)}
                </tr>
              )) : rows.length === 0 ? (
                <tr><td colSpan={8} className={cn("p-12 text-center", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No articles found</td></tr>
              ) : rows.map(row => {
                const st = STATUS_MAP[row.status] || STATUS_MAP.draft;
                return (
                  <tr key={row.id} className={cn("border-b cursor-pointer transition-colors", dark ? "border-[#252c36] hover:bg-[#1c2230]" : "border-[#eef0f3] hover:bg-[#f8f9fb]")} onClick={() => openDetail(row.id)}>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelect(row.id)} className="rounded" />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {row.featured_image ? (
                          <img src={row.featured_image} alt="" className="w-10 h-10 rounded-[8px] object-cover flex-shrink-0" />
                        ) : (
                          <div className={cn("w-10 h-10 rounded-[8px] flex items-center justify-center flex-shrink-0", dark ? "bg-[#252c36]" : "bg-[#f4f6f9]")}>
                            <ImageIcon className={cn("w-5 h-5", dark ? "text-[#8b95a3]" : "text-[#8a929c]")} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className={cn("font-semibold truncate max-w-[280px]", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{row.title}</p>
                          {row.author && <p className={cn("text-xs truncate", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{row.author.full_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", dark ? st.darkColor : st.color)}>{st.label}</span>
                    </td>
                    <td className={cn("p-3", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{(row.views || 0).toLocaleString()}</td>
                    <td className={cn("p-3", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{row.comments_count || 0}</td>
                    <td className={cn("p-3", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{row.reading_time || 0}m</td>
                    <td className={cn("p-3 text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}</td>
                    <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditor(row)} className={cn("p-1.5 rounded-[8px] hover:bg-black/5", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => deleteArticle(row.id)} className="p-1.5 rounded-[8px] text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={cn("flex items-center justify-between px-4 py-3 border-t", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
            <span className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </span>
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
              <div>
                <h2 className={cn("text-xl font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{detailDrawer.title}</h2>
                {detailDrawer.author && <p className={cn("text-sm mt-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>By {detailDrawer.author.full_name}</p>}
              </div>
              <button onClick={() => { setDetailDrawer(null); openEditor(detailDrawer); }} className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-[#2563eb] text-white text-sm font-semibold">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>

            {/* Tabs */}
            <div className={cn("flex gap-1 border-b pb-0", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
              {["overview", "seo", "analytics"].map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={cn("px-3 py-2 text-sm font-semibold rounded-t-[8px] -mb-px border-b-2 transition-all",
                    detailTab === t ? "border-[#2563eb] text-[#2563eb]" : cn("border-transparent", dark ? "text-[#8b95a3]" : "text-[#8a929c]")
                  )}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {detailTab === "overview" && (
              <div className="space-y-4">
                {detailDrawer.featured_image && <img src={detailDrawer.featured_image} alt="" className="w-full h-48 object-cover rounded-[12px]" />}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Status", value: STATUS_MAP[detailDrawer.status]?.label || detailDrawer.status },
                    { label: "Category", value: categories.find((c: any) => c.id === detailDrawer.category_id)?.name || "—" },
                    { label: "Reading Time", value: `${detailDrawer.reading_time || 0} min` },
                    { label: "Views", value: (detailDrawer.views || 0).toLocaleString() },
                    { label: "Comments", value: detailDrawer.comments_count || 0 },
                    { label: "Likes", value: detailDrawer.likes || 0 },
                    { label: "Shares", value: detailDrawer.shares || 0 },
                    { label: "Featured", value: detailDrawer.is_featured ? "Yes" : "No" },
                  ].map((item, i) => (
                    <div key={i} className={cn("rounded-[10px] border p-3", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
                      <p className={cn("text-[11px] font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{item.label}</p>
                      <p className={cn("font-semibold mt-0.5", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{item.value}</p>
                    </div>
                  ))}
                </div>
                {detailDrawer.excerpt && (
                  <div>
                    <p className={cn("text-xs font-semibold mb-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Excerpt</p>
                    <p className={cn("text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{detailDrawer.excerpt}</p>
                  </div>
                )}
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
              </div>
            )}

            {detailTab === "seo" && (
              <div className="space-y-4">
                {[
                  { label: "Meta Title", value: detailDrawer.meta_title },
                  { label: "Meta Description", value: detailDrawer.meta_description },
                  { label: "Focus Keyword", value: detailDrawer.focus_keyword },
                  { label: "Canonical URL", value: detailDrawer.canonical_url },
                  { label: "Slug", value: detailDrawer.slug },
                ].map((item, i) => (
                  <div key={i}>
                    <p className={cn("text-xs font-semibold mb-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{item.label}</p>
                    <p className={cn("text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{item.value || "—"}</p>
                  </div>
                ))}
                <div className={cn("rounded-[10px] border p-4", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
                  <p className={cn("text-xs font-semibold mb-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Google Preview</p>
                  <p className="text-[#1a0dab] text-base font-medium truncate">{detailDrawer.meta_title || detailDrawer.title}</p>
                  <p className="text-[#006621] text-xs truncate">atlantasneaker.com/blog/{detailDrawer.slug}</p>
                  <p className={cn("text-xs mt-1 line-clamp-2", dark ? "text-[#8b95a3]" : "text-[#545454]")}>{detailDrawer.meta_description || detailDrawer.excerpt || ""}</p>
                </div>
              </div>
            )}

            {detailTab === "analytics" && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Views", value: (detailDrawer.views || 0).toLocaleString(), icon: Eye },
                  { label: "Comments", value: detailDrawer.comments_count || 0, icon: MessageSquare },
                  { label: "Likes", value: detailDrawer.likes || 0, icon: Heart },
                  { label: "Shares", value: detailDrawer.shares || 0, icon: Share2 },
                  { label: "Read Time", value: `${detailDrawer.reading_time || 0}m`, icon: Clock },
                  { label: "Published", value: detailDrawer.published_at ? new Date(detailDrawer.published_at).toLocaleDateString() : "—", icon: Globe },
                ].map((item, i) => (
                  <div key={i} className={cn("rounded-[10px] border p-3 flex items-center gap-3", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
                    <item.icon className={cn("w-5 h-5", dark ? "text-[#8b95a3]" : "text-[#8a929c]")} />
                    <div>
                      <p className={cn("text-[11px]", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{item.label}</p>
                      <p className={cn("font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Editor Drawer */}
      <Drawer open={!!editorDrawer} onClose={() => setEditorDrawer(null)} dark={dark} width="xl">
        <div className="space-y-4">
          <h2 className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>
            {editorDrawer === "new" ? "New Article" : "Edit Article"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: "title", label: "Title", required: true },
              { key: "slug", label: "Slug", placeholder: "auto-generated from title" },
            ].map(f => (
              <div key={f.key}>
                <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{f.label}{f.required && " *"}</label>
                <input
                  className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                  value={form[f.key] || ""}
                  placeholder={f.placeholder}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>

          <div>
            <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Excerpt</label>
            <textarea
              rows={2}
              className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm resize-none", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
              value={form.excerpt || ""}
              onChange={e => setForm({ ...form, excerpt: e.target.value })}
            />
          </div>

          <div>
            <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Content</label>
            <textarea
              rows={10}
              className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm resize-none font-mono", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
              value={form.content || ""}
              onChange={e => setForm({ ...form, content: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Category</label>
              <select
                className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={form.category_id || ""}
                onChange={e => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">No category</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Status</label>
              <select
                className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={form.status || "draft"}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Reading Time (min)</label>
              <input
                type="number"
                className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={form.reading_time || 0}
                onChange={e => setForm({ ...form, reading_time: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Featured Image URL</label>
              <input
                className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={form.featured_image || ""}
                onChange={e => setForm({ ...form, featured_image: e.target.value })}
              />
            </div>
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>OG Image URL</label>
              <input
                className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={form.og_image || ""}
                onChange={e => setForm({ ...form, og_image: e.target.value })}
              />
            </div>
          </div>

          <div className={cn("rounded-[10px] border p-4", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
            <p className={cn("text-xs font-bold mb-3", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>SEO Settings</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { key: "meta_title", label: "Meta Title" },
                { key: "focus_keyword", label: "Focus Keyword" },
                { key: "canonical_url", label: "Canonical URL" },
              ].map(f => (
                <div key={f.key}>
                  <label className={cn("text-[11px] font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{f.label}</label>
                  <input
                    className={cn("w-full mt-1 px-3 py-1.5 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                    value={form[f.key] || ""}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className={cn("text-[11px] font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Meta Description</label>
              <textarea
                rows={2}
                className={cn("w-full mt-1 px-3 py-1.5 rounded-[8px] border text-sm resize-none", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                value={form.meta_description || ""}
                onChange={e => setForm({ ...form, meta_description: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_featured || false} onChange={e => setForm({ ...form, is_featured: e.target.checked })} className="rounded" />
              <span className={cn("text-sm font-medium", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Featured Article</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setEditorDrawer(null)} className={cn("px-4 py-2 rounded-[10px] text-sm font-semibold border", dark ? "border-[#252c36] text-[#8b95a3]" : "border-[#eef0f3] text-[#8a929c]")}>Cancel</button>
            <button onClick={saveArticle} disabled={saving || !form.title} className="px-4 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-40">
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
              {categories.map((c: any) => (
                <div key={c.id} className={cn("flex items-center justify-between px-3 py-2 rounded-[10px] border", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                  <div>
                    <p className={cn("font-semibold text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{c.name}</p>
                    <p className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{c.slug}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={cn("rounded-[10px] border p-4", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
            <p className={cn("text-xs font-bold mb-3", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Add Category</p>
            <div className="space-y-2">
              <input
                className={cn("w-full px-3 py-2 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                placeholder="Category name"
                value={catForm.name}
                onChange={e => setCatForm({ ...catForm, name: e.target.value })}
              />
              <input
                className={cn("w-full px-3 py-2 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                placeholder="Description (optional)"
                value={catForm.description}
                onChange={e => setCatForm({ ...catForm, description: e.target.value })}
              />
              <button onClick={saveCategory} disabled={saving || !catForm.name} className="w-full py-2 rounded-[8px] bg-[#2563eb] text-white text-sm font-semibold disabled:opacity-40">
                {saving ? "Saving..." : "Add Category"}
              </button>
            </div>
          </div>
        </div>
      </Drawer>

      {/* Tag Drawer */}
      <Drawer open={tagDrawer} onClose={() => setTagDrawer(false)} dark={dark} width="md">
        <div className="space-y-4">
          <h2 className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Manage Tags</h2>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((t: any) => (
                <span key={t.id} className={cn("px-3 py-1 rounded-full text-xs font-medium", dark ? "bg-[#252c36] text-[#8b95a3]" : "bg-[#f4f6f9] text-[#8a929c]")}>{t.name}</span>
              ))}
            </div>
          )}

          <div className={cn("rounded-[10px] border p-4", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
            <p className={cn("text-xs font-bold mb-3", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Add Tag</p>
            <div className="space-y-2">
              <input
                className={cn("w-full px-3 py-2 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                placeholder="Tag name"
                value={tagForm.name}
                onChange={e => setTagForm({ ...tagForm, name: e.target.value })}
              />
              <button onClick={saveTag} disabled={saving || !tagForm.name} className="w-full py-2 rounded-[8px] bg-[#2563eb] text-white text-sm font-semibold disabled:opacity-40">
                {saving ? "Saving..." : "Add Tag"}
              </button>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
