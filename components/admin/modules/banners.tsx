// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Drawer } from "@/components/ui/drawer";
import {
  Image as ImageIcon, Layout, Megaphone, Monitor, Tablet, Smartphone,
  Search, Filter, ChevronLeft, ChevronRight, Download, Upload,
  RefreshCw, Plus, Eye, Edit3, Copy, Trash2, CheckCircle2, XCircle,
  BarChart3, TrendingUp, MousePointer, Target, Calendar, Clock,
  ArrowUpRight, Star, X, Loader2, ToggleLeft, ToggleRight,
  Globe, Link, Type, Palette, ExternalLink, Layers, MapPin,
  ShoppingCart, Heart, Gift, Zap, Mail, AlertTriangle, FileImage,
} from "lucide-react";

type Props = { dark: boolean };

type BannerRow = {
  id: string; name: string; location: string; campaign: string | null;
  description: string | null; image_desktop: string | null; image_tablet: string | null;
  image_mobile: string | null; alt_text: string | null; link_url: string | null;
  link_type: string | null; cta_label: string | null; cta_style: string | null;
  cta_color: string | null; priority: number; starts_at: string | null;
  ends_at: string | null; is_active: boolean; device_target: string;
  country: string | null; language: string | null; dimensions: string | null;
  seo_title: string | null; seo_description: string | null;
  clicks: number; impressions: number; conversions: number;
  created_at: string; updated_at: string | null;
};

type KPIs = {
  totalBanners: number; activeBanners: number; inactiveBanners: number;
  scheduledBanners: number; expiredBanners: number; homepageBanners: number;
  categoryBanners: number; campaignBanners: number; clicks: number;
  ctr: number; impressions: number; conversions: number;
};

const LOCATIONS = [
  { id: "hero_carousel", label: "Hero Carousel", icon: Layout },
  { id: "flash_deal_strip", label: "Flash Deal Strip", icon: Zap },
  { id: "promo_strip", label: "Promo Strip", icon: Megaphone },
  { id: "category_banner", label: "Category Banner", icon: Layers },
  { id: "collection_banner", label: "Collection Banner", icon: FileImage },
  { id: "rewards_banner", label: "Rewards Banner", icon: Gift },
  { id: "homepage_section", label: "Homepage Section", icon: Layout },
  { id: "app_banner", label: "App Banner", icon: Smartphone },
  { id: "footer_banner", label: "Footer Banner", icon: MapPin },
  { id: "sidebar_banner", label: "Sidebar Banner", icon: Layout },
  { id: "popup_banner", label: "Popup Banner", icon: ExternalLink },
  { id: "newsletter_banner", label: "Newsletter", icon: Mail },
  { id: "checkout_banner", label: "Checkout Banner", icon: ShoppingCart },
  { id: "cart_banner", label: "Cart Banner", icon: ShoppingCart },
  { id: "wishlist_banner", label: "Wishlist Banner", icon: Heart },
  { id: "search_banner", label: "Search Banner", icon: Search },
  { id: "error_404", label: "404 Banner", icon: AlertTriangle },
  { id: "blog_banner", label: "Blog Banner", icon: Type },
  { id: "seasonal_banner", label: "Seasonal Banner", icon: Calendar },
];

const LOCATION_MAP = Object.fromEntries(LOCATIONS.map(l => [l.id, l]));
const STATUS_FILTERS = ["all", "active", "inactive", "scheduled", "expired"];
const DEVICE_OPTIONS = ["all", "desktop", "tablet", "mobile"];
const LINK_TYPES = ["product", "category", "brand", "collection", "flash_deals", "rewards", "landing_page", "external"];

const fmtN = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + "M" : n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n);
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function getBannerStatus(b: BannerRow): { label: string; color: string } {
  const now = new Date();
  if (!b.is_active) return { label: "Inactive", color: "bg-gray-500/15 text-gray-500" };
  if (b.starts_at && new Date(b.starts_at) > now) return { label: "Scheduled", color: "bg-indigo-500/15 text-indigo-600" };
  if (b.ends_at && new Date(b.ends_at) <= now) return { label: "Expired", color: "bg-red-500/15 text-red-600" };
  return { label: "Active", color: "bg-green-500/15 text-green-600" };
}

export function AdminBanners({ dark }: Props) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [detailLoading, setDetailLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", location: "hero_carousel", campaign: "", description: "",
    image_desktop: "", image_tablet: "", image_mobile: "",
    alt_text: "", link_url: "", link_type: "", cta_label: "", cta_style: "solid",
    cta_color: "#2563eb", priority: "0", starts_at: "", ends_at: "",
    is_active: true, device_target: "all", country: "", language: "",
    seo_title: "", seo_description: "",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [bulkAction, setBulkAction] = useState("");

  const bg = dark ? "bg-[#171c24]" : "bg-white";
  const border = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const card = cn("rounded-[14px] border p-4", bg, border);
  const inputCls = cn("w-full h-10 px-3 rounded-[10px] border text-[13px] outline-none", border, bg, txt);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(t); }, [search]);

  const fetchKpis = useCallback(async () => {
    try { const r = await fetch("/api/admin/banners?section=kpis"); if (r.ok) setKpis(await r.json()); } catch {}
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ section: "list", page: String(page), limit: String(limit) });
      if (debouncedSearch) p.set("search", debouncedSearch);
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (locationFilter) p.set("location", locationFilter);
      const r = await fetch(`/api/admin/banners?${p}`);
      if (r.ok) { const d = await r.json(); setRows(d.rows || []); setTotal(d.total || 0); }
    } catch {} finally { setLoading(false); }
  }, [page, limit, debouncedSearch, statusFilter, locationFilter]);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);
  useEffect(() => { fetchList(); }, [fetchList]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true); setDetailTab("overview");
    try { const r = await fetch(`/api/admin/banners?section=detail&id=${id}`); if (r.ok) setDetail(await r.json()); } catch {} finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { if (detailId) fetchDetail(detailId); }, [detailId, fetchDetail]);

  const openCreate = () => {
    setEditId(null);
    setForm({ name: "", location: "hero_carousel", campaign: "", description: "", image_desktop: "", image_tablet: "", image_mobile: "", alt_text: "", link_url: "", link_type: "", cta_label: "", cta_style: "solid", cta_color: "#2563eb", priority: "0", starts_at: "", ends_at: "", is_active: true, device_target: "all", country: "", language: "", seo_title: "", seo_description: "" });
    setCreateOpen(true);
  };

  const openEdit = (b: BannerRow) => {
    setEditId(b.id);
    setForm({
      name: b.name, location: b.location, campaign: b.campaign || "", description: b.description || "",
      image_desktop: b.image_desktop || "", image_tablet: b.image_tablet || "", image_mobile: b.image_mobile || "",
      alt_text: b.alt_text || "", link_url: b.link_url || "", link_type: b.link_type || "",
      cta_label: b.cta_label || "", cta_style: b.cta_style || "solid", cta_color: b.cta_color || "#2563eb",
      priority: String(b.priority || 0), starts_at: b.starts_at ? b.starts_at.slice(0, 10) : "",
      ends_at: b.ends_at ? b.ends_at.slice(0, 10) : "", is_active: b.is_active,
      device_target: b.device_target || "all", country: b.country || "", language: b.language || "",
      seo_title: b.seo_title || "", seo_description: b.seo_description || "",
    });
    setCreateOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.location) return;
    setFormSubmitting(true);
    try {
      const payload = { ...form, priority: parseInt(form.priority || "0") };
      // Normalize empty strings to null and drop empty timestamps
      ["campaign", "description", "image_desktop", "image_tablet", "image_mobile", "alt_text", "link_url", "link_type", "cta_label", "country", "language", "seo_title", "seo_description", "starts_at", "ends_at"].forEach(k => {
        if (payload[k] === "") payload[k] = null;
      });

      const viaApi = async () => {
        const method = editId ? "PUT" : "POST";
        const body = editId ? { id: editId, ...payload } : payload;
        const r = await fetch("/api/admin/banners", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const text = await r.text();
        let d; try { d = text ? JSON.parse(text) : {}; } catch { const e = new Error("nonjson"); e.nonJson = true; throw e; }
        if (!r.ok) throw new Error(d.error || "Failed to save banner");
      };

      const viaSupabase = async () => {
        const supabase = createClient();
        if (editId) {
          const { error } = await supabase.from("banners").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editId);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from("banners").insert({ ...payload, is_active: form.is_active !== false, clicks: 0, impressions: 0, conversions: 0 });
          if (error) throw new Error(error.message);
        }
      };

      try { await viaApi(); }
      catch (e) { if (e.nonJson) await viaSupabase(); else throw e; }

      setCreateOpen(false); fetchList(); fetchKpis();
      if (detailId === editId && editId) fetchDetail(editId);
    } catch (e) {
      alert(e.message || "Failed to create banner");
    } finally { setFormSubmitting(false); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await fetch("/api/admin/banners", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_active: !active }) });
    fetchList(); fetchKpis();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    await fetch(`/api/admin/banners?id=${id}`, { method: "DELETE" });
    fetchList(); fetchKpis();
    if (detailId === id) { setDetailId(null); setDetail(null); }
  };

  const handleDuplicate = async (id: string) => {
    await fetch("/api/admin/banners", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "duplicate", ids: [id] }) });
    fetchList(); fetchKpis();
  };

  const handleBulk = async () => {
    if (!bulkAction || selected.size === 0) return;
    if (bulkAction === "export") { handleExport(); setSelected(new Set()); setBulkAction(""); return; }
    if (bulkAction === "delete" && !confirm(`Delete ${selected.size} banners?`)) return;
    await fetch("/api/admin/banners", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: bulkAction, ids: Array.from(selected) }) });
    setSelected(new Set()); setBulkAction(""); fetchList(); fetchKpis();
  };

  const handleExport = async () => {
    try {
      const r = await fetch("/api/admin/banners?section=export"); if (!r.ok) return;
      const { rows: data } = await r.json();
      const csv = ["Name,Location,Campaign,Status,Priority,Clicks,Impressions,CTR,Conversions,Created"].concat(
        data.map((b: any) => `"${b.name}","${b.location}","${b.campaign || ""}","${b.is_active ? "active" : "inactive"}",${b.priority || 0},${b.clicks || 0},${b.impressions || 0},${b.impressions ? ((b.clicks/b.impressions)*100).toFixed(1) : "0"}%,${b.conversions || 0},"${b.created_at || ""}"`)
      ).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `banners-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const toggleAll = () => { selected.size === rows.length ? setSelected(new Set()) : setSelected(new Set(rows.map(r => r.id))); };
  const toggleOne = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const totalPages = Math.ceil(total / limit);

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      { label: "Total Banners", value: fmtN(kpis.totalBanners), icon: ImageIcon, color: "text-blue-500" },
      { label: "Active", value: fmtN(kpis.activeBanners), icon: CheckCircle2, color: "text-green-500" },
      { label: "Inactive", value: fmtN(kpis.inactiveBanners), icon: XCircle, color: "text-gray-500" },
      { label: "Scheduled", value: fmtN(kpis.scheduledBanners), icon: Calendar, color: "text-indigo-500" },
      { label: "Expired", value: fmtN(kpis.expiredBanners), icon: Clock, color: "text-red-500" },
      { label: "Homepage", value: fmtN(kpis.homepageBanners), icon: Layout, color: "text-purple-500" },
      { label: "Category", value: fmtN(kpis.categoryBanners), icon: Layers, color: "text-teal-500" },
      { label: "Campaign", value: fmtN(kpis.campaignBanners), icon: Megaphone, color: "text-orange-500" },
      { label: "Clicks", value: fmtN(kpis.clicks), icon: MousePointer, color: "text-cyan-500" },
      { label: "CTR", value: `${kpis.ctr}%`, icon: TrendingUp, color: "text-pink-500" },
      { label: "Impressions", value: fmtN(kpis.impressions), icon: Eye, color: "text-amber-500" },
      { label: "Conversions", value: fmtN(kpis.conversions), icon: Target, color: "text-emerald-500" },
    ];
  }, [kpis]);

  const Skeleton = ({ className }: { className?: string }) => (
    <div className={cn("animate-pulse rounded-[10px]", dark ? "bg-[#252c36]" : "bg-[#eef0f3]", className)} />
  );

  const getPreviewImage = (b: any) => {
    if (previewDevice === "tablet" && b?.image_tablet) return b.image_tablet;
    if (previewDevice === "mobile" && b?.image_mobile) return b.image_mobile;
    return b?.image_desktop || b?.image_tablet || b?.image_mobile;
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={cn("text-[28px] font-extrabold tracking-[-.02em]", txt)}>Banner Management</h1>
          <p className={cn("text-[14px] mt-1", sub)}>Manage all banners, promotional visuals and marketing campaigns across the entire platform.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openCreate} className="h-9 px-3 rounded-[10px] bg-[#2563eb] text-white text-[13px] font-bold flex items-center gap-1.5 hover:bg-[#1d4ed8] transition-colors cursor-pointer">
            <Plus className="w-4 h-4" /> Create Banner
          </button>
          <button onClick={handleExport} className={cn("h-9 px-3 rounded-[10px] text-[13px] font-bold flex items-center gap-1.5 border cursor-pointer transition-colors", border, dark ? "text-[#e7ebf0] hover:bg-white/5" : "text-[#16181d] hover:bg-[#f7f8fa]")}>
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => { fetchKpis(); fetchList(); }} className={cn("h-9 w-9 rounded-[10px] flex items-center justify-center border cursor-pointer transition-colors", border, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")}>
            <RefreshCw className={cn("w-4 h-4", sub)} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {kpis ? kpiCards.map((k, i) => (
          <div key={i} className={card}>
            <div className="flex items-center justify-between mb-2"><k.icon className={cn("w-5 h-5", k.color)} /></div>
            <p className={cn("text-[22px] font-extrabold tracking-[-.02em]", txt)}>{k.value}</p>
            <p className={cn("text-[11px] font-bold uppercase tracking-wider mt-1", sub)}>{k.label}</p>
          </div>
        )) : Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={card}><Skeleton className="h-4 w-8 mb-3" /><Skeleton className="h-7 w-16 mb-2" /><Skeleton className="h-3 w-20" /></div>
        ))}
      </div>

      {/* LOCATION FILTER */}
      <div className={cn("rounded-[14px] border p-4", bg, border)}>
        <h3 className={cn("text-[13px] font-extrabold mb-3 uppercase tracking-wider", sub)}>Placements</h3>
        <div className="flex flex-wrap gap-1.5">
          {LOCATIONS.map(loc => (
            <button key={loc.id} onClick={() => { setLocationFilter(locationFilter === loc.id ? "" : loc.id); setPage(1); }}
              className={cn("h-7 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer",
                locationFilter === loc.id ? "bg-[#2563eb] text-white border-[#2563eb]" : cn(border, sub, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")
              )}>
              <loc.icon className="w-3 h-3" /> {loc.label}
            </button>
          ))}
          {locationFilter && <button onClick={() => setLocationFilter("")} className={cn("h-7 px-2 text-[11px] font-bold flex items-center gap-1 cursor-pointer", sub)}><X className="w-3 h-3" /> Clear</button>}
        </div>
      </div>

      {/* SEARCH + STATUS */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className={cn("flex-1 flex items-center gap-2 h-10 px-3 rounded-[10px] border", border, bg)}>
          <Search className={cn("w-4 h-4 shrink-0", sub)} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, campaign, location..."
            className={cn("flex-1 bg-transparent text-[13px] outline-none", txt)} />
          {search && <button onClick={() => setSearch("")} className="cursor-pointer"><X className={cn("w-4 h-4", sub)} /></button>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn("h-8 px-3 rounded-full text-[12px] font-bold capitalize border transition-colors cursor-pointer",
                statusFilter === s ? "bg-[#2563eb] text-white border-[#2563eb]" : cn(border, sub, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")
              )}>{s}</button>
          ))}
        </div>
      </div>

      {/* BULK */}
      {selected.size > 0 && (
        <div className={cn("flex items-center gap-2 p-3 rounded-[10px] border", border, bg)}>
          <span className={cn("text-[12px] font-bold", sub)}>{selected.size} selected</span>
          <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} className={cn("h-8 px-2 rounded-[8px] text-[12px] border", border, bg, txt)}>
            <option value="">Action...</option>
            <option value="publish">Publish</option>
            <option value="unpublish">Unpublish</option>
            <option value="duplicate">Duplicate</option>
            <option value="export">Export</option>
            <option value="delete">Delete</option>
          </select>
          <button onClick={handleBulk} disabled={!bulkAction} className="h-8 px-3 rounded-[8px] bg-[#2563eb] text-white text-[12px] font-bold cursor-pointer hover:bg-[#1d4ed8] disabled:opacity-40">Apply</button>
        </div>
      )}

      {/* TABLE */}
      <div className={cn("rounded-[14px] border overflow-hidden", border)}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className={cn(dark ? "bg-[#1a2030]" : "bg-[#f9fafb]")}>
                <th className="px-4 py-3 text-left w-10"><input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} className="cursor-pointer rounded" /></th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px] w-14", sub)}>Preview</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px]", sub)}>Banner</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px] hidden md:table-cell", sub)}>Placement</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px] hidden lg:table-cell", sub)}>Campaign</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px] hidden lg:table-cell", sub)}>Priority</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px] hidden xl:table-cell", sub)}>Clicks</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px] hidden xl:table-cell", sub)}>CTR</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px]", sub)}>Status</th>
                <th className={cn("px-4 py-3 text-right font-bold uppercase tracking-wider text-[11px]", sub)}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className={cn("border-t", border)}>
                  {Array.from({ length: 10 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>)}
                </tr>
              )) : rows.length === 0 ? (
                <tr><td colSpan={10} className={cn("px-4 py-12 text-center text-[14px]", sub)}>No banners found.</td></tr>
              ) : rows.map(b => {
                const st = getBannerStatus(b);
                const loc = LOCATION_MAP[b.location];
                const LocIcon = loc?.icon || ImageIcon;
                const ctr = b.impressions > 0 ? ((b.clicks / b.impressions) * 100).toFixed(1) : "0";
                return (
                  <tr key={b.id} className={cn("border-t cursor-pointer transition-colors", border, dark ? "hover:bg-white/[.03]" : "hover:bg-[#f9fafb]")} onClick={() => setDetailId(b.id)}>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(b.id)} onChange={() => toggleOne(b.id)} className="cursor-pointer rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className={cn("w-12 h-8 rounded-[6px] overflow-hidden flex items-center justify-center", dark ? "bg-[#252c36]" : "bg-[#f0f1f3]")}>
                        {b.image_desktop ? (
                          <img src={b.image_desktop} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className={cn("w-4 h-4", sub)} />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className={cn("font-bold text-[13px]", txt)}>{b.name}</p>
                      {b.description && <p className={cn("text-[11px] truncate max-w-[200px]", sub)}>{b.description}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold", sub)}>
                        <LocIcon className="w-3 h-3" /> {loc?.label || b.location}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 hidden lg:table-cell text-[12px]", sub)}>{b.campaign || "—"}</td>
                    <td className={cn("px-4 py-3 hidden lg:table-cell text-[12px] font-bold", txt)}>{b.priority}</td>
                    <td className={cn("px-4 py-3 hidden xl:table-cell text-[12px] font-bold", txt)}>{fmtN(b.clicks)}</td>
                    <td className={cn("px-4 py-3 hidden xl:table-cell text-[12px] font-bold", txt)}>{ctr}%</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold", st.color)}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDetailId(b.id)} className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                          <Eye className={cn("w-3.5 h-3.5", sub)} />
                        </button>
                        <button onClick={() => openEdit(b)} className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                          <Edit3 className={cn("w-3.5 h-3.5", sub)} />
                        </button>
                        <button onClick={() => handleToggle(b.id, b.is_active)} className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                          {b.is_active ? <ToggleRight className="w-3.5 h-3.5 text-green-500" /> : <ToggleLeft className="w-3.5 h-3.5 text-gray-400" />}
                        </button>
                        <button onClick={() => handleDuplicate(b.id)} className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                          <Copy className={cn("w-3.5 h-3.5", sub)} />
                        </button>
                        <button onClick={() => handleDelete(b.id)} className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className={cn("flex items-center justify-between px-4 py-3 border-t", border)}>
            <p className={cn("text-[12px]", sub)}>Showing {(page-1)*limit+1}–{Math.min(page*limit, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={cn("h-8 w-8 rounded-[8px] flex items-center justify-center border cursor-pointer disabled:opacity-40", border, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")}><ChevronLeft className={cn("w-4 h-4", sub)} /></button>
              <span className={cn("text-[12px] font-bold px-2", txt)}>{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className={cn("h-8 w-8 rounded-[8px] flex items-center justify-center border cursor-pointer disabled:opacity-40", border, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")}><ChevronRight className={cn("w-4 h-4", sub)} /></button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER */}
      <Drawer open={!!detailId} onClose={() => { setDetailId(null); setDetail(null); }} dark={dark} width="2xl" title="Banner Details">
        {detailLoading || !detail ? (
          <div className="space-y-4 p-2"><Skeleton className="h-40 w-full" /><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>
        ) : (
          <div className="space-y-4">
            {/* Preview */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                {(["desktop", "tablet", "mobile"] as const).map(d => (
                  <button key={d} onClick={() => setPreviewDevice(d)}
                    className={cn("h-7 px-2 rounded-[6px] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors",
                      previewDevice === d ? "bg-[#2563eb] text-white" : cn(sub, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")
                    )}>
                    {d === "desktop" ? <Monitor className="w-3 h-3" /> : d === "tablet" ? <Tablet className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
              <div className={cn("rounded-[12px] overflow-hidden border flex items-center justify-center", border,
                previewDevice === "mobile" ? "max-w-[320px] mx-auto" : previewDevice === "tablet" ? "max-w-[768px] mx-auto" : "w-full",
                dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                {getPreviewImage(detail) ? (
                  <img src={getPreviewImage(detail)} alt={detail.alt_text || ""} className="w-full h-auto" />
                ) : (
                  <div className="py-16 text-center">
                    <ImageIcon className={cn("w-12 h-12 mx-auto mb-2", sub)} />
                    <p className={cn("text-[13px]", sub)}>No image uploaded</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className={cn("flex gap-1 border-b", border)}>
              {["overview", "media", "targeting", "analytics"].map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={cn("px-3 py-2 text-[12px] font-bold capitalize rounded-t-[8px] transition-colors cursor-pointer",
                    detailTab === t ? "border-b-2 border-[#2563eb] text-[#2563eb]" : cn(sub, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")
                  )}>{t}</button>
              ))}
            </div>

            {detailTab === "overview" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Name", value: detail.name },
                    { label: "Location", value: LOCATION_MAP[detail.location]?.label || detail.location },
                    { label: "Campaign", value: detail.campaign || "—" },
                    { label: "Priority", value: String(detail.priority || 0) },
                    { label: "Status", value: getBannerStatus(detail).label },
                    { label: "Device Target", value: detail.device_target || "All" },
                    { label: "Start Date", value: fmtDate(detail.starts_at) },
                    { label: "End Date", value: fmtDate(detail.ends_at) },
                    { label: "Created", value: fmtDateTime(detail.created_at) },
                    { label: "Updated", value: fmtDateTime(detail.updated_at) },
                  ].map((s, i) => (
                    <div key={i} className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                      <p className={cn("text-[10px] font-bold uppercase", sub)}>{s.label}</p>
                      <p className={cn("text-[14px] font-extrabold mt-0.5", txt)}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {detail.description && (
                  <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <p className={cn("text-[10px] font-bold uppercase mb-1", sub)}>Description</p>
                    <p className={cn("text-[13px]", txt)}>{detail.description}</p>
                  </div>
                )}
                {detail.link_url && (
                  <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <p className={cn("text-[10px] font-bold uppercase mb-1", sub)}>Link</p>
                    <div className="flex items-center gap-2">
                      <Link className={cn("w-4 h-4 shrink-0", sub)} />
                      <p className={cn("text-[13px] truncate", txt)}>{detail.link_url}</p>
                      {detail.link_type && <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600")}>{detail.link_type}</span>}
                    </div>
                  </div>
                )}
                {detail.cta_label && (
                  <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <p className={cn("text-[10px] font-bold uppercase mb-2", sub)}>CTA Preview</p>
                    <button className="px-4 py-2 rounded-[8px] text-white text-[13px] font-bold" style={{ backgroundColor: detail.cta_color || "#2563eb" }}>
                      {detail.cta_label}
                    </button>
                  </div>
                )}
              </div>
            )}

            {detailTab === "media" && (
              <div className="space-y-3">
                {[
                  { label: "Desktop Image", url: detail.image_desktop, dim: "1920x640" },
                  { label: "Tablet Image", url: detail.image_tablet, dim: "1024x400" },
                  { label: "Mobile Image", url: detail.image_mobile, dim: "640x400" },
                ].map((img, i) => (
                  <div key={i} className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={cn("text-[12px] font-bold", txt)}>{img.label}</p>
                      <span className={cn("text-[10px] font-mono", sub)}>{img.dim}</span>
                    </div>
                    {img.url ? (
                      <img src={img.url} alt="" className="w-full rounded-[8px]" />
                    ) : (
                      <div className={cn("py-8 text-center rounded-[8px] border-2 border-dashed", border)}>
                        <ImageIcon className={cn("w-8 h-8 mx-auto mb-1", sub)} />
                        <p className={cn("text-[12px]", sub)}>No image</p>
                      </div>
                    )}
                  </div>
                ))}
                {detail.alt_text && (
                  <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <p className={cn("text-[10px] font-bold uppercase mb-1", sub)}>Alt Text</p>
                    <p className={cn("text-[13px]", txt)}>{detail.alt_text}</p>
                  </div>
                )}
                {(detail.seo_title || detail.seo_description) && (
                  <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <p className={cn("text-[10px] font-bold uppercase mb-1", sub)}>SEO</p>
                    {detail.seo_title && <p className={cn("text-[13px] font-bold", txt)}>{detail.seo_title}</p>}
                    {detail.seo_description && <p className={cn("text-[12px] mt-1", sub)}>{detail.seo_description}</p>}
                  </div>
                )}
              </div>
            )}

            {detailTab === "targeting" && (
              <div className="space-y-3">
                {[
                  { label: "Device", value: detail.device_target || "All", icon: Monitor, active: detail.device_target && detail.device_target !== "all" },
                  { label: "Country", value: detail.country || "All countries", icon: Globe, active: !!detail.country },
                  { label: "Language", value: detail.language || "All languages", icon: Type, active: !!detail.language },
                  { label: "Schedule Start", value: detail.starts_at ? fmtDateTime(detail.starts_at) : "Immediate", icon: Calendar, active: !!detail.starts_at },
                  { label: "Schedule End", value: detail.ends_at ? fmtDateTime(detail.ends_at) : "No expiry", icon: Clock, active: !!detail.ends_at },
                ].map((rule, i) => (
                  <div key={i} className={cn("flex items-center justify-between p-3 rounded-[10px]", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <div className="flex items-center gap-2">
                      {rule.active ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}
                      <rule.icon className={cn("w-4 h-4", sub)} />
                      <span className={cn("text-[13px] font-bold", txt)}>{rule.label}</span>
                    </div>
                    <span className={cn("text-[13px]", sub)}>{rule.value}</span>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "analytics" && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Impressions", value: fmtN(detail.impressions || 0), icon: Eye, color: "text-amber-500" },
                  { label: "Clicks", value: fmtN(detail.clicks || 0), icon: MousePointer, color: "text-blue-500" },
                  { label: "CTR", value: `${detail.impressions ? ((detail.clicks / detail.impressions) * 100).toFixed(1) : "0"}%`, icon: TrendingUp, color: "text-pink-500" },
                  { label: "Conversions", value: fmtN(detail.conversions || 0), icon: Target, color: "text-emerald-500" },
                  { label: "Conv. Rate", value: `${detail.clicks ? ((detail.conversions / detail.clicks) * 100).toFixed(1) : "0"}%`, icon: BarChart3, color: "text-purple-500" },
                  { label: "Priority", value: String(detail.priority || 0), icon: Star, color: "text-yellow-500" },
                ].map((s, i) => (
                  <div key={i} className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <s.icon className={cn("w-4 h-4 mb-1", s.color)} />
                    <p className={cn("text-[16px] font-extrabold", txt)}>{s.value}</p>
                    <p className={cn("text-[10px] font-bold uppercase", sub)}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => openEdit(detail)} className="flex-1 h-9 rounded-[8px] bg-[#2563eb] text-white text-[13px] font-bold cursor-pointer hover:bg-[#1d4ed8]">Edit Banner</button>
              <button onClick={() => handleDuplicate(detail.id)} className={cn("h-9 px-3 rounded-[8px] text-[13px] font-bold border cursor-pointer", border, txt)}>Duplicate</button>
              <button onClick={() => handleDelete(detail.id)} className="h-9 px-3 rounded-[8px] bg-red-600 text-white text-[13px] font-bold cursor-pointer hover:bg-red-700">Delete</button>
            </div>
          </div>
        )}
      </Drawer>

      {/* CREATE/EDIT DRAWER */}
      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} dark={dark} width="xl" title={editId ? "Edit Banner" : "Create Banner"}>
        <div className="space-y-4">
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Banner Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={cn("mt-1", inputCls)} placeholder="Summer Sale Hero Banner" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cn("text-[12px] font-bold uppercase", sub)}>Placement</label>
              <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className={cn("mt-1", inputCls)}>
                {LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className={cn("text-[12px] font-bold uppercase", sub)}>Campaign</label>
              <input value={form.campaign} onChange={e => setForm({ ...form, campaign: e.target.value })} className={cn("mt-1", inputCls)} placeholder="Summer Sale 2024" />
            </div>
          </div>
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className={cn("mt-1 w-full px-3 py-2 rounded-[10px] border text-[13px] resize-none outline-none", border, bg, txt)} placeholder="Internal description" />
          </div>

          <div className={cn("rounded-[10px] p-3 space-y-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
            <p className={cn("text-[12px] font-bold uppercase", sub)}>Media</p>
            <BannerImageField dark={dark} label="Desktop Image" hint="Recommended 1920×640" value={form.image_desktop} onChange={v => setForm(f => ({ ...f, image_desktop: v }))} />
            <BannerImageField dark={dark} label="Tablet Image" hint="Recommended 1024×400 — optional" value={form.image_tablet} onChange={v => setForm(f => ({ ...f, image_tablet: v }))} />
            <BannerImageField dark={dark} label="Mobile Image" hint="Recommended 640×400 — optional" value={form.image_mobile} onChange={v => setForm(f => ({ ...f, image_mobile: v }))} />
            <div>
              <label className={cn("text-[11px] font-bold", sub)}>Alt Text</label>
              <input value={form.alt_text} onChange={e => setForm({ ...form, alt_text: e.target.value })} className={cn("mt-1", inputCls)} placeholder="Descriptive alt text for accessibility" />
            </div>
          </div>

          <div className={cn("rounded-[10px] p-3 space-y-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
            <p className={cn("text-[12px] font-bold uppercase", sub)}>Link & CTA</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={cn("text-[11px] font-bold", sub)}>Link Type</label>
                <select value={form.link_type} onChange={e => setForm({ ...form, link_type: e.target.value })} className={cn("mt-1", inputCls)}>
                  <option value="">None</option>
                  {LINK_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label className={cn("text-[11px] font-bold", sub)}>Link URL</label>
                <input value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} className={cn("mt-1", inputCls)} placeholder="/shop or https://..." />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={cn("text-[11px] font-bold", sub)}>CTA Label</label>
                <input value={form.cta_label} onChange={e => setForm({ ...form, cta_label: e.target.value })} className={cn("mt-1", inputCls)} placeholder="Shop Now" />
              </div>
              <div>
                <label className={cn("text-[11px] font-bold", sub)}>CTA Style</label>
                <select value={form.cta_style} onChange={e => setForm({ ...form, cta_style: e.target.value })} className={cn("mt-1", inputCls)}>
                  <option value="solid">Solid</option>
                  <option value="outline">Outline</option>
                  <option value="ghost">Ghost</option>
                </select>
              </div>
              <div>
                <label className={cn("text-[11px] font-bold", sub)}>CTA Color</label>
                <input type="color" value={form.cta_color} onChange={e => setForm({ ...form, cta_color: e.target.value })} className="mt-1 w-full h-10 rounded-[10px] border-0 cursor-pointer" />
              </div>
            </div>
          </div>

          <div className={cn("rounded-[10px] p-3 space-y-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
            <p className={cn("text-[12px] font-bold uppercase", sub)}>Scheduling & Targeting</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={cn("text-[11px] font-bold", sub)}>Start Date</label>
                <input type="date" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} className={cn("mt-1", inputCls)} />
              </div>
              <div>
                <label className={cn("text-[11px] font-bold", sub)}>End Date</label>
                <input type="date" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} className={cn("mt-1", inputCls)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={cn("text-[11px] font-bold", sub)}>Device</label>
                <select value={form.device_target} onChange={e => setForm({ ...form, device_target: e.target.value })} className={cn("mt-1", inputCls)}>
                  {DEVICE_OPTIONS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={cn("text-[11px] font-bold", sub)}>Country</label>
                <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className={cn("mt-1", inputCls)} placeholder="HT, US..." />
              </div>
              <div>
                <label className={cn("text-[11px] font-bold", sub)}>Priority</label>
                <input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className={cn("mt-1", inputCls)} min="0" />
              </div>
            </div>
          </div>

          <div className={cn("rounded-[10px] p-3 space-y-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
            <p className={cn("text-[12px] font-bold uppercase", sub)}>SEO</p>
            <div>
              <label className={cn("text-[11px] font-bold", sub)}>SEO Title</label>
              <input value={form.seo_title} onChange={e => setForm({ ...form, seo_title: e.target.value })} className={cn("mt-1", inputCls)} placeholder="Banner title for search engines" />
            </div>
            <div>
              <label className={cn("text-[11px] font-bold", sub)}>SEO Description</label>
              <textarea value={form.seo_description} onChange={e => setForm({ ...form, seo_description: e.target.value })} rows={2} className={cn("mt-1 w-full px-3 py-2 rounded-[10px] border text-[13px] resize-none outline-none", border, bg, txt)} placeholder="Meta description" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setForm({ ...form, is_active: !form.is_active })} className="cursor-pointer">
              {form.is_active ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
            </button>
            <span className={cn("text-[13px] font-bold", txt)}>{form.is_active ? "Active" : "Inactive"}</span>
          </div>

          {/* Live Preview */}
          {form.image_desktop && (
            <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
              <p className={cn("text-[10px] font-bold uppercase mb-2", sub)}>Preview</p>
              <img src={form.image_desktop} alt={form.alt_text || ""} className="w-full rounded-[8px]" />
              {form.cta_label && (
                <div className="mt-2">
                  <button className="px-4 py-2 rounded-[8px] text-white text-[13px] font-bold" style={{ backgroundColor: form.cta_color || "#2563eb" }}>
                    {form.cta_label}
                  </button>
                </div>
              )}
            </div>
          )}

          <button onClick={handleSubmit} disabled={formSubmitting || !form.name}
            className="w-full h-10 rounded-[10px] bg-[#2563eb] text-white text-[14px] font-bold cursor-pointer hover:bg-[#1d4ed8] disabled:opacity-40 transition-colors">
            {formSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editId ? "Update Banner" : "Create Banner"}
          </button>
        </div>
      </Drawer>
    </div>
  );
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"];
const EXT_MAP = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/svg+xml": "svg" };

function BannerImageField({ dark, label, hint, value, onChange }) {
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const border = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [showUrl, setShowUrl] = useState(false);

  const upload = async (file) => {
    setError("");
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { setError("Unsupported file type (use JPG, PNG, WebP, GIF, AVIF or SVG)"); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Image exceeds the 8MB limit"); return; }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = EXT_MAP[file.type] || "bin";
      const path = `banners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("banner-images").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        // Fallback to the server upload route if direct storage is unavailable
        const fd = new FormData();
        fd.append("files", file);
        fd.append("bucket", "banner-images");
        fd.append("folder", "banners");
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.files?.[0]?.url) throw new Error(d.error || upErr.message || "Upload failed");
        onChange(d.files[0].url);
      } else {
        const { data: pub } = supabase.storage.from("banner-images").getPublicUrl(path);
        onChange(pub.publicUrl);
      }
    } catch (e) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className={cn("text-[11px] font-bold", sub)}>{label}</label>
        <button type="button" onClick={() => setShowUrl(v => !v)} className={cn("text-[10px] font-bold", sub, "hover:text-[#2563eb]")}>
          {showUrl ? "Use upload" : "Paste URL instead"}
        </button>
      </div>

      <input ref={fileRef} type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} className="hidden"
        onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />

      {value ? (
        <div className={cn("mt-1 relative rounded-[10px] border overflow-hidden group", border)}>
          <img src={value} alt="" className="w-full max-h-40 object-cover" onError={e => { e.currentTarget.style.opacity = "0.3"; }} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="px-3 h-8 rounded-[8px] bg-white text-black text-[11px] font-bold flex items-center gap-1">
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Replace
            </button>
            <button type="button" onClick={() => onChange("")}
              className="px-3 h-8 rounded-[8px] bg-red-500 text-white text-[11px] font-bold flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </div>
        </div>
      ) : showUrl ? (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder="https://..."
          className={cn("mt-1 w-full px-3 py-2 rounded-[10px] border text-[13px] outline-none", border, dark ? "bg-[#171c24] text-[#e7ebf0]" : "bg-white text-[#16181d]")} />
      ) : (
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (!uploading && e.dataTransfer.files?.[0]) upload(e.dataTransfer.files[0]); }}
          className={cn("mt-1 rounded-[10px] border-2 border-dashed p-5 text-center cursor-pointer transition-colors select-none",
            dragOver ? "border-[#2563eb] bg-[#2563eb]/5" : border, uploading && "opacity-60 pointer-events-none")}>
          {uploading ? (
            <><Loader2 className="w-6 h-6 mx-auto mb-1.5 animate-spin text-[#2563eb]" /><p className={cn("text-[12px] font-semibold", txt)}>Uploading…</p></>
          ) : (
            <><Upload className={cn("w-6 h-6 mx-auto mb-1.5", dragOver ? "text-[#2563eb]" : sub)} />
            <p className={cn("text-[12px] font-semibold", txt)}>Click to choose a photo or drag & drop</p>
            <p className={cn("text-[10px] mt-0.5", sub)}>{hint} · up to 8MB</p></>
          )}
        </div>
      )}
      {error && <p className="text-[11px] text-red-500 mt-1 font-medium">{error}</p>}
    </div>
  );
}
