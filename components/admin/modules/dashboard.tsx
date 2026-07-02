"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  Plus,
  Eye,
  Send,
  Download,
  AlertTriangle,
  Clock,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import type { Product, ProductVariant, Order } from "@/types";

/* ─── theme helpers ─── */
const t = (dark: boolean, light: string, darkVal: string) =>
  dark ? darkVal : light;

const bg = (d: boolean) => t(d, "#f4f6f9", "#0f1318");
const panel = (d: boolean) => t(d, "#ffffff", "#171c24");
const text = (d: boolean) => t(d, "#16181d", "#e7ebf0");
const sub = (d: boolean) => t(d, "#8a929c", "#8b95a3");
const border = (d: boolean) => t(d, "#eef0f3", "#252c36");

const categoryColors = ["#2563eb", "#7c3aed", "#16a34a", "#ea7317", "#ef4444"];

const countryData = [
  { country: "United States", pct: 45 },
  { country: "United Kingdom", pct: 22 },
  { country: "Germany", pct: 15 },
  { country: "France", pct: 10 },
  { country: "Canada", pct: 8 },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day(s) ago`;
}

/* ─── component ─── */
type Props = { dark: boolean; onNavigate: (module: string) => void };

export default function DashboardModule({ dark, onNavigate }: Props) {
  const [revenue, setRevenue] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [customersCount, setCustomersCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [lowStock, setLowStock] = useState<
    { name: string; size: string; stock: number }[]
  >([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [topProducts, setTopProducts] = useState<
    { rank: number; name: string; sales: number; revenue: number }[]
  >([]);
  const [revenueData, setRevenueData] = useState<
    { month: string; revenue: number }[]
  >([]);
  const [categoryData, setCategoryData] = useState<
    { name: string; value: number }[]
  >([]);
  const [recentActivity, setRecentActivity] = useState<
    { time: string; text: string; color: string }[]
  >([]);
  const [dashLoading, setDashLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      try {
        /* orders count + revenue */
        const { data: orders } = await supabase
          .from("orders")
          .select("id, total, status, order_number, created_at, user_id, payment_status, subtotal, shipping_cost, discount, shipping_address");
        if (orders) {
          setOrdersCount(orders.length);
          setRevenue(
            orders.reduce((s: number, o: { total: number }) => s + o.total, 0)
          );

          /* revenue chart: last 7 days */
          const now = new Date();
          const last7: { month: string; revenue: number }[] = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const dayRevenue = orders
              .filter((o: any) => o.created_at?.slice(0, 10) === key)
              .reduce((s: number, o: any) => s + (o.total ?? 0), 0);
            last7.push({ month: label, revenue: dayRevenue });
          }
          setRevenueData(last7);
        }

        /* products count */
        const { count: pCount } = await supabase
          .from("products")
          .select("id", { count: "exact", head: true });
        if (pCount !== null) setProductsCount(pCount);

        /* customers count */
        const { count: cCount } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true });
        if (cCount !== null) setCustomersCount(cCount);

        /* low stock variants */
        const { data: variants } = await supabase
          .from("product_variants")
          .select("size, stock, product_id, products(name)")
          .lt("stock", 5)
          .order("stock", { ascending: true })
          .limit(5);
        if (variants) {
          setLowStock(
            variants.map((v: any) => ({
              name: v.products?.name ?? "Unknown",
              size: v.size,
              stock: v.stock,
            }))
          );
        }

        /* pending orders */
        const { data: pending } = await supabase
          .from("orders")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5);
        if (pending) setPendingOrders(pending as Order[]);

        /* top products by sales count */
        const { data: topProds } = await supabase
          .from("products")
          .select("name, price")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(5);
        if (topProds && topProds.length > 0) {
          setTopProducts(
            topProds.map((p: any, i: number) => ({
              rank: i + 1,
              name: p.name,
              sales: 0,
              revenue: 0,
            }))
          );
        }

        /* category breakdown */
        const { data: prods } = await supabase
          .from("products")
          .select("category:categories(name)");
        if (prods && prods.length > 0) {
          const counts: Record<string, number> = {};
          prods.forEach((p: any) => {
            const cat = p.category?.name ?? "Uncategorized";
            counts[cat] = (counts[cat] ?? 0) + 1;
          });
          const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
          const total = sorted.reduce((s, [, v]) => s + v, 0);
          setCategoryData(
            sorted.map(([name, count]) => ({
              name,
              value: total > 0 ? Math.round((count / total) * 100) : 0,
            }))
          );
        }

        /* recent activity */
        const { data: activityLogs } = await supabase
          .from("activity_logs")
          .select("description, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        if (activityLogs && activityLogs.length > 0) {
          const colors = ["#2563eb", "#16a34a", "#7c3aed", "#ea7317", "#ef4444"];
          setRecentActivity(
            activityLogs.map((a: any, i: number) => ({
              time: timeAgo(a.created_at),
              text: a.description ?? "Activity",
              color: colors[i % colors.length],
            }))
          );
        }
      } catch {
        /* keep fallback empty values */
      } finally {
        setDashLoading(false);
      }
    }

    load();
  }, []);

  /* ─── card style ─── */
  const cardStyle: React.CSSProperties = {
    background: panel(dark),
    border: `1px solid ${border(dark)}`,
    borderRadius: 16,
    padding: 18,
  };

  /* ─── KPI cards ─── */
  const kpis = [
    {
      label: "Total Revenue",
      value: `$${revenue.toLocaleString()}`,
      icon: DollarSign,
      iconBg: "#eaf1fb",
      iconColor: "#2563eb",
      trend: "+12.4%",
      trendUp: true,
    },
    {
      label: "Orders",
      value: ordersCount.toLocaleString(),
      icon: ShoppingCart,
      iconBg: "#e8f7ee",
      iconColor: "#16a34a",
      trend: "+8.2%",
      trendUp: true,
    },
    {
      label: "Customers",
      value: customersCount.toLocaleString(),
      icon: Users,
      iconBg: "#efe9fd",
      iconColor: "#7c3aed",
      trend: "+5.1%",
      trendUp: true,
    },
    {
      label: "Products",
      value: productsCount.toLocaleString(),
      icon: Package,
      iconBg: "#fdecdd",
      iconColor: "#ea7317",
      trend: "-2.3%",
      trendUp: false,
    },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        style={{
          background: panel(dark),
          border: `1px solid ${border(dark)}`,
          borderRadius: 8,
          padding: "8px 12px",
          color: text(dark),
          fontSize: 13,
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
        <p style={{ margin: 0, color: "#2563eb" }}>
          ${payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  };

  if (dashLoading) {
    return (
      <div style={{ background: bg(dark), minHeight: "100vh", padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 24, height: 24, border: "2px solid #2563eb", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: bg(dark), minHeight: "100vh", padding: 24 }}>
      {/* KPI Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {kpis.map((kpi) => (
          <div key={kpi.label} style={{ ...cardStyle, position: "relative" }}>
            {/* trend badge */}
            <div
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontSize: 12,
                fontWeight: 600,
                color: kpi.trendUp ? "#16a34a" : "#ef4444",
              }}
            >
              {kpi.trendUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {kpi.trend}
            </div>

            {/* icon */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: kpi.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <kpi.icon size={22} color={kpi.iconColor} />
            </div>

            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: text(dark),
                lineHeight: 1.2,
              }}
            >
              {kpi.value}
            </div>
            <div style={{ fontSize: 13, color: sub(dark), marginTop: 2 }}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Revenue Line Chart */}
        <div style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: text(dark) }}>
              Sales Analytics
            </div>
            <div style={{ fontSize: 13, color: sub(dark) }}>Last 7 days</div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenueData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={border(dark)}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: sub(dark), fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: sub(dark), fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "#2563eb" }}
                fill="url(#revGrad)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Donut */}
        <div style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: text(dark) }}>
              Sales by Category
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={categoryColors[i]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value}%`, "Share"]}
                contentStyle={{
                  background: panel(dark),
                  border: `1px solid ${border(dark)}`,
                  borderRadius: 8,
                  color: text(dark),
                  fontSize: 13,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
              marginTop: 8,
            }}
          >
            {categoryData.map((c, i) => (
              <div
                key={c.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: sub(dark),
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: categoryColors[i],
                    display: "inline-block",
                  }}
                />
                {c.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Sales by Country */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: text(dark),
              marginBottom: 16,
            }}
          >
            Sales by Country
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {countryData.map((c) => (
              <div key={c.country}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: text(dark) }}>{c.country}</span>
                  <span style={{ color: sub(dark), fontWeight: 600 }}>
                    {c.pct}%
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: border(dark),
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${c.pct}%`,
                      height: "100%",
                      borderRadius: 3,
                      background: "#2563eb",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Selling Products */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: text(dark),
              marginBottom: 16,
            }}
          >
            Top Selling Products
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: sub(dark), textAlign: "left" }}>
                <th style={{ padding: "6px 0", fontWeight: 500 }}>#</th>
                <th style={{ padding: "6px 0", fontWeight: 500 }}>Product</th>
                <th style={{ padding: "6px 0", fontWeight: 500, textAlign: "right" }}>
                  Sales
                </th>
                <th style={{ padding: "6px 0", fontWeight: 500, textAlign: "right" }}>
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p) => (
                <tr
                  key={p.rank}
                  style={{
                    borderTop: `1px solid ${border(dark)}`,
                    color: text(dark),
                  }}
                >
                  <td style={{ padding: "10px 0" }}>{p.rank}</td>
                  <td
                    style={{
                      padding: "10px 0",
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </td>
                  <td style={{ padding: "10px 0", textAlign: "right" }}>{p.sales}</td>
                  <td style={{ padding: "10px 0", textAlign: "right" }}>
                    ${p.revenue.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Add Product", icon: Plus, action: () => onNavigate("products") },
          { label: "View Orders", icon: Eye, action: () => onNavigate("orders") },
          {
            label: "Send Campaign",
            icon: Send,
            action: () => onNavigate("notifications"),
          },
          { label: "Export Data", icon: Download, action: undefined },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={btn.action}
            style={{
              ...cardStyle,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              color: "#2563eb",
              transition: "opacity 0.15s",
            }}
          >
            <btn.icon size={18} />
            {btn.label}
          </button>
        ))}
      </div>

      {/* Bottom Section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {/* Low Stock Alerts */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              fontSize: 16,
              fontWeight: 600,
              color: text(dark),
            }}
          >
            <AlertTriangle size={18} color="#ea7317" />
            Low Stock Alerts
          </div>
          {lowStock.length === 0 ? (
            <div style={{ fontSize: 13, color: sub(dark) }}>
              No low stock items found.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lowStock.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: dark ? "#1c1f26" : "#fefcfb",
                    border: `1px solid ${border(dark)}`,
                    fontSize: 13,
                  }}
                >
                  <div>
                    <div style={{ color: text(dark), fontWeight: 500 }}>
                      {item.name}
                    </div>
                    <div style={{ color: sub(dark), fontSize: 12 }}>
                      Size {item.size}
                    </div>
                  </div>
                  <span
                    style={{
                      color: item.stock <= 1 ? "#ef4444" : "#ea7317",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {item.stock} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Orders */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              fontSize: 16,
              fontWeight: 600,
              color: text(dark),
            }}
          >
            <Clock size={18} color="#2563eb" />
            Pending Orders
          </div>
          {pendingOrders.length === 0 ? (
            <div style={{ fontSize: 13, color: sub(dark) }}>
              No pending orders.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: dark ? "#1c1f26" : "#f8fafc",
                    border: `1px solid ${border(dark)}`,
                    fontSize: 13,
                  }}
                >
                  <div>
                    <div style={{ color: text(dark), fontWeight: 500 }}>
                      #{order.order_number}
                    </div>
                    <div style={{ color: sub(dark), fontSize: 12 }}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span style={{ color: "#2563eb", fontWeight: 600 }}>
                    ${order.total.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              fontSize: 16,
              fontWeight: 600,
              color: text(dark),
            }}
          >
            <Activity size={18} color="#7c3aed" />
            Recent Activity
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {recentActivity.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "start" }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: item.color,
                    marginTop: 5,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontSize: 13, color: text(dark) }}>{item.text}</div>
                  <div style={{ fontSize: 11, color: sub(dark), marginTop: 2 }}>
                    {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
