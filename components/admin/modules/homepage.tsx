// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  Layout, Megaphone, ShoppingBag, Tag, Star, Zap, Gift, Users,
  Image as ImageIcon, Grid3X3, Layers, Crown, Heart, TrendingUp,
  Eye, MousePointer, Target, BarChart3, ArrowUp, ArrowDown,
  Search, ChevronUp, ChevronDown, Plus, Trash2, Edit3, Copy,
  CheckCircle2, XCircle, Monitor, Tablet, Smartphone, Globe,
  Download, RefreshCw, Loader2, X, GripVertical, ToggleLeft,
  ToggleRight, Save, Clock, Mail, MessageSquare, Palette,
  Settings, FileText, Link, Type, Hash, Package,
} from "lucide-react";

type Props = { dark: boolean };

type Section = {
  id: string; label: string; type: string; order: number;
  is_active: boolean; config?: any;
};

type KPIs = {
  totalSections: number; activeSections: number; inactiveSections: number;
  totalProducts: number; featuredProducts: number; totalCategories: number;
  totalBrands: number; clicks: number; ctr: number; impressions: number;
  conversions: number; bounceRate: number;
};

const SECTION_ICONS: Record<string, any> = {
  announcement_bar: Megaphone, hero_carousel: Layout, flash_deals: Zap,
  featured_categories: Grid3X3, trending_now: TrendingUp, best_sellers: Star,
  new_arrivals: Package, collections: Layers, brands_showcase: Crown,
  top_rated: Star, promo_banner: ImageIcon, recommended: Heart,
  most_wishlisted: Heart, coupons: Tag, rewards: Gift,
  testimonials: MessageSquare, newsletter: Mail, app_download: Smartphone,
  blog: FileText, faq: MessageSquare,
};

const SECTION_COLORS: Record<string, string> = {
  carousel: "text-blue-500", products: "text-purple-500", categories: "text-emerald-500",
  collections: "text-pink-500", brands: "text-amber-500", banner: "text-cyan-500",
  coupons: "text-orange-500", rewards: "text-yellow-500", reviews: "text-teal-500",
  content: "text-gray-500",
};

const SECTION_TYPES = [
  { value: "content", label: "Content" }, { value: "products", label: "Products" },
  { value: "categories", label: "Categories" }, { value: "collections", label: "Collections" },
  { value: "brands", label: "Brands" }, { value: "carousel", label: "Carousel" },
  { value: "banner", label: "Banner" }, { value: "coupons", label: "Coupons" },
  { value: "rewards", label: "Rewards" }, { value: "reviews", label: "Reviews" },
];

const PRODUCT_SOURCES = [
  "manual", "category", "brand", "flash_deals", "most_sold", "newest",
  "random", "top_rated", "trending", "best_sellers", "featured", "wishlisted",
];

const fmtN = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + "M" : n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n);

export function AdminHomepage({ dark }: Props) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"builder" | "seo" | "analytics">("builder");

  const [editSection, setEditSection] = useState<Section | null>(null);
  const [editConfig, setEditConfig] = useState<any>({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ id: "", label: "", type: "content" });

  const [seo, setSeo] = useState({ title: "", description: "", keywords: "", og_image: "" });
  const [seoLoading, setSeoLoading] = useState(false);

  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const bg = dark ? "bg-[#171c24]" : "bg-white";
  const border = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const card = cn("rounded-[14px] border p-4", bg, border);
  const inputCls = cn("w-full h-10 px-3 rounded-[10px] border text-[13px] outline-none", border, bg, txt);

  const fetchKpis = useCallback(async () => {
    try { const r = await fetch("/api/admin/homepage?section=kpis"); if (r.ok) setKpis(await r.json()); } catch {}
  }, []);

  const fetchSections = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch("/api/admin/homepage?section=sections"); if (r.ok) { const d = await r.json(); setSections(d.sections || []); } } catch {} finally { setLoading(false); }
  }, []);

  const fetchSeo = useCallback(async () => {
    try { const r = await fetch("/api/admin/homepage?section=seo"); if (r.ok) setSeo(await r.json()); } catch {}
  }, []);

  useEffect(() => { fetchKpis(); fetchSections(); fetchSeo(); }, [fetchKpis, fetchSections, fetchSeo]);

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/homepage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_sections", sections }) });
    } catch {} finally { setSaving(false); }
  };

  const handleToggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, is_active: !s.is_active } : s));
  };

  const handleMoveSection = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    const copy = [...sections];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    copy.forEach((s, i) => s.order = i);
    setSections(copy);
  };

  const handleDuplicateSection = (s: Section) => {
    const newId = `${s.id}_copy_${Date.now().toString(36).slice(-4)}`;
    const newSection: Section = { ...s, id: newId, label: `${s.label} (Copy)`, order: sections.length };
    setSections(prev => [...prev, newSection]);
  };

  const handleDeleteSection = (id: string) => {
    if (!confirm("Remove this section from the homepage?")) return;
    setSections(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i })));
  };

  const handleEditSection = (s: Section) => {
    setEditSection(s);
    setEditConfig(s.config || getDefaultConfig(s.type));
  };

  const getDefaultConfig = (type: string) => {
    if (type === "products") return { source: "featured", max_items: 12, layout: "grid", columns: 4, show_badge: true, show_rating: true, show_wishlist: true, show_cart: true };
    if (type === "carousel") return { auto_play: true, interval: 5000, show_dots: true, show_arrows: true };
    if (type === "categories") return { max_items: 8, layout: "grid", show_count: true };
    if (type === "brands") return { max_items: 12, layout: "slider", show_name: true };
    if (type === "content") return { title: "", subtitle: "", bg_color: "", text_color: "", image: "" };
    if (type === "banner") return { image_desktop: "", image_mobile: "", link: "", cta_label: "" };
    return {};
  };

  const handleSaveSection = async () => {
    if (!editSection) return;
    setEditSubmitting(true);
    try {
      const updated = { ...editSection, config: editConfig };
      setSections(prev => prev.map(s => s.id === editSection.id ? updated : s));
      await fetch("/api/admin/homepage", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_section", id: editSection.id, config: editConfig, is_active: editSection.is_active, label: editSection.label, order: editSection.order }) });
      setEditSection(null);
    } catch {} finally { setEditSubmitting(false); }
  };

  const handleCreateSection = async () => {
    if (!createForm.id || !createForm.label) return;
    const newSection: Section = { id: createForm.id.toLowerCase().replace(/\s+/g, "_"), label: createForm.label, type: createForm.type, order: sections.length, is_active: true };
    setSections(prev => [...prev, newSection]);
    await fetch("/api/admin/homepage", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_section", ...newSection }) });
    setCreateOpen(false);
    setCreateForm({ id: "", label: "", type: "content" });
  };

  const handleSaveSeo = async () => {
    setSeoLoading(true);
    try {
      await fetch("/api/admin/homepage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_seo", seo }) });
    } catch {} finally { setSeoLoading(false); }
  };

  const handleExport = () => {
    const json = JSON.stringify({ sections, seo }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `homepage-config-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const copy = [...sections];
    const [moved] = copy.splice(dragIdx, 1);
    copy.splice(idx, 0, moved);
    copy.forEach((s, i) => s.order = i);
    setSections(copy);
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      { label: "Total Sections", value: fmtN(kpis.totalSections), icon: Layout, color: "text-blue-500" },
      { label: "Active Sections", value: fmtN(kpis.activeSections), icon: CheckCircle2, color: "text-green-500" },
      { label: "Inactive", value: fmtN(kpis.inactiveSections), icon: XCircle, color: "text-gray-500" },
      { label: "Products", value: fmtN(kpis.totalProducts), icon: Package, color: "text-purple-500" },
      { label: "Featured", value: fmtN(kpis.featuredProducts), icon: Star, color: "text-yellow-500" },
      { label: "Categories", value: fmtN(kpis.totalCategories), icon: Grid3X3, color: "text-emerald-500" },
      { label: "Brands", value: fmtN(kpis.totalBrands), icon: Crown, color: "text-amber-500" },
      { label: "Clicks", value: fmtN(kpis.clicks), icon: MousePointer, color: "text-cyan-500" },
      { label: "CTR", value: `${kpis.ctr}%`, icon: TrendingUp, color: "text-pink-500" },
      { label: "Impressions", value: fmtN(kpis.impressions), icon: Eye, color: "text-indigo-500" },
      { label: "Conversions", value: fmtN(kpis.conversions), icon: Target, color: "text-teal-500" },
      { label: "Bounce Rate", value: `${kpis.bounceRate}%`, icon: BarChart3, color: "text-red-500" },
    ];
  }, [kpis]);

  const Skeleton = ({ className }: { className?: string }) => (
    <div className={cn("animate-pulse rounded-[10px]", dark ? "bg-[#252c36]" : "bg-[#eef0f3]", className)} />
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={cn("text-[28px] font-extrabold tracking-[-.02em]", txt)}>Homepage Management</h1>
          <p className={cn("text-[14px] mt-1", sub)}>Manage every section of the homepage from one professional dashboard.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleSaveAll} disabled={saving} className="h-9 px-3 rounded-[10px] bg-[#2563eb] text-white text-[13px] font-bold flex items-center gap-1.5 hover:bg-[#1d4ed8] transition-colors cursor-pointer disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Publish
          </button>
          <button onClick={() => setCreateOpen(true)} className={cn("h-9 px-3 rounded-[10px] text-[13px] font-bold flex items-center gap-1.5 border cursor-pointer transition-colors", border, dark ? "text-[#e7ebf0] hover:bg-white/5" : "text-[#16181d] hover:bg-[#f7f8fa]")}>
            <Plus className="w-4 h-4" /> Add Section
          </button>
          <button onClick={handleExport} className={cn("h-9 px-3 rounded-[10px] text-[13px] font-bold flex items-center gap-1.5 border cursor-pointer transition-colors", border, dark ? "text-[#e7ebf0] hover:bg-white/5" : "text-[#16181d] hover:bg-[#f7f8fa]")}>
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => { fetchKpis(); fetchSections(); }} className={cn("h-9 w-9 rounded-[10px] flex items-center justify-center border cursor-pointer transition-colors", border, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")}>
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

      {/* TABS */}
      <div className={cn("flex gap-1 border-b", border)}>
        {(["builder", "seo", "analytics"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn("px-4 py-2.5 text-[13px] font-bold capitalize rounded-t-[8px] transition-colors cursor-pointer",
              activeTab === t ? "border-b-2 border-[#2563eb] text-[#2563eb]" : cn(sub, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")
            )}>
            {t === "builder" ? "Page Builder" : t === "seo" ? "SEO Settings" : "Analytics"}
          </button>
        ))}
      </div>

      {/* PAGE BUILDER */}
      {activeTab === "builder" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <p className={cn("text-[13px] font-bold", sub)}>Drag sections to reorder. Toggle visibility. Click to configure.</p>
            <div className="flex items-center gap-1">
              {(["desktop", "tablet", "mobile"] as const).map(d => (
                <button key={d} onClick={() => setPreviewDevice(d)}
                  className={cn("h-7 px-2 rounded-[6px] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors",
                    previewDevice === d ? "bg-[#2563eb] text-white" : cn(sub, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")
                  )}>
                  {d === "desktop" ? <Monitor className="w-3 h-3" /> : d === "tablet" ? <Tablet className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                </button>
              ))}
            </div>
          </div>

          {loading ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={card}><Skeleton className="h-12 w-full" /></div>
          )) : sections.length === 0 ? (
            <div className={cn("rounded-[14px] border p-12 text-center", bg, border)}>
              <Layout className={cn("w-12 h-12 mx-auto mb-3", sub)} />
              <p className={cn("text-[15px] font-bold", txt)}>No sections configured</p>
              <p className={cn("text-[13px] mt-1", sub)}>Add sections to start building your homepage.</p>
            </div>
          ) : sections.map((s, idx) => {
            const Icon = SECTION_ICONS[s.id] || Layout;
            const color = SECTION_COLORS[s.type] || "text-gray-500";
            return (
              <div key={s.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-[12px] border transition-all group",
                  s.is_active ? cn(bg, border) : cn(dark ? "bg-[#171c24]/60" : "bg-[#f9fafb]", border, "opacity-60"),
                  dragIdx === idx && "ring-2 ring-[#2563eb] scale-[1.01]",
                  "cursor-grab active:cursor-grabbing"
                )}>
                <GripVertical className={cn("w-4 h-4 shrink-0 opacity-40 group-hover:opacity-100", sub)} />

                <div className={cn("w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0", s.is_active ? "bg-current/10" : "bg-gray-500/10")}>
                  <Icon className={cn("w-5 h-5", s.is_active ? color : "text-gray-400")} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn("text-[14px] font-bold", s.is_active ? txt : sub)}>{s.label}</p>
                  <p className={cn("text-[11px]", sub)}>{s.type} · Position {idx + 1}</p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); handleMoveSection(idx, -1); }}
                    disabled={idx === 0}
                    className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer disabled:opacity-20", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                    <ChevronUp className={cn("w-3.5 h-3.5", sub)} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleMoveSection(idx, 1); }}
                    disabled={idx === sections.length - 1}
                    className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer disabled:opacity-20", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                    <ChevronDown className={cn("w-3.5 h-3.5", sub)} />
                  </button>
                  <button onClick={() => handleEditSection(s)}
                    className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                    <Edit3 className={cn("w-3.5 h-3.5", sub)} />
                  </button>
                  <button onClick={() => handleDuplicateSection(s)}
                    className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                    <Copy className={cn("w-3.5 h-3.5", sub)} />
                  </button>
                  <button onClick={() => handleDeleteSection(s.id)}
                    className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>

                <button onClick={() => handleToggleSection(s.id)} className="cursor-pointer shrink-0">
                  {s.is_active ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                </button>
              </div>
            );
          })}

          {sections.length > 0 && (
            <div className="flex items-center justify-between pt-3">
              <p className={cn("text-[12px]", sub)}>{sections.filter(s => s.is_active).length} active / {sections.length} total sections</p>
              <button onClick={handleSaveAll} disabled={saving}
                className="h-9 px-4 rounded-[10px] bg-[#2563eb] text-white text-[13px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-[#1d4ed8] disabled:opacity-40">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save & Publish
              </button>
            </div>
          )}
        </div>
      )}

      {/* SEO */}
      {activeTab === "seo" && (
        <div className={cn("rounded-[14px] border p-6 space-y-4", bg, border)}>
          <h3 className={cn("text-[16px] font-extrabold", txt)}>Homepage SEO Settings</h3>
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Page Title</label>
            <input value={seo.title} onChange={e => setSeo({ ...seo, title: e.target.value })} className={cn("mt-1", inputCls)} placeholder="Atlanta Sneakers — Premium Sneakers in Haiti" />
          </div>
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Meta Description</label>
            <textarea value={seo.description} onChange={e => setSeo({ ...seo, description: e.target.value })} rows={3}
              className={cn("mt-1 w-full px-3 py-2 rounded-[10px] border text-[13px] resize-none outline-none", border, bg, txt)} placeholder="Shop the latest sneakers, fashion and lifestyle products..." />
            <p className={cn("text-[11px] mt-1", sub)}>{(seo.description || "").length}/160 characters</p>
          </div>
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Keywords</label>
            <input value={seo.keywords} onChange={e => setSeo({ ...seo, keywords: e.target.value })} className={cn("mt-1", inputCls)} placeholder="sneakers, haiti, fashion, shoes" />
          </div>
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>OG Image URL</label>
            <input value={seo.og_image} onChange={e => setSeo({ ...seo, og_image: e.target.value })} className={cn("mt-1", inputCls)} placeholder="https://..." />
          </div>
          {seo.og_image && (
            <div className={cn("rounded-[10px] overflow-hidden border", border)}>
              <img src={seo.og_image} alt="OG Preview" className="w-full h-auto max-h-[200px] object-cover" />
            </div>
          )}
          <div className={cn("rounded-[10px] p-4", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
            <p className={cn("text-[11px] font-bold uppercase mb-2", sub)}>Search Preview</p>
            <p className="text-[16px] text-[#1a0dab] font-medium">{seo.title || "Atlanta Sneakers"}</p>
            <p className="text-[13px] text-[#006621]">atlantasneaker.com</p>
            <p className="text-[12px] text-[#545454] mt-0.5">{seo.description || "Shop premium sneakers and fashion in Haiti."}</p>
          </div>
          <button onClick={handleSaveSeo} disabled={seoLoading}
            className="h-10 px-4 rounded-[10px] bg-[#2563eb] text-white text-[14px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-[#1d4ed8] disabled:opacity-40">
            {seoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save SEO Settings
          </button>
        </div>
      )}

      {/* ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Impressions", value: fmtN(kpis?.impressions || 0), icon: Eye, color: "text-amber-500" },
              { label: "Clicks", value: fmtN(kpis?.clicks || 0), icon: MousePointer, color: "text-blue-500" },
              { label: "CTR", value: `${kpis?.ctr || 0}%`, icon: TrendingUp, color: "text-pink-500" },
              { label: "Conversions", value: fmtN(kpis?.conversions || 0), icon: Target, color: "text-emerald-500" },
              { label: "Bounce Rate", value: `${kpis?.bounceRate || 0}%`, icon: BarChart3, color: "text-red-500" },
              { label: "Active Sections", value: String(kpis?.activeSections || 0), icon: CheckCircle2, color: "text-green-500" },
            ].map((s, i) => (
              <div key={i} className={cn("rounded-[12px] p-4", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                <s.icon className={cn("w-5 h-5 mb-2", s.color)} />
                <p className={cn("text-[20px] font-extrabold", txt)}>{s.value}</p>
                <p className={cn("text-[11px] font-bold uppercase", sub)}>{s.label}</p>
              </div>
            ))}
          </div>

          <div className={cn("rounded-[14px] border p-4", bg, border)}>
            <h4 className={cn("text-[14px] font-extrabold mb-3", txt)}>Section Performance</h4>
            {sections.filter(s => s.is_active).map((s, i) => {
              const Icon = SECTION_ICONS[s.id] || Layout;
              return (
                <div key={s.id} className={cn("flex items-center gap-3 py-2", i > 0 && cn("border-t", border))}>
                  <Icon className={cn("w-4 h-4", SECTION_COLORS[s.type] || "text-gray-500")} />
                  <span className={cn("flex-1 text-[13px] font-bold", txt)}>{s.label}</span>
                  <span className={cn("text-[12px]", sub)}>Position {i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EDIT SECTION DRAWER */}
      <Drawer open={!!editSection} onClose={() => setEditSection(null)} dark={dark} width="lg" title={`Configure: ${editSection?.label || ""}`}>
        {editSection && (
          <div className="space-y-4">
            <div>
              <label className={cn("text-[12px] font-bold uppercase", sub)}>Section Label</label>
              <input value={editSection.label} onChange={e => setEditSection({ ...editSection, label: e.target.value })} className={cn("mt-1", inputCls)} />
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setEditSection({ ...editSection, is_active: !editSection.is_active })} className="cursor-pointer">
                {editSection.is_active ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
              </button>
              <span className={cn("text-[13px] font-bold", txt)}>{editSection.is_active ? "Active" : "Inactive"}</span>
            </div>

            {/* Products Config */}
            {editSection.type === "products" && (
              <div className={cn("rounded-[10px] p-4 space-y-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                <p className={cn("text-[12px] font-bold uppercase", sub)}>Product Source</p>
                <select value={editConfig.source || "featured"} onChange={e => setEditConfig({ ...editConfig, source: e.target.value })} className={inputCls}>
                  {PRODUCT_SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cn("text-[11px] font-bold", sub)}>Max Items</label>
                    <input type="number" value={editConfig.max_items || 12} onChange={e => setEditConfig({ ...editConfig, max_items: parseInt(e.target.value) })} className={cn("mt-1", inputCls)} min="1" max="50" />
                  </div>
                  <div>
                    <label className={cn("text-[11px] font-bold", sub)}>Layout</label>
                    <select value={editConfig.layout || "grid"} onChange={e => setEditConfig({ ...editConfig, layout: e.target.value })} className={cn("mt-1", inputCls)}>
                      <option value="grid">Grid</option>
                      <option value="carousel">Carousel</option>
                      <option value="slider">Slider</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cn("text-[11px] font-bold", sub)}>Columns (Desktop)</label>
                    <select value={editConfig.columns || 4} onChange={e => setEditConfig({ ...editConfig, columns: parseInt(e.target.value) })} className={cn("mt-1", inputCls)}>
                      {[2, 3, 4, 5, 6].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 pt-5">
                    {[
                      { key: "show_badge", label: "Show Badge" },
                      { key: "show_rating", label: "Show Rating" },
                      { key: "show_wishlist", label: "Show Wishlist" },
                      { key: "show_cart", label: "Show Add to Cart" },
                    ].map(opt => (
                      <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editConfig[opt.key] !== false} onChange={e => setEditConfig({ ...editConfig, [opt.key]: e.target.checked })} className="rounded" />
                        <span className={cn("text-[12px]", txt)}>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Carousel Config */}
            {editSection.type === "carousel" && (
              <div className={cn("rounded-[10px] p-4 space-y-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                <p className={cn("text-[12px] font-bold uppercase", sub)}>Carousel Settings</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editConfig.auto_play !== false} onChange={e => setEditConfig({ ...editConfig, auto_play: e.target.checked })} className="rounded" />
                    <span className={cn("text-[12px]", txt)}>Auto Play</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editConfig.show_dots !== false} onChange={e => setEditConfig({ ...editConfig, show_dots: e.target.checked })} className="rounded" />
                    <span className={cn("text-[12px]", txt)}>Show Dots</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editConfig.show_arrows !== false} onChange={e => setEditConfig({ ...editConfig, show_arrows: e.target.checked })} className="rounded" />
                    <span className={cn("text-[12px]", txt)}>Show Arrows</span>
                  </label>
                </div>
                <div>
                  <label className={cn("text-[11px] font-bold", sub)}>Interval (ms)</label>
                  <input type="number" value={editConfig.interval || 5000} onChange={e => setEditConfig({ ...editConfig, interval: parseInt(e.target.value) })} className={cn("mt-1", inputCls)} min="1000" step="500" />
                </div>
              </div>
            )}

            {/* Categories Config */}
            {editSection.type === "categories" && (
              <div className={cn("rounded-[10px] p-4 space-y-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                <p className={cn("text-[12px] font-bold uppercase", sub)}>Categories Settings</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cn("text-[11px] font-bold", sub)}>Max Items</label>
                    <input type="number" value={editConfig.max_items || 8} onChange={e => setEditConfig({ ...editConfig, max_items: parseInt(e.target.value) })} className={cn("mt-1", inputCls)} />
                  </div>
                  <div>
                    <label className={cn("text-[11px] font-bold", sub)}>Layout</label>
                    <select value={editConfig.layout || "grid"} onChange={e => setEditConfig({ ...editConfig, layout: e.target.value })} className={cn("mt-1", inputCls)}>
                      <option value="grid">Grid</option>
                      <option value="carousel">Carousel</option>
                      <option value="list">List</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editConfig.show_count !== false} onChange={e => setEditConfig({ ...editConfig, show_count: e.target.checked })} className="rounded" />
                  <span className={cn("text-[12px]", txt)}>Show Product Count</span>
                </label>
              </div>
            )}

            {/* Content Config */}
            {editSection.type === "content" && (
              <div className={cn("rounded-[10px] p-4 space-y-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                <p className={cn("text-[12px] font-bold uppercase", sub)}>Content Settings</p>
                <div>
                  <label className={cn("text-[11px] font-bold", sub)}>Title</label>
                  <input value={editConfig.title || ""} onChange={e => setEditConfig({ ...editConfig, title: e.target.value })} className={cn("mt-1", inputCls)} />
                </div>
                <div>
                  <label className={cn("text-[11px] font-bold", sub)}>Subtitle</label>
                  <input value={editConfig.subtitle || ""} onChange={e => setEditConfig({ ...editConfig, subtitle: e.target.value })} className={cn("mt-1", inputCls)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cn("text-[11px] font-bold", sub)}>Background Color</label>
                    <input type="color" value={editConfig.bg_color || "#ffffff"} onChange={e => setEditConfig({ ...editConfig, bg_color: e.target.value })} className="mt-1 w-full h-10 rounded-[10px] border-0 cursor-pointer" />
                  </div>
                  <div>
                    <label className={cn("text-[11px] font-bold", sub)}>Text Color</label>
                    <input type="color" value={editConfig.text_color || "#000000"} onChange={e => setEditConfig({ ...editConfig, text_color: e.target.value })} className="mt-1 w-full h-10 rounded-[10px] border-0 cursor-pointer" />
                  </div>
                </div>
                <div>
                  <label className={cn("text-[11px] font-bold", sub)}>Image URL</label>
                  <input value={editConfig.image || ""} onChange={e => setEditConfig({ ...editConfig, image: e.target.value })} className={cn("mt-1", inputCls)} placeholder="https://..." />
                </div>
              </div>
            )}

            {/* Banner Config */}
            {editSection.type === "banner" && (
              <div className={cn("rounded-[10px] p-4 space-y-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                <p className={cn("text-[12px] font-bold uppercase", sub)}>Banner Settings</p>
                <div>
                  <label className={cn("text-[11px] font-bold", sub)}>Desktop Image URL</label>
                  <input value={editConfig.image_desktop || ""} onChange={e => setEditConfig({ ...editConfig, image_desktop: e.target.value })} className={cn("mt-1", inputCls)} />
                </div>
                <div>
                  <label className={cn("text-[11px] font-bold", sub)}>Mobile Image URL</label>
                  <input value={editConfig.image_mobile || ""} onChange={e => setEditConfig({ ...editConfig, image_mobile: e.target.value })} className={cn("mt-1", inputCls)} />
                </div>
                <div>
                  <label className={cn("text-[11px] font-bold", sub)}>Link</label>
                  <input value={editConfig.link || ""} onChange={e => setEditConfig({ ...editConfig, link: e.target.value })} className={cn("mt-1", inputCls)} placeholder="/shop" />
                </div>
                <div>
                  <label className={cn("text-[11px] font-bold", sub)}>CTA Label</label>
                  <input value={editConfig.cta_label || ""} onChange={e => setEditConfig({ ...editConfig, cta_label: e.target.value })} className={cn("mt-1", inputCls)} placeholder="Shop Now" />
                </div>
              </div>
            )}

            {/* Brands Config */}
            {editSection.type === "brands" && (
              <div className={cn("rounded-[10px] p-4 space-y-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                <p className={cn("text-[12px] font-bold uppercase", sub)}>Brands Settings</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cn("text-[11px] font-bold", sub)}>Max Items</label>
                    <input type="number" value={editConfig.max_items || 12} onChange={e => setEditConfig({ ...editConfig, max_items: parseInt(e.target.value) })} className={cn("mt-1", inputCls)} />
                  </div>
                  <div>
                    <label className={cn("text-[11px] font-bold", sub)}>Layout</label>
                    <select value={editConfig.layout || "slider"} onChange={e => setEditConfig({ ...editConfig, layout: e.target.value })} className={cn("mt-1", inputCls)}>
                      <option value="slider">Slider</option>
                      <option value="grid">Grid</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editConfig.show_name !== false} onChange={e => setEditConfig({ ...editConfig, show_name: e.target.checked })} className="rounded" />
                  <span className={cn("text-[12px]", txt)}>Show Brand Name</span>
                </label>
              </div>
            )}

            {/* Generic for coupons, rewards, reviews */}
            {["coupons", "rewards", "reviews", "collections"].includes(editSection.type) && (
              <div className={cn("rounded-[10px] p-4 space-y-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                <p className={cn("text-[12px] font-bold uppercase", sub)}>{editSection.type.charAt(0).toUpperCase() + editSection.type.slice(1)} Settings</p>
                <div>
                  <label className={cn("text-[11px] font-bold", sub)}>Max Items</label>
                  <input type="number" value={editConfig.max_items || 6} onChange={e => setEditConfig({ ...editConfig, max_items: parseInt(e.target.value) })} className={cn("mt-1", inputCls)} />
                </div>
                <div>
                  <label className={cn("text-[11px] font-bold", sub)}>Layout</label>
                  <select value={editConfig.layout || "grid"} onChange={e => setEditConfig({ ...editConfig, layout: e.target.value })} className={cn("mt-1", inputCls)}>
                    <option value="grid">Grid</option>
                    <option value="carousel">Carousel</option>
                    <option value="list">List</option>
                  </select>
                </div>
              </div>
            )}

            <button onClick={handleSaveSection} disabled={editSubmitting}
              className="w-full h-10 rounded-[10px] bg-[#2563eb] text-white text-[14px] font-bold cursor-pointer hover:bg-[#1d4ed8] disabled:opacity-40 transition-colors">
              {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save Section"}
            </button>
          </div>
        )}
      </Drawer>

      {/* CREATE SECTION DRAWER */}
      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} dark={dark} title="Add New Section">
        <div className="space-y-4">
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Section ID</label>
            <input value={createForm.id} onChange={e => setCreateForm({ ...createForm, id: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
              className={cn("mt-1", inputCls)} placeholder="custom_section" />
          </div>
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Label</label>
            <input value={createForm.label} onChange={e => setCreateForm({ ...createForm, label: e.target.value })}
              className={cn("mt-1", inputCls)} placeholder="My Custom Section" />
          </div>
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Type</label>
            <select value={createForm.type} onChange={e => setCreateForm({ ...createForm, type: e.target.value })} className={cn("mt-1", inputCls)}>
              {SECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <button onClick={handleCreateSection} disabled={!createForm.id || !createForm.label}
            className="w-full h-10 rounded-[10px] bg-[#2563eb] text-white text-[14px] font-bold cursor-pointer hover:bg-[#1d4ed8] disabled:opacity-40">
            Add Section
          </button>
        </div>
      </Drawer>
    </div>
  );
}
