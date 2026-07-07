// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Image as ImageIcon, FileText, Film, File, Upload, FolderPlus, Download,
  RefreshCw, Search, Filter, Grid, List, LayoutGrid, ChevronLeft, ChevronRight,
  MoreHorizontal, Edit3, Trash2, Copy, Move, Archive, Eye, X, Check,
  FolderOpen, Tag, Hash, Star, Clock, HardDrive, AlertTriangle, TrendingUp,
  BarChart3, Layers, Globe, Sparkles, Replace, RotateCcw, Maximize2,
  ArrowUpDown, ChevronDown, Plus, Palette, Lock, Heart, FileImage,
  FileVideo, FileType, Columns, Calendar, Users, ExternalLink, Info,
  ZoomIn, ZoomOut, RotateCw, FlipHorizontal, FlipVertical, Sun, Contrast,
  Scissors, Droplets, Shield, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";

type MediaFile = any;
type Folder = any;

const TYPE_ICONS: Record<string, any> = {
  image: ImageIcon, video: Film, pdf: FileText, svg: FileImage,
  icon: Sparkles, document: File,
};

const TYPE_COLORS: Record<string, { light: string; dark: string }> = {
  image: { light: "bg-blue-100 text-blue-700", dark: "bg-blue-900/40 text-blue-300" },
  video: { light: "bg-purple-100 text-purple-700", dark: "bg-purple-900/40 text-purple-300" },
  pdf: { light: "bg-red-100 text-red-700", dark: "bg-red-900/40 text-red-300" },
  svg: { light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-900/40 text-emerald-300" },
  icon: { light: "bg-amber-100 text-amber-700", dark: "bg-amber-900/40 text-amber-300" },
  document: { light: "bg-gray-100 text-gray-600", dark: "bg-gray-800 text-gray-400" },
};

const FILTER_TYPES = [
  { key: "all", label: "All" },
  { key: "image", label: "Images" },
  { key: "video", label: "Videos" },
  { key: "pdf", label: "PDF" },
  { key: "svg", label: "SVG" },
  { key: "document", label: "Docs" },
];

const EXTENSIONS = ["png", "jpg", "jpeg", "webp", "avif", "gif", "svg", "mp4", "mov", "webm", "pdf"];

const VIEW_MODES = [
  { key: "grid", icon: Grid, label: "Grid" },
  { key: "list", icon: List, label: "List" },
  { key: "compact", icon: LayoutGrid, label: "Compact" },
];

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function AdminMedia({ dark }: { dark: boolean }) {
  const [kpis, setKpis] = useState<any>(null);
  const [rows, setRows] = useState<MediaFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(40);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [extFilter, setExtFilter] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState("grid");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  const [detailDrawer, setDetailDrawer] = useState<MediaFile | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [uploadDrawer, setUploadDrawer] = useState(false);
  const [folderDrawer, setFolderDrawer] = useState(false);
  const [tagDrawer, setTagDrawer] = useState(false);
  const [editDrawer, setEditDrawer] = useState<MediaFile | null>(null);
  const [moveDrawer, setMoveDrawer] = useState(false);
  const [analyticsDrawer, setAnalyticsDrawer] = useState(false);

  const [uploadForm, setUploadForm] = useState<any>({
    filename: "", url: "", title: "", alt_text: "", description: "",
    type: "image", extension: "", folder_id: "", tags: [],
    width: "", height: "", size: 0,
  });
  const [folderForm, setFolderForm] = useState<any>({ name: "", parent_id: "", color: "#3b82f6", is_private: false });
  const [tagForm, setTagForm] = useState<any>({ name: "", color: "#3b82f6" });
  const [editForm, setEditForm] = useState<any>({});
  const [moveTo, setMoveTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);

  const api = useCallback(async (method: string, params?: any) => {
    const isGet = method === "GET";
    const url = isGet ? `/api/admin/media?${new URLSearchParams(params).toString()}` : "/api/admin/media";
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
    if (typeFilter !== "all") params.type = typeFilter;
    if (extFilter) params.extension = extFilter;
    if (folderFilter) params.folder = folderFilter;
    if (tagFilter) params.tag = tagFilter;
    const data = await api("GET", params);
    setRows(data.rows || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [api, page, limit, search, typeFilter, extFilter, folderFilter, tagFilter, sortBy, sortDir]);

  const loadMeta = useCallback(async () => {
    const [f, t] = await Promise.all([
      api("GET", { section: "all_folders" }),
      api("GET", { section: "tags" }),
    ]);
    setFolders(f.folders || []);
    setTags(t.tags || []);
  }, [api]);

  useEffect(() => { loadKpis(); loadMeta(); }, [loadKpis, loadMeta]);
  useEffect(() => { loadList(); }, [loadList]);

  const openDetail = async (id: string) => {
    const data = await api("GET", { section: "detail", id });
    setDetailDrawer(data);
    setDetailTab("overview");
  };

  const openEdit = (file: MediaFile) => {
    setEditForm({ ...file });
    setEditDrawer(file);
  };

  const saveEdit = async () => {
    setSaving(true);
    const { id, title, alt_text, description, tags: t, folder_id } = editForm;
    await api("PUT", { id, title, alt_text, description, tags: t, folder_id });
    setSaving(false);
    setEditDrawer(null);
    loadList();
  };

  const uploadFile = async () => {
    setSaving(true);
    await api("POST", { action: "upload", ...uploadForm });
    setSaving(false);
    setUploadDrawer(false);
    setUploadForm({ filename: "", url: "", title: "", alt_text: "", description: "", type: "image", extension: "", folder_id: "", tags: [], width: "", height: "", size: 0 });
    loadList();
    loadKpis();
  };

  const createFolder = async () => {
    setSaving(true);
    await api("POST", { action: "create_folder", ...folderForm });
    setSaving(false);
    setFolderDrawer(false);
    setFolderForm({ name: "", parent_id: "", color: "#3b82f6", is_private: false });
    loadMeta();
  };

  const createTag = async () => {
    setSaving(true);
    await api("POST", { action: "create_tag", ...tagForm });
    setSaving(false);
    setTagDrawer(false);
    setTagForm({ name: "", color: "#3b82f6" });
    loadMeta();
  };

  const deleteFile = async (id: string) => {
    await fetch(`/api/admin/media?id=${id}`, { method: "DELETE" });
    loadList();
    loadKpis();
  };

  const bulkAction = async (action: string, extra?: any) => {
    if (!selected.length) return;
    await api("PATCH", { action, ids: selected, ...extra });
    setSelected([]);
    loadList();
    loadKpis();
  };

  const doMove = async () => {
    await bulkAction("move", { folder_id: moveTo || null });
    setMoveDrawer(false);
  };

  const loadAnalytics = async () => {
    const data = await api("GET", { section: "analytics" });
    setAnalytics(data);
    setAnalyticsDrawer(true);
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
    a.download = `media-export-${new Date().toISOString().slice(0, 10)}.csv`;
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
    { label: "Total Files", value: kpis.totalFiles, icon: Layers },
    { label: "Images", value: kpis.images, icon: ImageIcon },
    { label: "Videos", value: kpis.videos, icon: Film },
    { label: "PDFs", value: kpis.pdfs, icon: FileText },
    { label: "SVGs", value: kpis.svgs, icon: FileImage },
    { label: "Documents", value: kpis.documents, icon: File },
    { label: "Storage Used", value: formatBytes(kpis.storageUsed), icon: HardDrive },
    { label: "Storage Free", value: formatBytes(kpis.storageRemaining), icon: HardDrive },
    { label: "Recent Uploads", value: kpis.recentlyUploaded, icon: Clock },
    { label: "Most Used", value: kpis.mostUsedAssets, icon: Star },
    { label: "Unused", value: kpis.unusedAssets, icon: AlertTriangle },
    { label: "Duplicates", value: kpis.duplicateFiles, icon: Copy },
  ] : [];

  const Skel = ({ w = "w-full", h = "h-5" }: { w?: string; h?: string }) => (
    <div className={cn(w, h, "rounded-[8px] animate-pulse", dark ? "bg-[#252c36]" : "bg-[#e5e7eb]")} />
  );

  const FilePreview = ({ file, size = "md" }: { file: MediaFile; size?: string }) => {
    const dim = size === "sm" ? "w-10 h-10" : size === "lg" ? "w-full h-48" : "w-16 h-16";
    const radius = size === "lg" ? "rounded-[12px]" : "rounded-[8px]";
    if (file.type === "image" || file.type === "svg") {
      return <img src={file.thumbnail_url || file.url} alt={file.alt_text || file.filename} className={cn(dim, radius, "object-cover flex-shrink-0")} />;
    }
    const Icon = TYPE_ICONS[file.type] || File;
    const tc = TYPE_COLORS[file.type] || TYPE_COLORS.document;
    return (
      <div className={cn(dim, radius, "flex items-center justify-center flex-shrink-0", dark ? tc.dark : tc.light)}>
        <Icon className={cn(size === "lg" ? "w-12 h-12" : size === "sm" ? "w-5 h-5" : "w-7 h-7")} />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {kpis ? kpiCards.map((k, i) => (
          <div key={i} className={cn("rounded-[14px] border p-3", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
            <div className="flex items-center gap-2 mb-1">
              <k.icon className={cn("w-4 h-4", dark ? "text-[#8b95a3]" : "text-[#8a929c]")} />
              <span className={cn("text-[11px] font-medium truncate", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{k.label}</span>
            </div>
            <p className={cn("text-lg font-bold truncate", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{k.value}</p>
          </div>
        )) : Array.from({ length: 12 }).map((_, i) => (
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
              placeholder="Search files by name, title, alt text..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button onClick={() => setUploadDrawer(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8]">
            <Upload className="w-4 h-4" /> Upload
          </button>
          <button onClick={() => setFolderDrawer(true)} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-[10px] border text-sm font-medium", dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]")}>
            <FolderPlus className="w-4 h-4" /> Folder
          </button>
          <button onClick={() => setTagDrawer(true)} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-[10px] border text-sm font-medium", dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]")}>
            <Tag className="w-4 h-4" /> Tags
          </button>
          <button onClick={loadAnalytics} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-[10px] border text-sm font-medium", dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]")}>
            <BarChart3 className="w-4 h-4" /> Analytics
          </button>
          <button onClick={exportCsv} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-[10px] border text-sm font-medium", dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]")}>
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => { loadList(); loadKpis(); }} className={cn("p-2 rounded-[10px] border", dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]")}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_TYPES.map(f => (
            <button key={f.key} onClick={() => { setTypeFilter(f.key); setPage(1); }}
              className={cn("px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                typeFilter === f.key
                  ? "bg-[#2563eb] text-white border-[#2563eb]"
                  : dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]"
              )}
            >{f.label}</button>
          ))}
          <select
            value={extFilter}
            onChange={e => { setExtFilter(e.target.value); setPage(1); }}
            className={cn("px-2 py-1 rounded-[8px] border text-xs", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
          >
            <option value="">Extension</option>
            {EXTENSIONS.map(e => <option key={e} value={e}>.{e}</option>)}
          </select>
          {folders.length > 0 && (
            <select
              value={folderFilter}
              onChange={e => { setFolderFilter(e.target.value); setPage(1); }}
              className={cn("px-2 py-1 rounded-[8px] border text-xs", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
            >
              <option value="">All Folders</option>
              {folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          {tags.length > 0 && (
            <select
              value={tagFilter}
              onChange={e => { setTagFilter(e.target.value); setPage(1); }}
              className={cn("px-2 py-1 rounded-[8px] border text-xs", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
            >
              <option value="">All Tags</option>
              {tags.map((t: any) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          )}

          <div className="ml-auto flex items-center gap-1">
            {VIEW_MODES.map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key)}
                className={cn("p-1.5 rounded-[8px]", viewMode === v.key ? "bg-[#2563eb] text-white" : dark ? "text-[#8b95a3] hover:bg-[#252c36]" : "text-[#8a929c] hover:bg-[#f4f6f9]")}
              ><v.icon className="w-4 h-4" /></button>
            ))}
          </div>
        </div>

        {/* Bulk actions */}
        {selected.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}>
            <span className={cn("text-xs font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{selected.length} selected</span>
            {[
              { label: "Move", action: () => setMoveDrawer(true), color: "text-blue-500" },
              { label: "Duplicate", action: () => bulkAction("duplicate"), color: "text-indigo-500" },
              { label: "Archive", action: () => bulkAction("archive"), color: "text-amber-500" },
              { label: "Delete", action: () => bulkAction("delete"), color: "text-red-500" },
            ].map(b => (
              <button key={b.label} onClick={b.action} className={cn("text-xs font-semibold px-2 py-1 rounded-[6px] hover:bg-black/5", b.color)}>
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {loading ? Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={cn("rounded-[14px] border p-2 space-y-2", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
              <Skel h="h-28" /><Skel w="w-2/3" h="h-3" /><Skel w="w-1/3" h="h-3" />
            </div>
          )) : rows.length === 0 ? (
            <div className={cn("col-span-full rounded-[14px] border p-12 text-center", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
              <Layers className={cn("w-12 h-12 mx-auto mb-3", dark ? "text-[#252c36]" : "text-[#e5e7eb]")} />
              <p className={cn("text-sm font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No files found</p>
            </div>
          ) : rows.map(file => (
            <div
              key={file.id}
              onClick={() => openDetail(file.id)}
              className={cn(
                "group rounded-[14px] border overflow-hidden cursor-pointer transition-all hover:shadow-md",
                selected.includes(file.id) ? "ring-2 ring-[#2563eb]" : "",
                dark ? "bg-[#171c24] border-[#252c36] hover:border-[#3b4555]" : "bg-white border-[#eef0f3] hover:border-[#d0d5dd]"
              )}
            >
              <div className="relative aspect-square">
                {file.type === "image" || file.type === "svg" ? (
                  <img src={file.thumbnail_url || file.url} alt={file.alt_text || file.filename} className="w-full h-full object-cover" />
                ) : (
                  <div className={cn("w-full h-full flex items-center justify-center", dark ? TYPE_COLORS[file.type]?.dark || "bg-[#252c36]" : TYPE_COLORS[file.type]?.light || "bg-[#f4f6f9]")}>
                    {(() => { const Icon = TYPE_ICONS[file.type] || File; return <Icon className="w-10 h-10" />; })()}
                  </div>
                )}
                <div className="absolute top-2 left-2" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.includes(file.id)} onChange={() => toggleSelect(file.id)}
                    className={cn("rounded opacity-0 group-hover:opacity-100 transition-opacity", selected.includes(file.id) && "opacity-100")} />
                </div>
                <div className="absolute top-2 right-2">
                  <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase", dark ? "bg-black/60 text-white" : "bg-white/90 text-[#16181d]")}>
                    .{file.extension}
                  </span>
                </div>
              </div>
              <div className="p-2.5">
                <p className={cn("text-xs font-semibold truncate", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{file.filename}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className={cn("text-[10px]", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{formatBytes(file.size)}</span>
                  {file.width && file.height && <span className={cn("text-[10px]", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{file.width}×{file.height}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List / Compact view */
        <div className={cn("rounded-[14px] border overflow-hidden", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn("border-b", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                  <th className="p-3 w-10"><input type="checkbox" checked={selected.length === rows.length && rows.length > 0} onChange={toggleAll} className="rounded" /></th>
                  <th className="p-3 w-14"></th>
                  {[
                    { key: "filename", label: "Filename" },
                    { key: "type", label: "Type" },
                    { key: "extension", label: "Ext" },
                    { key: "size", label: "Size" },
                    { key: "usage_count", label: "Usage" },
                    { key: "created_at", label: "Created" },
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
                  <tr><td colSpan={9} className={cn("p-12 text-center", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No files found</td></tr>
                ) : rows.map(file => {
                  const tc = TYPE_COLORS[file.type] || TYPE_COLORS.document;
                  return (
                    <tr key={file.id} className={cn("border-b cursor-pointer transition-colors", dark ? "border-[#252c36] hover:bg-[#1c2230]" : "border-[#eef0f3] hover:bg-[#f8f9fb]")} onClick={() => openDetail(file.id)}>
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.includes(file.id)} onChange={() => toggleSelect(file.id)} className="rounded" />
                      </td>
                      <td className="p-3"><FilePreview file={file} size="sm" /></td>
                      <td className="p-3">
                        <p className={cn("font-semibold truncate max-w-[240px]", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{file.filename}</p>
                        {file.title && file.title !== file.filename && <p className={cn("text-xs truncate", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{file.title}</p>}
                      </td>
                      <td className="p-3"><span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", dark ? tc.dark : tc.light)}>{file.type}</span></td>
                      <td className={cn("p-3 text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>.{file.extension}</td>
                      <td className={cn("p-3", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{formatBytes(file.size)}</td>
                      <td className={cn("p-3", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{file.usage_count || 0}</td>
                      <td className={cn("p-3 text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{file.created_at ? new Date(file.created_at).toLocaleDateString() : "—"}</td>
                      <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(file)} className={cn("p-1.5 rounded-[8px]", dark ? "text-[#8b95a3] hover:bg-[#252c36]" : "text-[#8a929c] hover:bg-[#f4f6f9]")}><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => deleteFile(file.id)} className="p-1.5 rounded-[8px] text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
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
      )}

      {/* Grid pagination */}
      {viewMode === "grid" && totalPages > 1 && (
        <div className={cn("flex items-center justify-between px-4 py-3 rounded-[14px] border", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
          <span className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={cn("p-1.5 rounded-[8px]", dark ? "text-[#8b95a3] hover:bg-[#252c36]" : "text-[#8a929c] hover:bg-[#f4f6f9]", page <= 1 && "opacity-40")}><ChevronLeft className="w-4 h-4" /></button>
            <span className={cn("text-xs px-2", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{page}/{totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className={cn("p-1.5 rounded-[8px]", dark ? "text-[#8b95a3] hover:bg-[#252c36]" : "text-[#8a929c] hover:bg-[#f4f6f9]", page >= totalPages && "opacity-40")}><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <Drawer open={!!detailDrawer} onClose={() => setDetailDrawer(null)} dark={dark} width="lg">
        {detailDrawer && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h2 className={cn("text-xl font-bold truncate", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{detailDrawer.title || detailDrawer.filename}</h2>
                {detailDrawer.author && <p className={cn("text-sm mt-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Uploaded by {detailDrawer.author.full_name}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => { setDetailDrawer(null); openEdit(detailDrawer); }} className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-[#2563eb] text-white text-sm font-semibold">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            </div>

            <div className={cn("flex gap-1 border-b pb-0", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
              {["overview", "usage", "versions", "analytics"].map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={cn("px-3 py-2 text-sm font-semibold rounded-t-[8px] -mb-px border-b-2 transition-all",
                    detailTab === t ? "border-[#2563eb] text-[#2563eb]" : cn("border-transparent", dark ? "text-[#8b95a3]" : "text-[#8a929c]")
                  )}
                >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
              ))}
            </div>

            {detailTab === "overview" && (
              <div className="space-y-4">
                <FilePreview file={detailDrawer} size="lg" />
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Filename", value: detailDrawer.filename },
                    { label: "Type", value: detailDrawer.type },
                    { label: "Extension", value: `.${detailDrawer.extension}` },
                    { label: "Size", value: formatBytes(detailDrawer.size) },
                    { label: "Dimensions", value: detailDrawer.width && detailDrawer.height ? `${detailDrawer.width} × ${detailDrawer.height}` : "—" },
                    { label: "MIME Type", value: detailDrawer.mime_type || "—" },
                    { label: "Storage", value: detailDrawer.storage_provider || "supabase" },
                    { label: "Usage Count", value: detailDrawer.usage_count || 0 },
                    { label: "Downloads", value: detailDrawer.downloads || 0 },
                    { label: "Views", value: detailDrawer.views || 0 },
                  ].map((item, i) => (
                    <div key={i} className={cn("rounded-[10px] border p-3", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
                      <p className={cn("text-[11px] font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{item.label}</p>
                      <p className={cn("font-semibold mt-0.5 truncate", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{item.value}</p>
                    </div>
                  ))}
                </div>
                {detailDrawer.alt_text && (
                  <div>
                    <p className={cn("text-xs font-semibold mb-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Alt Text</p>
                    <p className={cn("text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{detailDrawer.alt_text}</p>
                  </div>
                )}
                {detailDrawer.description && (
                  <div>
                    <p className={cn("text-xs font-semibold mb-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Description</p>
                    <p className={cn("text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{detailDrawer.description}</p>
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
                {detailDrawer.linked_modules?.length > 0 && (
                  <div>
                    <p className={cn("text-xs font-semibold mb-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Linked Modules</p>
                    <div className="flex flex-wrap gap-1">
                      {detailDrawer.linked_modules.map((m: string, i: number) => (
                        <span key={i} className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", dark ? "bg-blue-900/30 text-blue-300" : "bg-blue-100 text-blue-700")}>{m}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className={cn("rounded-[10px] border p-3", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
                  <p className={cn("text-[11px] font-medium mb-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>URL</p>
                  <p className={cn("text-xs font-mono break-all", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{detailDrawer.url}</p>
                </div>
              </div>
            )}

            {detailTab === "usage" && (
              <div className="space-y-3">
                {detailDrawer.linked_modules?.length > 0 ? detailDrawer.linked_modules.map((m: string, i: number) => (
                  <div key={i} className={cn("flex items-center gap-3 p-3 rounded-[10px] border", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                    <Globe className={cn("w-5 h-5", dark ? "text-[#8b95a3]" : "text-[#8a929c]")} />
                    <div>
                      <p className={cn("font-semibold text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{m}</p>
                      <p className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Used in this module</p>
                    </div>
                  </div>
                )) : (
                  <p className={cn("text-sm text-center py-8", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>This file is not linked to any module yet.</p>
                )}
              </div>
            )}

            {detailTab === "versions" && (
              <div className="space-y-3">
                {detailDrawer.versions?.length > 0 ? detailDrawer.versions.map((v: any, i: number) => (
                  <div key={i} className={cn("flex items-center justify-between p-3 rounded-[10px] border", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                    <div>
                      <p className={cn("text-sm font-semibold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{v.filename}</p>
                      <p className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{formatBytes(v.size)} • {v.created_at ? new Date(v.created_at).toLocaleString() : "—"}</p>
                    </div>
                    <button onClick={async () => { await api("POST", { action: "rollback", version_id: v.id }); openDetail(detailDrawer.id); }}
                      className={cn("text-xs font-semibold px-2 py-1 rounded-[6px]", dark ? "text-blue-400 hover:bg-blue-900/30" : "text-blue-600 hover:bg-blue-50")}>
                      Rollback
                    </button>
                  </div>
                )) : (
                  <p className={cn("text-sm text-center py-8", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No previous versions.</p>
                )}
              </div>
            )}

            {detailTab === "analytics" && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Views", value: detailDrawer.views || 0, icon: Eye },
                  { label: "Downloads", value: detailDrawer.downloads || 0, icon: Download },
                  { label: "Usage Count", value: detailDrawer.usage_count || 0, icon: Layers },
                  { label: "Created", value: detailDrawer.created_at ? new Date(detailDrawer.created_at).toLocaleDateString() : "—", icon: Calendar },
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

      {/* Upload Drawer */}
      <Drawer open={uploadDrawer} onClose={() => setUploadDrawer(false)} dark={dark} width="lg">
        <div className="space-y-4">
          <h2 className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Upload File</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: "filename", label: "Filename *", placeholder: "image.png" },
              { key: "url", label: "File URL *", placeholder: "https://..." },
              { key: "title", label: "Title" },
              { key: "alt_text", label: "Alt Text" },
            ].map(f => (
              <div key={f.key}>
                <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{f.label}</label>
                <input
                  className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                  value={uploadForm[f.key] || ""}
                  placeholder={f.placeholder}
                  onChange={e => setUploadForm({ ...uploadForm, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>

          <div>
            <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Description</label>
            <textarea rows={2} className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm resize-none", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
              value={uploadForm.description || ""}
              onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Type</label>
              <select className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={uploadForm.type} onChange={e => setUploadForm({ ...uploadForm, type: e.target.value })}>
                {Object.keys(TYPE_ICONS).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Extension</label>
              <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={uploadForm.extension || ""} placeholder="png"
                onChange={e => setUploadForm({ ...uploadForm, extension: e.target.value })}
              />
            </div>
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Folder</label>
              <select className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={uploadForm.folder_id || ""} onChange={e => setUploadForm({ ...uploadForm, folder_id: e.target.value })}>
                <option value="">No folder</option>
                {folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Width (px)</label>
              <input type="number" className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={uploadForm.width || ""} onChange={e => setUploadForm({ ...uploadForm, width: parseInt(e.target.value) || "" })} />
            </div>
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Height (px)</label>
              <input type="number" className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={uploadForm.height || ""} onChange={e => setUploadForm({ ...uploadForm, height: parseInt(e.target.value) || "" })} />
            </div>
            <div>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Size (bytes)</label>
              <input type="number" className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={uploadForm.size || ""} onChange={e => setUploadForm({ ...uploadForm, size: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setUploadDrawer(false)} className={cn("px-4 py-2 rounded-[10px] text-sm font-semibold border", dark ? "border-[#252c36] text-[#8b95a3]" : "border-[#eef0f3] text-[#8a929c]")}>Cancel</button>
            <button onClick={uploadFile} disabled={saving || !uploadForm.filename || !uploadForm.url} className="px-4 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-40">
              {saving ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </Drawer>

      {/* Edit Drawer */}
      <Drawer open={!!editDrawer} onClose={() => setEditDrawer(null)} dark={dark} width="md">
        <div className="space-y-4">
          <h2 className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Edit File Details</h2>
          {[
            { key: "title", label: "Title" },
            { key: "alt_text", label: "Alt Text" },
          ].map(f => (
            <div key={f.key}>
              <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{f.label}</label>
              <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                value={editForm[f.key] || ""} onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })} />
            </div>
          ))}
          <div>
            <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Description</label>
            <textarea rows={3} className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm resize-none", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
              value={editForm.description || ""} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
          </div>
          <div>
            <label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Folder</label>
            <select className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
              value={editForm.folder_id || ""} onChange={e => setEditForm({ ...editForm, folder_id: e.target.value })}>
              <option value="">No folder</option>
              {folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setEditDrawer(null)} className={cn("px-4 py-2 rounded-[10px] text-sm font-semibold border", dark ? "border-[#252c36] text-[#8b95a3]" : "border-[#eef0f3] text-[#8a929c]")}>Cancel</button>
            <button onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-40">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Drawer>

      {/* Folder Drawer */}
      <Drawer open={folderDrawer} onClose={() => setFolderDrawer(false)} dark={dark} width="md">
        <div className="space-y-4">
          <h2 className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Manage Folders</h2>

          {folders.length > 0 && (
            <div className="space-y-2">
              {folders.map((f: any) => (
                <div key={f.id} className={cn("flex items-center justify-between px-3 py-2 rounded-[10px] border", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" style={{ color: f.color || "#3b82f6" }} />
                    <div>
                      <p className={cn("font-semibold text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{f.name}</p>
                      {f.is_private && <span className={cn("text-[10px]", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Private</span>}
                    </div>
                  </div>
                  <button onClick={async () => { await fetch(`/api/admin/media?id=${f.id}&type=folder`, { method: "DELETE" }); loadMeta(); }}
                    className="p-1 rounded text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}

          <div className={cn("rounded-[10px] border p-4", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
            <p className={cn("text-xs font-bold mb-3", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Create Folder</p>
            <div className="space-y-2">
              <input className={cn("w-full px-3 py-2 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                placeholder="Folder name" value={folderForm.name} onChange={e => setFolderForm({ ...folderForm, name: e.target.value })} />
              <select className={cn("w-full px-3 py-2 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                value={folderForm.parent_id || ""} onChange={e => setFolderForm({ ...folderForm, parent_id: e.target.value })}>
                <option value="">Root (no parent)</option>
                {folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <div className="flex items-center gap-3">
                <input type="color" value={folderForm.color} onChange={e => setFolderForm({ ...folderForm, color: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={folderForm.is_private} onChange={e => setFolderForm({ ...folderForm, is_private: e.target.checked })} className="rounded" />
                  <span className={cn("text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Private</span>
                </label>
              </div>
              <button onClick={createFolder} disabled={saving || !folderForm.name} className="w-full py-2 rounded-[8px] bg-[#2563eb] text-white text-sm font-semibold disabled:opacity-40">
                {saving ? "Creating..." : "Create Folder"}
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
                <span key={t.id} className={cn("px-3 py-1 rounded-full text-xs font-medium border", dark ? "border-[#252c36] text-[#8b95a3]" : "border-[#eef0f3] text-[#8a929c]")}
                  style={{ borderLeftColor: t.color || "#3b82f6", borderLeftWidth: 3 }}>{t.name}</span>
              ))}
            </div>
          )}
          <div className={cn("rounded-[10px] border p-4", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
            <p className={cn("text-xs font-bold mb-3", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Add Tag</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="color" value={tagForm.color} onChange={e => setTagForm({ ...tagForm, color: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                <input className={cn("flex-1 px-3 py-2 rounded-[8px] border text-sm", dark ? "bg-[#171c24] border-[#252c36] text-[#e7ebf0]" : "bg-white border-[#eef0f3] text-[#16181d]")}
                  placeholder="Tag name" value={tagForm.name} onChange={e => setTagForm({ ...tagForm, name: e.target.value })} />
              </div>
              <button onClick={createTag} disabled={saving || !tagForm.name} className="w-full py-2 rounded-[8px] bg-[#2563eb] text-white text-sm font-semibold disabled:opacity-40">
                {saving ? "Creating..." : "Add Tag"}
              </button>
            </div>
          </div>
        </div>
      </Drawer>

      {/* Move Drawer */}
      <Drawer open={moveDrawer} onClose={() => setMoveDrawer(false)} dark={dark} width="sm">
        <div className="space-y-4">
          <h2 className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Move {selected.length} file(s)</h2>
          <select className={cn("w-full px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
            value={moveTo} onChange={e => setMoveTo(e.target.value)}>
            <option value="">Root (no folder)</option>
            {folders.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button onClick={() => setMoveDrawer(false)} className={cn("px-4 py-2 rounded-[10px] text-sm font-semibold border", dark ? "border-[#252c36] text-[#8b95a3]" : "border-[#eef0f3] text-[#8a929c]")}>Cancel</button>
            <button onClick={doMove} className="px-4 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold">Move</button>
          </div>
        </div>
      </Drawer>

      {/* Analytics Drawer */}
      <Drawer open={analyticsDrawer} onClose={() => setAnalyticsDrawer(false)} dark={dark} width="lg">
        <div className="space-y-5">
          <h2 className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Media Analytics</h2>
          {analytics ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: "Total Downloads", value: analytics.totalDownloads, icon: Download },
                  { label: "Total Views", value: analytics.totalViews, icon: Eye },
                  { label: "Total Usage", value: analytics.totalUsage, icon: Layers },
                  { label: "Unused Assets", value: analytics.unusedCount, icon: AlertTriangle },
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

              {analytics.byType && (
                <div>
                  <p className={cn("text-xs font-bold mb-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Files by Type</p>
                  <div className="space-y-2">
                    {Object.entries(analytics.byType).map(([type, count]: [string, any]) => (
                      <div key={type} className="flex items-center gap-3">
                        <span className={cn("text-xs font-medium w-20", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{type}</span>
                        <div className={cn("flex-1 h-6 rounded-full overflow-hidden", dark ? "bg-[#252c36]" : "bg-[#f4f6f9]")}>
                          <div className="h-full bg-[#2563eb] rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${Math.max(10, (count / (kpis?.totalFiles || 1)) * 100)}%` }}>
                            <span className="text-[10px] font-bold text-white">{count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics.storageGrowth && Object.keys(analytics.storageGrowth).length > 0 && (
                <div>
                  <p className={cn("text-xs font-bold mb-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Storage Growth by Month</p>
                  <div className="space-y-1">
                    {Object.entries(analytics.storageGrowth).sort().slice(-6).map(([month, bytes]: [string, any]) => (
                      <div key={month} className="flex items-center justify-between">
                        <span className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{month}</span>
                        <span className={cn("text-xs font-semibold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{formatBytes(bytes)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics.mostUsed?.length > 0 && (
                <div>
                  <p className={cn("text-xs font-bold mb-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Most Used Files</p>
                  <div className="space-y-2">
                    {analytics.mostUsed.map((f: any, i: number) => (
                      <div key={i} className={cn("flex items-center justify-between px-3 py-2 rounded-[8px] border", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                        <span className={cn("text-sm font-medium truncate", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{f.id}</span>
                        <span className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{f.usage_count} uses</span>
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
    </div>
  );
}
