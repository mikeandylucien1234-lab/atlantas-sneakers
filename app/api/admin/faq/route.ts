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
    const { data: faqs } = await safeQuery(async () => await supabase.from("faqs").select("*"), { data: null } as any);
    const rows = faqs || [];
    const published = rows.filter(f => f.status === "published");
    const drafts = rows.filter(f => f.status === "draft");
    const totalViews = rows.reduce((s, f) => s + (f.views || 0), 0);
    const totalHelpful = rows.reduce((s, f) => s + (f.helpful || 0), 0);
    const totalUnhelpful = rows.reduce((s, f) => s + (f.unhelpful || 0), 0);
    const totalSearches = rows.reduce((s, f) => s + (f.searches || 0), 0);

    const { data: categories } = await safeQuery(async () => await supabase.from("faq_categories").select("id, name"), { data: null } as any);

    const topFaq = [...rows].sort((a, b) => (b.views || 0) - (a.views || 0))[0];

    const catViews: Record<string, { name: string; views: number }> = {};
    (categories || []).forEach(c => { catViews[c.id] = { name: c.name, views: 0 }; });
    rows.forEach(f => { if (f.category_id && catViews[f.category_id]) catViews[f.category_id].views += (f.views || 0); });
    const topCat = Object.values(catViews).sort((a, b) => b.views - a.views)[0];

    return Response.json({
      totalFaqs: rows.length, publishedFaqs: published.length, draftFaqs: drafts.length,
      categories: (categories || []).length, viewsToday: 0, viewsMonth: totalViews,
      helpful: totalHelpful, unhelpful: totalUnhelpful, searches: totalSearches,
      topFaq: topFaq?.question?.slice(0, 40) || "—",
      topCategory: topCat?.name || "—",
    });
  }

  if (section === "list") {
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const category = searchParams.get("category") || "";
    const sortBy = searchParams.get("sortBy") || "order";
    const sortDir = searchParams.get("sortDir") || "asc";
    const offset = (page - 1) * limit;

    let query = supabase.from("faqs").select("*", { count: "exact" });
    if (search) query = query.or(`question.ilike.%${search}%,answer.ilike.%${search}%,tags.cs.{${search}}`);
    if (status) query = query.eq("status", status);
    if (category) query = query.eq("category_id", category);
    query = query.order(sortBy, { ascending: sortDir === "asc" });
    query = query.range(offset, offset + limit - 1);

    const { data, count } = await safeQuery(async () => await query, { data: null, count: 0 } as any);

    const rows = data || [];
    const authorIds = [...new Set(rows.map(r => r.created_by).filter(Boolean))];
    let authors: any[] = [];
    if (authorIds.length > 0) {
      const { data: profiles } = await safeQuery(async () => await supabase.from("profiles").select("id, full_name, avatar_url").in("id", authorIds), { data: null } as any);
      authors = profiles || [];
    }
    const authorMap = Object.fromEntries(authors.map(a => [a.id, a]));
    const enriched = rows.map(r => ({ ...r, author: authorMap[r.created_by] || null }));

    return Response.json({ rows: enriched, total: count || 0, page, limit });
  }

  if (section === "detail") {
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    const { data } = await safeQuery(async () => await supabase.from("faqs").select("*").eq("id", id).single(), { data: null } as any);
    if (!data) return Response.json({ error: "Not found" }, { status: 404 });

    let author = null;
    if (data.created_by) {
      const { data: p } = await safeQuery(async () => await supabase.from("profiles").select("id, full_name, avatar_url, email").eq("id", data.created_by).single(), { data: null } as any);
      author = p;
    }

    const { data: versions } = await safeQuery(async () => await supabase.from("faq_versions").select("*").eq("faq_id", id).order("created_at", { ascending: false }), { data: null } as any);
    const { data: feedback } = await safeQuery(async () => await supabase.from("faq_feedback").select("*").eq("faq_id", id).order("created_at", { ascending: false }).limit(20), { data: null } as any);

    return Response.json({ ...data, author, versions: versions || [], feedback: feedback || [] });
  }

  if (section === "categories") {
    const { data } = await safeQuery(async () => await supabase.from("faq_categories").select("*").order("order", { ascending: true }), { data: null } as any);
    return Response.json({ categories: data || [] });
  }

  if (section === "analytics") {
    const { data: faqs } = await safeQuery(async () => await supabase.from("faqs").select("id, question, category_id, views, helpful, unhelpful, searches, status, created_at"), { data: null } as any);
    const rows = faqs || [];
    const totalViews = rows.reduce((s, f) => s + (f.views || 0), 0);
    const totalHelpful = rows.reduce((s, f) => s + (f.helpful || 0), 0);
    const totalUnhelpful = rows.reduce((s, f) => s + (f.unhelpful || 0), 0);
    const helpfulPct = (totalHelpful + totalUnhelpful) > 0 ? ((totalHelpful / (totalHelpful + totalUnhelpful)) * 100).toFixed(1) : "0";
    const mostViewed = [...rows].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
    const leastViewed = [...rows].filter(f => f.status === "published").sort((a, b) => (a.views || 0) - (b.views || 0)).slice(0, 10);
    const mostHelpful = [...rows].sort((a, b) => (b.helpful || 0) - (a.helpful || 0)).slice(0, 10);

    return Response.json({
      totalViews, totalHelpful, totalUnhelpful, helpfulPct: parseFloat(helpfulPct),
      totalSearches: rows.reduce((s, f) => s + (f.searches || 0), 0),
      mostViewed, leastViewed, mostHelpful,
    });
  }

  if (section === "seo") {
    const { data } = await safeQuery(async () => await supabase.from("faq_settings").select("*").eq("key", "seo").single(), { data: null } as any);
    return Response.json(data?.value || { title: "", description: "", keywords: "", og_image: "", canonical_url: "" });
  }

  if (section === "export") {
    const { data } = await safeQuery(async () => await supabase.from("faqs").select("*").order("order", { ascending: true }), { data: null } as any);
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

  if (action === "create_faq") {
    const { question, answer, summary, category_id, subcategory_id, tags,
      icon, image, video, attachment, related_products, related_categories,
      related_coupons, related_deals, related_blog, status, is_featured,
      is_pinned, order, slug, meta_title, meta_description } = body;

    if (!question) return Response.json({ error: "Question required" }, { status: 400 });
    const autoSlug = slug || question.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);

    const { data } = await safeQuery(async () => await supabase.from("faqs").insert({
      question, answer: answer || "", summary: summary || null,
      category_id: category_id || null, subcategory_id: subcategory_id || null,
      tags: tags || [], icon: icon || null, image: image || null,
      video: video || null, attachment: attachment || null,
      related_products: related_products || [], related_categories: related_categories || [],
      related_coupons: related_coupons || [], related_deals: related_deals || [],
      related_blog: related_blog || [],
      status: status || "draft", is_featured: is_featured || false,
      is_pinned: is_pinned || false, order: order || 0,
      slug: autoSlug, meta_title: meta_title || question,
      meta_description: meta_description || summary || null,
      views: 0, helpful: 0, unhelpful: 0, searches: 0,
      created_by: auth.user.id,
    }).select().single(), { data: null } as any);

    if (!data) return Response.json({ error: "Failed to create FAQ" }, { status: 500 });
    return Response.json({ success: true, faq: data });
  }

  if (action === "create_category") {
    const { name, slug, description, icon, image, order, parent_id } = body;
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    const autoSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { data } = await safeQuery(async () => await supabase.from("faq_categories").insert({
      name, slug: autoSlug, description: description || null,
      icon: icon || null, image: image || null,
      order: order || 0, parent_id: parent_id || null,
    }).select().single(), { data: null } as any);
    return Response.json({ success: true, category: data });
  }

  if (action === "save_seo") {
    const { seo } = body;
    await safeQuery(async () => await supabase.from("faq_settings").upsert({
      key: "seo", value: seo, updated_by: auth.user.id, updated_at: new Date().toISOString(),
    }, { onConflict: "key" }), null);
    return Response.json({ success: true });
  }

  if (action === "reorder") {
    const { items } = body;
    if (!items?.length) return Response.json({ error: "No items" }, { status: 400 });
    for (let i = 0; i < items.length; i++) {
      await safeQuery(async () => await supabase.from("faqs").update({ order: i }).eq("id", items[i]), null);
    }
    return Response.json({ success: true });
  }

  if (action === "feedback") {
    const { faq_id, type, comment } = body;
    if (!faq_id || !type) return Response.json({ error: "Missing fields" }, { status: 400 });
    await safeQuery(async () => await supabase.from("faq_feedback").insert({
      faq_id, type, comment: comment || null, created_by: auth.user.id,
    }), null);
    const field = type === "helpful" ? "helpful" : "unhelpful";
    await safeQuery(async () => await supabase.rpc("increment_field", { table_name: "faqs", field_name: field, row_id: faq_id }), null);
    return Response.json({ success: true });
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

  const { data: current } = await safeQuery(async () => await supabase.from("faqs").select("question, answer").eq("id", id).single(), { data: null } as any);
  if (current) {
    await safeQuery(async () => await supabase.from("faq_versions").insert({
      faq_id: id, question: current.question, answer: current.answer,
      modified_by: auth.user.id,
    }), null);
  }

  if (updates.status === "published" && !updates.published_at) {
    updates.published_at = new Date().toISOString();
  }
  updates.updated_at = new Date().toISOString();

  const { error } = await supabase.from("faqs").update(updates).eq("id", id);
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

  if (action === "publish") await supabase.from("faqs").update({ status: "published", published_at: new Date().toISOString() }).in("id", ids);
  else if (action === "draft") await supabase.from("faqs").update({ status: "draft" }).in("id", ids);
  else if (action === "archive") await supabase.from("faqs").update({ status: "archived" }).in("id", ids);
  else if (action === "delete") await supabase.from("faqs").delete().in("id", ids);
  else if (action === "duplicate") {
    for (const id of ids) {
      const { data: orig } = await supabase.from("faqs").select("*").eq("id", id).single();
      if (!orig) continue;
      const { id: _id, created_at: _ca, views: _v, helpful: _h, unhelpful: _u, searches: _s, ...rest } = orig;
      await supabase.from("faqs").insert({
        ...rest, question: `${rest.question} (Copy)`,
        slug: `${rest.slug}-copy-${Date.now().toString(36).slice(-4)}`,
        status: "draft", views: 0, helpful: 0, unhelpful: 0, searches: 0,
        created_by: auth.user.id,
      });
    }
  } else return Response.json({ error: "Unknown action" }, { status: 400 });

  return Response.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const id = request.nextUrl.searchParams.get("id");
  const type = request.nextUrl.searchParams.get("type") || "faq";
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  if (type === "category") {
    await safeQuery(async () => await supabase.from("faq_categories").delete().eq("id", id), null);
  } else {
    await safeQuery(async () => await supabase.from("faqs").delete().eq("id", id), null);
  }
  return Response.json({ success: true });
}
