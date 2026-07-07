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
    const { data: allCoupons } = await safeQuery(async () => await supabase.from("coupons").select("*"), { data: null } as any);
    const rows = allCoupons || [];
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const active = rows.filter(c => c.is_active && (!c.expires_at || new Date(c.expires_at) > now));
    const expired = rows.filter(c => c.expires_at && new Date(c.expires_at) <= now);
    const scheduled = rows.filter(c => c.starts_at && new Date(c.starts_at) > now);
    const disabled = rows.filter(c => !c.is_active);
    const unused = rows.filter(c => (c.used_count || 0) === 0);
    const totalDiscount = rows.reduce((s, c) => s + (c.total_discount_given || 0), 0);
    const totalUsed = rows.reduce((s, c) => s + (c.used_count || 0), 0);

    const { data: usageLogs } = await safeQuery(async () => await supabase.from("coupon_usage").select("id, created_at, discount_amount"), { data: null } as any);
    const logs = usageLogs || [];
    const usedToday = logs.filter(l => l.created_at?.startsWith(today)).length;
    const usedMonth = logs.filter(l => l.created_at >= monthStart).length;

    const codeUsage: Record<string, number> = {};
    rows.forEach(c => { codeUsage[c.code] = c.used_count || 0; });
    const mostUsed = Object.entries(codeUsage).sort((a, b) => b[1] - a[1])[0];

    const conversionRate = rows.length > 0 ? Math.round((rows.filter(c => (c.used_count || 0) > 0).length / rows.length) * 100) : 0;

    return Response.json({
      totalCoupons: rows.length, activeCoupons: active.length, expiredCoupons: expired.length,
      scheduledCoupons: scheduled.length, usedToday, usedMonth, totalDiscount,
      conversionRate, avgOrderIncrease: 0, mostUsedCoupon: mostUsed ? mostUsed[0] : "—",
      unusedCoupons: unused.length, disabledCoupons: disabled.length,
    });
  }

  if (section === "list") {
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortDir = searchParams.get("sortDir") || "desc";
    const offset = (page - 1) * limit;

    let query = supabase.from("coupons").select("*", { count: "exact" });
    if (search) query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%,campaign.ilike.%${search}%`);
    if (type) query = query.eq("type", type);

    const now = new Date().toISOString();
    if (status === "active") { query = query.eq("is_active", true).or(`expires_at.is.null,expires_at.gt.${now}`); }
    else if (status === "expired") { query = query.lte("expires_at", now); }
    else if (status === "disabled") { query = query.eq("is_active", false); }
    else if (status === "scheduled") { query = query.gt("starts_at", now); }

    query = query.order(sortBy, { ascending: sortDir === "asc" });
    query = query.range(offset, offset + limit - 1);

    const { data, count } = await safeQuery(async () => await query, { data: null, count: 0 } as any);
    return Response.json({ rows: data || [], total: count || 0, page, limit });
  }

  if (section === "detail") {
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    const { data: coupon } = await safeQuery(async () => await supabase.from("coupons").select("*").eq("id", id).single(), { data: null } as any);
    if (!coupon) return Response.json({ error: "Not found" }, { status: 404 });

    const { data: usage } = await safeQuery(async () => await supabase.from("coupon_usage").select("*, profiles(full_name, email)").eq("coupon_id", id).order("created_at", { ascending: false }).limit(50), { data: null } as any);

    return Response.json({ ...coupon, usage: usage || [] });
  }

  if (section === "export") {
    const { data } = await safeQuery(async () => await supabase.from("coupons").select("*").order("created_at", { ascending: false }), { data: null } as any);
    return Response.json({ rows: data || [] });
  }

  return Response.json({ error: "Unknown section" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { code, type, value, description, campaign, min_order, max_discount, max_uses, starts_at, expires_at, is_active, conditions } = body;
  if (!code || !type || value === undefined) return Response.json({ error: "Code, type, and value are required" }, { status: 400 });

  const { data: existing } = await supabase.from("coupons").select("id").eq("code", code.toUpperCase()).single();
  if (existing) return Response.json({ error: "Coupon code already exists" }, { status: 409 });

  const { data, error } = await safeQuery(async () => await supabase.from("coupons").insert({
    code: code.toUpperCase(), type, value: parseFloat(value),
    description: description || null, campaign: campaign || null,
    min_order: min_order ? parseFloat(min_order) : 0,
    max_discount: max_discount ? parseFloat(max_discount) : null,
    max_uses: max_uses ? parseInt(max_uses) : null,
    starts_at: starts_at || null, expires_at: expires_at || null,
    is_active: is_active !== false, used_count: 0, total_discount_given: 0,
    conditions: conditions || null, created_by: auth.user.id,
  }).select().single(), { data: null, error: "Insert failed" } as any);

  if (!data) return Response.json({ error: "Failed to create coupon" }, { status: 500 });
  return Response.json({ success: true, coupon: data });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  if (updates.value !== undefined) updates.value = parseFloat(updates.value);
  if (updates.min_order !== undefined) updates.min_order = parseFloat(updates.min_order);
  if (updates.max_discount !== undefined) updates.max_discount = updates.max_discount ? parseFloat(updates.max_discount) : null;
  if (updates.max_uses !== undefined) updates.max_uses = updates.max_uses ? parseInt(updates.max_uses) : null;
  if (updates.code) updates.code = updates.code.toUpperCase();

  const { error } = await supabase.from("coupons").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { action, ids } = body;
  if (!ids?.length) return Response.json({ error: "No ids" }, { status: 400 });

  if (action === "enable") {
    await supabase.from("coupons").update({ is_active: true }).in("id", ids);
  } else if (action === "disable") {
    await supabase.from("coupons").update({ is_active: false }).in("id", ids);
  } else if (action === "delete") {
    await supabase.from("coupons").delete().in("id", ids);
  } else if (action === "duplicate") {
    for (const id of ids) {
      const { data: orig } = await supabase.from("coupons").select("*").eq("id", id).single();
      if (!orig) continue;
      const { id: _id, created_at: _ca, used_count: _uc, total_discount_given: _td, ...rest } = orig;
      await supabase.from("coupons").insert({ ...rest, code: `${rest.code}_COPY_${Date.now().toString(36).slice(-4).toUpperCase()}`, used_count: 0, total_discount_given: 0 });
    }
  } else {
    return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  return Response.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
