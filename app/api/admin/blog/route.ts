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
    const { data: articles } = await safeQuery(async () => await supabase.from("blog_posts").select("*"), { data: null } as any);
    const rows = articles || [];
    const published = rows.filter(a => a.status === "published");
    const drafts = rows.filter(a => a.status === "draft");
    const scheduled = rows.filter(a => a.status === "scheduled");
    const archived = rows.filter(a => a.status === "archived");
    const totalViews = rows.reduce((s, a) => s + (a.views || 0), 0);
    const totalComments = rows.reduce((s, a) => s + (a.comments_count || 0), 0);
    const totalLikes = rows.reduce((s, a) => s + (a.likes || 0), 0);
    const totalShares = rows.reduce((s, a) => s + (a.shares || 0), 0);
    const avgReadTime = rows.length > 0 ? Math.round(rows.reduce((s, a) => s + (a.reading_time || 0), 0) / rows.length) : 0;

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    const { data: categories } = await safeQuery(async () => await supabase.from("blog_categories").select("id"), { data: null } as any);
    const { data: tags } = await safeQuery(async () => await supabase.from("blog_tags").select("id"), { data: null } as any);

    const topArticle = published.sort((a, b) => (b.views || 0) - (a.views || 0))[0];

    return Response.json({
      totalArticles: rows.length, publishedArticles: published.length,
      draftArticles: drafts.length, scheduledArticles: scheduled.length,
      archivedArticles: archived.length, totalCategories: (categories || []).length,
      totalTags: (tags || []).length, totalAuthors: new Set(rows.map(a => a.author_id).filter(Boolean)).size,
      todayViews: 0, monthlyViews: totalViews, avgReadTime,
      avgEngagement: 0, comments: totalComments, likes: totalLikes,
      shares: totalShares, organicTraffic: 0, seoScore: 0,
      topArticle: topArticle?.title || "—",
    });
  }

  if (section === "list") {
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const category = searchParams.get("category") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortDir = searchParams.get("sortDir") || "desc";
    const offset = (page - 1) * limit;

    let query = supabase.from("blog_posts").select("*", { count: "exact" });
    if (search) query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%,excerpt.ilike.%${search}%`);
    if (status) query = query.eq("status", status);
    if (category) query = query.eq("category_id", category);
    query = query.order(sortBy, { ascending: sortDir === "asc" });
    query = query.range(offset, offset + limit - 1);

    const { data, count } = await safeQuery(async () => await query, { data: null, count: 0 } as any);

    const rows = data || [];
    const authorIds = [...new Set(rows.map(r => r.author_id).filter(Boolean))];
    let authors: any[] = [];
    if (authorIds.length > 0) {
      const { data: profiles } = await safeQuery(async () => await supabase.from("profiles").select("id, full_name, avatar_url").in("id", authorIds), { data: null } as any);
      authors = profiles || [];
    }
    const authorMap = Object.fromEntries(authors.map(a => [a.id, a]));
    const enriched = rows.map(r => ({ ...r, author: authorMap[r.author_id] || null }));

    return Response.json({ rows: enriched, total: count || 0, page, limit });
  }

  if (section === "detail") {
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    const { data } = await safeQuery(async () => await supabase.from("blog_posts").select("*").eq("id", id).single(), { data: null } as any);
    if (!data) return Response.json({ error: "Not found" }, { status: 404 });

    let author = null;
    if (data.author_id) {
      const { data: p } = await safeQuery(async () => await supabase.from("profiles").select("id, full_name, avatar_url, email").eq("id", data.author_id).single(), { data: null } as any);
      author = p;
    }
    return Response.json({ ...data, author });
  }

  if (section === "categories") {
    const { data } = await safeQuery(async () => await supabase.from("blog_categories").select("*").order("name", { ascending: true }), { data: null } as any);
    return Response.json({ categories: data || [] });
  }

  if (section === "tags") {
    const { data } = await safeQuery(async () => await supabase.from("blog_tags").select("*").order("name", { ascending: true }), { data: null } as any);
    return Response.json({ tags: data || [] });
  }

  if (section === "export") {
    const { data } = await safeQuery(async () => await supabase.from("blog_posts").select("*").order("created_at", { ascending: false }), { data: null } as any);
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

  if (action === "create_article") {
    const { title, slug, excerpt, content, category_id, tags, featured_image,
      status, meta_title, meta_description, focus_keyword, canonical_url,
      og_image, reading_time, is_featured, published_at } = body;

    if (!title) return Response.json({ error: "Title is required" }, { status: 400 });
    const autoSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const { data, error } = await safeQuery(async () => await supabase.from("blog_posts").insert({
      title, slug: autoSlug, excerpt: excerpt || null, content: content || null,
      category_id: category_id || null, tags: tags || [], featured_image: featured_image || null,
      status: status || "draft", meta_title: meta_title || title,
      meta_description: meta_description || excerpt || null,
      focus_keyword: focus_keyword || null, canonical_url: canonical_url || null,
      og_image: og_image || featured_image || null,
      reading_time: reading_time || 0, is_featured: is_featured || false,
      published_at: status === "published" ? (published_at || new Date().toISOString()) : null,
      author_id: auth.user.id, views: 0, likes: 0, shares: 0, comments_count: 0,
    }).select().single(), { data: null, error: "Failed" } as any);

    if (!data) return Response.json({ error: "Failed to create article" }, { status: 500 });
    return Response.json({ success: true, article: data });
  }

  if (action === "create_category") {
    const { name, slug, description, image } = body;
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    const autoSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { data } = await safeQuery(async () => await supabase.from("blog_categories").insert({ name, slug: autoSlug, description: description || null, image: image || null }).select().single(), { data: null } as any);
    return Response.json({ success: true, category: data });
  }

  if (action === "create_tag") {
    const { name, slug } = body;
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    const autoSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { data } = await safeQuery(async () => await supabase.from("blog_tags").insert({ name, slug: autoSlug }).select().single(), { data: null } as any);
    return Response.json({ success: true, tag: data });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  if (updates.status === "published" && !updates.published_at) {
    updates.published_at = new Date().toISOString();
  }
  updates.updated_at = new Date().toISOString();

  const { error } = await supabase.from("blog_posts").update(updates).eq("id", id);
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

  if (action === "publish") await supabase.from("blog_posts").update({ status: "published", published_at: new Date().toISOString() }).in("id", ids);
  else if (action === "draft") await supabase.from("blog_posts").update({ status: "draft" }).in("id", ids);
  else if (action === "archive") await supabase.from("blog_posts").update({ status: "archived" }).in("id", ids);
  else if (action === "delete") await supabase.from("blog_posts").delete().in("id", ids);
  else if (action === "duplicate") {
    for (const id of ids) {
      const { data: orig } = await supabase.from("blog_posts").select("*").eq("id", id).single();
      if (!orig) continue;
      const { id: _id, created_at: _ca, views: _v, likes: _l, shares: _s, comments_count: _cc, ...rest } = orig;
      await supabase.from("blog_posts").insert({ ...rest, title: `${rest.title} (Copy)`, slug: `${rest.slug}-copy-${Date.now().toString(36).slice(-4)}`, status: "draft", views: 0, likes: 0, shares: 0, comments_count: 0 });
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

  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
