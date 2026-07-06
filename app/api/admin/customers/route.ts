// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function checkAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: "Forbidden", status: 403 };
  return { user };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = request.nextUrl;
  const section = searchParams.get("section") || "list";

  if (section === "kpis") {
    const { count: totalCustomers } = await safeQuery(
      async () => await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "customer"),
      { count: 0 } as any
    );

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: newToday } = await safeQuery(
      async () => await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "customer").gte("created_at", todayStart.toISOString()),
      { count: 0 } as any
    );

    const { data: allOrders } = await safeQuery(
      async () => await supabase.from("orders").select("id, user_id, total"),
      { data: null } as any
    );
    const orders = allOrders || [];

    const ordersByUser: Record<string, { count: number; total: number }> = {};
    let totalRevenue = 0;
    let totalOrderCount = orders.length;
    for (const o of orders) {
      totalRevenue += Number(o.total) || 0;
      if (!ordersByUser[o.user_id]) ordersByUser[o.user_id] = { count: 0, total: 0 };
      ordersByUser[o.user_id].count++;
      ordersByUser[o.user_id].total += Number(o.total) || 0;
    }

    const activeCustomers = Object.keys(ordersByUser).length;
    const avgLifetimeValue = activeCustomers > 0 ? totalRevenue / activeCustomers : 0;
    const avgOrderValue = totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0;

    const { data: pointsData } = await safeQuery(
      async () => await supabase.from("profiles").select("points").eq("role", "customer"),
      { data: null } as any
    );
    const totalRewardsPoints = (pointsData || []).reduce((sum, p) => sum + (Number(p.points) || 0), 0);

    const returningCustomers = Object.values(ordersByUser).filter(u => u.count > 1).length;

    let topCustomer = { name: "N/A", amount: 0 };
    if (Object.keys(ordersByUser).length > 0) {
      const topUserId = Object.entries(ordersByUser).sort((a, b) => b[1].total - a[1].total)[0][0];
      const { data: topProfile } = await safeQuery(
        async () => await supabase.from("profiles").select("full_name").eq("id", topUserId).single(),
        { data: null } as any
      );
      topCustomer = { name: topProfile?.full_name || "Unknown", amount: ordersByUser[topUserId].total };
    }

    return Response.json({
      totalCustomers: totalCustomers || 0,
      newToday: newToday || 0,
      activeCustomers,
      totalRevenue,
      avgLifetimeValue,
      avgOrderValue,
      totalRewardsPoints,
      totalOrders: totalOrderCount,
      returningCustomers,
      topCustomer,
    });
  }

  if (section === "list") {
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("per_page") || "20");

    const { data: customers } = await safeQuery(
      async () => await supabase.from("profiles").select("*").eq("role", "customer"),
      { data: null } as any
    );

    const { data: allOrders } = await safeQuery(
      async () => await supabase.from("orders").select("id, user_id, total, created_at"),
      { data: null } as any
    );
    const orders = allOrders || [];

    const ordersByUser: Record<string, { count: number; total: number; lastDate: string | null }> = {};
    for (const o of orders) {
      if (!ordersByUser[o.user_id]) ordersByUser[o.user_id] = { count: 0, total: 0, lastDate: null };
      ordersByUser[o.user_id].count++;
      ordersByUser[o.user_id].total += Number(o.total) || 0;
      if (!ordersByUser[o.user_id].lastDate || o.created_at > ordersByUser[o.user_id].lastDate) {
        ordersByUser[o.user_id].lastDate = o.created_at;
      }
    }

    let results = (customers || []).map(c => ({
      ...c,
      orderCount: ordersByUser[c.id]?.count || 0,
      totalSpent: ordersByUser[c.id]?.total || 0,
      lastOrderDate: ordersByUser[c.id]?.lastDate || null,
    }));

    if (search) {
      const s = search.toLowerCase();
      results = results.filter(c =>
        (c.full_name && c.full_name.toLowerCase().includes(s)) ||
        (c.email && c.email.toLowerCase().includes(s))
      );
    }

    if (status === "active") {
      results = results.filter(c => c.orderCount > 0);
    } else if (status === "inactive") {
      results = results.filter(c => c.orderCount === 0);
    }

    const ascending = order === "asc";
    results.sort((a, b) => {
      let av: any, bv: any;
      switch (sort) {
        case "full_name": av = a.full_name || ""; bv = b.full_name || ""; break;
        case "email": av = a.email || ""; bv = b.email || ""; break;
        case "total_spent": av = a.totalSpent; bv = b.totalSpent; break;
        case "orders_count": av = a.orderCount; bv = b.orderCount; break;
        default: av = a.created_at || ""; bv = b.created_at || "";
      }
      if (typeof av === "string") return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
      return ascending ? av - bv : bv - av;
    });

    const total = results.length;
    const totalPages = Math.ceil(total / perPage);
    const start = (page - 1) * perPage;
    const paginated = results.slice(start, start + perPage);

    return Response.json({
      customers: paginated,
      pagination: { page, perPage, total, totalPages },
    });
  }

  if (section === "detail") {
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    const { data: profile } = await safeQuery(
      async () => await supabase.from("profiles").select("*").eq("id", id).single(),
      { data: null } as any
    );
    if (!profile) return Response.json({ error: "Customer not found" }, { status: 404 });

    const { data: orders } = await safeQuery(
      async () => await supabase.from("orders").select("*, order_items(*, products(id, name, slug, images, price))").eq("user_id", id).order("created_at", { ascending: false }),
      { data: null } as any
    );

    const { data: reviews } = await safeQuery(
      async () => await supabase.from("reviews").select("*, products(id, name, slug)").eq("user_id", id).order("created_at", { ascending: false }),
      { data: null } as any
    );

    const orderList = orders || [];
    const totalSpent = orderList.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const orderCount = orderList.length;
    const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;
    const lastOrder = orderList[0]?.created_at || null;
    const firstOrder = orderList.length > 0 ? orderList[orderList.length - 1]?.created_at : null;

    return Response.json({
      profile,
      orders: orderList,
      reviews: reviews || [],
      stats: { totalSpent, orderCount, avgOrderValue, lastOrder, firstOrder },
      rewards: { points: profile.points || 0 },
    });
  }

  if (section === "export") {
    const { data: customers } = await safeQuery(
      async () => await supabase.from("profiles").select("*").eq("role", "customer"),
      { data: null } as any
    );

    const { data: allOrders } = await safeQuery(
      async () => await supabase.from("orders").select("id, user_id, total, created_at"),
      { data: null } as any
    );
    const orders = allOrders || [];

    const ordersByUser: Record<string, { count: number; total: number; lastDate: string | null }> = {};
    for (const o of orders) {
      if (!ordersByUser[o.user_id]) ordersByUser[o.user_id] = { count: 0, total: 0, lastDate: null };
      ordersByUser[o.user_id].count++;
      ordersByUser[o.user_id].total += Number(o.total) || 0;
      if (!ordersByUser[o.user_id].lastDate || o.created_at > ordersByUser[o.user_id].lastDate) {
        ordersByUser[o.user_id].lastDate = o.created_at;
      }
    }

    const results = (customers || []).map(c => ({
      ...c,
      orderCount: ordersByUser[c.id]?.count || 0,
      totalSpent: ordersByUser[c.id]?.total || 0,
      lastOrderDate: ordersByUser[c.id]?.lastDate || null,
      avgOrderValue: ordersByUser[c.id] ? ordersByUser[c.id].total / ordersByUser[c.id].count : 0,
    }));

    return Response.json({ customers: results });
  }

  return Response.json({ error: "Invalid section" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { email, full_name, points } = body;

  if (!email || !full_name) {
    return Response.json({ error: "email and full_name are required" }, { status: 400 });
  }

  const { data, error } = await supabase.from("profiles").insert({
    email,
    full_name,
    role: "customer",
    points: points || 0,
  }).select().single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ customer: data }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const allowedFields = ["full_name", "email", "avatar_url", "points", "role"];
  const filtered: Record<string, any> = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  if (Object.keys(filtered).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase.from("profiles").update(filtered).eq("id", id).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ customer: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "ids array is required" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").delete().in("id", ids).eq("role", "customer");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true, deleted: ids.length });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { ids, action } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "ids array is required" }, { status: 400 });
  }

  if (!action) {
    return Response.json({ error: "action is required" }, { status: 400 });
  }

  switch (action) {
    case "add_points": {
      for (const id of ids) {
        const { data: profile } = await safeQuery(
          async () => await supabase.from("profiles").select("points").eq("id", id).single(),
          { data: null } as any
        );
        if (profile) {
          await supabase.from("profiles").update({ points: (Number(profile.points) || 0) + 100 }).eq("id", id);
        }
      }
      return Response.json({ success: true, action: "add_points", count: ids.length });
    }
    case "reset_points": {
      const { error } = await supabase.from("profiles").update({ points: 0 }).in("id", ids);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true, action: "reset_points", count: ids.length });
    }
    case "delete": {
      const { error } = await supabase.from("profiles").delete().in("id", ids).eq("role", "customer");
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true, action: "delete", count: ids.length });
    }
    default:
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
