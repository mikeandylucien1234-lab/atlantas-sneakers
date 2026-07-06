import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

type Period = "today" | "yesterday" | "7d" | "30d" | "90d" | "year" | "all";

function getPeriodDates(period: Period): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  label: string;
} {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  let start: Date;
  let end: Date = now;
  let prevStart: Date;
  let prevEnd: Date;

  switch (period) {
    case "today":
      start = todayStart;
      prevStart = new Date(todayStart);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(todayStart);
      prevEnd.setMilliseconds(-1);
      break;
    case "yesterday": {
      start = new Date(todayStart);
      start.setDate(start.getDate() - 1);
      end = new Date(todayStart);
      end.setMilliseconds(-1);
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 1);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      break;
    }
    case "7d":
      start = new Date(todayStart);
      start.setDate(start.getDate() - 7);
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      break;
    case "90d":
      start = new Date(todayStart);
      start.setDate(start.getDate() - 90);
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 90);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      prevStart = new Date(now.getFullYear() - 1, 0, 1);
      prevEnd = new Date(now.getFullYear(), 0, 1);
      prevEnd.setMilliseconds(-1);
      break;
    case "all":
      start = new Date(2000, 0, 1);
      prevStart = new Date(2000, 0, 1);
      prevEnd = new Date(2000, 0, 1);
      break;
    case "30d":
    default:
      start = new Date(todayStart);
      start.setDate(start.getDate() - 30);
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 30);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      break;
  }

  return { start, end, prevStart, prevEnd, label: period };
}

function toISO(date: Date): string {
  return date.toISOString();
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function generateDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get("period") || "30d") as Period;
    const validPeriods: Period[] = [
      "today",
      "yesterday",
      "7d",
      "30d",
      "90d",
      "year",
      "all",
    ];
    if (!validPeriods.includes(period)) {
      return Response.json({ error: "Invalid period" }, { status: 400 });
    }

    const { start, end, prevStart, prevEnd } = getPeriodDates(period);
    const startISO = toISO(start);
    const endISO = toISO(end);
    const prevStartISO = toISO(prevStart);
    const prevEndISO = toISO(prevEnd);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = toISO(todayStart);

    // Run all queries in parallel
    const [
      kpiData,
      revenueChartData,
      recentOrdersData,
      topProductsData,
      stockAlertsData,
      flashDealsData,
      customerAnalyticsData,
      paymentBreakdownData,
      recentActivityData,
      monthlyGoalData,
      systemHealthData,
    ] = await Promise.all([
      // KPIs
      safeQuery(async () => {
        const [
          periodOrders,
          prevPeriodOrders,
          todayOrders,
          yesterdayOrders,
          totalCustomers,
          periodCustomers,
          prevPeriodCustomers,
          periodRefunds,
          prevPeriodRefunds,
        ] = await Promise.all([
          supabase
            .from("orders")
            .select("id, total, status, created_at")
            .gte("created_at", startISO)
            .lte("created_at", endISO),
          supabase
            .from("orders")
            .select("id, total, status, created_at")
            .gte("created_at", prevStartISO)
            .lte("created_at", prevEndISO),
          supabase
            .from("orders")
            .select("id, total")
            .gte("created_at", todayISO),
          supabase
            .from("orders")
            .select("id, total")
            .gte(
              "created_at",
              toISO(
                new Date(todayStart.getTime() - 86400000)
              )
            )
            .lt("created_at", todayISO),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .gte("created_at", startISO)
            .lte("created_at", endISO),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .gte("created_at", prevStartISO)
            .lte("created_at", prevEndISO),
          supabase
            .from("orders")
            .select("id, total")
            .eq("status", "refunded")
            .gte("created_at", startISO)
            .lte("created_at", endISO),
          supabase
            .from("orders")
            .select("id, total")
            .eq("status", "refunded")
            .gte("created_at", prevStartISO)
            .lte("created_at", prevEndISO),
        ]);

        const orders = periodOrders.data || [];
        const prevOrders = prevPeriodOrders.data || [];
        const todayOrd = todayOrders.data || [];
        const yesterdayOrd = yesterdayOrders.data || [];
        const refunds = periodRefunds.data || [];
        const prevRefunds = prevPeriodRefunds.data || [];

        const totalRevenue = orders.reduce(
          (sum, o) => sum + (Number(o.total) || 0),
          0
        );
        const prevTotalRevenue = prevOrders.reduce(
          (sum, o) => sum + (Number(o.total) || 0),
          0
        );
        const todayRevenue = todayOrd.reduce(
          (sum, o) => sum + (Number(o.total) || 0),
          0
        );
        const yesterdayRevenue = yesterdayOrd.reduce(
          (sum, o) => sum + (Number(o.total) || 0),
          0
        );

        const customers = totalCustomers.count || 0;
        const newCust = periodCustomers.count || 0;
        const prevNewCust = prevPeriodCustomers.count || 0;
        const avgOrderValue =
          orders.length > 0 ? totalRevenue / orders.length : 0;
        const prevAvgOrderValue =
          prevOrders.length > 0
            ? prevTotalRevenue / prevOrders.length
            : 0;
        const conversionRate =
          customers > 0 ? (orders.length / customers) * 100 : 0;
        const prevConversionRate =
          customers > 0 ? (prevOrders.length / customers) * 100 : 0;
        const profit = totalRevenue * 0.3;
        const prevProfit = prevTotalRevenue * 0.3;
        const refundTotal = refunds.reduce(
          (sum, o) => sum + (Number(o.total) || 0),
          0
        );
        const prevRefundTotal = prevRefunds.reduce(
          (sum, o) => sum + (Number(o.total) || 0),
          0
        );

        return {
          todayRevenue: Math.round(todayRevenue * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          ordersToday: todayOrd.length,
          totalOrders: orders.length,
          customers,
          newCustomers: newCust,
          conversionRate: Math.round(conversionRate * 10) / 10,
          averageOrderValue: Math.round(avgOrderValue * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          refunds: Math.round(refundTotal * 100) / 100,
          todayRevenueChange: pctChange(todayRevenue, yesterdayRevenue),
          totalRevenueChange: pctChange(totalRevenue, prevTotalRevenue),
          ordersTodayChange: pctChange(todayOrd.length, yesterdayOrd.length),
          totalOrdersChange: pctChange(orders.length, prevOrders.length),
          customersChange: pctChange(newCust, prevNewCust),
          newCustomersChange: pctChange(newCust, prevNewCust),
          conversionRateChange: pctChange(conversionRate, prevConversionRate),
          averageOrderValueChange: pctChange(avgOrderValue, prevAvgOrderValue),
          profitChange: pctChange(profit, prevProfit),
          refundsChange: pctChange(refundTotal, prevRefundTotal),
        };
      }, {
        todayRevenue: 0, totalRevenue: 0, ordersToday: 0, totalOrders: 0,
        customers: 0, newCustomers: 0, conversionRate: 0, averageOrderValue: 0,
        profit: 0, refunds: 0, todayRevenueChange: 0, totalRevenueChange: 0,
        ordersTodayChange: 0, totalOrdersChange: 0, customersChange: 0,
        newCustomersChange: 0, conversionRateChange: 0,
        averageOrderValueChange: 0, profitChange: 0, refundsChange: 0,
      }),

      // Revenue chart
      safeQuery(async () => {
        const { data: orders } = await supabase
          .from("orders")
          .select("total, created_at")
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .order("created_at", { ascending: true });

        const dateRange = generateDateRange(start, end);
        const dailyMap = new Map<
          string,
          { revenue: number; orders: number }
        >();
        dateRange.forEach((d) => dailyMap.set(d, { revenue: 0, orders: 0 }));

        (orders || []).forEach((o) => {
          const day = formatDate(new Date(o.created_at));
          const entry = dailyMap.get(day);
          if (entry) {
            entry.revenue += Number(o.total) || 0;
            entry.orders += 1;
          }
        });

        return dateRange.map((date) => {
          const entry = dailyMap.get(date)!;
          return {
            date,
            revenue: Math.round(entry.revenue * 100) / 100,
            orders: entry.orders,
            profit: Math.round(entry.revenue * 0.3 * 100) / 100,
          };
        });
      }, []),

      // Recent orders
      safeQuery(async () => {
        const { data: orders } = await supabase
          .from("orders")
          .select(
            "id, order_number, total, payment_method, status, created_at, user_id, items:order_items(quantity, price, product:products(name, images))"
          )
          .order("created_at", { ascending: false })
          .limit(10);

        if (!orders || orders.length === 0) return [];

        const userIds = [...new Set(orders.map((o) => o.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const profileMap = new Map(
          (profiles || []).map((p) => [p.id, p])
        );

        return orders.map((o) => {
          const profile = profileMap.get(o.user_id);
          return {
            id: o.id,
            order_number: o.order_number,
            customer_name: profile?.full_name || "Unknown",
            customer_email: profile?.email || "",
            total: Number(o.total) || 0,
            payment_method: o.payment_method,
            status: o.status,
            created_at: o.created_at,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            items: (o.items || []).map((item: any) => ({
              name: item.product?.name || "Unknown",
              image: item.product?.images?.[0] || null,
              quantity: item.quantity,
              price: Number(item.price) || 0,
            })),
          };
        });
      }, []),

      // Top products
      safeQuery(async () => {
        const { data: orderItems } = await supabase
          .from("order_items")
          .select(
            "product_id, quantity, price, order:orders!inner(created_at)"
          )
          .gte("order.created_at", startISO)
          .lte("order.created_at", endISO);

        if (!orderItems || orderItems.length === 0) return [];

        const productStats = new Map<
          string,
          { sales: number; revenue: number }
        >();
        orderItems.forEach((item) => {
          const existing = productStats.get(item.product_id) || {
            sales: 0,
            revenue: 0,
          };
          existing.sales += item.quantity || 0;
          existing.revenue += (Number(item.price) || 0) * (item.quantity || 1);
          productStats.set(item.product_id, existing);
        });

        const topIds = [...productStats.entries()]
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .slice(0, 10)
          .map(([id]) => id);

        if (topIds.length === 0) return [];

        const { data: products } = await supabase
          .from("products")
          .select("id, name, slug, images, stock")
          .in("id", topIds);

        return (products || [])
          .map((p) => {
            const stats = productStats.get(p.id) || {
              sales: 0,
              revenue: 0,
            };
            return {
              id: p.id,
              name: p.name,
              slug: p.slug,
              image: p.images?.[0] || null,
              sales: stats.sales,
              revenue: Math.round(stats.revenue * 100) / 100,
              stock: p.stock || 0,
              conversion: 0,
            };
          })
          .sort((a, b) => b.revenue - a.revenue);
      }, []),

      // Stock alerts
      safeQuery(async () => {
        const [lowStockRes, outOfStockRes, allProductsRes, soldProductsRes] =
          await Promise.all([
            supabase
              .from("products")
              .select("id, name, images, stock, sku")
              .gt("stock", 0)
              .lte("stock", 5)
              .limit(20),
            supabase
              .from("products")
              .select("id, name, images, sku")
              .eq("stock", 0)
              .limit(20),
            supabase
              .from("products")
              .select("id, name, images")
              .limit(1000),
            supabase
              .from("order_items")
              .select("product_id")
              .limit(10000),
          ]);

        const soldIds = new Set(
          (soldProductsRes.data || []).map((i) => i.product_id)
        );
        const neverSold = (allProductsRes.data || [])
          .filter((p) => !soldIds.has(p.id))
          .slice(0, 20)
          .map((p) => ({
            id: p.id,
            name: p.name,
            image: p.images?.[0] || null,
          }));

        return {
          lowStock: (lowStockRes.data || []).map((p) => ({
            id: p.id,
            name: p.name,
            image: p.images?.[0] || null,
            stock: p.stock,
            sku: p.sku || "",
          })),
          outOfStock: (outOfStockRes.data || []).map((p) => ({
            id: p.id,
            name: p.name,
            image: p.images?.[0] || null,
            sku: p.sku || "",
          })),
          neverSold,
        };
      }, { lowStock: [], outOfStock: [], neverSold: [] }),

      // Flash deals
      safeQuery(async () => {
        const { data: deals } = await supabase
          .from("flash_deals")
          .select("id, deal_price, original_price, ends_at, is_active, product_id, product:products(name)")
          .order("created_at", { ascending: false })
          .limit(10);

        if (!deals || deals.length === 0) return [];

        const dealIds = deals.map((d) => d.product_id);
        const { data: salesData } = await supabase
          .from("order_items")
          .select("product_id, quantity, price")
          .in("product_id", dealIds);

        const salesMap = new Map<
          string,
          { sales: number; revenue: number }
        >();
        (salesData || []).forEach((item) => {
          const existing = salesMap.get(item.product_id) || {
            sales: 0,
            revenue: 0,
          };
          existing.sales += item.quantity || 0;
          existing.revenue += (Number(item.price) || 0) * (item.quantity || 1);
          salesMap.set(item.product_id, existing);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return deals.map((d: any) => {
          const stats = salesMap.get(d.product_id) || {
            sales: 0,
            revenue: 0,
          };
          return {
            id: d.id,
            product_name: d.product?.name || "Unknown",
            deal_price: Number(d.deal_price) || 0,
            original_price: Number(d.original_price) || 0,
            sales: stats.sales,
            revenue: Math.round(stats.revenue * 100) / 100,
            ends_at: d.ends_at,
            is_active: d.is_active,
          };
        });
      }, []),

      // Customer analytics
      safeQuery(async () => {
        const [
          newCustRes,
          activeCustRes,
          allCustRes,
          vipRes,
          customerGrowthRes,
          prevActiveCustRes,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .gte("created_at", startISO)
            .lte("created_at", endISO),
          supabase
            .from("orders")
            .select("user_id")
            .gte("created_at", startISO)
            .lte("created_at", endISO),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("orders")
            .select("user_id"),
          supabase
            .from("profiles")
            .select("id, created_at")
            .gte("created_at", startISO)
            .lte("created_at", endISO)
            .order("created_at", { ascending: true }),
          supabase
            .from("orders")
            .select("user_id")
            .gte("created_at", prevStartISO)
            .lte("created_at", prevEndISO),
        ]);

        const activeCustomerIds = new Set(
          (activeCustRes.data || []).map((o) => o.user_id)
        );
        const activeCustomers = activeCustomerIds.size;
        const totalCustomers = allCustRes.count || 0;
        const inactiveCustomers = totalCustomers - activeCustomers;
        const newCustomers = newCustRes.count || 0;

        // VIP: 5+ orders
        const orderCounts = new Map<string, number>();
        (vipRes.data || []).forEach((o) => {
          orderCounts.set(o.user_id, (orderCounts.get(o.user_id) || 0) + 1);
        });
        const vipCustomers = [...orderCounts.values()].filter(
          (c) => c >= 5
        ).length;

        // Retention: customers active in both periods
        const prevActiveIds = new Set(
          (prevActiveCustRes.data || []).map((o) => o.user_id)
        );
        const retained = [...activeCustomerIds].filter((id) =>
          prevActiveIds.has(id)
        ).length;
        const retentionRate =
          prevActiveIds.size > 0
            ? Math.round((retained / prevActiveIds.size) * 100 * 10) / 10
            : 0;

        // Lifetime value
        const { data: allOrders } = await supabase
          .from("orders")
          .select("total, user_id");
        const customerTotals = new Map<string, number>();
        (allOrders || []).forEach((o) => {
          customerTotals.set(
            o.user_id,
            (customerTotals.get(o.user_id) || 0) + (Number(o.total) || 0)
          );
        });
        const ltValues = [...customerTotals.values()];
        const lifetimeValue =
          ltValues.length > 0
            ? Math.round(
                (ltValues.reduce((a, b) => a + b, 0) / ltValues.length) * 100
              ) / 100
            : 0;

        // Growth data
        const dateRange = generateDateRange(start, end);
        const growthMap = new Map<string, number>();
        dateRange.forEach((d) => growthMap.set(d, 0));
        (customerGrowthRes.data || []).forEach((p) => {
          const day = formatDate(new Date(p.created_at));
          growthMap.set(day, (growthMap.get(day) || 0) + 1);
        });

        return {
          newCustomers,
          activeCustomers,
          inactiveCustomers,
          vipCustomers,
          retentionRate,
          lifetimeValue,
          growthData: dateRange.map((date) => ({
            date,
            customers: growthMap.get(date) || 0,
          })),
        };
      }, {
        newCustomers: 0, activeCustomers: 0, inactiveCustomers: 0,
        vipCustomers: 0, retentionRate: 0, lifetimeValue: 0, growthData: [],
      }),

      // Payment breakdown
      safeQuery(async () => {
        const { data: orders } = await supabase
          .from("orders")
          .select("payment_method, total")
          .gte("created_at", startISO)
          .lte("created_at", endISO);

        if (!orders || orders.length === 0) return [];

        const methodMap = new Map<
          string,
          { count: number; amount: number }
        >();
        orders.forEach((o) => {
          const method = o.payment_method || "unknown";
          const existing = methodMap.get(method) || { count: 0, amount: 0 };
          existing.count += 1;
          existing.amount += Number(o.total) || 0;
          methodMap.set(method, existing);
        });

        const totalAmount = [...methodMap.values()].reduce(
          (sum, v) => sum + v.amount,
          0
        );

        return [...methodMap.entries()]
          .map(([method, stats]) => ({
            method,
            count: stats.count,
            amount: Math.round(stats.amount * 100) / 100,
            percentage:
              totalAmount > 0
                ? Math.round((stats.amount / totalAmount) * 100 * 10) / 10
                : 0,
          }))
          .sort((a, b) => b.amount - a.amount);
      }, []),

      // Recent activity
      safeQuery(async () => {
        const { data: activities } = await supabase
          .from("activity_logs")
          .select("id, type, message, created_at")
          .order("created_at", { ascending: false })
          .limit(20);

        return (activities || []).map((a) => ({
          id: a.id,
          type: a.type,
          message: a.message,
          created_at: a.created_at,
        }));
      }, []),

      // Monthly goal
      safeQuery(async () => {
        const monthStart = new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1
        );
        const { data: monthOrders } = await supabase
          .from("orders")
          .select("total")
          .gte("created_at", toISO(monthStart));

        const current = (monthOrders || []).reduce(
          (sum, o) => sum + (Number(o.total) || 0),
          0
        );
        const target = 100000;
        return {
          target,
          current: Math.round(current * 100) / 100,
          percentage: Math.round((current / target) * 100 * 10) / 10,
        };
      }, { target: 100000, current: 0, percentage: 0 }),

      // System health
      safeQuery(async () => {
        const tables = [
          "orders",
          "products",
          "profiles",
          "order_items",
          "payments",
        ];
        const results = await Promise.all(
          tables.map(async (table) => {
            const startTime = Date.now();
            try {
              const { error } = await supabase
                .from(table)
                .select("id", { count: "exact", head: true });
              const latency = Date.now() - startTime;
              if (error) {
                return {
                  name: table,
                  status: "error" as const,
                  latency,
                };
              }
              return {
                name: table,
                status: (latency > 2000 ? "warning" : "ok") as
                  | "ok"
                  | "warning",
                latency,
              };
            } catch {
              return {
                name: table,
                status: "error" as const,
                latency: Date.now() - startTime,
              };
            }
          })
        );
        return results;
      }, []),
    ]);

    return Response.json({
      kpis: kpiData,
      revenueChart: revenueChartData,
      recentOrders: recentOrdersData,
      topProducts: topProductsData,
      stockAlerts: stockAlertsData,
      flashDeals: flashDealsData,
      customerAnalytics: customerAnalyticsData,
      paymentBreakdown: paymentBreakdownData,
      recentActivity: recentActivityData,
      monthlyGoal: monthlyGoalData,
      systemHealth: systemHealthData,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
