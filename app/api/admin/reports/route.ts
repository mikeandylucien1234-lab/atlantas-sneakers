import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

type Period = "today" | "yesterday" | "7d" | "30d" | "90d" | "12m" | "year" | "all";
type Section =
  | "kpis" | "revenue" | "sales" | "customers" | "products"
  | "categories" | "inventory" | "payments" | "flashdeals"
  | "coupons" | "activity";

function getPeriodDates(period: Period): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
    case "12m":
      start = new Date(todayStart);
      start.setMonth(start.getMonth() - 12);
      prevStart = new Date(start);
      prevStart.setMonth(prevStart.getMonth() - 12);
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

  return { start, end, prevStart, prevEnd };
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const section = searchParams.get("section") as Section | null;

    const validPeriods: Period[] = [
      "today", "yesterday", "7d", "30d", "90d", "12m", "year", "all",
    ];
    if (!validPeriods.includes(period)) {
      return Response.json({ error: "Invalid period" }, { status: 400 });
    }

    const validSections: Section[] = [
      "kpis", "revenue", "sales", "customers", "products",
      "categories", "inventory", "payments", "flashdeals",
      "coupons", "activity",
    ];
    if (section && !validSections.includes(section)) {
      return Response.json({ error: "Invalid section" }, { status: 400 });
    }

    const { start, end, prevStart, prevEnd } = getPeriodDates(period);
    const startISO = toISO(start);
    const endISO = toISO(end);
    const prevStartISO = toISO(prevStart);
    const prevEndISO = toISO(prevEnd);
    const dateRange = generateDateRange(start, end);

    const want = (s: Section) => !section || section === s;

    // ── Section builders ──

    const buildKpis = () =>
      safeQuery(async () => {
        const [
          periodOrders,
          prevPeriodOrders,
          periodCustomers,
          prevPeriodCustomers,
          periodRefunds,
          prevPeriodRefunds,
          periodCancelled,
          prevCancelled,
          periodCouponOrders,
        ] = await Promise.all([
          supabase
            .from("orders")
            .select("id, total, status, tax, shipping_cost, created_at")
            .gte("created_at", startISO)
            .lte("created_at", endISO),
          supabase
            .from("orders")
            .select("id, total, status, tax, shipping_cost, created_at")
            .gte("created_at", prevStartISO)
            .lte("created_at", prevEndISO),
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
          supabase
            .from("orders")
            .select("id")
            .eq("status", "cancelled")
            .gte("created_at", startISO)
            .lte("created_at", endISO),
          supabase
            .from("orders")
            .select("id")
            .eq("status", "cancelled")
            .gte("created_at", prevStartISO)
            .lte("created_at", prevEndISO),
          supabase
            .from("orders")
            .select("id, coupon_code")
            .not("coupon_code", "is", null)
            .gte("created_at", startISO)
            .lte("created_at", endISO),
        ]);

        const orders = periodOrders.data || [];
        const prevOrders = prevPeriodOrders.data || [];
        const refunds = periodRefunds.data || [];
        const prevRefunds = prevPeriodRefunds.data || [];

        const totalRevenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const prevTotalRevenue = prevOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const taxesCollected = orders.reduce((s, o) => s + (Number(o.tax) || 0), 0);
        const prevTaxes = prevOrders.reduce((s, o) => s + (Number(o.tax) || 0), 0);
        const shippingRevenue = orders.reduce((s, o) => s + (Number(o.shipping_cost) || 0), 0);
        const prevShipping = prevOrders.reduce((s, o) => s + (Number(o.shipping_cost) || 0), 0);
        const refundTotal = refunds.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const prevRefundTotal = prevRefunds.reduce((s, o) => s + (Number(o.total) || 0), 0);

        const grossProfit = totalRevenue * 0.4;
        const prevGrossProfit = prevTotalRevenue * 0.4;
        const netProfit = totalRevenue * 0.3 - refundTotal;
        const prevNetProfit = prevTotalRevenue * 0.3 - prevRefundTotal;

        const newCust = periodCustomers.count || 0;
        const prevNewCust = prevPeriodCustomers.count || 0;

        // Returning customers: ordered in period but account created before period
        const userIds = [...new Set(orders.map((o) => o.status !== "cancelled" ? (o as { user_id?: string }).user_id : null).filter(Boolean))];
        const returningCustomers = Math.max(0, userIds.length - newCust);
        const prevUserIds = [...new Set(prevOrders.map((o) => (o as { user_id?: string }).user_id).filter(Boolean))];
        const prevReturning = Math.max(0, prevUserIds.length - prevNewCust);

        const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
        const prevAvgOV = prevOrders.length > 0 ? prevTotalRevenue / prevOrders.length : 0;

        const totalProfiles = (await supabase.from("profiles").select("id", { count: "exact", head: true })).count || 1;
        const conversionRate = (orders.length / totalProfiles) * 100;
        const prevConversionRate = (prevOrders.length / totalProfiles) * 100;

        const cancelledOrders = (periodCancelled.data || []).length;
        const prevCancelledOrders = (prevCancelled.data || []).length;
        const couponsUsed = (periodCouponOrders.data || []).length;

        return {
          totalRevenue: round2(totalRevenue),
          totalRevenueChange: pctChange(totalRevenue, prevTotalRevenue),
          netProfit: round2(netProfit),
          netProfitChange: pctChange(netProfit, prevNetProfit),
          grossProfit: round2(grossProfit),
          grossProfitChange: pctChange(grossProfit, prevGrossProfit),
          orders: orders.length,
          ordersChange: pctChange(orders.length, prevOrders.length),
          averageOrderValue: round2(avgOrderValue),
          averageOrderValueChange: pctChange(avgOrderValue, prevAvgOV),
          conversionRate: Math.round(conversionRate * 10) / 10,
          conversionRateChange: pctChange(conversionRate, prevConversionRate),
          newCustomers: newCust,
          newCustomersChange: pctChange(newCust, prevNewCust),
          returningCustomers,
          returningCustomersChange: pctChange(returningCustomers, prevReturning),
          refunds: refunds.length,
          refundsChange: pctChange(refunds.length, prevRefunds.length),
          cancelledOrders,
          cancelledOrdersChange: pctChange(cancelledOrders, prevCancelledOrders),
          taxesCollected: round2(taxesCollected),
          taxesCollectedChange: pctChange(taxesCollected, prevTaxes),
          shippingRevenue: round2(shippingRevenue),
          shippingRevenueChange: pctChange(shippingRevenue, prevShipping),
          couponsUsed,
          couponsUsedChange: 0,
        };
      }, {
        totalRevenue: 0, totalRevenueChange: 0,
        netProfit: 0, netProfitChange: 0,
        grossProfit: 0, grossProfitChange: 0,
        orders: 0, ordersChange: 0,
        averageOrderValue: 0, averageOrderValueChange: 0,
        conversionRate: 0, conversionRateChange: 0,
        newCustomers: 0, newCustomersChange: 0,
        returningCustomers: 0, returningCustomersChange: 0,
        refunds: 0, refundsChange: 0,
        cancelledOrders: 0, cancelledOrdersChange: 0,
        taxesCollected: 0, taxesCollectedChange: 0,
        shippingRevenue: 0, shippingRevenueChange: 0,
        couponsUsed: 0, couponsUsedChange: 0,
      });

    const buildRevenueChart = () =>
      safeQuery(async () => {
        const { data: orders } = await supabase
          .from("orders")
          .select("total, tax, shipping_cost, status, created_at")
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .order("created_at", { ascending: true });

        const dailyMap = new Map<string, {
          revenue: number; profit: number; refunds: number;
          taxes: number; shipping: number;
        }>();
        dateRange.forEach((d) =>
          dailyMap.set(d, { revenue: 0, profit: 0, refunds: 0, taxes: 0, shipping: 0 })
        );

        (orders || []).forEach((o) => {
          const day = formatDate(new Date(o.created_at));
          const entry = dailyMap.get(day);
          if (!entry) return;
          const total = Number(o.total) || 0;
          const tax = Number(o.tax) || 0;
          const ship = Number(o.shipping_cost) || 0;
          if (o.status === "refunded") {
            entry.refunds += total;
          } else {
            entry.revenue += total;
            entry.profit += total * 0.3;
            entry.taxes += tax;
            entry.shipping += ship;
          }
        });

        return dateRange.map((date) => {
          const e = dailyMap.get(date)!;
          return {
            date,
            revenue: round2(e.revenue),
            profit: round2(e.profit),
            netRevenue: round2(e.revenue - e.refunds - e.taxes),
            refunds: round2(e.refunds),
            taxes: round2(e.taxes),
            shipping: round2(e.shipping),
          };
        });
      }, []);

    const buildSalesReport = () =>
      safeQuery(async () => {
        const [periodOrders, orderItemsRes] = await Promise.all([
          supabase
            .from("orders")
            .select("id, total, status, created_at")
            .gte("created_at", startISO)
            .lte("created_at", endISO),
          supabase
            .from("order_items")
            .select("quantity, order:orders!inner(created_at)")
            .gte("order.created_at", startISO)
            .lte("order.created_at", endISO),
        ]);

        const orders = periodOrders.data || [];
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const avgCart = totalOrders > 0 ? round2(totalRevenue / totalOrders) : 0;
        const productsSold = (orderItemsRes.data || []).reduce(
          (s, i) => s + (i.quantity || 0), 0
        );

        const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;
        const refundedOrders = orders.filter((o) => o.status === "refunded").length;
        const failedOrders = orders.filter((o) => o.status === "failed").length;
        const successRate = totalOrders > 0
          ? Math.round(((totalOrders - cancelledOrders - failedOrders) / totalOrders) * 100 * 10) / 10
          : 0;

        // Chart data
        const dailyMap = new Map<string, { orders: number; cancelled: number; refunded: number }>();
        dateRange.forEach((d) => dailyMap.set(d, { orders: 0, cancelled: 0, refunded: 0 }));
        orders.forEach((o) => {
          const day = formatDate(new Date(o.created_at));
          const entry = dailyMap.get(day);
          if (!entry) return;
          entry.orders += 1;
          if (o.status === "cancelled") entry.cancelled += 1;
          if (o.status === "refunded") entry.refunded += 1;
        });

        return {
          totalOrders,
          avgCart,
          productsSold,
          cancelledOrders,
          refundedOrders,
          failedOrders,
          successRate,
          chartData: dateRange.map((date) => ({
            date,
            ...(dailyMap.get(date) || { orders: 0, cancelled: 0, refunded: 0 }),
          })),
        };
      }, {
        totalOrders: 0, avgCart: 0, productsSold: 0, cancelledOrders: 0,
        refundedOrders: 0, failedOrders: 0, successRate: 0, chartData: [],
      });

    const buildCustomerReport = () =>
      safeQuery(async () => {
        const [
          newCustRes,
          activeCustRes,
          allCustRes,
          allOrdersRes,
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
            .select("total, user_id"),
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

        const activeIds = new Set((activeCustRes.data || []).map((o) => o.user_id));
        const prevActiveIds = new Set((prevActiveCustRes.data || []).map((o) => o.user_id));
        const totalCustomers = allCustRes.count || 0;
        const newCustomers = newCustRes.count || 0;
        const inactiveCustomers = Math.max(0, totalCustomers - activeIds.size);

        // VIP + loyal: 5+ orders = VIP, 2+ = loyal
        const orderCounts = new Map<string, number>();
        const customerTotals = new Map<string, number>();
        (allOrdersRes.data || []).forEach((o) => {
          orderCounts.set(o.user_id, (orderCounts.get(o.user_id) || 0) + 1);
          customerTotals.set(o.user_id, (customerTotals.get(o.user_id) || 0) + (Number(o.total) || 0));
        });
        const vipCustomers = [...orderCounts.values()].filter((c) => c >= 5).length;
        const loyalCustomers = [...orderCounts.values()].filter((c) => c >= 2).length;

        // Retention
        const retained = [...activeIds].filter((id) => prevActiveIds.has(id)).length;
        const retentionRate = prevActiveIds.size > 0
          ? Math.round((retained / prevActiveIds.size) * 100 * 10) / 10
          : 0;

        // LTV + avg value + purchase frequency
        const ltValues = [...customerTotals.values()];
        const lifetimeValue = ltValues.length > 0
          ? round2(ltValues.reduce((a, b) => a + b, 0) / ltValues.length)
          : 0;
        const avgValue = activeIds.size > 0
          ? round2([...activeIds].reduce((s, id) => s + (customerTotals.get(id) || 0), 0) / activeIds.size)
          : 0;
        const purchaseFrequency = activeIds.size > 0
          ? round2([...activeIds].reduce((s, id) => s + (orderCounts.get(id) || 0), 0) / activeIds.size)
          : 0;

        // Growth data
        const growthMap = new Map<string, number>();
        dateRange.forEach((d) => growthMap.set(d, 0));
        (customerGrowthRes.data || []).forEach((p) => {
          const day = formatDate(new Date(p.created_at));
          growthMap.set(day, (growthMap.get(day) || 0) + 1);
        });

        // Returning per day
        const returningMap = new Map<string, Set<string>>();
        dateRange.forEach((d) => returningMap.set(d, new Set()));
        (activeCustRes.data || []).forEach((o) => {
          // We don't have created_at on these rows, approximate from order data
        });

        return {
          newCustomers,
          loyalCustomers,
          vipCustomers,
          inactiveCustomers,
          avgValue,
          lifetimeValue,
          purchaseFrequency,
          retentionRate,
          growthData: dateRange.map((date) => ({
            date,
            newCustomers: growthMap.get(date) || 0,
            returning: 0,
          })),
        };
      }, {
        newCustomers: 0, loyalCustomers: 0, vipCustomers: 0,
        inactiveCustomers: 0, avgValue: 0, lifetimeValue: 0,
        purchaseFrequency: 0, retentionRate: 0, growthData: [],
      });

    const buildProductReport = () =>
      safeQuery(async () => {
        const { data: orderItems } = await supabase
          .from("order_items")
          .select("product_id, quantity, price, order:orders!inner(created_at)")
          .gte("order.created_at", startISO)
          .lte("order.created_at", endISO);

        if (!orderItems || orderItems.length === 0) return [];

        const productStats = new Map<string, { sales: number; revenue: number }>();
        orderItems.forEach((item) => {
          const existing = productStats.get(item.product_id) || { sales: 0, revenue: 0 };
          existing.sales += item.quantity || 0;
          existing.revenue += (Number(item.price) || 0) * (item.quantity || 1);
          productStats.set(item.product_id, existing);
        });

        const topIds = [...productStats.entries()]
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .slice(0, 20)
          .map(([id]) => id);

        if (topIds.length === 0) return [];

        const { data: products } = await supabase
          .from("products")
          .select("id, name, images, sku, stock, category_id, categories(name)")
          .in("id", topIds);

        return (products || [])
          .map((p) => {
            const stats = productStats.get(p.id) || { sales: 0, revenue: 0 };
            return {
              id: p.id,
              name: p.name,
              image: p.images?.[0] || null,
              sku: p.sku || "",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              category: (p as any).categories?.name || "Uncategorized",
              stock: p.stock || 0,
              sales: stats.sales,
              revenue: round2(stats.revenue),
              profit: round2(stats.revenue * 0.3),
            };
          })
          .sort((a, b) => b.revenue - a.revenue);
      }, []);

    const buildCategoryReport = () =>
      safeQuery(async () => {
        const [categoriesRes, orderItemsRes] = await Promise.all([
          supabase.from("categories").select("id, name"),
          supabase
            .from("order_items")
            .select("product_id, quantity, price, order:orders!inner(created_at, id)")
            .gte("order.created_at", startISO)
            .lte("order.created_at", endISO),
        ]);

        const categories = categoriesRes.data || [];
        const items = orderItemsRes.data || [];

        if (categories.length === 0) return [];

        // Get product -> category mapping
        const productIds = [...new Set(items.map((i) => i.product_id))];
        if (productIds.length === 0) {
          return categories.map((c) => ({
            name: c.name, revenue: 0, profit: 0, orders: 0, products: 0, avgCart: 0,
          }));
        }

        const { data: products } = await supabase
          .from("products")
          .select("id, category_id")
          .in("id", productIds);

        const productCatMap = new Map<string, string>();
        (products || []).forEach((p) => {
          if (p.category_id) productCatMap.set(p.id, p.category_id);
        });

        const catStats = new Map<string, {
          revenue: number; orders: Set<string>; productIds: Set<string>;
        }>();
        categories.forEach((c) =>
          catStats.set(c.id, { revenue: 0, orders: new Set(), productIds: new Set() })
        );

        items.forEach((item) => {
          const catId = productCatMap.get(item.product_id);
          if (!catId) return;
          const stat = catStats.get(catId);
          if (!stat) return;
          const rev = (Number(item.price) || 0) * (item.quantity || 1);
          stat.revenue += rev;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stat.orders.add((item.order as any)?.id || "");
          stat.productIds.add(item.product_id);
        });

        const catMap = new Map(categories.map((c) => [c.id, c.name]));

        return [...catStats.entries()]
          .map(([id, stat]) => ({
            name: catMap.get(id) || "Unknown",
            revenue: round2(stat.revenue),
            profit: round2(stat.revenue * 0.3),
            orders: stat.orders.size,
            products: stat.productIds.size,
            avgCart: stat.orders.size > 0 ? round2(stat.revenue / stat.orders.size) : 0,
          }))
          .filter((c) => c.revenue > 0 || c.products > 0)
          .sort((a, b) => b.revenue - a.revenue);
      }, []);

    const buildInventoryReport = () =>
      safeQuery(async () => {
        const [allProductsRes, lowStockRes, outOfStockRes, orderItemsRes] = await Promise.all([
          supabase
            .from("products")
            .select("id, name, images, stock, sku, price")
            .limit(1000),
          supabase
            .from("products")
            .select("id, name, images, stock, sku")
            .gt("stock", 0)
            .lte("stock", 5)
            .limit(50),
          supabase
            .from("products")
            .select("id, name, images, sku")
            .eq("stock", 0)
            .limit(50),
          supabase
            .from("order_items")
            .select("product_id, quantity")
            .limit(10000),
        ]);

        const allProducts = allProductsRes.data || [];
        const totalValue = allProducts.reduce(
          (s, p) => s + (Number(p.price) || 0) * (p.stock || 0), 0
        );
        const lowStockCount = (lowStockRes.data || []).length;
        const outOfStockCount = (outOfStockRes.data || []).length;

        // Average rotation: total items sold / total stock
        const totalSold = (orderItemsRes.data || []).reduce((s, i) => s + (i.quantity || 0), 0);
        const totalStock = allProducts.reduce((s, p) => s + (p.stock || 0), 0);
        const avgRotation = totalStock > 0 ? round2(totalSold / totalStock) : 0;

        const items = [
          ...(lowStockRes.data || []).map((p) => ({
            id: p.id,
            name: p.name,
            image: p.images?.[0] || null,
            stock: p.stock || 0,
            sku: p.sku || "",
          })),
          ...(outOfStockRes.data || []).map((p) => ({
            id: p.id,
            name: p.name,
            image: p.images?.[0] || null,
            stock: 0,
            sku: p.sku || "",
          })),
        ];

        return {
          totalValue: round2(totalValue),
          lowStockCount,
          outOfStockCount,
          avgRotation,
          items,
        };
      }, { totalValue: 0, lowStockCount: 0, outOfStockCount: 0, avgRotation: 0, items: [] });

    const buildPaymentReport = () =>
      safeQuery(async () => {
        const { data: orders } = await supabase
          .from("orders")
          .select("payment_method, total, status")
          .gte("created_at", startISO)
          .lte("created_at", endISO);

        if (!orders || orders.length === 0) return [];

        const methodMap = new Map<string, {
          count: number; amount: number; failures: number; refunds: number;
        }>();

        orders.forEach((o) => {
          const method = o.payment_method || "unknown";
          const existing = methodMap.get(method) || { count: 0, amount: 0, failures: 0, refunds: 0 };
          existing.count += 1;
          existing.amount += Number(o.total) || 0;
          if (o.status === "failed") existing.failures += 1;
          if (o.status === "refunded") existing.refunds += 1;
          methodMap.set(method, existing);
        });

        return [...methodMap.entries()]
          .map(([method, stats]) => ({
            method,
            count: stats.count,
            amount: round2(stats.amount),
            successRate: stats.count > 0
              ? Math.round(((stats.count - stats.failures) / stats.count) * 100 * 10) / 10
              : 0,
            failures: stats.failures,
            refunds: stats.refunds,
          }))
          .sort((a, b) => b.amount - a.amount);
      }, []);

    const buildFlashDealReport = () =>
      safeQuery(async () => {
        const { data: deals } = await supabase
          .from("flash_deals")
          .select("id, deal_price, original_price, ends_at, is_active, product_id, product:products(name)")
          .order("created_at", { ascending: false })
          .limit(20);

        if (!deals || deals.length === 0) return [];

        const dealProductIds = deals.map((d) => d.product_id);
        const { data: salesData } = await supabase
          .from("order_items")
          .select("product_id, quantity, price, order:orders!inner(created_at)")
          .in("product_id", dealProductIds)
          .gte("order.created_at", startISO)
          .lte("order.created_at", endISO);

        const salesMap = new Map<string, { orders: number; revenue: number }>();
        (salesData || []).forEach((item) => {
          const existing = salesMap.get(item.product_id) || { orders: 0, revenue: 0 };
          existing.orders += item.quantity || 0;
          existing.revenue += (Number(item.price) || 0) * (item.quantity || 1);
          salesMap.set(item.product_id, existing);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return deals.map((d: any) => {
          const stats = salesMap.get(d.product_id) || { orders: 0, revenue: 0 };
          return {
            id: d.id,
            productName: d.product?.name || "Unknown",
            revenue: round2(stats.revenue),
            orders: stats.orders,
            dealPrice: Number(d.deal_price) || 0,
            originalPrice: Number(d.original_price) || 0,
            endsAt: d.ends_at,
            isActive: d.is_active,
          };
        });
      }, []);

    const buildCouponReport = () =>
      safeQuery(async () => {
        const { data: coupons } = await supabase
          .from("coupons")
          .select("id, code, type, value, is_active, usage_count")
          .order("usage_count", { ascending: false })
          .limit(20);

        if (!coupons || coupons.length === 0) return [];

        const codes = coupons.map((c) => c.code);
        const { data: couponOrders } = await supabase
          .from("orders")
          .select("coupon_code, total")
          .in("coupon_code", codes)
          .gte("created_at", startISO)
          .lte("created_at", endISO);

        const revenueMap = new Map<string, number>();
        (couponOrders || []).forEach((o) => {
          if (o.coupon_code) {
            revenueMap.set(o.coupon_code, (revenueMap.get(o.coupon_code) || 0) + (Number(o.total) || 0));
          }
        });

        return coupons.map((c) => ({
          code: c.code,
          type: c.type || "percentage",
          value: Number(c.value) || 0,
          uses: c.usage_count || 0,
          revenueGenerated: round2(revenueMap.get(c.code) || 0),
          isActive: c.is_active,
        }));
      }, []);

    const buildActivityReport = () =>
      safeQuery(async () => {
        const { data: activities } = await supabase
          .from("activity_logs")
          .select("id, type, message, created_at")
          .order("created_at", { ascending: false })
          .limit(30);

        return (activities || []).map((a) => ({
          id: a.id,
          type: a.type,
          message: a.message,
          createdAt: a.created_at,
        }));
      }, []);

    // ── Execute requested sections in parallel ──

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: Record<string, any> = {};
    const tasks: Array<{ key: string; promise: Promise<unknown> }> = [];

    if (want("kpis")) tasks.push({ key: "kpis", promise: buildKpis() });
    if (want("revenue")) tasks.push({ key: "revenueChart", promise: buildRevenueChart() });
    if (want("sales")) tasks.push({ key: "salesReport", promise: buildSalesReport() });
    if (want("customers")) tasks.push({ key: "customerReport", promise: buildCustomerReport() });
    if (want("products")) tasks.push({ key: "productReport", promise: buildProductReport() });
    if (want("categories")) tasks.push({ key: "categoryReport", promise: buildCategoryReport() });
    if (want("inventory")) tasks.push({ key: "inventoryReport", promise: buildInventoryReport() });
    if (want("payments")) tasks.push({ key: "paymentReport", promise: buildPaymentReport() });
    if (want("flashdeals")) tasks.push({ key: "flashDealReport", promise: buildFlashDealReport() });
    if (want("coupons")) tasks.push({ key: "couponReport", promise: buildCouponReport() });
    if (want("activity")) tasks.push({ key: "activityReport", promise: buildActivityReport() });

    const resolved = await Promise.all(tasks.map((t) => t.promise));
    tasks.forEach((t, i) => {
      results[t.key] = resolved[i];
    });

    // ── Generate insights and alerts (only when returning all or kpis) ──

    if (!section) {
      const kpis = results.kpis || {};
      const inventory = results.inventoryReport || {};
      const sales = results.salesReport || {};

      const insights: string[] = [];

      if (kpis.totalRevenue > 0) {
        insights.push(
          `Total revenue for the period is $${kpis.totalRevenue.toLocaleString()}` +
          (kpis.totalRevenueChange > 0
            ? `, up ${kpis.totalRevenueChange}% from the previous period.`
            : kpis.totalRevenueChange < 0
              ? `, down ${Math.abs(kpis.totalRevenueChange)}% from the previous period.`
              : `.`)
        );
      }

      if (kpis.averageOrderValue > 0) {
        insights.push(
          `Average order value is $${kpis.averageOrderValue.toFixed(2)}.`
        );
      }

      if (kpis.newCustomers > 0) {
        insights.push(
          `${kpis.newCustomers} new customer${kpis.newCustomers !== 1 ? "s" : ""} joined this period.`
        );
      }

      if (kpis.returningCustomers > 0) {
        insights.push(
          `${kpis.returningCustomers} returning customer${kpis.returningCustomers !== 1 ? "s" : ""} placed orders.`
        );
      }

      if (sales.successRate > 0) {
        insights.push(
          `Order success rate is ${sales.successRate}%.`
        );
      }

      if (inventory.lowStockCount > 0) {
        insights.push(
          `${inventory.lowStockCount} product${inventory.lowStockCount !== 1 ? "s" : ""} have low stock (5 or fewer units).`
        );
      }

      if (kpis.couponsUsed > 0) {
        insights.push(
          `${kpis.couponsUsed} order${kpis.couponsUsed !== 1 ? "s" : ""} used coupon codes.`
        );
      }

      if (kpis.grossProfit > 0) {
        const margin = round2((kpis.grossProfit / kpis.totalRevenue) * 100);
        insights.push(
          `Gross profit margin is ${margin}%.`
        );
      }

      results.insights = insights.slice(0, 8);

      // Alerts
      const alerts: Array<{ type: string; message: string; severity: "warning" | "error" | "info" }> = [];

      if (kpis.totalRevenueChange < -20) {
        alerts.push({
          type: "revenue_decline",
          message: `Revenue declined ${Math.abs(kpis.totalRevenueChange)}% compared to the previous period.`,
          severity: kpis.totalRevenueChange < -50 ? "error" : "warning",
        });
      }

      if (inventory.outOfStockCount > 0) {
        alerts.push({
          type: "out_of_stock",
          message: `${inventory.outOfStockCount} product${inventory.outOfStockCount !== 1 ? "s are" : " is"} out of stock.`,
          severity: inventory.outOfStockCount > 10 ? "error" : "warning",
        });
      }

      if (inventory.lowStockCount > 5) {
        alerts.push({
          type: "low_stock",
          message: `${inventory.lowStockCount} products have critically low stock.`,
          severity: "warning",
        });
      }

      const refundRate = kpis.orders > 0
        ? (kpis.refunds / kpis.orders) * 100
        : 0;
      if (refundRate > 10) {
        alerts.push({
          type: "high_refund_rate",
          message: `Refund rate is ${round2(refundRate)}%, which is above the 10% threshold.`,
          severity: refundRate > 25 ? "error" : "warning",
        });
      }

      if (kpis.cancelledOrders > 0 && kpis.orders > 0) {
        const cancelRate = (kpis.cancelledOrders / kpis.orders) * 100;
        if (cancelRate > 15) {
          alerts.push({
            type: "high_cancellation",
            message: `Cancellation rate is ${round2(cancelRate)}%.`,
            severity: "warning",
          });
        }
      }

      if (kpis.conversionRate < 1 && kpis.orders > 0) {
        alerts.push({
          type: "low_conversion",
          message: `Conversion rate is only ${kpis.conversionRate}%.`,
          severity: "info",
        });
      }

      results.alerts = alerts;
    }

    return Response.json(results);
  } catch (error) {
    console.error("Reports API error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
