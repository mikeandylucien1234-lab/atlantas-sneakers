"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  Search, Plus, ChevronLeft, ChevronRight, Edit3, Trash2, Eye,
  Download, RefreshCw, X, Loader2, SlidersHorizontal, ArrowUpDown,
  XCircle, TrendingUp, DollarSign, CheckCircle2, Users, UserPlus,
  Star, Award, ShoppingCart, Heart, MessageSquare, Shield, Clock,
  Mail, Phone, MapPin, Calendar, BarChart3, Gift, Crown, FileDown,
  User, Globe, Activity
} from "lucide-react";

type Props = { dark: boolean };
type SortKey = "full_name" | "email" | "created_at" | "total_spent" | "orders_count";
type SortOrder = "asc" | "desc";
type DetailTab = "overview" | "orders" | "reviews" | "rewards" | "analytics";

interface CustomerKpis {
  totalCustomers: number;
  newToday: number;
  activeCustomers: number;
  totalRevenue: number;
  avgLifetimeValue: number;
  avgOrderValue: number;
  totalRewardsPoints: number;
  totalOrders: number;
  returningCustomers: number;
  topCustomer: { name: string; amount: number } | null;
}

interface CustomerRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  points: number;
  created_at: string;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: string | null;
}

const defaultKpis: CustomerKpis = {
  totalCustomers: 0, newToday: 0, activeCustomers: 0, totalRevenue: 0,
  avgLifetimeValue: 0, avgOrderValue: 0, totalRewardsPoints: 0,
  totalOrders: 0, returningCustomers: 0, topCustomer: null,
};

const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
const fmtCurrency = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AdminCustomers({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");
  const badge = (color: string) => cn("px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase", color);

  const [kpis, setKpis] = useState<CustomerKpis>(defaultKpis);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [detailCustomer, setDetailCustomer] = useState<CustomerRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [detailData, setDetailData] = useState<Record<string, any> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPoints, setFormPoints] = useState(0);
  const [formSaving, setFormSaving] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const res = await fetch("/api/admin/customers?section=kpis");
      if (!res.ok) throw new Error("Failed");
      setKpis(await res.json());
    } catch { /* silent */ } finally { setKpisLoading(false); }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), per_page: String(perPage), sort: sortKey, order: sortOrder });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/customers?${params}`);
      if (!res.ok) throw new Error("Failed to load customers");
      const data = await res.json();
      setCustomers(data.customers || []);
      setTotal(data.total || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }, [page, perPage, search, statusFilter, sortKey, sortOrder]);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);
  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

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

  const allSelected = customers.length > 0 && customers.every(c => selected.has(c.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(customers.map(c => c.id)));
  };

  // Detail
  const openDetail = async (customer: CustomerRow) => {
    setDetailCustomer(customer);
    setDetailTab("overview");
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetch(`/api/admin/customers?section=detail&id=${customer.id}`);
      if (res.ok) setDetailData(await res.json());
    } catch { /* silent */ } finally { setDetailLoading(false); }
  };

  // Create/Edit
  const openCreate = () => {
    setEditCustomer(null);
    setFormName(""); setFormEmail(""); setFormPoints(0);
    setFormOpen(true);
  };

  const openEdit = (c: CustomerRow) => {
    setEditCustomer(c);
    setFormName(c.full_name || "");
    setFormEmail(c.email);
    setFormPoints(c.points);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formEmail) { showToast("Email is required", "error"); return; }
    setFormSaving(true);
    try {
      const body: Record<string, unknown> = { email: formEmail, full_name: formName || null, points: formPoints };
      if (editCustomer) {
        body.id = editCustomer.id;
        const res = await fetch("/api/admin/customers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
        showToast("Customer updated");
      } else {
        const res = await fetch("/api/admin/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
        showToast("Customer created");
      }
      setFormOpen(false);
      fetchCustomers();
      fetchKpis();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    } finally { setFormSaving(false); }
  };

  // Delete
  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} customer(s)? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/admin/customers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`${ids.length} customer(s) deleted`);
      setSelected(new Set());
      fetchCustomers();
      fetchKpis();
      if (detailCustomer && ids.includes(detailCustomer.id)) setDetailCustomer(null);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  // Bulk
  const handleBulk = async (action: string) => {
    if (selected.size === 0) return;
    try {
      const res = await fetch("/api/admin/customers", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`Bulk ${action.replace(/_/g, " ")} completed`);
      setSelected(new Set());
      fetchCustomers();
      fetchKpis();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    }
  };

  // Export
  const handleExport = async (format: "csv" | "json") => {
    try {
      const res = await fetch("/api/admin/customers?section=export");
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const items = data.customers || [];
      if (format === "json") {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "customers.json"; a.click();
        URL.revokeObjectURL(url);
      } else {
        if (items.length === 0) return;
        const headers = Object.keys(items[0]);
        const csv = [headers.join(","), ...items.map((r: Record<string, unknown>) => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "customers.csv"; a.click();
        URL.revokeObjectURL(url);
      }
      showToast(`Exported as ${format.toUpperCase()}`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Export error", "error");
    }
  };

  const Skeleton = ({ w = "100%", h = 14 }: { w?: string | number; h?: number }) => (
    <div className={cn("rounded-[6px] animate-pulse", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} style={{ width: w, height: h }} />
  );

  const customerLevel = (spent: number) => {
    if (spent >= 1000) return <span className={badge("bg-amber-500/10 text-amber-500")}><Crown className="w-2.5 h-2.5 inline mr-0.5" /> VIP</span>;
    if (spent >= 500) return <span className={badge("bg-purple-500/10 text-purple-500")}>Gold</span>;
    if (spent >= 100) return <span className={badge("bg-blue-500/10 text-blue-500")}>Silver</span>;
    return <span className={badge("bg-gray-500/10 text-gray-500")}>Bronze</span>;
  };

  const kpiCards = useMemo(() => [
    { label: "Total Customers", value: fmt(kpis.totalCustomers), icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "New Today", value: fmt(kpis.newToday), icon: UserPlus, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Active Customers", value: fmt(kpis.activeCustomers), icon: Activity, color: "text-cyan-500", bg: "bg-cyan-500/10" },
    { label: "Returning", value: fmt(kpis.returningCustomers), icon: TrendingUp, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Total Revenue", value: fmtCurrency(kpis.totalRevenue), icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Avg Lifetime Value", value: fmtCurrency(kpis.avgLifetimeValue), icon: BarChart3, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Avg Order Value", value: fmtCurrency(kpis.avgOrderValue), icon: ShoppingCart, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Total Orders", value: fmt(kpis.totalOrders), icon: ShoppingCart, color: "text-teal-500", bg: "bg-teal-500/10" },
    { label: "Total Points", value: fmt(kpis.totalRewardsPoints), icon: Award, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Top Customer", value: kpis.topCustomer?.name || "—", icon: Crown, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  ], [kpis]);

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={cn("text-[22px] font-extrabold tracking-[-.02em]", txt)}>Customers</h1>
          <p className={cn("text-sm mt-0.5", sub)}>Manage all customer accounts and relationships.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openCreate} className="h-9 px-4 rounded-[10px] text-[13px] font-semibold bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Create Customer
          </button>
          <button onClick={() => handleExport("csv")} className={cn("h-9 px-3.5 rounded-[10px] text-[13px] font-semibold border flex items-center gap-1.5 transition-colors", brd, sub, hover)}>
            <FileDown className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={() => { fetchCustomers(); fetchKpis(); }} className={cn("h-9 px-3.5 rounded-[10px] text-[13px] font-semibold border flex items-center gap-1.5 transition-colors", brd, sub, hover)}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map(k => (
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
            <input type="text" placeholder="Search by name, email..." className={cn(inpCls, "pl-9")} onChange={e => handleSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={cn("h-[42px] px-4 rounded-[11px] text-[13px] font-semibold border flex items-center gap-2 transition-colors", brd, sub, hover, showFilters && "border-[#2563eb] text-[#2563eb]")}>
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={inpCls}>
              <option value="all">All Customers</option>
              <option value="active">Active (has orders)</option>
              <option value="inactive">Inactive (no orders)</option>
            </select>
          </div>
        )}
      </div>

      {/* BULK ACTIONS */}
      {selected.size > 0 && (
        <div className={cn("rounded-[14px] border p-3 flex flex-wrap items-center gap-2", p, brd)}>
          <span className={cn("text-sm font-semibold", txt)}>{selected.size} selected</span>
          <div className="flex-1" />
          <button onClick={() => handleBulk("add_points")} className="h-8 px-3 rounded-[8px] text-[12px] font-semibold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" /> +100 Points
          </button>
          <button onClick={() => handleBulk("reset_points")} className="h-8 px-3 rounded-[8px] text-[12px] font-semibold bg-gray-500/10 text-gray-600 hover:bg-gray-500/20 transition-colors flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" /> Reset Points
          </button>
          <button onClick={() => handleDelete(Array.from(selected))} className="h-8 px-3 rounded-[8px] text-[12px] font-semibold bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Delete
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
            <button onClick={fetchCustomers} className="mt-3 text-sm text-[#2563eb] font-semibold hover:underline">Retry</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn("border-b", brd)}>
                  <th className="w-10 p-3"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" /></th>
                  <th className="p-3 text-left w-10" />
                  <th className={cn("p-3 text-left font-semibold cursor-pointer select-none", sub)} onClick={() => handleSort("full_name")}>
                    <span className="flex items-center gap-1">Name <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className={cn("p-3 text-left font-semibold cursor-pointer select-none", sub)} onClick={() => handleSort("email")}>
                    <span className="flex items-center gap-1">Email <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className={cn("p-3 text-right font-semibold cursor-pointer select-none", sub)} onClick={() => handleSort("orders_count")}>
                    <span className="flex items-center justify-end gap-1">Orders <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className={cn("p-3 text-right font-semibold cursor-pointer select-none", sub)} onClick={() => handleSort("total_spent")}>
                    <span className="flex items-center justify-end gap-1">Lifetime Value <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className={cn("p-3 text-right font-semibold", sub)}>Points</th>
                  <th className={cn("p-3 text-left font-semibold", sub)}>Level</th>
                  <th className={cn("p-3 text-left font-semibold cursor-pointer select-none", sub)} onClick={() => handleSort("created_at")}>
                    <span className="flex items-center gap-1">Joined <ArrowUpDown className="w-3 h-3" /></span>
                  </th>
                  <th className={cn("p-3 text-center font-semibold", sub)}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className={cn("border-b", brd)}>
                    <td className="p-3"><Skeleton w={16} h={16} /></td>
                    <td className="p-3"><Skeleton w={32} h={32} /></td>
                    <td className="p-3"><Skeleton w="70%" /></td>
                    <td className="p-3"><Skeleton w="60%" /></td>
                    <td className="p-3"><Skeleton w={30} /></td>
                    <td className="p-3"><Skeleton w={60} /></td>
                    <td className="p-3"><Skeleton w={40} /></td>
                    <td className="p-3"><Skeleton w={50} /></td>
                    <td className="p-3"><Skeleton w={60} /></td>
                    <td className="p-3"><Skeleton w={50} /></td>
                  </tr>
                )) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center">
                      <Users className={cn("w-10 h-10 mx-auto mb-2", sub)} />
                      <p className={cn("text-sm font-semibold", txt)}>No customers found</p>
                      <p className={cn("text-xs mt-1", sub)}>Adjust your search or filters</p>
                    </td>
                  </tr>
                ) : customers.map(c => (
                  <tr key={c.id} className={cn("border-b transition-colors", brd, hover, selected.has(c.id) && (dark ? "bg-blue-500/5" : "bg-blue-50/50"))}>
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => {
                        const s = new Set(selected);
                        s.has(c.id) ? s.delete(c.id) : s.add(c.id);
                        setSelected(s);
                      }} className="rounded" />
                    </td>
                    <td className="p-3">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold", dark ? "bg-[#252c36] text-[#8b95a3]" : "bg-[#f0f2f5] text-[#8a929c]")}>
                          {(c.full_name || c.email || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <button onClick={() => openDetail(c)} className={cn("text-sm font-semibold text-left hover:text-[#2563eb] transition-colors", txt)}>
                        {c.full_name || "—"}
                      </button>
                    </td>
                    <td className={cn("p-3 text-xs", sub)}>{c.email}</td>
                    <td className={cn("p-3 text-right font-semibold tabular-nums", txt)}>{c.orderCount}</td>
                    <td className={cn("p-3 text-right font-bold tabular-nums", c.totalSpent > 0 ? "text-green-500" : sub)}>{fmtCurrency(c.totalSpent)}</td>
                    <td className={cn("p-3 text-right tabular-nums", c.points > 0 ? "text-amber-500 font-semibold" : sub)}>{fmt(c.points)}</td>
                    <td className="p-3">{customerLevel(c.totalSpent)}</td>
                    <td className={cn("p-3 text-xs", sub)}>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openDetail(c)} className={cn("w-7 h-7 rounded-[7px] flex items-center justify-center transition-colors", hover)} title="View"><Eye className={cn("w-3.5 h-3.5", sub)} /></button>
                        <button onClick={() => openEdit(c)} className={cn("w-7 h-7 rounded-[7px] flex items-center justify-center transition-colors", hover)} title="Edit"><Edit3 className={cn("w-3.5 h-3.5", sub)} /></button>
                        <button onClick={() => handleDelete([c.id])} className={cn("w-7 h-7 rounded-[7px] flex items-center justify-center transition-colors", hover)} title="Delete"><Trash2 className={cn("w-3.5 h-3.5", sub)} /></button>
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
            <p className={cn("text-xs", sub)}>Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors disabled:opacity-30", hover)}>
                <ChevronLeft className={cn("w-4 h-4", sub)} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const pg = start + i;
                if (pg > totalPages) return null;
                return <button key={pg} onClick={() => setPage(pg)} className={cn("w-8 h-8 rounded-[8px] text-xs font-semibold transition-colors", pg === page ? "bg-[#2563eb] text-white" : cn(sub, hover))}>{pg}</button>;
              })}
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center transition-colors disabled:opacity-30", hover)}>
                <ChevronRight className={cn("w-4 h-4", sub)} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL PANEL */}
      <Drawer open={!!detailCustomer} onClose={() => setDetailCustomer(null)} title="Customer Profile" className={dark ? "!bg-[#171c24] !text-[#e7ebf0]" : ""}>
        {detailLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" /></div>
        ) : detailData ? (
          <div className="space-y-4">
            <div className={cn("flex gap-1 p-1 rounded-[10px]", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
              {(["overview", "orders", "reviews", "rewards", "analytics"] as DetailTab[]).map(tab => (
                <button key={tab} onClick={() => setDetailTab(tab)} className={cn("flex-1 h-8 rounded-[8px] text-xs font-semibold transition-colors capitalize", detailTab === tab ? "bg-[#2563eb] text-white" : cn(sub, hover))}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Overview */}
            {detailTab === "overview" && (() => {
              const d = detailData;
              const profile = d.profile || {};
              const stats = d.stats || {};
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold", dark ? "bg-[#252c36] text-[#8b95a3]" : "bg-[#f0f2f5] text-[#8a929c]")}>
                        {(profile.full_name || profile.email || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className={cn("text-base font-extrabold", txt)}>{profile.full_name || "No Name"}</p>
                      <p className={cn("text-xs", sub)}>{profile.email}</p>
                      <div className="mt-1">{customerLevel(stats.totalSpent || 0)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard dark={dark} label="Total Spent" value={fmtCurrency(stats.totalSpent || 0)} color="text-green-500" />
                    <StatCard dark={dark} label="Orders" value={String(stats.orderCount || 0)} color="text-blue-500" />
                    <StatCard dark={dark} label="Avg Order" value={fmtCurrency(stats.avgOrderValue || 0)} color="text-purple-500" />
                    <StatCard dark={dark} label="Points" value={fmt(profile.points || 0)} color="text-amber-500" />
                  </div>
                  <InfoRow dark={dark} label="Customer ID" value={profile.id?.slice(0, 12) + "..." || "—"} />
                  <InfoRow dark={dark} label="Role" value={profile.role || "—"} />
                  <InfoRow dark={dark} label="Joined" value={profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"} />
                  <InfoRow dark={dark} label="Last Order" value={stats.lastOrder ? new Date(stats.lastOrder).toLocaleDateString() : "Never"} />
                </div>
              );
            })()}

            {/* Orders */}
            {detailTab === "orders" && (() => {
              const orders: any[] = detailData.orders || [];
              return (
                <div className="space-y-2">
                  {orders.length === 0 ? (
                    <p className={cn("text-sm text-center py-6", sub)}>No orders</p>
                  ) : orders.map((o: any) => (
                    <div key={o.id} className={cn("rounded-[12px] border p-3", p, brd)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={cn("text-xs font-semibold", txt)}>#{o.id.slice(0, 8)}</p>
                          <p className={cn("text-[10px] mt-0.5", sub)}>{new Date(o.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-sm font-bold", "text-green-500")}>{fmtCurrency(o.total || 0)}</p>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                            o.status === "delivered" ? "bg-emerald-500/10 text-emerald-500" :
                            o.status === "shipped" ? "bg-blue-500/10 text-blue-500" :
                            o.status === "processing" ? "bg-amber-500/10 text-amber-500" :
                            o.status === "cancelled" ? "bg-red-500/10 text-red-500" :
                            "bg-gray-500/10 text-gray-500"
                          )}>{o.status}</span>
                        </div>
                      </div>
                      {o.items && o.items.length > 0 && (
                        <div className={cn("mt-2 pt-2 border-t space-y-1", brd)}>
                          {o.items.slice(0, 3).map((item: any) => (
                            <div key={item.id} className="flex justify-between">
                              <span className={cn("text-[11px]", sub)}>{item.product?.name || "Product"} x{item.quantity}</span>
                              <span className={cn("text-[11px] font-semibold", txt)}>{fmtCurrency(item.price * item.quantity)}</span>
                            </div>
                          ))}
                          {o.items.length > 3 && <p className={cn("text-[10px]", sub)}>+{o.items.length - 3} more items</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Reviews */}
            {detailTab === "reviews" && (() => {
              const reviews: any[] = detailData.reviews || [];
              return (
                <div className="space-y-2">
                  {reviews.length === 0 ? (
                    <p className={cn("text-sm text-center py-6", sub)}>No reviews</p>
                  ) : reviews.map((r: any) => (
                    <div key={r.id} className={cn("rounded-[12px] border p-3", p, brd)}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("w-3 h-3", i < r.rating ? "text-amber-400 fill-amber-400" : sub)} />
                          ))}
                        </div>
                        <span className={cn("text-[10px]", sub)}>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className={cn("text-xs", txt)}>{r.comment || "No comment"}</p>
                      {r.product_name && <p className={cn("text-[10px] mt-1", sub)}>on {r.product_name}</p>}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Rewards */}
            {detailTab === "rewards" && (() => {
              const profile = detailData.profile || {};
              const stats = detailData.stats || {};
              return (
                <div className="space-y-3">
                  <div className={cn("rounded-[14px] p-5 text-center", "bg-gradient-to-br from-amber-500/10 to-orange-500/10")}>
                    <Award className="w-10 h-10 mx-auto text-amber-500 mb-2" />
                    <p className={cn("text-3xl font-extrabold text-amber-500")}>{fmt(profile.points || 0)}</p>
                    <p className={cn("text-xs mt-1", sub)}>Reward Points</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard dark={dark} label="Level" value={stats.totalSpent >= 1000 ? "VIP" : stats.totalSpent >= 500 ? "Gold" : stats.totalSpent >= 100 ? "Silver" : "Bronze"} color="text-purple-500" />
                    <StatCard dark={dark} label="Total Spent" value={fmtCurrency(stats.totalSpent || 0)} color="text-green-500" />
                  </div>
                  <div className={cn("rounded-[11px] border p-3", brd)}>
                    <p className={cn("text-xs font-semibold mb-2", sub)}>Points Progress</p>
                    <div className={cn("h-3 rounded-full overflow-hidden", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")}>
                      <div className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all" style={{ width: `${Math.min(100, (profile.points || 0) / 10)}%` }} />
                    </div>
                    <p className={cn("text-[10px] mt-1", sub)}>{profile.points || 0} / 1000 points to next level</p>
                  </div>
                </div>
              );
            })()}

            {/* Analytics */}
            {detailTab === "analytics" && (() => {
              const stats = detailData.stats || {};
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard dark={dark} label="Lifetime Value" value={fmtCurrency(stats.totalSpent || 0)} color="text-green-500" />
                    <StatCard dark={dark} label="Avg Order" value={fmtCurrency(stats.avgOrderValue || 0)} color="text-blue-500" />
                    <StatCard dark={dark} label="Total Orders" value={String(stats.orderCount || 0)} color="text-indigo-500" />
                    <StatCard dark={dark} label="Total Reviews" value={String(stats.totalReviews || 0)} color="text-amber-500" />
                    <StatCard dark={dark} label="Avg Rating" value={(stats.avgRating || 0).toFixed(1)} color="text-yellow-500" />
                    <StatCard dark={dark} label="Member Since" value={stats.memberDays ? `${stats.memberDays}d` : "—"} color="text-purple-500" />
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <p className={cn("text-sm text-center py-6", sub)}>No data</p>
        )}
      </Drawer>

      {/* CREATE/EDIT DRAWER */}
      <Drawer open={formOpen} onClose={() => setFormOpen(false)} title={editCustomer ? "Edit Customer" : "Create Customer"} className={dark ? "!bg-[#171c24] !text-[#e7ebf0]" : ""}>
        <div className="space-y-4">
          <div>
            <label className={cn("text-xs font-semibold block mb-1.5", sub)}>Full Name</label>
            <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="John Doe" className={inpCls} />
          </div>
          <div>
            <label className={cn("text-xs font-semibold block mb-1.5", sub)}>Email *</label>
            <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="john@example.com" className={inpCls} disabled={!!editCustomer} />
            {editCustomer && <p className={cn("text-[10px] mt-1", sub)}>Email cannot be changed</p>}
          </div>
          <div>
            <label className={cn("text-xs font-semibold block mb-1.5", sub)}>Reward Points</label>
            <input type="number" min={0} value={formPoints} onChange={e => setFormPoints(Math.max(0, parseInt(e.target.value) || 0))} className={inpCls} />
          </div>
          <button onClick={handleSave} disabled={formSaving} className="w-full h-[42px] rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {formSaving ? "Saving..." : editCustomer ? "Update Customer" : "Create Customer"}
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
