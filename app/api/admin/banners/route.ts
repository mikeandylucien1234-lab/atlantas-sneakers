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

const LOCATIONS = [
  "hero_carousel", "flash_deal_strip", "promo_strip", "category_banner", "collection_banner",
  "rewards_banner", "homepage_section", "app_banner", "footer_banner", "sidebar_banner",
  "popup_banner", "newsletter_banner", "checkout_banner", "cart_banner", "wishlist_banner",
  "search_banner", "error_404", "blog_banner", "seasonal_banner",
];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = request.nextUrl;
  const section = searchParams.get("section") || "list";

  if (section === "kpis") {
    const { data: all } = await safeQuery(async () => await supabase.from("banners").select("*"), { data: null } as any);
    const rows = all || [];
    const now = new Date();
    const active = rows.filter(b => b.status === "active" || (b.is_active && (!b.ends_at || new Date(b.ends_at) > now)));
    const inactive = rows.filter(b => b.status === "inactive" || !b.is_active);
    const scheduled = rows.filter(b => b.starts_at && new Date(b.starts_at) > now);
    const expired = rows.filter(b => b.ends_at && new Date(b.ends_at) <= now);
    const homepage = rows.filter(b => b.location === "hero_carousel" || b.location === "homepage_section");
    const category = rows.filter(b => b.location === "category_banner");
    const campaign = rows.filter(b => !!b.campaign);
    const totalClicks = rows.reduce((s, b) => s + (b.clicks || 0), 0);
    const totalImpressions = rows.reduce((s, b) => s + (b.impressions || 0), 0);
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "0";
    const totalConversions = rows.reduce((s, b) => s + (b.conversions || 0), 0);

    return Response.json({
      totalBanners: rows.length, activeBanners: active.length, inactiveBanners: inactive.length,
      scheduledBanners: scheduled.length, expiredBanners: expired.length,
      homepageBanners: homepage.length, categoryBanners: category.length,
      campaignBanners: campaign.length, clicks: totalClicks, ctr: parseFloat(ctr),
      impressions: totalImpressions, conversions: totalConversions,
    });
  }

  if (section === "list") {
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const location = searchParams.get("location") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortDir = searchParams.get("sortDir") || "desc";
    const offset = (page - 1) * limit;

    let query = supabase.from("banners").select("*", { count: "exact" });
    if (search) query = query.or(`name.ilike.%${search}%,campaign.ilike.%${search}%,location.ilike.%${search}%`);
    if (status === "active") query = query.eq("is_active", true);
    else if (status === "inactive") query = query.eq("is_active", false);
    else if (status === "expired") query = query.lte("ends_at", new Date().toISOString());
    else if (status === "scheduled") query = query.gt("starts_at", new Date().toISOString());
    if (location) query = query.eq("location", location);
    query = query.order(sortBy, { ascending: sortDir === "asc" });
    query = query.range(offset, offset + limit - 1);

    const { data, count } = await safeQuery(async () => await query, { data: null, count: 0 } as any);
    return Response.json({ rows: data || [], total: count || 0, page, limit });
  }

  if (section === "detail") {
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    const { data } = await safeQuery(async () => await supabase.from("banners").select("*").eq("id", id).single(), { data: null } as any);
    if (!data) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(data);
  }

  if (section === "locations") {
    return Response.json({ locations: LOCATIONS });
  }

  if (section === "export") {
    const { data } = await safeQuery(async () => await supabase.from("banners").select("*").order("created_at", { ascending: false }), { data: null } as any);
    return Response.json({ rows: data || [] });
  }

  return Response.json({ error: "Unknown section" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { name, location, campaign, description, image_desktop, image_tablet, image_mobile,
    alt_text, link_url, link_type, cta_label, cta_style, cta_color, priority,
    starts_at, ends_at, is_active, device_target, country, language,
    dimensions, seo_title, seo_description } = body;

  if (!name || !location) return Response.json({ error: "Name and location are required" }, { status: 400 });

  const { data, error } = await supabase.from("banners").insert({
    name, location, campaign: campaign || null, description: description || null,
    image_desktop: image_desktop || null, image_tablet: image_tablet || null,
    image_mobile: image_mobile || null, alt_text: alt_text || null,
    link_url: link_url || null, link_type: link_type || null,
    cta_label: cta_label || null, cta_style: cta_style || null, cta_color: cta_color || null,
    priority: priority || 0, starts_at: starts_at || null, ends_at: ends_at || null,
    is_active: is_active !== false, device_target: device_target || "all",
    country: country || null, language: language || null,
    dimensions: dimensions || null, seo_title: seo_title || null,
    seo_description: seo_description || null,
    clicks: 0, impressions: 0, conversions: 0, created_by: auth.user.id,
  }).select().single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true, banner: data });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("banners").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
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

  if (action === "publish") await supabase.from("banners").update({ is_active: true }).in("id", ids);
  else if (action === "unpublish") await supabase.from("banners").update({ is_active: false }).in("id", ids);
  else if (action === "delete") await supabase.from("banners").delete().in("id", ids);
  else if (action === "duplicate") {
    for (const id of ids) {
      const { data: orig } = await supabase.from("banners").select("*").eq("id", id).single();
      if (!orig) continue;
      const { id: _id, created_at: _ca, clicks: _cl, impressions: _im, conversions: _cv, ...rest } = orig;
      await supabase.from("banners").insert({ ...rest, name: `${rest.name} (Copy)`, clicks: 0, impressions: 0, conversions: 0 });
    }
  } else return Response.json({ error: "Unknown action" }, { status: 400 });

  return Response.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
