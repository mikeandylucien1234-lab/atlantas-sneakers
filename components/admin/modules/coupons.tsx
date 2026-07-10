// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Drawer } from "@/components/ui/drawer";
import {
  Tag, Gift, Percent, DollarSign, Truck, ShoppingBag, Zap, Clock,
  Search, Filter, ChevronLeft, ChevronRight, Download, Upload,
  RefreshCw, Plus, Eye, Edit3, Copy, Trash2, CheckCircle2, XCircle,
  BarChart3, TrendingUp, TrendingDown, Calendar, Users, Crown,
  ArrowUpRight, ArrowDownRight, Package, Star, X, Loader2,
  ToggleLeft, ToggleRight, AlertTriangle, Hash, Shield,
} from "lucide-react";

type Props = { dark: boolean };

type CouponRow = {
  id: string; code: string; type: string; value: number; description: string | null;
  campaign: string | null; min_order: number; max_discount: number | null;
  max_uses: number | null; used_count: number; total_discount_given: number;
  starts_at: string | null; expires_at: string | null; is_active: boolean;
  conditions: any; created_at: string;
};

type KPIs = {
  totalCoupons: number; activeCoupons: number; expiredCoupons: number;
  scheduledCoupons: number; usedToday: number; usedMonth: number;
  totalDiscount: number; conversionRate: number; avgOrderIncrease: number;
  mostUsedCoupon: string; unusedCoupons: number; disabledCoupons: number;
};

const TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  percentage: { label: "Percentage", icon: Percent, color: "text-blue-500" },
  fixed: { label: "Fixed Amount", icon: DollarSign, color: "text-green-500" },
  free_shipping: { label: "Free Shipping", icon: Truck, color: "text-purple-500" },
  buy_x_get_y: { label: "Buy X Get Y", icon: Gift, color: "text-pink-500" },
  cashback: { label: "Cashback", icon: TrendingDown, color: "text-teal-500" },
};

const STATUS_FILTERS = ["all", "active", "expired", "disabled", "scheduled"];

const fmtN = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + "M" : n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n);
const fmtCurrency = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "HTG" }).format(n);
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function getCouponStatus(c: CouponRow): { label: string; color: string } {
  const now = new Date();
  if (!c.is_active) return { label: "Disabled", color: "bg-gray-500/15 text-gray-500" };
  if (c.starts_at && new Date(c.starts_at) > now) return { label: "Scheduled", color: "bg-indigo-500/15 text-indigo-600" };
  if (c.expires_at && new Date(c.expires_at) <= now) return { label: "Expired", color: "bg-red-500/15 text-red-600" };
  if (c.max_uses && c.used_count >= c.max_uses) return { label: "Maxed", color: "bg-amber-500/15 text-amber-600" };
  return { label: "Active", color: "bg-green-500/15 text-green-600" };
}

function formatDiscount(c: CouponRow) {
  if (c.type === "percentage") return `${c.value}%`;
  if (c.type === "fixed") return fmtCurrency(c.value);
  if (c.type === "free_shipping") return "Free Ship";
  if (c.type === "buy_x_get_y") return "BOGO";
  if (c.type === "cashback") return `${c.value}% back`;
  return String(c.value);
}

export function AdminCoupons({ dark }: Props) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [detailLoading, setDetailLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", type: "percentage", value: "", description: "", campaign: "", min_order: "", max_discount: "", max_uses: "", starts_at: "", expires_at: "", is_active: true });
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [bulkAction, setBulkAction] = useState("");

  const bg = dark ? "bg-[#171c24]" : "bg-white";
  const border = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const card = cn("rounded-[14px] border p-4", bg, border);
  const inputCls = cn("w-full h-10 px-3 rounded-[10px] border text-[13px] outline-none", border, bg, txt);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(t); }, [search]);

  const fetchKpis = useCallback(async () => {
    try { const r = await fetch("/api/admin/coupons?section=kpis"); if (r.ok) setKpis(await r.json()); } catch {}
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ section: "list", page: String(page), limit: String(limit) });
      if (debouncedSearch) p.set("search", debouncedSearch);
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (typeFilter) p.set("type", typeFilter);
      const r = await fetch(`/api/admin/coupons?${p}`);
      if (r.ok) { const d = await r.json(); setRows(d.rows || []); setTotal(d.total || 0); }
    } catch {} finally { setLoading(false); }
  }, [page, limit, debouncedSearch, statusFilter, typeFilter]);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);
  useEffect(() => { fetchList(); }, [fetchList]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true); setDetailTab("overview");
    try { const r = await fetch(`/api/admin/coupons?section=detail&id=${id}`); if (r.ok) setDetail(await r.json()); } catch {} finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { if (detailId) fetchDetail(detailId); }, [detailId, fetchDetail]);

  const openCreate = () => {
    setEditId(null);
    setForm({ code: "", type: "percentage", value: "", description: "", campaign: "", min_order: "", max_discount: "", max_uses: "", starts_at: "", expires_at: "", is_active: true });
    setCreateOpen(true);
  };

  const openEdit = (c: CouponRow) => {
    setEditId(c.id);
    setForm({
      code: c.code, type: c.type, value: String(c.value), description: c.description || "",
      campaign: c.campaign || "", min_order: c.min_order ? String(c.min_order) : "",
      max_discount: c.max_discount ? String(c.max_discount) : "", max_uses: c.max_uses ? String(c.max_uses) : "",
      starts_at: c.starts_at ? c.starts_at.slice(0, 10) : "", expires_at: c.expires_at ? c.expires_at.slice(0, 10) : "",
      is_active: c.is_active,
    });
    setCreateOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.code || !form.value) return;
    setFormSubmitting(true);
    try {
      // Normalized payload for the direct-Supabase fallback
      const record = {
        code: form.code.toUpperCase(), type: form.type, value: parseFloat(form.value),
        description: form.description || null, campaign: form.campaign || null,
        min_order: form.min_order ? parseFloat(form.min_order) : 0,
        max_discount: form.max_discount ? parseFloat(form.max_discount) : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        starts_at: form.starts_at || null, expires_at: form.expires_at || null,
        is_active: form.is_active !== false,
      };

      const viaApi = async () => {
        const method = editId ? "PUT" : "POST";
        const body = editId ? { id: editId, ...form } : form;
        const r = await fetch("/api/admin/coupons", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const text = await r.text();
        let d; try { d = text ? JSON.parse(text) : {}; } catch { const e = new Error("nonjson"); e.nonJson = true; throw e; }
        if (!r.ok) throw new Error(d.error || "Failed to save coupon");
      };

      const viaSupabase = async () => {
        const supabase = createClient();
        if (editId) {
          const { error } = await supabase.from("coupons").update({ ...record, updated_at: new Date().toISOString() }).eq("id", editId);
          if (error) throw new Error(error.message);
        } else {
          const { data: dup } = await supabase.from("coupons").select("id").eq("code", record.code).maybeSingle();
          if (dup) throw new Error("Coupon code already exists");
          const { error } = await supabase.from("coupons").insert({ ...record, used_count: 0, total_discount_given: 0 });
          if (error) throw new Error(error.message);
        }
      };

      try { await viaApi(); }
      catch (e) { if (e.nonJson) await viaSupabase(); else throw e; }

      setCreateOpen(false); fetchList(); fetchKpis();
      if (detailId === editId && editId) fetchDetail(editId);
    } catch (e) {
      alert(e.message || "Failed to create coupon");
    } finally { setFormSubmitting(false); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await fetch("/api/admin/coupons", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_active: !active }) });
    fetchList(); fetchKpis();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    await fetch(`/api/admin/coupons?id=${id}`, { method: "DELETE" });
    fetchList(); fetchKpis();
    if (detailId === id) { setDetailId(null); setDetail(null); }
  };

  const handleDuplicate = async (id: string) => {
    await fetch("/api/admin/coupons", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "duplicate", ids: [id] }) });
    fetchList(); fetchKpis();
  };

  const handleBulk = async () => {
    if (!bulkAction || selected.size === 0) return;
    if (bulkAction === "export") { handleExport(); setSelected(new Set()); setBulkAction(""); return; }
    if (bulkAction === "delete" && !confirm(`Delete ${selected.size} coupons?`)) return;
    await fetch("/api/admin/coupons", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: bulkAction, ids: Array.from(selected) }) });
    setSelected(new Set()); setBulkAction(""); fetchList(); fetchKpis();
  };

  const handleExport = async () => {
    try {
      const r = await fetch("/api/admin/coupons?section=export"); if (!r.ok) return;
      const { rows: data } = await r.json();
      const csv = ["Code,Type,Value,Status,Used,Max Uses,Min Order,Starts,Expires,Created"].concat(
        data.map((c: any) => `"${c.code}","${c.type}",${c.value},"${c.is_active ? "active" : "disabled"}",${c.used_count || 0},${c.max_uses || ""},${c.min_order || 0},"${c.starts_at || ""}","${c.expires_at || ""}","${c.created_at || ""}"`)
      ).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `coupons-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const toggleAll = () => { selected.size === rows.length ? setSelected(new Set()) : setSelected(new Set(rows.map(r => r.id))); };
  const toggleOne = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const totalPages = Math.ceil(total / limit);

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      { label: "Total Coupons", value: fmtN(kpis.totalCoupons), icon: Tag, color: "text-blue-500" },
      { label: "Active", value: fmtN(kpis.activeCoupons), icon: CheckCircle2, color: "text-green-500" },
      { label: "Expired", value: fmtN(kpis.expiredCoupons), icon: XCircle, color: "text-red-500" },
      { label: "Scheduled", value: fmtN(kpis.scheduledCoupons), icon: Calendar, color: "text-indigo-500" },
      { label: "Used Today", value: fmtN(kpis.usedToday), icon: Zap, color: "text-amber-500" },
      { label: "Used This Month", value: fmtN(kpis.usedMonth), icon: BarChart3, color: "text-purple-500" },
      { label: "Total Discount", value: fmtCurrency(kpis.totalDiscount), icon: DollarSign, color: "text-emerald-500" },
      { label: "Conversion Rate", value: `${kpis.conversionRate}%`, icon: TrendingUp, color: "text-pink-500" },
      { label: "Most Used", value: kpis.mostUsedCoupon, icon: Star, color: "text-yellow-500" },
      { label: "Unused", value: fmtN(kpis.unusedCoupons), icon: AlertTriangle, color: "text-orange-500" },
      { label: "Disabled", value: fmtN(kpis.disabledCoupons), icon: ToggleLeft, color: "text-gray-500" },
      { label: "Avg Order +", value: `${kpis.avgOrderIncrease}%`, icon: ArrowUpRight, color: "text-teal-500" },
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
          <h1 className={cn("text-[28px] font-extrabold tracking-[-.02em]", txt)}>Coupons</h1>
          <p className={cn("text-[14px] mt-1", sub)}>Manage all coupons, discounts and promotional campaigns.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openCreate} className="h-9 px-3 rounded-[10px] bg-[#2563eb] text-white text-[13px] font-bold flex items-center gap-1.5 hover:bg-[#1d4ed8] transition-colors cursor-pointer">
            <Plus className="w-4 h-4" /> Create Coupon
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

      {/* FILTERS */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className={cn("flex-1 flex items-center gap-2 h-10 px-3 rounded-[10px] border", border, bg)}>
          <Search className={cn("w-4 h-4 shrink-0", sub)} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by code, campaign, description..."
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

      {/* TYPE FILTER */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(TYPE_LABELS).map(([key, t]) => (
          <button key={key} onClick={() => { setTypeFilter(typeFilter === key ? "" : key); setPage(1); }}
            className={cn("h-7 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer",
              typeFilter === key ? cn("border-current", t.color, "bg-current/10") : cn(border, sub, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")
            )}>
            <t.icon className="w-3 h-3" /> {t.label}
          </button>
        ))}
        {typeFilter && <button onClick={() => setTypeFilter("")} className={cn("h-7 px-2 text-[11px] font-bold flex items-center gap-1 cursor-pointer", sub)}><X className="w-3 h-3" /> Clear</button>}
      </div>

      {/* BULK */}
      {selected.size > 0 && (
        <div className={cn("flex items-center gap-2 p-3 rounded-[10px] border", border, bg)}>
          <span className={cn("text-[12px] font-bold", sub)}>{selected.size} selected</span>
          <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} className={cn("h-8 px-2 rounded-[8px] text-[12px] border", border, bg, txt)}>
            <option value="">Action...</option>
            <option value="enable">Enable</option>
            <option value="disable">Disable</option>
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
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px]", sub)}>Code</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px] hidden sm:table-cell", sub)}>Type</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px]", sub)}>Discount</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px] hidden md:table-cell", sub)}>Usage</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px] hidden lg:table-cell", sub)}>Expires</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px]", sub)}>Status</th>
                <th className={cn("px-4 py-3 text-right font-bold uppercase tracking-wider text-[11px]", sub)}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className={cn("border-t", border)}>
                  {Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>)}
                </tr>
              )) : rows.length === 0 ? (
                <tr><td colSpan={8} className={cn("px-4 py-12 text-center text-[14px]", sub)}>No coupons found.</td></tr>
              ) : rows.map(c => {
                const st = getCouponStatus(c);
                const tl = TYPE_LABELS[c.type] || TYPE_LABELS.percentage;
                const TypeIcon = tl.icon;
                return (
                  <tr key={c.id} className={cn("border-t cursor-pointer transition-colors", border, dark ? "hover:bg-white/[.03]" : "hover:bg-[#f9fafb]")} onClick={() => setDetailId(c.id)}>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} className="cursor-pointer rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Tag className={cn("w-4 h-4 shrink-0", tl.color)} />
                        <div>
                          <p className={cn("font-bold font-mono text-[13px]", txt)}>{c.code}</p>
                          {c.campaign && <p className={cn("text-[11px]", sub)}>{c.campaign}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold", tl.color)}>
                        <TypeIcon className="w-3 h-3" /> {tl.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[14px] font-extrabold", txt)}>{formatDiscount(c)}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={cn("text-[12px] font-bold", txt)}>{c.used_count || 0}{c.max_uses ? `/${c.max_uses}` : ""}</span>
                    </td>
                    <td className={cn("px-4 py-3 hidden lg:table-cell text-[12px]", sub)}>{fmtDate(c.expires_at)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold", st.color)}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDetailId(c.id)} className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                          <Eye className={cn("w-3.5 h-3.5", sub)} />
                        </button>
                        <button onClick={() => openEdit(c)} className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                          <Edit3 className={cn("w-3.5 h-3.5", sub)} />
                        </button>
                        <button onClick={() => handleToggle(c.id, c.is_active)} className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                          {c.is_active ? <ToggleRight className="w-3.5 h-3.5 text-green-500" /> : <ToggleLeft className="w-3.5 h-3.5 text-gray-400" />}
                        </button>
                        <button onClick={() => handleDuplicate(c.id)} className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                          <Copy className={cn("w-3.5 h-3.5", sub)} />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
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
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={cn("h-8 w-8 rounded-[8px] flex items-center justify-center border cursor-pointer disabled:opacity-40", border, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")}>
                <ChevronLeft className={cn("w-4 h-4", sub)} />
              </button>
              <span className={cn("text-[12px] font-bold px-2", txt)}>{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className={cn("h-8 w-8 rounded-[8px] flex items-center justify-center border cursor-pointer disabled:opacity-40", border, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")}>
                <ChevronRight className={cn("w-4 h-4", sub)} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER */}
      <Drawer open={!!detailId} onClose={() => { setDetailId(null); setDetail(null); }} dark={dark} width="2xl" title="Coupon Details">
        {detailLoading || !detail ? (
          <div className="space-y-4 p-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className={cn("flex items-center justify-between p-4 rounded-[12px]", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
              <div className="flex items-center gap-3">
                <div className={cn("w-12 h-12 rounded-[10px] flex items-center justify-center", TYPE_LABELS[detail.type]?.color || "text-blue-500", "bg-current/10")}>
                  {(() => { const Icon = TYPE_LABELS[detail.type]?.icon || Tag; return <Icon className="w-6 h-6" />; })()}
                </div>
                <div>
                  <p className={cn("text-[20px] font-extrabold font-mono", txt)}>{detail.code}</p>
                  <p className={cn("text-[13px]", sub)}>{detail.description || detail.campaign || "No description"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("px-3 py-1 rounded-full text-[12px] font-bold", getCouponStatus(detail).color)}>{getCouponStatus(detail).label}</span>
                <button onClick={() => openEdit(detail)} className={cn("h-8 px-3 rounded-[8px] text-[12px] font-bold border flex items-center gap-1 cursor-pointer", border, txt)}>
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className={cn("flex gap-1 border-b", border)}>
              {["overview", "conditions", "usage", "analytics"].map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={cn("px-3 py-2 text-[12px] font-bold capitalize rounded-t-[8px] transition-colors cursor-pointer",
                    detailTab === t ? "border-b-2 border-[#2563eb] text-[#2563eb]" : cn(sub, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")
                  )}>{t}</button>
              ))}
            </div>

            {detailTab === "overview" && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Discount", value: formatDiscount(detail) },
                  { label: "Type", value: TYPE_LABELS[detail.type]?.label || detail.type },
                  { label: "Campaign", value: detail.campaign || "—" },
                  { label: "Times Used", value: `${detail.used_count || 0}${detail.max_uses ? `/${detail.max_uses}` : ""}` },
                  { label: "Total Saved", value: fmtCurrency(detail.total_discount_given || 0) },
                  { label: "Min Order", value: detail.min_order ? fmtCurrency(detail.min_order) : "None" },
                  { label: "Max Discount", value: detail.max_discount ? fmtCurrency(detail.max_discount) : "No limit" },
                  { label: "Start Date", value: fmtDate(detail.starts_at) },
                  { label: "End Date", value: fmtDate(detail.expires_at) },
                  { label: "Created", value: fmtDateTime(detail.created_at) },
                ].map((s, i) => (
                  <div key={i} className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <p className={cn("text-[10px] font-bold uppercase", sub)}>{s.label}</p>
                    <p className={cn("text-[15px] font-extrabold mt-0.5", txt)}>{s.value}</p>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "conditions" && (
              <div className="space-y-3">
                <h4 className={cn("text-[14px] font-extrabold", txt)}>Conditions & Rules</h4>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { label: "Minimum Order", value: detail.min_order ? fmtCurrency(detail.min_order) : "No minimum", active: !!detail.min_order },
                    { label: "Maximum Discount", value: detail.max_discount ? fmtCurrency(detail.max_discount) : "No limit", active: !!detail.max_discount },
                    { label: "Usage Limit", value: detail.max_uses ? `${detail.max_uses} uses` : "Unlimited", active: !!detail.max_uses },
                    { label: "Start Date", value: detail.starts_at ? fmtDate(detail.starts_at) : "Immediate", active: !!detail.starts_at },
                    { label: "Expiration", value: detail.expires_at ? fmtDate(detail.expires_at) : "Never", active: !!detail.expires_at },
                  ].map((rule, i) => (
                    <div key={i} className={cn("flex items-center justify-between p-3 rounded-[10px]", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                      <div className="flex items-center gap-2">
                        {rule.active ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}
                        <span className={cn("text-[13px] font-bold", txt)}>{rule.label}</span>
                      </div>
                      <span className={cn("text-[13px]", sub)}>{rule.value}</span>
                    </div>
                  ))}
                </div>
                {detail.conditions && (
                  <div className={cn("p-3 rounded-[10px] text-[12px] font-mono", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]", sub)}>
                    <p className={cn("text-[11px] font-bold uppercase mb-1", sub)}>Custom Conditions (JSON)</p>
                    <pre className="overflow-x-auto">{JSON.stringify(detail.conditions, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}

            {detailTab === "usage" && (
              <div className="space-y-3">
                <h4 className={cn("text-[14px] font-extrabold", txt)}>Usage History</h4>
                {(detail.usage || []).length === 0 ? (
                  <p className={cn("text-[13px] py-6 text-center", sub)}>No usage recorded yet.</p>
                ) : (detail.usage || []).map((u: any, i: number) => (
                  <div key={i} className={cn("flex items-center gap-3 p-3 rounded-[10px]", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <div className="w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                      {(u.profiles?.full_name || "?")[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[13px] font-bold", txt)}>{u.profiles?.full_name || "Unknown"}</p>
                      <p className={cn("text-[11px]", sub)}>{u.profiles?.email || "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-[13px] font-bold", txt)}>{u.discount_amount ? fmtCurrency(u.discount_amount) : "—"}</p>
                      <p className={cn("text-[10px]", sub)}>{fmtDateTime(u.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "analytics" && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Times Used", value: String(detail.used_count || 0), icon: Hash, color: "text-blue-500" },
                  { label: "Total Saved", value: fmtCurrency(detail.total_discount_given || 0), icon: DollarSign, color: "text-green-500" },
                  { label: "Avg Discount", value: detail.used_count ? fmtCurrency((detail.total_discount_given || 0) / detail.used_count) : "—", icon: BarChart3, color: "text-purple-500" },
                  { label: "Remaining Uses", value: detail.max_uses ? String(Math.max(0, detail.max_uses - (detail.used_count || 0))) : "Unlimited", icon: Shield, color: "text-teal-500" },
                  { label: "Days Active", value: String(Math.max(0, Math.floor((Date.now() - new Date(detail.created_at).getTime()) / 86400000))), icon: Calendar, color: "text-orange-500" },
                  { label: "Days Remaining", value: detail.expires_at ? String(Math.max(0, Math.ceil((new Date(detail.expires_at).getTime() - Date.now()) / 86400000))) : "N/A", icon: Clock, color: "text-red-500" },
                ].map((s, i) => (
                  <div key={i} className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <s.icon className={cn("w-4 h-4 mb-1", s.color)} />
                    <p className={cn("text-[16px] font-extrabold", txt)}>{s.value}</p>
                    <p className={cn("text-[10px] font-bold uppercase", sub)}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* CREATE/EDIT DRAWER */}
      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} dark={dark} width="lg" title={editId ? "Edit Coupon" : "Create Coupon"}>
        <div className="space-y-4">
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Coupon Code</label>
            <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className={cn("mt-1", inputCls)} placeholder="SUMMER2024" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cn("text-[12px] font-bold uppercase", sub)}>Discount Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={cn("mt-1", inputCls)}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
                <option value="free_shipping">Free Shipping</option>
                <option value="buy_x_get_y">Buy X Get Y</option>
                <option value="cashback">Cashback</option>
              </select>
            </div>
            <div>
              <label className={cn("text-[12px] font-bold uppercase", sub)}>Value</label>
              <input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className={cn("mt-1", inputCls)} placeholder={form.type === "percentage" ? "10" : "500"} />
            </div>
          </div>
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className={cn("mt-1 w-full px-3 py-2 rounded-[10px] border text-[13px] resize-none outline-none", border, bg, txt)} placeholder="Summer sale — 10% off everything" />
          </div>
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Campaign</label>
            <input value={form.campaign} onChange={e => setForm({ ...form, campaign: e.target.value })} className={cn("mt-1", inputCls)} placeholder="Summer Sale 2024" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cn("text-[12px] font-bold uppercase", sub)}>Min Order</label>
              <input type="number" value={form.min_order} onChange={e => setForm({ ...form, min_order: e.target.value })} className={cn("mt-1", inputCls)} placeholder="0" />
            </div>
            <div>
              <label className={cn("text-[12px] font-bold uppercase", sub)}>Max Discount</label>
              <input type="number" value={form.max_discount} onChange={e => setForm({ ...form, max_discount: e.target.value })} className={cn("mt-1", inputCls)} placeholder="No limit" />
            </div>
          </div>
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Max Uses</label>
            <input type="number" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} className={cn("mt-1", inputCls)} placeholder="Unlimited" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cn("text-[12px] font-bold uppercase", sub)}>Start Date</label>
              <input type="date" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} className={cn("mt-1", inputCls)} />
            </div>
            <div>
              <label className={cn("text-[12px] font-bold uppercase", sub)}>Expiration Date</label>
              <input type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} className={cn("mt-1", inputCls)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setForm({ ...form, is_active: !form.is_active })} className="cursor-pointer">
              {form.is_active ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
            </button>
            <span className={cn("text-[13px] font-bold", txt)}>{form.is_active ? "Active" : "Disabled"}</span>
          </div>
          <button onClick={handleSubmit} disabled={formSubmitting || !form.code || !form.value}
            className="w-full h-10 rounded-[10px] bg-[#2563eb] text-white text-[14px] font-bold cursor-pointer hover:bg-[#1d4ed8] disabled:opacity-40 transition-colors">
            {formSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editId ? "Update Coupon" : "Create Coupon"}
          </button>
        </div>
      </Drawer>
    </div>
  );
}
