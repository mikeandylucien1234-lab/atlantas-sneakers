"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  DollarSign, ShoppingCart, Users, Package, TrendingUp, TrendingDown,
  RefreshCw, FileText, FileSpreadsheet, Calendar, Clock, Activity,
  AlertTriangle, Zap, Target, Bell, Heart, ChevronRight, Eye,
  Plus, Tag, Image as ImageIcon, Upload, Download, ShieldCheck,
  ShieldAlert, CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight,
  Layers, CreditCard, Smartphone, Wallet, Globe, Mail,
  BarChart3, PieChart as PieChartIcon, Star, Flame, PackageX,
  UserPlus, UserCheck, UserX, Crown, Repeat, TrendingUp as Growth,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

type Period = "today" | "yesterday" | "7d" | "30d" | "90d" | "year" | "all";

interface DashboardData {
  kpis: Record<string, number>;
  revenueChart: Array<{ date: string; revenue: number; orders: number; profit: number }>;
  recentOrders: Array<{
    id: string; order_number: string; customer_name: string; customer_email: string;
    total: number; payment_method: string; status: string; created_at: string;
    items: Array<{ name: string; image: string; quantity: number; price: number }>;
  }>;
  topProducts: Array<{
    id: string; name: string; slug: string; image: string;
    sales: number; revenue: number; stock: number; conversion: number;
  }>;
  stockAlerts: {
    lowStock: Array<{ id: string; name: string; image: string; stock: number; sku: string }>;
    outOfStock: Array<{ id: string; name: string; image: string; sku: string }>;
    neverSold: Array<{ id: string; name: string; image: string }>;
  };
  flashDeals: Array<{
    id: string; product_name: string; deal_price: number; original_price: number;
    sales: number; revenue: number; ends_at: string; is_active: boolean;
  }>;
  customerAnalytics: {
    newCustomers: number; activeCustomers: number; inactiveCustomers: number;
    vipCustomers: number; retentionRate: number; lifetimeValue: number;
    growthData: Array<{ date: string; customers: number }>;
  };
  paymentBreakdown: Array<{ method: string; count: number; amount: number; percentage: number }>;
  recentActivity: Array<{ id: string; type: string; message: string; created_at: string }>;
  monthlyGoal: { target: number; current: number; percentage: number };
  systemHealth: Array<{ name: string; status: "ok" | "warning" | "error"; latency?: number }>;
}

const emptyData: DashboardData = {
  kpis: {}, revenueChart: [], recentOrders: [], topProducts: [],
  stockAlerts: { lowStock: [], outOfStock: [], neverSold: [] },
  flashDeals: [],
  customerAnalytics: { newCustomers: 0, activeCustomers: 0, inactiveCustomers: 0, vipCustomers: 0, retentionRate: 0, lifetimeValue: 0, growthData: [] },
  paymentBreakdown: [], recentActivity: [],
  monthlyGoal: { target: 100000, current: 0, percentage: 0 },
  systemHealth: [],
};

const periodLabels: Record<Period, string> = {
  today: "Today", yesterday: "Yesterday", "7d": "7 Days", "30d": "30 Days",
  "90d": "90 Days", year: "This Year", all: "All Time",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  processing: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  shipped: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400",
  delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  refunded: "bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400",
};

const paymentColors = ["#2563eb", "#7c3aed", "#16a34a", "#ea7317", "#ef4444", "#64748b"];

const fmt = (n: number, prefix = "$") => {
  if (n >= 1000000) return `${prefix}${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${prefix}${(n / 1000).toFixed(1)}K`;
  return `${prefix}${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
};

const fmtNum = (n: number) => fmt(n, "");

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

function ChangeIndicator({ value, dark }: { value: number; dark: boolean }) {
  if (value === 0) return <span className={cn("text-xs font-medium", dark ? "text-gray-500" : "text-gray-400")}>—</span>;
  const positive = value > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", positive ? "text-emerald-500" : "text-red-500")}>
      {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function MiniSparkline({ data, color = "#2563eb", height = 32 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 80;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={height} className="opacity-60">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export default function AdminDashboard({ dark, onNavigate }: { dark: boolean; onNavigate: (m: string) => void }) {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<("revenue" | "orders" | "profit")[]>(["revenue"]);
  const [periodOpen, setPeriodOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/dashboard?period=${period}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // keep current data on error
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpi = data.kpis;
  const sparkData = useMemo(() => data.revenueChart.map((d) => d.revenue), [data.revenueChart]);
  const orderSparkData = useMemo(() => data.revenueChart.map((d) => d.orders), [data.revenueChart]);

  const kpiCards = [
    { label: "Today's Revenue", value: fmt(kpi.todayRevenue ?? 0), change: kpi.todayRevenueChange ?? 0, icon: DollarSign, color: "#2563eb", spark: sparkData },
    { label: "Total Revenue", value: fmt(kpi.totalRevenue ?? 0), change: kpi.totalRevenueChange ?? 0, icon: TrendingUp, color: "#7c3aed", spark: sparkData },
    { label: "Orders Today", value: fmtNum(kpi.ordersToday ?? 0), change: kpi.ordersTodayChange ?? 0, icon: ShoppingCart, color: "#16a34a", spark: orderSparkData },
    { label: "Total Orders", value: fmtNum(kpi.totalOrders ?? 0), change: kpi.totalOrdersChange ?? 0, icon: Package, color: "#ea7317", spark: orderSparkData },
    { label: "Customers", value: fmtNum(kpi.customers ?? 0), change: kpi.customersChange ?? 0, icon: Users, color: "#0ea5e9", spark: [] },
    { label: "New Customers", value: fmtNum(kpi.newCustomers ?? 0), change: kpi.newCustomersChange ?? 0, icon: UserPlus, color: "#14b8a6", spark: [] },
    { label: "Conversion Rate", value: `${(kpi.conversionRate ?? 0).toFixed(1)}%`, change: kpi.conversionRateChange ?? 0, icon: Target, color: "#8b5cf6", spark: [] },
    { label: "Avg Order Value", value: fmt(kpi.averageOrderValue ?? 0), change: kpi.averageOrderValueChange ?? 0, icon: BarChart3, color: "#f59e0b", spark: [] },
    { label: "Profit", value: fmt(kpi.profit ?? 0), change: kpi.profitChange ?? 0, icon: Wallet, color: "#22c55e", spark: sparkData },
    { label: "Refunds", value: fmt(kpi.refunds ?? 0), change: kpi.refundsChange ?? 0, icon: Repeat, color: "#ef4444", spark: [] },
  ];

  const quickActions = [
    { label: "Add Product", icon: Plus, module: "products", color: "#2563eb" },
    { label: "New Category", icon: Layers, module: "categories", color: "#7c3aed" },
    { label: "Flash Deal", icon: Zap, module: "flashdeals", color: "#ea7317" },
    { label: "Create Coupon", icon: Tag, module: "coupons", color: "#16a34a" },
    { label: "View Orders", icon: ShoppingCart, module: "orders", color: "#0ea5e9" },
    { label: "View Clients", icon: Users, module: "customers", color: "#14b8a6" },
    { label: "Add Banner", icon: ImageIcon, module: "banners", color: "#8b5cf6" },
    { label: "Import", icon: Upload, module: "products", color: "#64748b" },
    { label: "Export", icon: Download, module: "products", color: "#78716c" },
  ];

  const activityIcons: Record<string, React.ReactNode> = {
    order: <ShoppingCart className="w-3.5 h-3.5" />,
    customer: <UserPlus className="w-3.5 h-3.5" />,
    payment: <CreditCard className="w-3.5 h-3.5" />,
    cancelled: <XCircle className="w-3.5 h-3.5" />,
    product: <Package className="w-3.5 h-3.5" />,
    flash_deal: <Zap className="w-3.5 h-3.5" />,
    coupon: <Tag className="w-3.5 h-3.5" />,
    login: <ShieldCheck className="w-3.5 h-3.5" />,
  };

  const activityColors: Record<string, string> = {
    order: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    customer: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    payment: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
    cancelled: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    product: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    flash_deal: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    coupon: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
    login: "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400",
  };

  const toggleChart = (mode: "revenue" | "orders" | "profit") => {
    setChartMode((prev) => prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]);
  };

  return (
    <div className={cn("space-y-6", dark && "dark")}>
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className={cn("text-xs font-medium mb-1", dark ? "text-gray-500" : "text-gray-400")}>
            Dashboard / Overview
          </p>
          <h1 className={cn("text-2xl font-extrabold tracking-tight", dark ? "text-white" : "text-[#16181d]")}>
            Business Overview
          </h1>
          <p className={cn("text-sm mt-0.5", dark ? "text-gray-400" : "text-gray-500")}>
            Welcome back, voici les performances en temps réel de votre boutique.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <button
              onClick={() => setPeriodOpen(!periodOpen)}
              className={cn(
                "h-9 px-3 rounded-xl text-sm font-semibold border flex items-center gap-2 transition-colors",
                dark ? "bg-[#1e2430] border-[#2d3544] text-gray-300 hover:border-[#4a5568]"
                     : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              {periodLabels[period]}
            </button>
            {periodOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPeriodOpen(false)} />
                <div className={cn(
                  "absolute right-0 top-full mt-1 z-50 rounded-xl border py-1 min-w-[160px] shadow-lg",
                  dark ? "bg-[#1e2430] border-[#2d3544]" : "bg-white border-gray-200"
                )}>
                  {(Object.keys(periodLabels) as Period[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => { setPeriod(p); setPeriodOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm font-medium transition-colors",
                        p === period
                          ? dark ? "bg-blue-600/20 text-blue-400" : "bg-blue-50 text-blue-600"
                          : dark ? "text-gray-300 hover:bg-[#252c36]" : "text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      {periodLabels[p]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={fetchData}
            className={cn(
              "h-9 w-9 rounded-xl border flex items-center justify-center transition-colors",
              dark ? "bg-[#1e2430] border-[#2d3544] text-gray-400 hover:text-white" : "bg-white border-gray-200 text-gray-500 hover:text-gray-800"
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
          <button className={cn(
            "h-9 w-9 rounded-xl border flex items-center justify-center transition-colors",
            dark ? "bg-[#1e2430] border-[#2d3544] text-gray-400 hover:text-white" : "bg-white border-gray-200 text-gray-500 hover:text-gray-800"
          )}>
            <FileText className="w-3.5 h-3.5" />
          </button>
          <button className={cn(
            "h-9 w-9 rounded-xl border flex items-center justify-center transition-colors",
            dark ? "bg-[#1e2430] border-[#2d3544] text-gray-400 hover:text-white" : "bg-white border-gray-200 text-gray-500 hover:text-gray-800"
          )}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ═══ KPI CARDS ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[120px]" />)
          : kpiCards.map((card) => (
            <Card key={card.label} dark={dark} className="relative overflow-hidden">
              <div className="flex items-start justify-between mb-2">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center")} style={{ backgroundColor: `${card.color}15` }}>
                  <card.icon className="w-4 h-4" style={{ color: card.color }} />
                </div>
                <ChangeIndicator value={card.change} dark={dark} />
              </div>
              <p className={cn("text-xl font-extrabold tracking-tight", dark ? "text-white" : "text-[#16181d]")}>{card.value}</p>
              <p className={cn("text-xs font-medium mt-0.5", dark ? "text-gray-500" : "text-gray-400")}>{card.label}</p>
              {card.spark.length > 0 && (
                <div className="absolute bottom-2 right-3">
                  <MiniSparkline data={card.spark} color={card.color} />
                </div>
              )}
            </Card>
          ))
        }
      </div>

      {/* ═══ SALES ANALYTICS ═══ */}
      <Card dark={dark}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className={cn("text-base font-extrabold", dark ? "text-white" : "text-[#16181d]")}>Sales Analytics</h2>
          <div className="flex items-center gap-1">
            {(["revenue", "orders", "profit"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => toggleChart(mode)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize",
                  chartMode.includes(mode)
                    ? mode === "revenue" ? "bg-blue-600 text-white"
                    : mode === "orders" ? "bg-emerald-600 text-white"
                    : "bg-violet-600 text-white"
                    : dark ? "text-gray-400 hover:bg-[#252c36]" : "text-gray-500 hover:bg-gray-100"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[300px] sm:h-[360px]">
          {loading ? <Skeleton className="h-full" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueChart} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOrd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#252c36" : "#f0f0f0"} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} width={50} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: dark ? "#1e2430" : "#fff",
                    border: `1px solid ${dark ? "#2d3544" : "#e5e7eb"}`,
                    borderRadius: 12, fontSize: 12, fontWeight: 600,
                  }}
                />
                {chartMode.includes("revenue") && (
                  <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fill="url(#gRev)" dot={false} />
                )}
                {chartMode.includes("orders") && (
                  <Area type="monotone" dataKey="orders" stroke="#16a34a" strokeWidth={2} fill="url(#gOrd)" dot={false} />
                )}
                {chartMode.includes("profit") && (
                  <Area type="monotone" dataKey="profit" stroke="#7c3aed" strokeWidth={2} fill="url(#gPro)" dot={false} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* ═══ RECENT ORDERS + TOP PRODUCTS ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <Card dark={dark}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={cn("text-base font-extrabold", dark ? "text-white" : "text-[#16181d]")}>Recent Orders</h2>
            <button onClick={() => onNavigate("orders")} className="text-xs font-semibold text-blue-500 hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : data.recentOrders.length === 0 ? (
            <p className={cn("text-sm text-center py-8", dark ? "text-gray-500" : "text-gray-400")}>No orders yet</p>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className={cn("border-b text-left", dark ? "border-[#252c36]" : "border-gray-100")}>
                    {["Order", "Customer", "Amount", "Status", ""].map((h) => (
                      <th key={h} className={cn("pb-2 text-[10px] font-bold uppercase tracking-wider", dark ? "text-gray-500" : "text-gray-400")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.slice(0, 8).map((order) => (
                    <tr key={order.id} className={cn("border-b last:border-0", dark ? "border-[#252c36]/50" : "border-gray-50")}>
                      <td className="py-2.5">
                        <span className={cn("text-xs font-bold", dark ? "text-blue-400" : "text-blue-600")}>{order.order_number}</span>
                      </td>
                      <td className="py-2.5">
                        <p className={cn("text-xs font-semibold", dark ? "text-gray-200" : "text-gray-800")}>{order.customer_name || "Guest"}</p>
                      </td>
                      <td className="py-2.5">
                        <span className={cn("text-xs font-bold", dark ? "text-gray-200" : "text-gray-800")}>${order.total.toFixed(2)}</span>
                      </td>
                      <td className="py-2.5">
                        <span className={cn("inline-block px-2 py-0.5 rounded-md text-[10px] font-bold capitalize", statusColors[order.status] ?? (dark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"))}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button className={cn("p-1 rounded-md transition-colors", dark ? "hover:bg-[#252c36]" : "hover:bg-gray-100")}>
                          <Eye className={cn("w-3.5 h-3.5", dark ? "text-gray-500" : "text-gray-400")} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Top Products */}
        <Card dark={dark}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={cn("text-base font-extrabold", dark ? "text-white" : "text-[#16181d]")}>Top Selling Products</h2>
            <button onClick={() => onNavigate("products")} className="text-xs font-semibold text-blue-500 hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : data.topProducts.length === 0 ? (
            <p className={cn("text-sm text-center py-8", dark ? "text-gray-500" : "text-gray-400")}>No products yet</p>
          ) : (
            <div className="space-y-2.5">
              {data.topProducts.slice(0, 8).map((p, i) => (
                <div key={p.id} className={cn("flex items-center gap-3 p-2 rounded-xl transition-colors", dark ? "hover:bg-[#1e2430]" : "hover:bg-gray-50")}>
                  <span className={cn("w-5 text-xs font-bold text-center", dark ? "text-gray-500" : "text-gray-400")}>#{i + 1}</span>
                  <div className={cn("w-9 h-9 rounded-lg overflow-hidden flex-shrink-0", dark ? "bg-[#252c36]" : "bg-gray-100")}>
                    {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-semibold truncate", dark ? "text-gray-200" : "text-gray-800")}>{p.name}</p>
                    <p className={cn("text-[10px]", dark ? "text-gray-500" : "text-gray-400")}>{p.sales} sales</p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-xs font-bold", dark ? "text-gray-200" : "text-gray-800")}>${p.revenue.toFixed(0)}</p>
                    {p.stock <= 5 && <span className="text-[10px] font-bold text-red-500">Low Stock</span>}
                  </div>
                  {i === 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Best</span>}
                  {i > 0 && i < 3 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">Hot</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ═══ STOCK ALERTS + FLASH DEALS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock Alerts */}
        <Card dark={dark}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <h2 className={cn("text-base font-extrabold", dark ? "text-white" : "text-[#16181d]")}>Stock Alerts</h2>
            </div>
            <button onClick={() => onNavigate("inventory")} className="text-xs font-semibold text-blue-500 hover:underline">Manage Inventory</button>
          </div>
          {loading ? <Skeleton className="h-32" /> : (
            <div className="space-y-4">
              {data.stockAlerts.outOfStock.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-2 flex items-center gap-1">
                    <PackageX className="w-3 h-3" /> Out of Stock ({data.stockAlerts.outOfStock.length})
                  </p>
                  <div className="space-y-1.5">
                    {data.stockAlerts.outOfStock.slice(0, 3).map((p) => (
                      <div key={p.id} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg", dark ? "bg-red-900/10" : "bg-red-50")}>
                        <div className={cn("w-7 h-7 rounded-md overflow-hidden flex-shrink-0", dark ? "bg-[#252c36]" : "bg-gray-100")}>
                          {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className={cn("text-xs font-medium truncate flex-1", dark ? "text-gray-300" : "text-gray-700")}>{p.name}</span>
                        <span className="text-[10px] font-bold text-red-500">0 left</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.stockAlerts.lowStock.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Low Stock ({data.stockAlerts.lowStock.length})
                  </p>
                  <div className="space-y-1.5">
                    {data.stockAlerts.lowStock.slice(0, 3).map((p) => (
                      <div key={p.id} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-lg", dark ? "bg-amber-900/10" : "bg-amber-50")}>
                        <div className={cn("w-7 h-7 rounded-md overflow-hidden flex-shrink-0", dark ? "bg-[#252c36]" : "bg-gray-100")}>
                          {p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className={cn("text-xs font-medium truncate flex-1", dark ? "text-gray-300" : "text-gray-700")}>{p.name}</span>
                        <span className="text-[10px] font-bold text-amber-500">{p.stock} left</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {data.stockAlerts.outOfStock.length === 0 && data.stockAlerts.lowStock.length === 0 && (
                <div className="text-center py-6">
                  <CheckCircle2 className={cn("w-8 h-8 mx-auto mb-2", dark ? "text-emerald-400" : "text-emerald-500")} />
                  <p className={cn("text-sm font-medium", dark ? "text-gray-400" : "text-gray-500")}>All stock levels healthy</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Flash Deals */}
        <Card dark={dark}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-orange-500" />
              </div>
              <h2 className={cn("text-base font-extrabold", dark ? "text-white" : "text-[#16181d]")}>Flash Deals</h2>
            </div>
            <button onClick={() => onNavigate("flashdeals")} className="text-xs font-semibold text-blue-500 hover:underline">Manage Deals</button>
          </div>
          {loading ? <Skeleton className="h-32" /> : data.flashDeals.length === 0 ? (
            <div className="text-center py-6">
              <Zap className={cn("w-8 h-8 mx-auto mb-2", dark ? "text-gray-600" : "text-gray-300")} />
              <p className={cn("text-sm font-medium", dark ? "text-gray-400" : "text-gray-500")}>No active flash deals</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.flashDeals.slice(0, 4).map((deal) => {
                const remaining = deal.ends_at ? Math.max(0, new Date(deal.ends_at).getTime() - Date.now()) : 0;
                const hours = Math.floor(remaining / 3600000);
                const mins = Math.floor((remaining % 3600000) / 60000);
                return (
                  <div key={deal.id} className={cn("flex items-center gap-3 p-2.5 rounded-xl", dark ? "bg-[#1e2430]" : "bg-gray-50")}>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-semibold truncate", dark ? "text-gray-200" : "text-gray-800")}>{deal.product_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-blue-500">${deal.deal_price}</span>
                        <span className={cn("text-[10px] line-through", dark ? "text-gray-500" : "text-gray-400")}>${deal.original_price}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-[10px] font-medium", dark ? "text-gray-400" : "text-gray-500")}>{deal.sales} sales</p>
                      {remaining > 0 && (
                        <p className="text-[10px] font-bold text-orange-500">{hours}h {mins}m left</p>
                      )}
                    </div>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-bold",
                      deal.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                    )}>
                      {deal.is_active ? "Active" : "Ended"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ═══ CUSTOMER ANALYTICS + PAYMENT BREAKDOWN ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Customer Analytics */}
        <Card dark={dark}>
          <h2 className={cn("text-base font-extrabold mb-4", dark ? "text-white" : "text-[#16181d]")}>Customer Analytics</h2>
          {loading ? <Skeleton className="h-48" /> : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "New", value: data.customerAnalytics.newCustomers, icon: UserPlus, color: "text-blue-500" },
                  { label: "Active", value: data.customerAnalytics.activeCustomers, icon: UserCheck, color: "text-emerald-500" },
                  { label: "VIP", value: data.customerAnalytics.vipCustomers, icon: Crown, color: "text-amber-500" },
                ].map((s) => (
                  <div key={s.label} className={cn("text-center p-3 rounded-xl", dark ? "bg-[#1e2430]" : "bg-gray-50")}>
                    <s.icon className={cn("w-4 h-4 mx-auto mb-1", s.color)} />
                    <p className={cn("text-lg font-extrabold", dark ? "text-white" : "text-[#16181d]")}>{s.value}</p>
                    <p className={cn("text-[10px] font-medium", dark ? "text-gray-500" : "text-gray-400")}>{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={cn("p-3 rounded-xl", dark ? "bg-[#1e2430]" : "bg-gray-50")}>
                  <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-1", dark ? "text-gray-500" : "text-gray-400")}>Retention</p>
                  <p className={cn("text-lg font-extrabold", dark ? "text-white" : "text-[#16181d]")}>{data.customerAnalytics.retentionRate.toFixed(1)}%</p>
                </div>
                <div className={cn("p-3 rounded-xl", dark ? "bg-[#1e2430]" : "bg-gray-50")}>
                  <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-1", dark ? "text-gray-500" : "text-gray-400")}>Lifetime Value</p>
                  <p className={cn("text-lg font-extrabold", dark ? "text-white" : "text-[#16181d]")}>${data.customerAnalytics.lifetimeValue.toFixed(0)}</p>
                </div>
              </div>
              {data.customerAnalytics.growthData.length > 0 && (
                <div className="h-[120px] mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.customerAnalytics.growthData}>
                      <defs>
                        <linearGradient id="gCust" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="customers" stroke="#0ea5e9" strokeWidth={2} fill="url(#gCust)" dot={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: dark ? "#6b7280" : "#9ca3af" }} axisLine={false} tickLine={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Payment Breakdown */}
        <Card dark={dark}>
          <h2 className={cn("text-base font-extrabold mb-4", dark ? "text-white" : "text-[#16181d]")}>Payment Methods</h2>
          {loading ? <Skeleton className="h-48" /> : data.paymentBreakdown.length === 0 ? (
            <p className={cn("text-sm text-center py-8", dark ? "text-gray-500" : "text-gray-400")}>No payment data</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-[180px] h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.paymentBreakdown} dataKey="amount" nameKey="method" cx="50%" cy="50%" innerRadius={50} outerRadius={75} strokeWidth={2} stroke={dark ? "#171c24" : "#fff"}>
                      {data.paymentBreakdown.map((_, i) => (
                        <Cell key={i} fill={paymentColors[i % paymentColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `$${Number(v ?? 0).toFixed(2)}`} contentStyle={{ backgroundColor: dark ? "#1e2430" : "#fff", border: `1px solid ${dark ? "#2d3544" : "#e5e7eb"}`, borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {data.paymentBreakdown.map((pm, i) => (
                  <div key={pm.method} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: paymentColors[i % paymentColors.length] }} />
                    <span className={cn("text-xs font-medium flex-1 capitalize", dark ? "text-gray-300" : "text-gray-600")}>{pm.method}</span>
                    <span className={cn("text-xs font-bold", dark ? "text-gray-200" : "text-gray-800")}>{pm.percentage.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ═══ MONTHLY GOAL + ACTIVITY + QUICK ACTIONS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Goal */}
        <Card dark={dark}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center">
              <Target className="w-4 h-4 text-violet-500" />
            </div>
            <h2 className={cn("text-base font-extrabold", dark ? "text-white" : "text-[#16181d]")}>Monthly Goal</h2>
          </div>
          {loading ? <Skeleton className="h-32" /> : (
            <div className="text-center">
              <p className={cn("text-3xl font-extrabold", dark ? "text-white" : "text-[#16181d]")}>
                {data.monthlyGoal.percentage}%
              </p>
              <p className={cn("text-sm mt-1", dark ? "text-gray-400" : "text-gray-500")}>
                ${data.monthlyGoal.current.toLocaleString()} / ${data.monthlyGoal.target.toLocaleString()}
              </p>
              <div className={cn("w-full h-3 rounded-full mt-4 overflow-hidden", dark ? "bg-[#252c36]" : "bg-gray-100")}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(100, data.monthlyGoal.percentage)}%` }}
                />
              </div>
              <p className={cn("text-xs mt-2", dark ? "text-gray-500" : "text-gray-400")}>
                ${(data.monthlyGoal.target - data.monthlyGoal.current).toLocaleString()} remaining
              </p>
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card dark={dark}>
          <h2 className={cn("text-base font-extrabold mb-4", dark ? "text-white" : "text-[#16181d]")}>Recent Activity</h2>
          {loading ? <Skeleton className="h-48" /> : data.recentActivity.length === 0 ? (
            <p className={cn("text-sm text-center py-8", dark ? "text-gray-500" : "text-gray-400")}>No recent activity</p>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {data.recentActivity.slice(0, 12).map((a) => (
                <div key={a.id} className="flex items-start gap-2.5">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", activityColors[a.type] ?? (dark ? "bg-gray-700 text-gray-400" : "bg-gray-100 text-gray-500"))}>
                    {activityIcons[a.type] ?? <Activity className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium leading-snug", dark ? "text-gray-300" : "text-gray-700")}>{a.message}</p>
                    <p className={cn("text-[10px] mt-0.5", dark ? "text-gray-600" : "text-gray-400")}>
                      {new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card dark={dark}>
          <h2 className={cn("text-base font-extrabold mb-4", dark ? "text-white" : "text-[#16181d]")}>Quick Actions</h2>
          <div className="grid grid-cols-3 gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => onNavigate(action.module)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all",
                  dark ? "hover:bg-[#1e2430]" : "hover:bg-gray-50"
                )}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${action.color}12` }}>
                  <action.icon className="w-4 h-4" style={{ color: action.color }} />
                </div>
                <span className={cn("text-[10px] font-semibold leading-tight", dark ? "text-gray-400" : "text-gray-500")}>{action.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* ═══ SYSTEM HEALTH + NOTIFICATIONS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* System Health */}
        <Card dark={dark}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <h2 className={cn("text-base font-extrabold", dark ? "text-white" : "text-[#16181d]")}>System Health</h2>
          </div>
          {loading ? <Skeleton className="h-48" /> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.systemHealth.map((s) => (
                <div key={s.name} className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl", dark ? "bg-[#1e2430]" : "bg-gray-50")}>
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", s.status === "ok" ? "bg-emerald-500" : s.status === "warning" ? "bg-amber-500" : "bg-red-500")} />
                  <span className={cn("text-xs font-medium truncate", dark ? "text-gray-300" : "text-gray-600")}>{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Business Insights */}
        <Card dark={dark}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Flame className="w-4 h-4 text-blue-500" />
            </div>
            <h2 className={cn("text-base font-extrabold", dark ? "text-white" : "text-[#16181d]")}>Business Insights</h2>
          </div>
          {loading ? <Skeleton className="h-32" /> : (
            <div className="space-y-2">
              {[
                data.topProducts[0] ? `Your top product "${data.topProducts[0].name}" generates ${data.topProducts.length > 1 ? Math.round((data.topProducts[0].revenue / data.topProducts.reduce((s, p) => s + p.revenue, 0)) * 100) : 100}% of product revenue.` : null,
                data.stockAlerts.lowStock.length > 0 ? `${data.stockAlerts.lowStock.length} product${data.stockAlerts.lowStock.length > 1 ? "s" : ""} running low on stock.` : null,
                data.customerAnalytics.newCustomers > 0 ? `${data.customerAnalytics.newCustomers} new customer${data.customerAnalytics.newCustomers > 1 ? "s" : ""} joined during this period.` : null,
                (kpi.averageOrderValue ?? 0) > 0 ? `Average order value is $${(kpi.averageOrderValue ?? 0).toFixed(2)}.` : null,
                data.stockAlerts.outOfStock.length > 0 ? `${data.stockAlerts.outOfStock.length} product${data.stockAlerts.outOfStock.length > 1 ? "s are" : " is"} out of stock.` : null,
              ].filter(Boolean).map((insight, i) => (
                <div key={i} className={cn("flex items-start gap-2 p-2.5 rounded-xl", dark ? "bg-[#1e2430]" : "bg-blue-50/50")}>
                  <Star className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className={cn("text-xs font-medium", dark ? "text-gray-300" : "text-gray-600")}>{insight}</p>
                </div>
              ))}
              {data.topProducts.length === 0 && data.stockAlerts.lowStock.length === 0 && (
                <p className={cn("text-sm text-center py-4", dark ? "text-gray-500" : "text-gray-400")}>Add products and get orders to see insights</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
