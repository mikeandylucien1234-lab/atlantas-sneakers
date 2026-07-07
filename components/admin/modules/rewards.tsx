// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  Gift, Star, Users, Coins, Award, Tag, TrendingUp, TrendingDown,
  Search, Filter, ChevronLeft, ChevronRight, MoreHorizontal,
  Download, Upload, RefreshCw, Plus, Minus, Eye, Edit3, Trash2,
  Crown, Diamond, Shield, Medal, Heart, Zap, Clock, CheckCircle2,
  XCircle, AlertTriangle, ArrowUpRight, ArrowDownRight, Package,
  ShoppingBag, MessageSquare, Share2, UserPlus, Ticket, BarChart3,
  X, Send, Copy, Loader2,
} from "lucide-react";

type Props = { dark: boolean };

type MemberRow = {
  id: string; full_name: string; email: string; avatar_url: string | null;
  points: number; role: string; created_at: string;
  vip_level: string; balance: number;
};

type KPIs = {
  totalPoints: number; earnedToday: number; redeemedToday: number;
  totalMembers: number; vipMembers: number; couponsGenerated: number;
  couponsUsed: number; referralRewards: number; avgPoints: number;
  conversionRate: number; pendingRewards: number; expiredRewards: number;
};

const VIP_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  Bronze: { bg: "bg-amber-700/15", text: "text-amber-700", icon: Medal },
  Silver: { bg: "bg-slate-400/15", text: "text-slate-500", icon: Shield },
  Gold: { bg: "bg-yellow-500/15", text: "text-yellow-600", icon: Star },
  Platinum: { bg: "bg-purple-500/15", text: "text-purple-600", icon: Crown },
  Diamond: { bg: "bg-cyan-500/15", text: "text-cyan-600", icon: Diamond },
};

const VIP_THRESHOLDS = [
  { name: "Diamond", min: 5000, color: "#06b6d4" },
  { name: "Platinum", min: 2000, color: "#a855f7" },
  { name: "Gold", min: 1000, color: "#eab308" },
  { name: "Silver", min: 500, color: "#94a3b8" },
  { name: "Bronze", min: 0, color: "#b45309" },
];

const fmtN = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + "M" : n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n);
const fmtCurrency = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "HTG" }).format(n);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export function AdminRewards({ dark }: Props) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [vipFilter, setVipFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [detailLoading, setDetailLoading] = useState(false);

  const [pointsDrawer, setPointsDrawer] = useState<{ id: string; name: string; action: "add" | "remove" } | null>(null);
  const [pointsAmount, setPointsAmount] = useState("");
  const [pointsReason, setPointsReason] = useState("");
  const [pointsSubmitting, setPointsSubmitting] = useState(false);

  const [couponDrawer, setCouponDrawer] = useState(false);
  const [couponForm, setCouponForm] = useState({ code: "", type: "percentage", value: "", min_order: "", expires_at: "", max_uses: "1", user_id: "" });
  const [couponSubmitting, setCouponSubmitting] = useState(false);

  const [bulkAction, setBulkAction] = useState("");
  const [bulkPoints, setBulkPoints] = useState("");
  const [bulkReason, setBulkReason] = useState("");

  const bg = dark ? "bg-[#171c24]" : "bg-white";
  const border = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const card = cn("rounded-[14px] border p-4", bg, border);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchKpis = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/rewards?section=kpis");
      if (r.ok) setKpis(await r.json());
    } catch {}
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), limit: String(limit) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (vipFilter) params.set("vipLevel", vipFilter);
      const r = await fetch(`/api/admin/rewards?${params}`);
      if (r.ok) {
        const d = await r.json();
        setRows(d.rows || []);
        setTotal(d.total || 0);
      }
    } catch {} finally { setLoading(false); }
  }, [page, limit, debouncedSearch, vipFilter]);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);
  useEffect(() => { fetchList(); }, [fetchList]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailTab("overview");
    try {
      const r = await fetch(`/api/admin/rewards?section=detail&id=${id}`);
      if (r.ok) setDetail(await r.json());
    } catch {} finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { if (detailId) fetchDetail(detailId); }, [detailId, fetchDetail]);

  const handleAddRemovePoints = async () => {
    if (!pointsDrawer || !pointsAmount || !pointsReason) return;
    setPointsSubmitting(true);
    try {
      await fetch("/api/admin/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pointsDrawer.action === "add" ? "add_points" : "remove_points", user_id: pointsDrawer.id, points: parseInt(pointsAmount), reason: pointsReason }),
      });
      setPointsDrawer(null); setPointsAmount(""); setPointsReason("");
      fetchList(); fetchKpis();
      if (detailId === pointsDrawer.id) fetchDetail(pointsDrawer.id);
    } catch {} finally { setPointsSubmitting(false); }
  };

  const handleCreateCoupon = async () => {
    if (!couponForm.code || !couponForm.value) return;
    setCouponSubmitting(true);
    try {
      await fetch("/api/admin/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_coupon", ...couponForm, value: parseFloat(couponForm.value), min_order: parseFloat(couponForm.min_order || "0"), max_uses: parseInt(couponForm.max_uses || "1") }),
      });
      setCouponDrawer(false);
      setCouponForm({ code: "", type: "percentage", value: "", min_order: "", expires_at: "", max_uses: "1", user_id: "" });
      fetchKpis();
    } catch {} finally { setCouponSubmitting(false); }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selected.size === 0) return;
    const ids = Array.from(selected);
    if (bulkAction === "add_points" || bulkAction === "remove_points") {
      if (!bulkPoints) return;
      await fetch("/api/admin/rewards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: bulkAction, ids, points: parseInt(bulkPoints), reason: bulkReason || "Bulk action" }),
      });
    } else if (bulkAction === "export") {
      handleExport();
    }
    setSelected(new Set());
    setBulkAction(""); setBulkPoints(""); setBulkReason("");
    fetchList(); fetchKpis();
  };

  const handleExport = async () => {
    try {
      const r = await fetch("/api/admin/rewards?section=export");
      if (!r.ok) return;
      const { rows: data } = await r.json();
      const csv = ["Name,Email,Points,Role,Created"].concat(
        data.map((r: any) => `"${r.full_name || ""}","${r.email || ""}",${r.points || 0},"${r.role || ""}","${r.created_at || ""}"`)
      ).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `rewards-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map(r => r.id)));
  };
  const toggleOne = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const totalPages = Math.ceil(total / limit);

  const kpiCards = useMemo(() => {
    if (!kpis) return [];
    return [
      { label: "Total Points", value: fmtN(kpis.totalPoints), icon: Coins, color: "text-yellow-500" },
      { label: "Earned Today", value: fmtN(kpis.earnedToday), icon: TrendingUp, color: "text-green-500" },
      { label: "Redeemed Today", value: fmtN(kpis.redeemedToday), icon: TrendingDown, color: "text-red-500" },
      { label: "Active Members", value: fmtN(kpis.totalMembers), icon: Users, color: "text-blue-500" },
      { label: "VIP Members", value: fmtN(kpis.vipMembers), icon: Crown, color: "text-purple-500" },
      { label: "Coupons Generated", value: fmtN(kpis.couponsGenerated), icon: Tag, color: "text-orange-500" },
      { label: "Coupons Used", value: fmtN(kpis.couponsUsed), icon: CheckCircle2, color: "text-emerald-500" },
      { label: "Referral Rewards", value: fmtN(kpis.referralRewards), icon: UserPlus, color: "text-teal-500" },
      { label: "Avg Points/Customer", value: fmtN(kpis.avgPoints), icon: BarChart3, color: "text-indigo-500" },
      { label: "Conversion Rate", value: `${kpis.conversionRate}%`, icon: Zap, color: "text-pink-500" },
      { label: "Pending Rewards", value: fmtN(kpis.pendingRewards), icon: Clock, color: "text-amber-500" },
      { label: "Expired Rewards", value: fmtN(kpis.expiredRewards), icon: XCircle, color: "text-gray-500" },
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
          <h1 className={cn("text-[28px] font-extrabold tracking-[-.02em]", txt)}>Rewards</h1>
          <p className={cn("text-[14px] mt-1", sub)}>Manage customer loyalty, points, VIP levels and reward programs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setCouponDrawer(true)} className="h-9 px-3 rounded-[10px] bg-[#2563eb] text-white text-[13px] font-bold flex items-center gap-1.5 hover:bg-[#1d4ed8] transition-colors cursor-pointer">
            <Tag className="w-4 h-4" /> Create Coupon
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
            <div className="flex items-center justify-between mb-2">
              <k.icon className={cn("w-5 h-5", k.color)} />
            </div>
            <p className={cn("text-[22px] font-extrabold tracking-[-.02em]", txt)}>{k.value}</p>
            <p className={cn("text-[11px] font-bold uppercase tracking-wider mt-1", sub)}>{k.label}</p>
          </div>
        )) : Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={card}><Skeleton className="h-4 w-8 mb-3" /><Skeleton className="h-7 w-16 mb-2" /><Skeleton className="h-3 w-20" /></div>
        ))}
      </div>

      {/* VIP LEVELS OVERVIEW */}
      <div className={cn("rounded-[14px] border p-4", bg, border)}>
        <h3 className={cn("text-[15px] font-extrabold mb-3", txt)}>VIP Tiers</h3>
        <div className="flex flex-wrap gap-2">
          {VIP_THRESHOLDS.map(v => {
            const vc = VIP_COLORS[v.name];
            const Icon = vc?.icon || Medal;
            return (
              <button key={v.name} onClick={() => setVipFilter(vipFilter === v.name ? "" : v.name)}
                className={cn("h-8 px-3 rounded-full text-[12px] font-bold flex items-center gap-1.5 border transition-colors cursor-pointer",
                  vipFilter === v.name ? cn(vc?.bg, vc?.text, "border-current") : cn(border, sub, "hover:bg-[#f7f8fa]", dark && "hover:bg-white/5")
                )}>
                <Icon className="w-3.5 h-3.5" /> {v.name} <span className={cn("text-[11px]", sub)}>({v.min}+ pts)</span>
              </button>
            );
          })}
          {vipFilter && (
            <button onClick={() => setVipFilter("")} className={cn("h-8 px-2 rounded-full text-[12px] font-bold flex items-center gap-1 cursor-pointer", sub)}>
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* SEARCH + BULK */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className={cn("flex-1 flex items-center gap-2 h-10 px-3 rounded-[10px] border", border, bg)}>
          <Search className={cn("w-4 h-4 shrink-0", sub)} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email, reward ID..."
            className={cn("flex-1 bg-transparent text-[13px] outline-none", txt)} />
          {search && <button onClick={() => setSearch("")} className="cursor-pointer"><X className={cn("w-4 h-4", sub)} /></button>}
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className={cn("text-[12px] font-bold", sub)}>{selected.size} selected</span>
            <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
              className={cn("h-9 px-2 rounded-[8px] text-[12px] border", border, bg, txt)}>
              <option value="">Bulk action...</option>
              <option value="add_points">Add Points</option>
              <option value="remove_points">Remove Points</option>
              <option value="export">Export</option>
            </select>
            {(bulkAction === "add_points" || bulkAction === "remove_points") && (
              <>
                <input type="number" value={bulkPoints} onChange={e => setBulkPoints(e.target.value)} placeholder="Points" className={cn("h-9 w-20 px-2 rounded-[8px] text-[12px] border", border, bg, txt)} />
                <input value={bulkReason} onChange={e => setBulkReason(e.target.value)} placeholder="Reason" className={cn("h-9 w-32 px-2 rounded-[8px] text-[12px] border", border, bg, txt)} />
              </>
            )}
            <button onClick={handleBulkAction} className="h-9 px-3 rounded-[8px] bg-[#2563eb] text-white text-[12px] font-bold cursor-pointer hover:bg-[#1d4ed8]">Apply</button>
          </div>
        )}
      </div>

      {/* TABLE */}
      <div className={cn("rounded-[14px] border overflow-hidden", border)}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className={cn(dark ? "bg-[#1a2030]" : "bg-[#f9fafb]")}>
                <th className="px-4 py-3 text-left w-10">
                  <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} className="cursor-pointer rounded" />
                </th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px]", sub)}>Customer</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px]", sub)}>Points</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px] hidden md:table-cell", sub)}>VIP Level</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px] hidden lg:table-cell", sub)}>Role</th>
                <th className={cn("px-4 py-3 text-left font-bold uppercase tracking-wider text-[11px] hidden lg:table-cell", sub)}>Joined</th>
                <th className={cn("px-4 py-3 text-right font-bold uppercase tracking-wider text-[11px]", sub)}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className={cn("border-t", border)}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-5 w-16" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-5 w-12" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-5 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-8 ml-auto" /></td>
                </tr>
              )) : rows.length === 0 ? (
                <tr><td colSpan={7} className={cn("px-4 py-12 text-center text-[14px]", sub)}>No members found.</td></tr>
              ) : rows.map(r => {
                const vc = VIP_COLORS[r.vip_level] || VIP_COLORS.Bronze;
                const VipIcon = vc.icon;
                return (
                  <tr key={r.id} className={cn("border-t cursor-pointer transition-colors", border, dark ? "hover:bg-white/[.03]" : "hover:bg-[#f9fafb]")}
                    onClick={() => setDetailId(r.id)}>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} className="cursor-pointer rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center text-white text-[12px] font-bold shrink-0">
                          {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" /> : ((r.full_name || "?")[0] || "?").toUpperCase()}
                        </div>
                        <div>
                          <p className={cn("font-bold text-[13px]", txt)}>{r.full_name || "—"}</p>
                          <p className={cn("text-[11px]", sub)}>{r.email || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[14px] font-extrabold", txt)}>{fmtN(r.points)}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold", vc.bg, vc.text)}>
                        <VipIcon className="w-3 h-3" /> {r.vip_level}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 hidden lg:table-cell text-[12px] capitalize", sub)}>{r.role || "user"}</td>
                    <td className={cn("px-4 py-3 hidden lg:table-cell text-[12px]", sub)}>{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDetailId(r.id)} className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center transition-colors cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                          <Eye className={cn("w-3.5 h-3.5", sub)} />
                        </button>
                        <button onClick={() => setPointsDrawer({ id: r.id, name: r.full_name || r.email, action: "add" })}
                          className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center transition-colors cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                          <Plus className="w-3.5 h-3.5 text-green-500" />
                        </button>
                        <button onClick={() => setPointsDrawer({ id: r.id, name: r.full_name || r.email, action: "remove" })}
                          className={cn("h-7 w-7 rounded-[6px] flex items-center justify-center transition-colors cursor-pointer", dark ? "hover:bg-white/10" : "hover:bg-[#f0f1f3]")}>
                          <Minus className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className={cn("flex items-center justify-between px-4 py-3 border-t", border)}>
            <p className={cn("text-[12px]", sub)}>Showing {(page-1)*limit+1}–{Math.min(page*limit, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className={cn("h-8 w-8 rounded-[8px] flex items-center justify-center border cursor-pointer transition-colors disabled:opacity-40", border, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")}>
                <ChevronLeft className={cn("w-4 h-4", sub)} />
              </button>
              <span className={cn("text-[12px] font-bold px-2", txt)}>{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className={cn("h-8 w-8 rounded-[8px] flex items-center justify-center border cursor-pointer transition-colors disabled:opacity-40", border, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")}>
                <ChevronRight className={cn("w-4 h-4", sub)} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER */}
      <Drawer open={!!detailId} onClose={() => { setDetailId(null); setDetail(null); }} dark={dark} width="2xl" title="Customer Reward Profile">
        {detailLoading || !detail ? (
          <div className="space-y-4 p-2">
            <Skeleton className="h-16 w-full" /><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Profile header */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#2563eb] flex items-center justify-center text-white font-bold text-xl shrink-0">
                {detail.avatar_url ? <img src={detail.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" /> : ((detail.full_name || "?")[0] || "?").toUpperCase()}
              </div>
              <div className="flex-1">
                <p className={cn("text-[18px] font-extrabold", txt)}>{detail.full_name || "—"}</p>
                <p className={cn("text-[13px]", sub)}>{detail.email || "—"}</p>
                <div className="flex items-center gap-2 mt-1">
                  {(() => {
                    const vc = VIP_COLORS[detail.vip_level] || VIP_COLORS.Bronze;
                    const Icon = vc.icon;
                    return <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold", vc.bg, vc.text)}><Icon className="w-3 h-3" /> {detail.vip_level}</span>;
                  })()}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setPointsDrawer({ id: detail.id, name: detail.full_name || detail.email, action: "add" })}
                  className="h-8 px-3 rounded-[8px] bg-green-600 text-white text-[12px] font-bold flex items-center gap-1 cursor-pointer hover:bg-green-700">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
                <button onClick={() => setPointsDrawer({ id: detail.id, name: detail.full_name || detail.email, action: "remove" })}
                  className="h-8 px-3 rounded-[8px] bg-red-600 text-white text-[12px] font-bold flex items-center gap-1 cursor-pointer hover:bg-red-700">
                  <Minus className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className={cn("flex gap-1 border-b pb-0", border)}>
              {["overview", "points", "coupons", "orders", "referrals", "history"].map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={cn("px-3 py-2 text-[12px] font-bold capitalize rounded-t-[8px] transition-colors cursor-pointer",
                    detailTab === t ? cn("border-b-2 border-[#2563eb] text-[#2563eb]") : cn(sub, dark ? "hover:bg-white/5" : "hover:bg-[#f7f8fa]")
                  )}>{t}</button>
              ))}
            </div>

            {/* Tab content */}
            {detailTab === "overview" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Available Points", value: fmtN(detail.points || 0), icon: Coins, color: "text-yellow-500" },
                  { label: "Lifetime Earned", value: fmtN(detail.lifetime_points || 0), icon: TrendingUp, color: "text-green-500" },
                  { label: "Redeemed", value: fmtN(detail.redeemed_points || 0), icon: TrendingDown, color: "text-red-500" },
                  { label: "Total Spent", value: fmtCurrency(detail.total_spent || 0), icon: ShoppingBag, color: "text-blue-500" },
                  { label: "Orders", value: String(detail.orders?.length || 0), icon: Package, color: "text-purple-500" },
                  { label: "Reviews", value: String(detail.reviews?.length || 0), icon: MessageSquare, color: "text-teal-500" },
                  { label: "Coupons", value: String(detail.coupons?.length || 0), icon: Tag, color: "text-orange-500" },
                  { label: "Referrals", value: String(detail.referrals?.length || 0), icon: UserPlus, color: "text-pink-500" },
                  { label: "Member Since", value: fmtDate(detail.created_at), icon: Clock, color: "text-gray-500" },
                ].map((s, i) => (
                  <div key={i} className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <s.icon className={cn("w-4 h-4 mb-1", s.color)} />
                    <p className={cn("text-[16px] font-extrabold", txt)}>{s.value}</p>
                    <p className={cn("text-[10px] font-bold uppercase", sub)}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "points" && (
              <div className="space-y-3">
                <h4 className={cn("text-[14px] font-extrabold", txt)}>Points History</h4>
                {(detail.logs || []).length === 0 ? (
                  <p className={cn("text-[13px] py-6 text-center", sub)}>No points activity yet.</p>
                ) : (detail.logs || []).map((l: any, i: number) => (
                  <div key={i} className={cn("flex items-center gap-3 p-3 rounded-[10px]", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      l.type === "earn" ? "bg-green-500/15" : "bg-red-500/15")}>
                      {l.type === "earn" ? <ArrowUpRight className="w-4 h-4 text-green-500" /> : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[13px] font-bold", txt)}>{l.reason || l.type}</p>
                      <p className={cn("text-[11px]", sub)}>{fmtDateTime(l.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-[14px] font-extrabold", l.type === "earn" ? "text-green-500" : "text-red-500")}>
                        {l.type === "earn" ? "+" : ""}{l.points}
                      </p>
                      <p className={cn("text-[11px]", sub)}>Bal: {l.balance_after ?? "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "coupons" && (
              <div className="space-y-3">
                <h4 className={cn("text-[14px] font-extrabold", txt)}>Customer Coupons</h4>
                {(detail.coupons || []).length === 0 ? (
                  <p className={cn("text-[13px] py-6 text-center", sub)}>No coupons.</p>
                ) : (detail.coupons || []).map((c: any, i: number) => (
                  <div key={i} className={cn("flex items-center gap-3 p-3 rounded-[10px]", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <Tag className={cn("w-5 h-5 shrink-0", c.is_active ? "text-green-500" : "text-gray-400")} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[13px] font-bold font-mono", txt)}>{c.code}</p>
                      <p className={cn("text-[11px]", sub)}>{c.type === "percentage" ? `${c.value}% off` : fmtCurrency(c.value)} — Used {c.used_count || 0}x</p>
                    </div>
                    <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", c.is_active ? "bg-green-500/15 text-green-600" : "bg-gray-500/15 text-gray-500")}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "orders" && (
              <div className="space-y-3">
                <h4 className={cn("text-[14px] font-extrabold", txt)}>Order History</h4>
                {(detail.orders || []).length === 0 ? (
                  <p className={cn("text-[13px] py-6 text-center", sub)}>No orders.</p>
                ) : (detail.orders || []).map((o: any, i: number) => (
                  <div key={i} className={cn("flex items-center gap-3 p-3 rounded-[10px]", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <Package className={cn("w-5 h-5 shrink-0", sub)} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[13px] font-bold", txt)}>#{o.order_number}</p>
                      <p className={cn("text-[11px]", sub)}>{fmtDate(o.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-[14px] font-bold", txt)}>{fmtCurrency(o.total || 0)}</p>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize",
                        o.status === "delivered" ? "bg-green-500/15 text-green-600" :
                        o.status === "cancelled" ? "bg-red-500/15 text-red-600" : "bg-blue-500/15 text-blue-600"
                      )}>{o.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "referrals" && (
              <div className="space-y-3">
                <h4 className={cn("text-[14px] font-extrabold", txt)}>Referrals</h4>
                {(detail.referrals || []).length === 0 ? (
                  <p className={cn("text-[13px] py-6 text-center", sub)}>No referrals yet.</p>
                ) : (detail.referrals || []).map((ref: any, i: number) => (
                  <div key={i} className={cn("flex items-center gap-3 p-3 rounded-[10px]", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    <UserPlus className="w-5 h-5 text-teal-500 shrink-0" />
                    <div className="flex-1">
                      <p className={cn("text-[13px] font-bold", txt)}>{ref.referred_email || ref.referred_id || "—"}</p>
                      <p className={cn("text-[11px]", sub)}>{fmtDateTime(ref.created_at)}</p>
                    </div>
                    <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full",
                      ref.status === "completed" ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"
                    )}>{ref.status || "pending"}</span>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "history" && (
              <div className="space-y-3">
                <h4 className={cn("text-[14px] font-extrabold", txt)}>Activity Timeline</h4>
                <div className="relative pl-6">
                  <div className={cn("absolute left-[11px] top-0 bottom-0 w-px", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                  {[
                    ...(detail.logs || []).map((l: any) => ({ date: l.created_at, type: "points", label: `${l.type === "earn" ? "Earned" : "Redeemed"} ${Math.abs(l.points)} pts`, detail: l.reason })),
                    ...(detail.orders || []).map((o: any) => ({ date: o.created_at, type: "order", label: `Order #${o.order_number}`, detail: `${fmtCurrency(o.total)} — ${o.status}` })),
                    ...(detail.reviews || []).map((r: any) => ({ date: r.created_at, type: "review", label: `Review: ${r.title || "Untitled"}`, detail: `${r.rating}/5 stars` })),
                  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30).map((item, i) => (
                    <div key={i} className="relative flex items-start gap-3 pb-4">
                      <div className={cn("absolute left-[-13px] w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center",
                        dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
                        {item.type === "points" ? <Coins className="w-3 h-3 text-yellow-500" /> :
                         item.type === "order" ? <Package className="w-3 h-3 text-blue-500" /> :
                         <Star className="w-3 h-3 text-purple-500" />}
                      </div>
                      <div>
                        <p className={cn("text-[13px] font-bold", txt)}>{item.label}</p>
                        <p className={cn("text-[11px]", sub)}>{item.detail}</p>
                        <p className={cn("text-[10px] mt-0.5", sub)}>{fmtDateTime(item.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* ADD/REMOVE POINTS DRAWER */}
      <Drawer open={!!pointsDrawer} onClose={() => { setPointsDrawer(null); setPointsAmount(""); setPointsReason(""); }} dark={dark} title={pointsDrawer ? `${pointsDrawer.action === "add" ? "Add" : "Remove"} Points — ${pointsDrawer.name}` : ""}>
        <div className="space-y-4">
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Points</label>
            <input type="number" value={pointsAmount} onChange={e => setPointsAmount(e.target.value)} min="1"
              className={cn("mt-1 w-full h-10 px-3 rounded-[10px] border text-[14px]", border, bg, txt)} placeholder="Enter amount" />
          </div>
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Reason (required)</label>
            <textarea value={pointsReason} onChange={e => setPointsReason(e.target.value)} rows={3}
              className={cn("mt-1 w-full px-3 py-2 rounded-[10px] border text-[13px] resize-none", border, bg, txt)} placeholder="Why are you adjusting points?" />
          </div>
          <button onClick={handleAddRemovePoints} disabled={pointsSubmitting || !pointsAmount || !pointsReason}
            className={cn("w-full h-10 rounded-[10px] text-[14px] font-bold text-white cursor-pointer transition-colors disabled:opacity-40",
              pointsDrawer?.action === "add" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}>
            {pointsSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `${pointsDrawer?.action === "add" ? "Add" : "Remove"} Points`}
          </button>
        </div>
      </Drawer>

      {/* COUPON DRAWER */}
      <Drawer open={couponDrawer} onClose={() => setCouponDrawer(false)} dark={dark} title="Create Coupon">
        <div className="space-y-4">
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Code</label>
            <input value={couponForm.code} onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
              className={cn("mt-1 w-full h-10 px-3 rounded-[10px] border text-[14px] font-mono", border, bg, txt)} placeholder="SUMMER2024" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cn("text-[12px] font-bold uppercase", sub)}>Type</label>
              <select value={couponForm.type} onChange={e => setCouponForm({ ...couponForm, type: e.target.value })}
                className={cn("mt-1 w-full h-10 px-3 rounded-[10px] border text-[13px]", border, bg, txt)}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
                <option value="free_shipping">Free Shipping</option>
              </select>
            </div>
            <div>
              <label className={cn("text-[12px] font-bold uppercase", sub)}>Value</label>
              <input type="number" value={couponForm.value} onChange={e => setCouponForm({ ...couponForm, value: e.target.value })}
                className={cn("mt-1 w-full h-10 px-3 rounded-[10px] border text-[14px]", border, bg, txt)} placeholder="10" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cn("text-[12px] font-bold uppercase", sub)}>Min Order</label>
              <input type="number" value={couponForm.min_order} onChange={e => setCouponForm({ ...couponForm, min_order: e.target.value })}
                className={cn("mt-1 w-full h-10 px-3 rounded-[10px] border text-[14px]", border, bg, txt)} placeholder="0" />
            </div>
            <div>
              <label className={cn("text-[12px] font-bold uppercase", sub)}>Max Uses</label>
              <input type="number" value={couponForm.max_uses} onChange={e => setCouponForm({ ...couponForm, max_uses: e.target.value })}
                className={cn("mt-1 w-full h-10 px-3 rounded-[10px] border text-[14px]", border, bg, txt)} placeholder="1" />
            </div>
          </div>
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Expires At</label>
            <input type="date" value={couponForm.expires_at} onChange={e => setCouponForm({ ...couponForm, expires_at: e.target.value })}
              className={cn("mt-1 w-full h-10 px-3 rounded-[10px] border text-[13px]", border, bg, txt)} />
          </div>
          <div>
            <label className={cn("text-[12px] font-bold uppercase", sub)}>Assign to Customer (optional)</label>
            <input value={couponForm.user_id} onChange={e => setCouponForm({ ...couponForm, user_id: e.target.value })}
              className={cn("mt-1 w-full h-10 px-3 rounded-[10px] border text-[13px]", border, bg, txt)} placeholder="User ID (optional)" />
          </div>
          <button onClick={handleCreateCoupon} disabled={couponSubmitting || !couponForm.code || !couponForm.value}
            className="w-full h-10 rounded-[10px] bg-[#2563eb] text-white text-[14px] font-bold cursor-pointer hover:bg-[#1d4ed8] disabled:opacity-40 transition-colors">
            {couponSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create Coupon"}
          </button>
        </div>
      </Drawer>
    </div>
  );
}
