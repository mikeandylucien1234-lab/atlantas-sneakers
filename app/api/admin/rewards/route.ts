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
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = request.nextUrl;
  const section = searchParams.get("section") || "list";

  if (section === "kpis") {
    const { data: profiles } = await safeQuery(async () => await supabase.from("profiles").select("id, points, role, created_at"), { data: null } as any);
    const rows = profiles || [];
    const totalMembers = rows.length;
    const totalPoints = rows.reduce((s, r) => s + (r.points || 0), 0);
    const avgPoints = totalMembers > 0 ? Math.round(totalPoints / totalMembers) : 0;
    const vipMembers = rows.filter(r => (r.points || 0) >= 500).length;

    const { data: coupons } = await safeQuery(async () => await supabase.from("coupons").select("id, is_active, used_count, created_at"), { data: null } as any);
    const couponRows = coupons || [];
    const couponsGenerated = couponRows.length;
    const couponsUsed = couponRows.filter(c => (c.used_count || 0) > 0).length;

    const { data: rewardLogs } = await safeQuery(async () => await supabase.from("reward_logs").select("id, type, points, created_at, status"), { data: null } as any);
    const logs = rewardLogs || [];
    const today = new Date().toISOString().slice(0, 10);
    const earnedToday = logs.filter(l => l.type === "earn" && l.created_at?.startsWith(today)).reduce((s, l) => s + (l.points || 0), 0);
    const redeemedToday = logs.filter(l => l.type === "redeem" && l.created_at?.startsWith(today)).reduce((s, l) => s + Math.abs(l.points || 0), 0);
    const pendingRewards = logs.filter(l => l.status === "pending").length;
    const expiredRewards = logs.filter(l => l.status === "expired").length;
    const referralRewards = logs.filter(l => l.type === "referral").length;
    const totalEarned = logs.filter(l => l.type === "earn").reduce((s, l) => s + (l.points || 0), 0);
    const totalRedeemed = logs.filter(l => l.type === "redeem").reduce((s, l) => s + Math.abs(l.points || 0), 0);
    const conversionRate = totalEarned > 0 ? Math.round((totalRedeemed / totalEarned) * 100) : 0;

    return Response.json({
      totalPoints, earnedToday, redeemedToday, totalMembers, vipMembers,
      couponsGenerated, couponsUsed, referralRewards, avgPoints, conversionRate,
      pendingRewards, expiredRewards,
    });
  }

  if (section === "list") {
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const vipLevel = searchParams.get("vipLevel") || "";
    const sortBy = searchParams.get("sortBy") || "points";
    const sortDir = searchParams.get("sortDir") || "desc";
    const offset = (page - 1) * limit;

    let query = supabase.from("profiles").select("id, full_name, email, avatar_url, points, role, created_at", { count: "exact" });
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    query = query.order(sortBy === "points" ? "points" : "created_at", { ascending: sortDir === "asc" });
    query = query.range(offset, offset + limit - 1);

    const { data, count } = await safeQuery(async () => await query, { data: null, count: 0 } as any);
    const rows = data || [];

    const enriched = rows.map(r => {
      const pts = r.points || 0;
      let vip = "Bronze";
      if (pts >= 5000) vip = "Diamond";
      else if (pts >= 2000) vip = "Platinum";
      else if (pts >= 1000) vip = "Gold";
      else if (pts >= 500) vip = "Silver";
      return { ...r, vip_level: vip, balance: pts };
    });

    if (vipLevel) {
      const filtered = enriched.filter(r => r.vip_level === vipLevel);
      return Response.json({ rows: filtered, total: filtered.length, page, limit });
    }

    return Response.json({ rows: enriched, total: count || 0, page, limit });
  }

  if (section === "detail") {
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    const { data: profile } = await safeQuery(async () => await supabase.from("profiles").select("*").eq("id", id).single(), { data: null } as any);
    if (!profile) return Response.json({ error: "Not found" }, { status: 404 });

    const { data: orders } = await safeQuery(async () => await supabase.from("orders").select("id, order_number, total, status, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(20), { data: null } as any);
    const { data: reviews } = await safeQuery(async () => await supabase.from("reviews").select("id, rating, title, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(20), { data: null } as any);
    const { data: logs } = await safeQuery(async () => await supabase.from("reward_logs").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50), { data: null } as any);
    const { data: userCoupons } = await safeQuery(async () => await supabase.from("coupons").select("*").eq("user_id", id).order("created_at", { ascending: false }), { data: null } as any);
    const { data: referrals } = await safeQuery(async () => await supabase.from("referrals").select("*").eq("referrer_id", id).order("created_at", { ascending: false }), { data: null } as any);

    const orderRows = orders || [];
    const totalSpent = orderRows.reduce((s, o) => s + (o.total || 0), 0);
    const totalEarned = (logs || []).filter(l => l.type === "earn").reduce((s, l) => s + (l.points || 0), 0);
    const totalRedeemed = (logs || []).filter(l => l.type === "redeem").reduce((s, l) => s + Math.abs(l.points || 0), 0);

    const pts = profile.points || 0;
    let vip = "Bronze";
    if (pts >= 5000) vip = "Diamond";
    else if (pts >= 2000) vip = "Platinum";
    else if (pts >= 1000) vip = "Gold";
    else if (pts >= 500) vip = "Silver";

    return Response.json({
      ...profile, vip_level: vip, total_spent: totalSpent,
      lifetime_points: totalEarned, redeemed_points: totalRedeemed,
      orders: orderRows, reviews: reviews || [], logs: logs || [],
      coupons: userCoupons || [], referrals: referrals || [],
    });
  }

  if (section === "export") {
    const { data } = await safeQuery(async () => await supabase.from("profiles").select("id, full_name, email, points, role, created_at").order("points", { ascending: false }), { data: null } as any);
    return Response.json({ rows: data || [] });
  }

  return Response.json({ error: "Unknown section" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { action } = body;

  if (action === "add_points" || action === "remove_points") {
    const { user_id, points, reason } = body;
    if (!user_id || !points || !reason) return Response.json({ error: "Missing fields" }, { status: 400 });

    const { data: profile } = await supabase.from("profiles").select("points").eq("id", user_id).single();
    if (!profile) return Response.json({ error: "User not found" }, { status: 404 });

    const delta = action === "add_points" ? Math.abs(points) : -Math.abs(points);
    const newBalance = Math.max(0, (profile.points || 0) + delta);

    await supabase.from("profiles").update({ points: newBalance }).eq("id", user_id);
    await safeQuery(async () => await supabase.from("reward_logs").insert({
      user_id, type: action === "add_points" ? "earn" : "redeem",
      points: delta, reason, balance_after: newBalance, admin_id: auth.user.id,
    }), null);

    return Response.json({ success: true, new_balance: newBalance });
  }

  if (action === "create_coupon") {
    const { code, type, value, min_order, expires_at, max_uses, user_id } = body;
    if (!code || !type || !value) return Response.json({ error: "Missing fields" }, { status: 400 });

    const { data, error } = await safeQuery(async () => await supabase.from("coupons").insert({
      code: code.toUpperCase(), type, value, min_order: min_order || 0,
      expires_at: expires_at || null, max_uses: max_uses || 1,
      is_active: true, used_count: 0, user_id: user_id || null,
    }).select().single(), { data: null, error: "Failed" } as any);

    if (error && !data) return Response.json({ error: "Failed to create coupon" }, { status: 500 });
    return Response.json({ success: true, coupon: data });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { user_id, points } = body;
  if (!user_id) return Response.json({ error: "Missing user_id" }, { status: 400 });

  if (typeof points === "number") {
    await supabase.from("profiles").update({ points: Math.max(0, points) }).eq("id", user_id);
    return Response.json({ success: true });
  }

  return Response.json({ error: "Nothing to update" }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { action, ids } = body;
  if (!ids?.length) return Response.json({ error: "No ids" }, { status: 400 });

  if (action === "add_points") {
    const { points, reason } = body;
    for (const id of ids) {
      const { data: p } = await supabase.from("profiles").select("points").eq("id", id).single();
      if (!p) continue;
      const nb = (p.points || 0) + Math.abs(points || 0);
      await supabase.from("profiles").update({ points: nb }).eq("id", id);
      await safeQuery(async () => await supabase.from("reward_logs").insert({
        user_id: id, type: "earn", points: Math.abs(points || 0),
        reason: reason || "Bulk add", balance_after: nb, admin_id: auth.user.id,
      }), null);
    }
    return Response.json({ success: true });
  }

  if (action === "remove_points") {
    const { points, reason } = body;
    for (const id of ids) {
      const { data: p } = await supabase.from("profiles").select("points").eq("id", id).single();
      if (!p) continue;
      const nb = Math.max(0, (p.points || 0) - Math.abs(points || 0));
      await supabase.from("profiles").update({ points: nb }).eq("id", id);
      await safeQuery(async () => await supabase.from("reward_logs").insert({
        user_id: id, type: "redeem", points: -Math.abs(points || 0),
        reason: reason || "Bulk remove", balance_after: nb, admin_id: auth.user.id,
      }), null);
    }
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  await supabase.from("profiles").update({ points: 0 }).eq("id", id);
  await safeQuery(async () => await supabase.from("reward_logs").insert({
    user_id: id, type: "redeem", points: 0, reason: "Admin reset",
    balance_after: 0, admin_id: auth.user.id,
  }), null);

  return Response.json({ success: true });
}
