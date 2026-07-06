"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, ShoppingCart, Users, Package,
  RefreshCw, FileText, FileSpreadsheet, FileDown, Printer, Share2,
  Calendar, Clock, ArrowUpRight, ArrowDownRight, ChevronRight,
  Target, CreditCard, Wallet, BarChart3, PieChart as PieChartIcon,
  UserPlus, UserCheck, Crown, Repeat, AlertTriangle, Zap, Tag,
  PackageX, Star, Flame, Globe, Smartphone, Monitor, Tablet,
  ShieldCheck, XCircle, CheckCircle2, Eye, Layers, Search,
  ChevronDown, ChevronLeft, Filter, ArrowUp, ArrowDown, Mail,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

type Period = "today" | "yesterday" | "7d" | "30d" | "90d" | "12m" | "year" | "all";
type Tab = "overview" | "revenue" | "sales" | "customers" | "products" | "categories" | "inventory" | "payments" | "flashdeals" | "coupons" | "activity" | "insights";

const periodLabels: Record<Period, string> = {
  today: "Today", yesterday: "Yesterday", "7d": "7 Days", "30d": "30 Days",
  "90d": "90 Days", "12m": "12 Months", year: "This Year", all: "All Time",
};

const tabLabels: Record<Tab, { label: string; icon: typeof DollarSign }> = {
  overview: { label: "Overview", icon: BarChart3 },
  revenue: { label: "Revenue", icon: DollarSign },
  sales: { label: "Sales", icon: ShoppingCart },
  customers: { label: "Customers", icon: Users },
  products: { label: "Products", icon: Package },
  categories: { label: "Categories", icon: Layers },
  inventory: { label: "Inventory", icon: PackageX },
  payments: { label: "Payments", icon: CreditCard },
  flashdeals: { label: "Flash Deals", icon: Zap },
  coupons: { label: "Coupons", icon: Tag },
  activity: { label: "Activity", icon: Clock },
  insights: { label: "AI Insights", icon: Star },
};

const chartColors = ["#2563eb", "#7c3aed", "#16a34a", "#ea7317", "#ef4444", "#0ea5e9", "#14b8a6", "#f59e0b"];

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700/50", className)} />;
}

function Card({ children, className, dark }: { children: React.ReactNode; className?: string; dark: boolean }) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 transition-all duration-200",
      dark ? "bg-[#171c24] border-[#252c36] hover:border-[#3a4250]" : "bg-white border-[#eef0f3] hover:border-[#d1d5db] hover:shadow-sm",
      className
    )}>
      {children}
    </div>
  );
}

function Change({ value, dark }: { value: number; dark: boolean }) {
  if (!value) return <span className={cn("text-xs font-medium", dark ? "text-gray-500" : "text-gray-400")}>—</span>;
  const up = value > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", up ? "text-emerald-500" : "text-red-500")}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function MiniSparkline({ data, color = "#2563eb" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const h = 28, w = 72;
  const max = Math.max(...data, 1), min = Math.min(...data, 0), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  return <svg width={w} height={h} className="opacity-50"><polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} /></svg>;
}

const fmt = (n: number, p = "$") => {
  if (n >= 1e6) return `${p}${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${p}${(n / 1e3).toFixed(1)}K`;
  return `${p}${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
};

interface ReportsData {
  kpis: Record<string, number>;
  revenueChart: Array<Record<string, number | string>>;
  salesReport: {
    totalOrders: number; avgCart: number; productsSold: number;
    cancelledOrders: number; refundedOrders: number; failedOrders: number;
    successRate: number;
    chartData: Array<{ date: string; orders: number; cancelled: number; refunded: number }>;
  };
  customerReport: {
    newCustomers: number; loyalCustomers: number; vipCustomers: number;
    inactiveCustomers: number; avgValue: number; lifetimeValue: number;
    purchaseFrequency: number; retentionRate: number;
    growthData: Array<{ date: string; newCustomers: number; returning: number }>;
  };
  productReport: Array<{
    id: string; name: string; image: string; sku: string; category: string;
    stock: number; sales: number; revenue: number; profit: number;
  }>;
  categoryReport: Array<{
    name: string; revenue: number; profit: number; orders: number;
    products: number; avgCart: number;
  }>;
  inventoryReport: {
    totalValue: number; lowStockCount: number; outOfStockCount: number;
    avgRotation: number;
    items: Array<{ id: string; name: string; image: string; stock: number; sku: string }>;
  };
  paymentReport: Array<{
    method: string; count: number; amount: number; successRate: number;
    failures: number; refunds: number;
  }>;
  flashDealReport: Array<{
    id: string; productName: string; revenue: number; orders: number;
    dealPrice: number; originalPrice: number; endsAt: string; isActive: boolean;
  }>;
  couponReport: Array<{
    code: string; type: string; value: number; uses: number;
    revenueGenerated: number; isActive: boolean;
  }>;
  activityReport: Array<{ id: string; type: string; message: string; createdAt: string }>;
  insights: string[];
  alerts: Array<{ type: string; message: string; severity: "warning" | "error" | "info" }>;
}

const emptyData: ReportsData = {
  kpis: {}, revenueChart: [],
  salesReport: { totalOrders: 0, avgCart: 0, productsSold: 0, cancelledOrders: 0, refundedOrders: 0, failedOrders: 0, successRate: 0, chartData: [] },
  customerReport: { newCustomers: 0, loyalCustomers: 0, vipCustomers: 0, inactiveCustomers: 0, avgValue: 0, lifetimeValue: 0, purchaseFrequency: 0, retentionRate: 0, growthData: [] },
  productReport: [], categoryReport: [],
  inventoryReport: { totalValue: 0, lowStockCount: 0, outOfStockCount: 0, avgRotation: 0, items: [] },
  paymentReport: [], flashDealReport: [], couponReport: [], activityReport: [],
  insights: [], alerts: [],
};

export function AdminReports({ dark }: { dark: boolean }) {
  const [period, setPeriod] = useState<Period>("30d");
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<ReportsData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [revMetrics, setRevMetrics] = useState<string[]>(["revenue", "profit"]);
  const [prodSearch, setProdSearch] = useState("");
  const [prodSort, setProdSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "revenue", dir: "desc" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?period=${period}`);
      if (res.ok) setData(await res.json());
    } catch { /* keep current */ }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const k = data.kpis;

  const kpiCards = [
    { label: "Total Revenue", value: fmt(k.totalRevenue ?? 0), change: k.totalRevenueChange ?? 0, icon: DollarSign, color: "#2563eb" },
    { label: "Net Profit", value: fmt(k.netProfit ?? 0), change: k.netProfitChange ?? 0, icon: TrendingUp, color: "#16a34a" },
    { label: "Gross Profit", value: fmt(k.grossProfit ?? 0), change: k.grossProfitChange ?? 0, icon: Wallet, color: "#7c3aed" },
    { label: "Orders", value: (k.orders ?? 0).toLocaleString(), change: k.ordersChange ?? 0, icon: ShoppingCart, color: "#ea7317" },
    { label: "Avg Order", value: fmt(k.averageOrderValue ?? 0), change: k.averageOrderValueChange ?? 0, icon: BarChart3, color: "#f59e0b" },
    { label: "Conversion", value: `${(k.conversionRate ?? 0).toFixed(1)}%`, change: k.conversionRateChange ?? 0, icon: Target, color: "#8b5cf6" },
    { label: "New Customers", value: (k.newCustomers ?? 0).toLocaleString(), change: k.newCustomersChange ?? 0, icon: UserPlus, color: "#0ea5e9" },
    { label: "Returning", value: (k.returningCustomers ?? 0).toLocaleString(), change: k.returningCustomersChange ?? 0, icon: Repeat, color: "#14b8a6" },
    { label: "Refunds", value: fmt(k.refunds ?? 0), change: k.refundsChange ?? 0, icon: XCircle, color: "#ef4444" },
    { label: "Cancelled", value: (k.cancelledOrders ?? 0).toLocaleString(), change: k.cancelledOrdersChange ?? 0, icon: PackageX, color: "#f43f5e" },
    { label: "Taxes", value: fmt(k.taxesCollected ?? 0), change: k.taxesCollectedChange ?? 0, icon: FileText, color: "#64748b" },
    { label: "Shipping Rev", value: fmt(k.shippingRevenue ?? 0), change: k.shippingRevenueChange ?? 0, icon: Globe, color: "#78716c" },
    { label: "Coupons Used", value: (k.couponsUsed ?? 0).toLocaleString(), change: k.couponsUsedChange ?? 0, icon: Tag, color: "#d946ef" },
  ];

  const toggleRevMetric = (m: string) => setRevMetrics((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);

  const filteredProducts = useMemo(() => {
    let list = [...data.productReport];
    if (prodSearch) list = list.filter((p) => p.name.toLowerCase().includes(prodSearch.toLowerCase()) || (p.sku?.toLowerCase() ?? "").includes(prodSearch.toLowerCase()));
    list.sort((a, b) => {
      const av = (a as any)[prodSort.key] ?? 0, bv = (b as any)[prodSort.key] ?? 0;
      return prodSort.dir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return list;
  }, [data.productReport, prodSearch, prodSort]);

  const sortProducts = (key: string) => setProdSort((prev) => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));

  const SortIcon = ({ col }: { col: string }) => {
    if (prodSort.key !== col) return null;
    return prodSort.dir === "asc" ? <ArrowUp className="w-3 h-3 inline ml-0.5" /> : <ArrowDown className="w-3 h-3 inline ml-0.5" />;
  };

  const revMetricDefs = [
    { key: "revenue", label: "Revenue", color: "#2563eb" },
    { key: "profit", label: "Profit", color: "#16a34a" },
    { key: "netRevenue", label: "Net Revenue", color: "#7c3aed" },
    { key: "refunds", label: "Refunds", color: "#ef4444" },
    { key: "taxes", label: "Taxes", color: "#64748b" },
    { key: "shipping", label: "Shipping", color: "#ea7317" },
  ];

  return (
    <div className={cn("space-y-6", dark && "dark")}>
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={cn("text-2xl font-extrabold tracking-tight", dark ? "text-white" : "text-[#16181d]")}>Business Reports</h1>
          <p className={cn("text-sm mt-0.5", dark ? "text-gray-400" : "text-gray-500")}>Analyse complète des performances de votre entreprise.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <button onClick={() => setPeriodOpen(!periodOpen)} className={cn(
              "h-9 px-3 rounded-xl text-sm font-semibold border flex items-center gap-2 transition-colors",
              dark ? "bg-[#1e2430] border-[#2d3544] text-gray-300 hover:border-[#4a5568]" : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
            )}>
              <Calendar className="w-3.5 h-3.5" /> {periodLabels[period]} <ChevronDown className="w-3 h-3" />
            </button>
            {periodOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPeriodOpen(false)} />
                <div className={cn("absolute right-0 top-full mt-1 z-50 rounded-xl border py-1 min-w-[160px] shadow-lg", dark ? "bg-[#1e2430] border-[#2d3544]" : "bg-white border-gray-200")}>
                  {(Object.keys(periodLabels) as Period[]).map((p) => (
                    <button key={p} onClick={() => { setPeriod(p); setPeriodOpen(false); }}
                      className={cn("w-full text-left px-3 py-2 text-sm font-medium transition-colors",
                        p === period ? (dark ? "bg-blue-600/20 text-blue-400" : "bg-blue-50 text-blue-600") : (dark ? "text-gray-300 hover:bg-[#252c36]" : "text-gray-700 hover:bg-gray-50")
                      )}>
                      {periodLabels[p]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {[RefreshCw, FileText, FileSpreadsheet, FileDown, Printer].map((Icon, i) => (
            <button key={i} onClick={i === 0 ? fetchData : undefined}
              className={cn("h-9 w-9 rounded-xl border flex items-center justify-center transition-colors",
                dark ? "bg-[#1e2430] border-[#2d3544] text-gray-400 hover:text-white" : "bg-white border-gray-200 text-gray-500 hover:text-gray-800"
              )}>
              <Icon className={cn("w-3.5 h-3.5", i === 0 && loading && "animate-spin")} />
            </button>
          ))}
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-1 min-w-max">
          {(Object.entries(tabLabels) as [Tab, typeof tabLabels.overview][]).map(([id, { label, icon: Icon }]) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap",
                tab === id ? (dark ? "bg-blue-600/20 text-blue-400" : "bg-blue-50 text-blue-600") : (dark ? "text-gray-400 hover:bg-[#1e2430]" : "text-gray-500 hover:bg-gray-50")
              )}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ ALERTS ═══ */}
      {!loading && data.alerts.length > 0 && (tab === "overview" || tab === "insights") && (
        <div className="space-y-2">
          {data.alerts.slice(0, 5).map((a, i) => (
            <div key={i} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium",
              a.severity === "error" ? (dark ? "bg-red-900/15 text-red-400" : "bg-red-50 text-red-700")
              : a.severity === "warning" ? (dark ? "bg-amber-900/15 text-amber-400" : "bg-amber-50 text-amber-700")
              : (dark ? "bg-blue-900/15 text-blue-400" : "bg-blue-50 text-blue-700")
            )}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* ═══ KPI CARDS (Overview + Revenue tabs) ═══ */}
      {(tab === "overview" || tab === "revenue") && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {loading
            ? Array.from({ length: 13 }).map((_, i) => <Skeleton key={i} className="h-[110px]" />)
            : kpiCards.map((c) => (
              <Card key={c.label} dark={dark} className="relative overflow-hidden">
                <div className="flex items-start justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${c.color}12` }}>
                    <c.icon className="w-3.5 h-3.5" style={{ color: c.color }} />
                  </div>
                  <Change value={c.change} dark={dark} />
                </div>
                <p className={cn("text-lg font-extrabold tracking-tight", dark ? "text-white" : "text-[#16181d]")}>{c.value}</p>
                <p className={cn("text-[10px] font-medium mt-0.5", dark ? "text-gray-500" : "text-gray-400")}>{c.label}</p>
              </Card>
            ))
          }
        </div>
      )}

      {/* ═══ REVENUE ANALYTICS ═══ */}
      {(tab === "overview" || tab === "revenue") && (
        <Card dark={dark}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className={cn("text-base font-extrabold", dark ? "text-white" : "text-[#16181d]")}>Revenue Analytics</h2>
            <div className="flex items-center gap-1 flex-wrap">
              {revMetricDefs.map((m) => (
                <button key={m.key} onClick={() => toggleRevMetric(m.key)}
                  className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors",
                    revMetrics.includes(m.key) ? "text-white" : (dark ? "text-gray-400 hover:bg-[#252c36]" : "text-gray-500 hover:bg-gray-100")
                  )}
                  style={revMetrics.includes(m.key) ? { backgroundColor: m.color } : undefined}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[320px] sm:h-[380px]">
            {loading ? <Skeleton className="h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.revenueChart} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <defs>
                    {revMetricDefs.map((m) => (
                      <linearGradient key={m.key} id={`g_${m.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={m.color} stopOpacity={0.12} />
                        <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#252c36" : "#f0f0f0"} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip contentStyle={{ backgroundColor: dark ? "#1e2430" : "#fff", border: `1px solid ${dark ? "#2d3544" : "#e5e7eb"}`, borderRadius: 12, fontSize: 11, fontWeight: 600 }} />
                  {revMetricDefs.filter((m) => revMetrics.includes(m.key)).map((m) => (
                    <Area key={m.key} type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} fill={`url(#g_${m.key})`} dot={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      )}

      {/* ═══ SALES REPORT ═══ */}
      {(tab === "overview" || tab === "sales") && (
        <Card dark={dark}>
          <h2 className={cn("text-base font-extrabold mb-4", dark ? "text-white" : "text-[#16181d]")}>Sales Report</h2>
          {loading ? <Skeleton className="h-48" /> : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
                {[
                  { l: "Total Orders", v: data.salesReport.totalOrders },
                  { l: "Avg Cart", v: `$${data.salesReport.avgCart.toFixed(2)}` },
                  { l: "Products Sold", v: data.salesReport.productsSold },
                  { l: "Cancelled", v: data.salesReport.cancelledOrders },
                  { l: "Refunded", v: data.salesReport.refundedOrders },
                  { l: "Failed", v: data.salesReport.failedOrders },
                  { l: "Success Rate", v: `${data.salesReport.successRate.toFixed(1)}%` },
                ].map((s) => (
                  <div key={s.l} className={cn("text-center p-3 rounded-xl", dark ? "bg-[#1e2430]" : "bg-gray-50")}>
                    <p className={cn("text-lg font-extrabold", dark ? "text-white" : "text-[#16181d]")}>{typeof s.v === "number" ? s.v.toLocaleString() : s.v}</p>
                    <p className={cn("text-[10px] font-medium mt-0.5", dark ? "text-gray-500" : "text-gray-400")}>{s.l}</p>
                  </div>
                ))}
              </div>
              {data.salesReport.chartData.length > 0 && (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.salesReport.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#252c36" : "#f0f0f0"} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: dark ? "#1e2430" : "#fff", border: `1px solid ${dark ? "#2d3544" : "#e5e7eb"}`, borderRadius: 12, fontSize: 11 }} />
                      <Bar dataKey="orders" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cancelled" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="refunded" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* ═══ CUSTOMER REPORT ═══ */}
      {(tab === "overview" || tab === "customers") && (
        <Card dark={dark}>
          <h2 className={cn("text-base font-extrabold mb-4", dark ? "text-white" : "text-[#16181d]")}>Customer Report</h2>
          {loading ? <Skeleton className="h-48" /> : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { l: "New Customers", v: data.customerReport.newCustomers, icon: UserPlus, color: "text-blue-500" },
                  { l: "Loyal", v: data.customerReport.loyalCustomers, icon: UserCheck, color: "text-emerald-500" },
                  { l: "VIP", v: data.customerReport.vipCustomers, icon: Crown, color: "text-amber-500" },
                  { l: "Inactive", v: data.customerReport.inactiveCustomers, icon: Users, color: "text-gray-400" },
                ].map((s) => (
                  <div key={s.l} className={cn("p-3 rounded-xl text-center", dark ? "bg-[#1e2430]" : "bg-gray-50")}>
                    <s.icon className={cn("w-5 h-5 mx-auto mb-1", s.color)} />
                    <p className={cn("text-xl font-extrabold", dark ? "text-white" : "text-[#16181d]")}>{s.v.toLocaleString()}</p>
                    <p className={cn("text-[10px] font-medium", dark ? "text-gray-500" : "text-gray-400")}>{s.l}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { l: "Avg Value", v: `$${data.customerReport.avgValue.toFixed(2)}` },
                  { l: "Lifetime Value", v: `$${data.customerReport.lifetimeValue.toFixed(0)}` },
                  { l: "Purchase Freq", v: `${data.customerReport.purchaseFrequency.toFixed(1)}x` },
                  { l: "Retention", v: `${data.customerReport.retentionRate.toFixed(1)}%` },
                ].map((s) => (
                  <div key={s.l} className={cn("p-3 rounded-xl text-center", dark ? "bg-[#1e2430]" : "bg-gray-50")}>
                    <p className={cn("text-lg font-extrabold", dark ? "text-white" : "text-[#16181d]")}>{s.v}</p>
                    <p className={cn("text-[10px] font-medium", dark ? "text-gray-500" : "text-gray-400")}>{s.l}</p>
                  </div>
                ))}
              </div>
              {data.customerReport.growthData.length > 0 && (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.customerReport.growthData}>
                      <defs>
                        <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.12} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0} /></linearGradient>
                        <linearGradient id="gRet" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.12} /><stop offset="95%" stopColor="#16a34a" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#252c36" : "#f0f0f0"} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: dark ? "#1e2430" : "#fff", border: `1px solid ${dark ? "#2d3544" : "#e5e7eb"}`, borderRadius: 12, fontSize: 11 }} />
                      <Area type="monotone" dataKey="newCustomers" stroke="#2563eb" strokeWidth={2} fill="url(#gNew)" dot={false} />
                      <Area type="monotone" dataKey="returning" stroke="#16a34a" strokeWidth={2} fill="url(#gRet)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* ═══ PRODUCT REPORT ═══ */}
      {(tab === "products") && (
        <Card dark={dark}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className={cn("text-base font-extrabold", dark ? "text-white" : "text-[#16181d]")}>Product Performance</h2>
            <div className={cn("flex items-center gap-2 h-8 px-3 rounded-xl border", dark ? "bg-[#1e2430] border-[#2d3544]" : "bg-gray-50 border-gray-200")}>
              <Search className={cn("w-3.5 h-3.5", dark ? "text-gray-500" : "text-gray-400")} />
              <input value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} placeholder="Search products..."
                className={cn("bg-transparent text-xs font-medium outline-none w-[150px]", dark ? "text-gray-200 placeholder:text-gray-500" : "text-gray-700 placeholder:text-gray-400")} />
            </div>
          </div>
          {loading ? <Skeleton className="h-64" /> : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className={cn("border-b", dark ? "border-[#252c36]" : "border-gray-100")}>
                    {[
                      { k: "name", l: "Product" }, { k: "category", l: "Category" }, { k: "stock", l: "Stock" },
                      { k: "sales", l: "Sales" }, { k: "revenue", l: "Revenue" }, { k: "profit", l: "Profit" },
                    ].map((c) => (
                      <th key={c.k} onClick={() => sortProducts(c.k)}
                        className={cn("pb-2 text-left text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none", dark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600")}>
                        {c.l} <SortIcon col={c.k} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.slice(0, 20).map((p) => (
                    <tr key={p.id} className={cn("border-b last:border-0", dark ? "border-[#252c36]/50" : "border-gray-50")}>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-8 h-8 rounded-lg overflow-hidden flex-shrink-0", dark ? "bg-[#252c36]" : "bg-gray-100")}>
                            {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="min-w-0">
                            <p className={cn("text-xs font-semibold truncate max-w-[180px]", dark ? "text-gray-200" : "text-gray-800")}>{p.name}</p>
                            {p.sku && <p className={cn("text-[10px]", dark ? "text-gray-500" : "text-gray-400")}>{p.sku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className={cn("py-2.5 text-xs font-medium", dark ? "text-gray-400" : "text-gray-500")}>{p.category || "—"}</td>
                      <td className="py-2.5">
                        <span className={cn("text-xs font-bold", p.stock === 0 ? "text-red-500" : p.stock < 5 ? "text-amber-500" : (dark ? "text-gray-200" : "text-gray-800"))}>{p.stock}</span>
                      </td>
                      <td className={cn("py-2.5 text-xs font-bold", dark ? "text-gray-200" : "text-gray-800")}>{p.sales}</td>
                      <td className={cn("py-2.5 text-xs font-bold", dark ? "text-gray-200" : "text-gray-800")}>${p.revenue.toFixed(0)}</td>
                      <td className={cn("py-2.5 text-xs font-bold text-emerald-500")}>${p.profit.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProducts.length === 0 && <p className={cn("text-sm text-center py-8", dark ? "text-gray-500" : "text-gray-400")}>No products found</p>}
            </div>
          )}
        </Card>
      )}

      {/* ═══ CATEGORY REPORT ═══ */}
      {(tab === "categories") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card dark={dark}>
            <h2 className={cn("text-base font-extrabold mb-4", dark ? "text-white" : "text-[#16181d]")}>Category Performance</h2>
            {loading ? <Skeleton className="h-48" /> : data.categoryReport.length === 0 ? (
              <p className={cn("text-sm text-center py-8", dark ? "text-gray-500" : "text-gray-400")}>No categories yet</p>
            ) : (
              <div className="space-y-2">
                {data.categoryReport.map((c, i) => {
                  const maxRev = Math.max(...data.categoryReport.map((x) => x.revenue), 1);
                  return (
                    <div key={c.name} className={cn("p-3 rounded-xl", dark ? "bg-[#1e2430]" : "bg-gray-50")}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={cn("text-xs font-semibold", dark ? "text-gray-200" : "text-gray-800")}>{c.name}</span>
                        <span className={cn("text-xs font-bold", dark ? "text-white" : "text-[#16181d]")}>${c.revenue.toFixed(0)}</span>
                      </div>
                      <div className={cn("h-1.5 rounded-full overflow-hidden", dark ? "bg-[#252c36]" : "bg-gray-200")}>
                        <div className="h-full rounded-full" style={{ width: `${(c.revenue / maxRev) * 100}%`, backgroundColor: chartColors[i % chartColors.length] }} />
                      </div>
                      <div className="flex gap-4 mt-1.5">
                        <span className={cn("text-[10px]", dark ? "text-gray-500" : "text-gray-400")}>{c.orders} orders</span>
                        <span className={cn("text-[10px]", dark ? "text-gray-500" : "text-gray-400")}>{c.products} products</span>
                        <span className={cn("text-[10px]", dark ? "text-gray-500" : "text-gray-400")}>Avg ${c.avgCart.toFixed(0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card dark={dark}>
            <h2 className={cn("text-base font-extrabold mb-4", dark ? "text-white" : "text-[#16181d]")}>Revenue by Category</h2>
            {loading ? <Skeleton className="h-[240px]" /> : data.categoryReport.length === 0 ? (
              <p className={cn("text-sm text-center py-8", dark ? "text-gray-500" : "text-gray-400")}>No data</p>
            ) : (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.categoryReport} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} strokeWidth={2} stroke={dark ? "#171c24" : "#fff"}>
                      {data.categoryReport.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: dark ? "#1e2430" : "#fff", border: `1px solid ${dark ? "#2d3544" : "#e5e7eb"}`, borderRadius: 12, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══ INVENTORY REPORT ═══ */}
      {tab === "inventory" && (
        <Card dark={dark}>
          <h2 className={cn("text-base font-extrabold mb-4", dark ? "text-white" : "text-[#16181d]")}>Inventory Report</h2>
          {loading ? <Skeleton className="h-48" /> : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { l: "Total Value", v: fmt(data.inventoryReport.totalValue), color: "text-blue-500" },
                  { l: "Low Stock", v: data.inventoryReport.lowStockCount, color: "text-amber-500" },
                  { l: "Out of Stock", v: data.inventoryReport.outOfStockCount, color: "text-red-500" },
                  { l: "Avg Rotation", v: `${data.inventoryReport.avgRotation.toFixed(1)}x`, color: "text-emerald-500" },
                ].map((s) => (
                  <div key={s.l} className={cn("text-center p-3 rounded-xl", dark ? "bg-[#1e2430]" : "bg-gray-50")}>
                    <p className={cn("text-xl font-extrabold", s.color)}>{typeof s.v === "number" ? s.v.toLocaleString() : s.v}</p>
                    <p className={cn("text-[10px] font-medium mt-0.5", dark ? "text-gray-500" : "text-gray-400")}>{s.l}</p>
                  </div>
                ))}
              </div>
              {data.inventoryReport.items.length > 0 && (
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full min-w-[400px]">
                    <thead>
                      <tr className={cn("border-b", dark ? "border-[#252c36]" : "border-gray-100")}>
                        {["Product", "SKU", "Stock"].map((h) => (
                          <th key={h} className={cn("pb-2 text-left text-[10px] font-bold uppercase tracking-wider", dark ? "text-gray-500" : "text-gray-400")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.inventoryReport.items.map((p) => (
                        <tr key={p.id} className={cn("border-b last:border-0", dark ? "border-[#252c36]/50" : "border-gray-50")}>
                          <td className="py-2 flex items-center gap-2">
                            <div className={cn("w-7 h-7 rounded-md overflow-hidden flex-shrink-0", dark ? "bg-[#252c36]" : "bg-gray-100")}>
                              {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <span className={cn("text-xs font-semibold", dark ? "text-gray-200" : "text-gray-800")}>{p.name}</span>
                          </td>
                          <td className={cn("py-2 text-xs", dark ? "text-gray-400" : "text-gray-500")}>{p.sku || "—"}</td>
                          <td className="py-2">
                            <span className={cn("text-xs font-bold", p.stock === 0 ? "text-red-500" : p.stock < 5 ? "text-amber-500" : "text-emerald-500")}>{p.stock}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* ═══ PAYMENT REPORT ═══ */}
      {(tab === "overview" || tab === "payments") && (
        <Card dark={dark}>
          <h2 className={cn("text-base font-extrabold mb-4", dark ? "text-white" : "text-[#16181d]")}>Payment Report</h2>
          {loading ? <Skeleton className="h-48" /> : data.paymentReport.length === 0 ? (
            <p className={cn("text-sm text-center py-8", dark ? "text-gray-500" : "text-gray-400")}>No payment data</p>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="w-full lg:w-[200px] h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.paymentReport} dataKey="amount" nameKey="method" cx="50%" cy="50%" innerRadius={50} outerRadius={80} strokeWidth={2} stroke={dark ? "#171c24" : "#fff"}>
                      {data.paymentReport.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: dark ? "#1e2430" : "#fff", border: `1px solid ${dark ? "#2d3544" : "#e5e7eb"}`, borderRadius: 12, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className={cn("border-b", dark ? "border-[#252c36]" : "border-gray-100")}>
                      {["Method", "Count", "Amount", "Success", "Failures", "Refunds"].map((h) => (
                        <th key={h} className={cn("pb-2 text-left text-[10px] font-bold uppercase tracking-wider", dark ? "text-gray-500" : "text-gray-400")}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.paymentReport.map((p, i) => (
                      <tr key={p.method} className={cn("border-b last:border-0", dark ? "border-[#252c36]/50" : "border-gray-50")}>
                        <td className="py-2 flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartColors[i % chartColors.length] }} />
                          <span className={cn("text-xs font-semibold capitalize", dark ? "text-gray-200" : "text-gray-800")}>{p.method}</span>
                        </td>
                        <td className={cn("py-2 text-xs font-medium", dark ? "text-gray-300" : "text-gray-600")}>{p.count}</td>
                        <td className={cn("py-2 text-xs font-bold", dark ? "text-gray-200" : "text-gray-800")}>${p.amount.toFixed(0)}</td>
                        <td className="py-2 text-xs font-bold text-emerald-500">{p.successRate.toFixed(0)}%</td>
                        <td className="py-2 text-xs font-medium text-red-500">{p.failures}</td>
                        <td className="py-2 text-xs font-medium text-amber-500">{p.refunds}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ═══ FLASH DEAL + COUPON REPORTS ═══ */}
      {(tab === "flashdeals" || tab === "coupons") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tab === "flashdeals" && (
            <Card dark={dark} className="lg:col-span-2">
              <h2 className={cn("text-base font-extrabold mb-4", dark ? "text-white" : "text-[#16181d]")}>Flash Deal Performance</h2>
              {loading ? <Skeleton className="h-48" /> : data.flashDealReport.length === 0 ? (
                <p className={cn("text-sm text-center py-8", dark ? "text-gray-500" : "text-gray-400")}>No flash deals data</p>
              ) : (
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className={cn("border-b", dark ? "border-[#252c36]" : "border-gray-100")}>
                        {["Product", "Deal Price", "Original", "Orders", "Revenue", "Status"].map((h) => (
                          <th key={h} className={cn("pb-2 text-left text-[10px] font-bold uppercase tracking-wider", dark ? "text-gray-500" : "text-gray-400")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.flashDealReport.map((d) => (
                        <tr key={d.id} className={cn("border-b last:border-0", dark ? "border-[#252c36]/50" : "border-gray-50")}>
                          <td className={cn("py-2.5 text-xs font-semibold", dark ? "text-gray-200" : "text-gray-800")}>{d.productName}</td>
                          <td className="py-2.5 text-xs font-bold text-blue-500">${d.dealPrice}</td>
                          <td className={cn("py-2.5 text-xs line-through", dark ? "text-gray-500" : "text-gray-400")}>${d.originalPrice}</td>
                          <td className={cn("py-2.5 text-xs font-bold", dark ? "text-gray-200" : "text-gray-800")}>{d.orders}</td>
                          <td className="py-2.5 text-xs font-bold text-emerald-500">${d.revenue.toFixed(0)}</td>
                          <td className="py-2.5">
                            <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold",
                              d.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                            )}>{d.isActive ? "Active" : "Ended"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
          {tab === "coupons" && (
            <Card dark={dark} className="lg:col-span-2">
              <h2 className={cn("text-base font-extrabold mb-4", dark ? "text-white" : "text-[#16181d]")}>Coupon Performance</h2>
              {loading ? <Skeleton className="h-48" /> : data.couponReport.length === 0 ? (
                <p className={cn("text-sm text-center py-8", dark ? "text-gray-500" : "text-gray-400")}>No coupons data</p>
              ) : (
                <div className="overflow-x-auto -mx-5 px-5">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className={cn("border-b", dark ? "border-[#252c36]" : "border-gray-100")}>
                        {["Code", "Type", "Value", "Uses", "Revenue", "Status"].map((h) => (
                          <th key={h} className={cn("pb-2 text-left text-[10px] font-bold uppercase tracking-wider", dark ? "text-gray-500" : "text-gray-400")}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.couponReport.map((c) => (
                        <tr key={c.code} className={cn("border-b last:border-0", dark ? "border-[#252c36]/50" : "border-gray-50")}>
                          <td className={cn("py-2.5 text-xs font-bold", dark ? "text-blue-400" : "text-blue-600")}>{c.code}</td>
                          <td className={cn("py-2.5 text-xs capitalize", dark ? "text-gray-300" : "text-gray-600")}>{c.type}</td>
                          <td className={cn("py-2.5 text-xs font-semibold", dark ? "text-gray-200" : "text-gray-800")}>{c.type === "percentage" ? `${c.value}%` : `$${c.value}`}</td>
                          <td className={cn("py-2.5 text-xs font-bold", dark ? "text-gray-200" : "text-gray-800")}>{c.uses}</td>
                          <td className="py-2.5 text-xs font-bold text-emerald-500">${c.revenueGenerated.toFixed(0)}</td>
                          <td className="py-2.5">
                            <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold",
                              c.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                            )}>{c.isActive ? "Active" : "Expired"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ═══ ACTIVITY REPORT ═══ */}
      {tab === "activity" && (
        <Card dark={dark}>
          <h2 className={cn("text-base font-extrabold mb-4", dark ? "text-white" : "text-[#16181d]")}>Admin Activity Log</h2>
          {loading ? <Skeleton className="h-64" /> : data.activityReport.length === 0 ? (
            <p className={cn("text-sm text-center py-8", dark ? "text-gray-500" : "text-gray-400")}>No activity recorded</p>
          ) : (
            <div className="space-y-2">
              {data.activityReport.map((a) => {
                const typeColors: Record<string, string> = {
                  order: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
                  customer: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
                  payment: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
                  product: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
                  login: "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400",
                };
                const typeIcons: Record<string, React.ReactNode> = {
                  order: <ShoppingCart className="w-3.5 h-3.5" />,
                  customer: <UserPlus className="w-3.5 h-3.5" />,
                  payment: <CreditCard className="w-3.5 h-3.5" />,
                  product: <Package className="w-3.5 h-3.5" />,
                  login: <ShieldCheck className="w-3.5 h-3.5" />,
                };
                return (
                  <div key={a.id} className={cn("flex items-start gap-3 p-3 rounded-xl", dark ? "hover:bg-[#1e2430]" : "hover:bg-gray-50")}>
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", typeColors[a.type] ?? (dark ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"))}>
                      {typeIcons[a.type] ?? <Clock className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-medium", dark ? "text-gray-300" : "text-gray-700")}>{a.message}</p>
                      <p className={cn("text-[10px] mt-0.5", dark ? "text-gray-600" : "text-gray-400")}>
                        {new Date(a.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ═══ AI INSIGHTS ═══ */}
      {(tab === "overview" || tab === "insights") && (
        <Card dark={dark}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <Star className="w-4 h-4 text-white" />
            </div>
            <h2 className={cn("text-base font-extrabold", dark ? "text-white" : "text-[#16181d]")}>AI Business Insights</h2>
          </div>
          {loading ? <Skeleton className="h-32" /> : data.insights.length === 0 ? (
            <p className={cn("text-sm text-center py-8", dark ? "text-gray-500" : "text-gray-400")}>Add products and get orders to generate insights</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.insights.map((insight, i) => (
                <div key={i} className={cn("flex items-start gap-2.5 p-3 rounded-xl", dark ? "bg-[#1e2430]" : "bg-gradient-to-r from-blue-50/50 to-violet-50/50")}>
                  <Flame className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className={cn("text-xs font-medium leading-relaxed", dark ? "text-gray-300" : "text-gray-600")}>{insight}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
