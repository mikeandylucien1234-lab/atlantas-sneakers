// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}
async function checkAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: "Forbidden", status: 403 };
  return { user, profile };
}
async function audit(supabase, auth, request, action, target, oldV, newV) {
  try {
    await supabase.from("seo_audit_log").insert({
      action, target: target || null,
      actor_id: auth.user?.id || null, actor_name: auth.profile?.full_name || auth.profile?.email || "Admin",
      ip_address: request.headers.get("x-forwarded-for") || null,
      old_value: oldV ?? null, new_value: newV ?? null,
    });
  } catch {}
}

const SETTINGS_FIELDS = [
  "site_name", "separator", "global_meta_title", "global_meta_description", "default_keywords", "canonical_base",
  "og_title", "og_description", "og_image", "twitter_card", "twitter_title", "twitter_description", "twitter_image",
  "favicon_url", "apple_touch_icon", "android_icon", "pwa_icon", "robots_txt",
  "google_verification", "google_analytics_id", "google_tag_manager_id", "google_merchant_id",
  "bing_verification", "indexnow_key",
];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const section = request.nextUrl.searchParams.get("section") || "settings";

    if (section === "settings") {
      const { data } = await supabase.from("seo_settings").select("*").eq("id", "global").single();
      return Response.json({ settings: data || {} });
    }

    if (section === "analyzer" || section === "dashboard") {
      const result = await safeQuery(async () => {
        const [prodRes, catRes, brandRes, sitemapRes, auditRes] = await Promise.all([
          supabase.from("products").select("id, name, slug, meta_title, meta_description, images, status"),
          supabase.from("categories").select("id, name, slug, meta_title, meta_description"),
          supabase.from("brands").select("id, name, slug, meta_title, meta_description"),
          supabase.from("sitemap_logs").select("*").order("created_at", { ascending: false }).limit(1),
          supabase.from("seo_audit_log").select("action, target, actor_name, created_at").order("created_at", { ascending: false }).limit(8),
        ]);
        const products = prodRes.data || [];
        const categories = catRes.data || [];
        const brands = brandRes.data || [];
        const active = products.filter(p => p.status === "active");

        const noTitle = [
          ...active.filter(p => !p.meta_title).map(p => ({ type: "product", id: p.id, name: p.name, issue: "Missing meta title" })),
          ...categories.filter(c => !c.meta_title).map(c => ({ type: "category", id: c.id, name: c.name, issue: "Missing meta title" })),
          ...brands.filter(b => !b.meta_title).map(b => ({ type: "brand", id: b.id, name: b.name, issue: "Missing meta title" })),
        ];
        const noDesc = [
          ...active.filter(p => !p.meta_description).map(p => ({ type: "product", id: p.id, name: p.name, issue: "Missing meta description" })),
          ...categories.filter(c => !c.meta_description).map(c => ({ type: "category", id: c.id, name: c.name, issue: "Missing meta description" })),
          ...brands.filter(b => !b.meta_description).map(b => ({ type: "brand", id: b.id, name: b.name, issue: "Missing meta description" })),
        ];
        // Title length issues
        const titleLen = active.filter(p => p.meta_title && (p.meta_title.length < 30 || p.meta_title.length > 60))
          .map(p => ({ type: "product", id: p.id, name: p.name, issue: p.meta_title.length < 30 ? "Meta title too short" : "Meta title too long" }));
        const descLen = active.filter(p => p.meta_description && (p.meta_description.length < 70 || p.meta_description.length > 160))
          .map(p => ({ type: "product", id: p.id, name: p.name, issue: p.meta_description.length < 70 ? "Meta description too short" : "Meta description too long" }));
        // Duplicate slugs
        const slugCount = {};
        [...products, ...categories, ...brands].forEach(x => { if (x.slug) slugCount[x.slug] = (slugCount[x.slug] || 0) + 1; });
        const dupSlugs = Object.entries(slugCount).filter(([, n]) => n > 1).map(([slug, n]) => ({ slug, count: n }));

        const totalIndexable = active.length + categories.length + brands.length + 6;
        const issuesCount = noTitle.length + noDesc.length + dupSlugs.length;
        // SEO score: proportion of entities fully optimized
        const totalEntities = active.length + categories.length + brands.length || 1;
        const optimized = totalEntities - new Set([...noTitle, ...noDesc].map(x => `${x.type}:${x.id}`)).size;
        const score = Math.max(0, Math.min(100, Math.round((optimized / totalEntities) * 100)));

        return {
          score,
          indexablePages: totalIndexable,
          missingTitle: noTitle.length,
          missingDescription: noDesc.length,
          imagesWithoutAlt: 0, // product images are stored as URLs without per-image alt
          pagesWithErrors: issuesCount,
          duplicateUrls: dupSlugs.length,
          totalIndexable,
          issues: {
            noTitle: noTitle.slice(0, 100),
            noDescription: noDesc.slice(0, 100),
            titleLength: titleLen.slice(0, 100),
            descriptionLength: descLen.slice(0, 100),
            duplicateSlugs: dupSlugs,
          },
          lastSitemap: sitemapRes.data?.[0] || null,
          recentChanges: auditRes.data || [],
        };
      }, { score: 0, indexablePages: 0, missingTitle: 0, missingDescription: 0, imagesWithoutAlt: 0, pagesWithErrors: 0, duplicateUrls: 0, totalIndexable: 0, issues: {}, lastSitemap: null, recentChanges: [] });
      return Response.json(result);
    }

    if (section === "redirects") {
      const { data } = await supabase.from("seo_redirects").select("*").order("created_at", { ascending: false });
      return Response.json({ redirects: data || [] });
    }

    if (section === "audit") {
      const { data } = await supabase.from("seo_audit_log").select("*").order("created_at", { ascending: false }).limit(50);
      return Response.json({ audit: data || [] });
    }

    return Response.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("SEO API GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const patch = { id: "global", updated_at: new Date().toISOString() };
    SETTINGS_FIELDS.forEach(k => { if (body[k] !== undefined) patch[k] = body[k]; });

    const { data: before } = await supabase.from("seo_settings").select("*").eq("id", "global").single();
    const { error } = await supabase.from("seo_settings").upsert(patch, { onConflict: "id" });
    if (error) return Response.json({ error: error.message }, { status: 400 });
    await audit(supabase, auth, request, "settings.updated", "global", before, patch);
    return Response.json({ success: true });
  } catch (error) {
    console.error("SEO API PUT error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const action = body.action;

    if (action === "add_redirect") {
      const { from_path, to_path, redirect_type, notes } = body;
      if (!from_path) return Response.json({ error: "from_path is required" }, { status: 400 });
      const type = [301, 302, 307, 410].includes(Number(redirect_type)) ? Number(redirect_type) : 301;
      if (type !== 410 && !to_path) return Response.json({ error: "to_path is required for this redirect type" }, { status: 400 });
      const from = from_path.startsWith("/") ? from_path : `/${from_path}`;
      const { data: dup } = await supabase.from("seo_redirects").select("id").eq("from_path", from).maybeSingle();
      if (dup) return Response.json({ error: "A redirect for this path already exists" }, { status: 409 });
      const { data, error } = await supabase.from("seo_redirects").insert({
        from_path: from, to_path: type === 410 ? null : (to_path || null), redirect_type: type, notes: notes || null,
      }).select().single();
      if (error) return Response.json({ error: error.message }, { status: 400 });
      await audit(supabase, auth, request, "redirect.created", from, null, data);
      return Response.json({ success: true, redirect: data }, { status: 201 });
    }

    if (action === "generate_sitemap") {
      // Count what the sitemap will contain and log the generation
      const [{ count: pc }, { count: cc }, { count: bc }] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("categories").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("brands").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      const urlCount = (pc || 0) + (cc || 0) + (bc || 0) + 6;
      await supabase.from("sitemap_logs").insert({ url_count: urlCount, status: "success", detail: { products: pc || 0, categories: cc || 0, brands: bc || 0 } });
      await audit(supabase, auth, request, "sitemap.generated", null, null, { urlCount });
      const base = process.env.NEXT_PUBLIC_SITE_URL || "https://atlantasneaker.com";
      return Response.json({ success: true, urlCount, url: `${base}/sitemap.xml` });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("SEO API POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { id } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    const patch = { updated_at: new Date().toISOString() };
    ["from_path", "to_path", "redirect_type", "is_active", "notes"].forEach(k => { if (body[k] !== undefined) patch[k] = body[k]; });
    const { error } = await supabase.from("seo_redirects").update(patch).eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    await audit(supabase, auth, request, "redirect.updated", id, null, patch);
    return Response.json({ success: true });
  } catch (error) {
    console.error("SEO API PATCH error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    await audit(supabase, auth, request, "redirect.deleted", id, null, null);
    const { error } = await supabase.from("seo_redirects").delete().eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ success: true });
  } catch (error) {
    console.error("SEO API DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
