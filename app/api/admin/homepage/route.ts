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

const DEFAULT_SECTIONS = [
  { id: "announcement_bar", label: "Announcement Bar", type: "content", order: 0, is_active: true },
  { id: "hero_carousel", label: "Hero Carousel", type: "carousel", order: 1, is_active: true },
  { id: "flash_deals", label: "Flash Deals", type: "products", order: 2, is_active: true },
  { id: "featured_categories", label: "Featured Categories", type: "categories", order: 3, is_active: true },
  { id: "trending_now", label: "Trending Now", type: "products", order: 4, is_active: true },
  { id: "best_sellers", label: "Best Sellers", type: "products", order: 5, is_active: true },
  { id: "new_arrivals", label: "New Arrivals", type: "products", order: 6, is_active: true },
  { id: "collections", label: "Collections", type: "collections", order: 7, is_active: true },
  { id: "brands_showcase", label: "Brands Showcase", type: "brands", order: 8, is_active: true },
  { id: "top_rated", label: "Top Rated", type: "products", order: 9, is_active: true },
  { id: "promo_banner", label: "Promo Banner", type: "banner", order: 10, is_active: true },
  { id: "recommended", label: "Recommended For You", type: "products", order: 11, is_active: true },
  { id: "most_wishlisted", label: "Most Wishlisted", type: "products", order: 12, is_active: false },
  { id: "coupons", label: "Coupons & Deals", type: "coupons", order: 13, is_active: true },
  { id: "rewards", label: "Rewards", type: "rewards", order: 14, is_active: true },
  { id: "testimonials", label: "Customer Reviews", type: "reviews", order: 15, is_active: true },
  { id: "newsletter", label: "Newsletter", type: "content", order: 16, is_active: true },
  { id: "app_download", label: "App Download", type: "banner", order: 17, is_active: false },
  { id: "blog", label: "Blog", type: "content", order: 18, is_active: false },
  { id: "faq", label: "FAQ", type: "content", order: 19, is_active: false },
];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = request.nextUrl;
  const section = searchParams.get("section") || "sections";

  if (section === "kpis") {
    const { data: sections } = await safeQuery(async () => await supabase.from("homepage_sections").select("*"), { data: null } as any);
    const rows = sections || DEFAULT_SECTIONS;
    const activeSections = rows.filter(s => s.is_active).length;

    const { data: banners } = await safeQuery(async () => await supabase.from("banners").select("clicks, impressions, conversions").eq("location", "hero_carousel"), { data: null } as any);
    const bannerRows = banners || [];
    const totalClicks = bannerRows.reduce((s, b) => s + (b.clicks || 0), 0);
    const totalImpressions = bannerRows.reduce((s, b) => s + (b.impressions || 0), 0);
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "0";

    const { data: products } = await safeQuery(async () => await supabase.from("products").select("id, is_featured, is_new, status").eq("status", "active"), { data: null } as any);
    const productCount = (products || []).length;
    const featuredCount = (products || []).filter(p => p.is_featured).length;

    const { data: categories } = await safeQuery(async () => await supabase.from("categories").select("id"), { data: null } as any);
    const { data: brands } = await safeQuery(async () => await supabase.from("brands").select("id"), { data: null } as any);

    return Response.json({
      totalSections: rows.length, activeSections, inactiveSections: rows.length - activeSections,
      totalProducts: productCount, featuredProducts: featuredCount,
      totalCategories: (categories || []).length, totalBrands: (brands || []).length,
      clicks: totalClicks, ctr: parseFloat(ctr), impressions: totalImpressions,
      conversions: bannerRows.reduce((s, b) => s + (b.conversions || 0), 0),
      bounceRate: 0,
    });
  }

  if (section === "sections") {
    const { data } = await safeQuery(async () => await supabase.from("homepage_sections").select("*").order("order", { ascending: true }), { data: null } as any);
    return Response.json({ sections: data || DEFAULT_SECTIONS });
  }

  if (section === "section_detail") {
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    const { data } = await safeQuery(async () => await supabase.from("homepage_sections").select("*").eq("id", id).single(), { data: null } as any);
    const fallback = DEFAULT_SECTIONS.find(s => s.id === id);
    return Response.json(data || fallback || { error: "Not found" });
  }

  if (section === "seo") {
    const { data } = await safeQuery(async () => await supabase.from("homepage_settings").select("*").eq("key", "seo").single(), { data: null } as any);
    return Response.json(data?.value || { title: "", description: "", keywords: "", og_image: "" });
  }

  if (section === "export") {
    const { data } = await safeQuery(async () => await supabase.from("homepage_sections").select("*").order("order", { ascending: true }), { data: null } as any);
    return Response.json({ sections: data || DEFAULT_SECTIONS });
  }

  return Response.json({ error: "Unknown section" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { action } = body;

  if (action === "save_sections") {
    const { sections } = body;
    if (!sections?.length) return Response.json({ error: "No sections" }, { status: 400 });

    for (const s of sections) {
      await safeQuery(async () => await supabase.from("homepage_sections").upsert({
        id: s.id, label: s.label, type: s.type, order: s.order,
        is_active: s.is_active, config: s.config || null,
        updated_by: auth.user.id, updated_at: new Date().toISOString(),
      }, { onConflict: "id" }), null);
    }
    return Response.json({ success: true });
  }

  if (action === "save_section") {
    const { id, config, is_active, label, order } = body;
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    await safeQuery(async () => await supabase.from("homepage_sections").upsert({
      id, label, is_active, order, config: config || null,
      updated_by: auth.user.id, updated_at: new Date().toISOString(),
    }, { onConflict: "id" }), null);
    return Response.json({ success: true });
  }

  if (action === "create_section") {
    const { id, label, type, order } = body;
    if (!id || !label) return Response.json({ error: "Missing fields" }, { status: 400 });

    await safeQuery(async () => await supabase.from("homepage_sections").insert({
      id, label, type: type || "content", order: order || 99,
      is_active: true, config: null, updated_by: auth.user.id,
    }), null);
    return Response.json({ success: true });
  }

  if (action === "save_seo") {
    const { seo } = body;
    await safeQuery(async () => await supabase.from("homepage_settings").upsert({
      key: "seo", value: seo, updated_by: auth.user.id, updated_at: new Date().toISOString(),
    }, { onConflict: "key" }), null);
    return Response.json({ success: true });
  }

  if (action === "reorder") {
    const { order } = body;
    if (!order?.length) return Response.json({ error: "No order" }, { status: 400 });
    for (let i = 0; i < order.length; i++) {
      await safeQuery(async () => await supabase.from("homepage_sections").update({ order: i }).eq("id", order[i]), null);
    }
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  await safeQuery(async () => await supabase.from("homepage_sections").delete().eq("id", id), null);
  return Response.json({ success: true });
}
