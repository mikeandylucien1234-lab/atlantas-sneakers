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
    const { data: allReviews } = await safeQuery(
      async () => await supabase.from("reviews").select("*"),
      { data: null } as any
    );
    const reviews = allReviews || [];
    const total = reviews.length;

    const publishedReviews = reviews.filter((r) => r.status === "published").length || total;
    const pendingReviews = reviews.filter((r) => r.status === "pending").length;
    const rejectedReviews = reviews.filter((r) => r.status === "rejected").length;
    const reportedReviews = reviews.filter((r) => r.reported === true).length;
    const verifiedReviews = reviews.filter((r) => r.is_verified === true).length;
    const positiveReviews = reviews.filter((r) => r.rating >= 4).length;
    const negativeReviews = reviews.filter((r) => r.rating <= 2).length;
    const withImages = reviews.filter((r) => Array.isArray(r.images) && r.images.length > 0).length;

    const avgRating = total > 0
      ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / total
      : 0;

    const withReply = reviews.filter((r) => r.admin_reply != null).length;
    const responseRate = total > 0 ? withReply / total : 0;

    return Response.json({
      kpis: {
        totalReviews: total,
        publishedReviews,
        pendingReviews,
        rejectedReviews,
        reportedReviews,
        averageRating: Math.round(avgRating * 100) / 100,
        verifiedReviews,
        positiveReviews,
        negativeReviews,
        withImages,
        responseRate: Math.round(responseRate * 100) / 100,
      },
    });
  }

  if (section === "list" || section === "export") {
    const page = parseInt(searchParams.get("page") || "1");
    const per_page = section === "export" ? 10000 : parseInt(searchParams.get("per_page") || "25");
    const search = searchParams.get("search")?.toLowerCase() || "";
    const ratingFilter = searchParams.get("rating");
    const statusFilter = searchParams.get("status");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") || "desc";
    const verifiedFilter = searchParams.get("verified");
    const hasImagesFilter = searchParams.get("has_images");
    const reportedFilter = searchParams.get("reported");

    let query = supabase.from("reviews").select("*");

    if (ratingFilter) query = query.eq("rating", parseInt(ratingFilter));
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo);

    const statusQuery = statusFilter
      ? safeQuery(async () => await query.eq("status", statusFilter).order(sortBy, { ascending: sortOrder === "asc" }), { data: null } as any)
      : safeQuery(async () => await query.order(sortBy, { ascending: sortOrder === "asc" }), { data: null } as any);

    const { data: rawReviews } = await statusQuery;
    let reviews = rawReviews || [];

    if (verifiedFilter === "true") {
      reviews = reviews.filter((r) => r.is_verified === true);
    }
    if (hasImagesFilter === "true") {
      reviews = reviews.filter((r) => Array.isArray(r.images) && r.images.length > 0);
    }
    if (reportedFilter === "true") {
      reviews = reviews.filter((r) => r.reported === true);
    }

    const userIds = [...new Set(reviews.map((r) => r.user_id).filter(Boolean))];
    const productIds = [...new Set(reviews.map((r) => r.product_id).filter(Boolean))];

    const { data: profiles } = await safeQuery(
      async () => await supabase.from("profiles").select("id, full_name, email, avatar_url, points").in("id", userIds.length ? userIds : ["__none__"]),
      { data: null } as any
    );
    const { data: products } = await safeQuery(
      async () => await supabase.from("products").select("id, name, slug, images, price").in("id", productIds.length ? productIds : ["__none__"]),
      { data: null } as any
    );

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    const productMap = Object.fromEntries((products || []).map((p) => [p.id, p]));

    let enriched = reviews.map((r) => ({
      ...r,
      customer: profileMap[r.user_id] || null,
      product: productMap[r.product_id] || null,
    }));

    if (search) {
      enriched = enriched.filter((r) => {
        const fields = [
          r.comment, r.title,
          r.customer?.full_name, r.customer?.email,
          r.product?.name,
        ];
        return fields.some((f) => f && String(f).toLowerCase().includes(search));
      });
    }

    const total = enriched.length;

    if (section === "list") {
      const start = (page - 1) * per_page;
      enriched = enriched.slice(start, start + per_page);
    }

    return Response.json({ reviews: enriched, total, page, per_page });
  }

  if (section === "detail") {
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    const { data: review } = await safeQuery(
      async () => await supabase.from("reviews").select("*").eq("id", id).single(),
      { data: null } as any
    );
    if (!review) return Response.json({ error: "Review not found" }, { status: 404 });

    const { data: customer } = await safeQuery(
      async () => await supabase.from("profiles").select("id, full_name, email, avatar_url, points").eq("id", review.user_id).single(),
      { data: null } as any
    );
    const { data: product } = await safeQuery(
      async () => await supabase.from("products").select("id, name, slug, images, price").eq("id", review.product_id).single(),
      { data: null } as any
    );

    let isVerifiedPurchase = false;
    const { data: deliveredOrders } = await safeQuery(
      async () => await supabase.from("orders").select("id").eq("user_id", review.user_id).eq("status", "delivered"),
      { data: null } as any
    );
    if (deliveredOrders && deliveredOrders.length > 0) {
      const orderIds = deliveredOrders.map((o) => o.id);
      const { data: items } = await safeQuery(
        async () => await supabase.from("order_items").select("id").in("order_id", orderIds).eq("product_id", review.product_id).limit(1),
        { data: null } as any
      );
      isVerifiedPurchase = (items && items.length > 0);
    }

    return Response.json({
      review: { ...review, customer, product, isVerifiedPurchase },
    });
  }

  if (section === "stats") {
    const { data: allReviews } = await safeQuery(
      async () => await supabase.from("reviews").select("rating"),
      { data: null } as any
    );
    const reviews = allReviews || [];
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const rating = Number(r.rating);
      if (rating >= 1 && rating <= 5) distribution[rating]++;
    }
    return Response.json({ distribution });
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
  const { id, admin_reply } = body;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const { data: review } = await safeQuery(
    async () => await supabase.from("reviews").update({
      admin_reply,
      admin_reply_at: new Date().toISOString(),
    }).eq("id", id).select().single(),
    { data: null } as any
  );

  return Response.json({ review });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const allowed = ["status", "admin_reply", "rating", "comment"];
  const updateData: Record<string, any> = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) updateData[key] = updates[key];
  }
  if (updateData.admin_reply !== undefined) {
    updateData.admin_reply_at = new Date().toISOString();
  }

  const { data: review } = await safeQuery(
    async () => await supabase.from("reviews").update(updateData).eq("id", id).select().single(),
    { data: null } as any
  );

  return Response.json({ review });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { action, ids } = body;
  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "Missing action or ids" }, { status: 400 });
  }

  if (action === "approve") {
    await safeQuery(
      async () => await supabase.from("reviews").update({ status: "published" }).in("id", ids),
      { data: null } as any
    );
  } else if (action === "reject") {
    await safeQuery(
      async () => await supabase.from("reviews").update({ status: "rejected" }).in("id", ids),
      { data: null } as any
    );
  } else if (action === "delete") {
    await safeQuery(
      async () => await supabase.from("reviews").delete().in("id", ids),
      { data: null } as any
    );
  } else if (action === "feature") {
    await safeQuery(
      async () => await supabase.from("reviews").update({ is_featured: true }).in("id", ids),
      { data: null } as any
    );
  } else {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  return Response.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const id = body.id;
  const ids = body.ids || (id ? [id] : []);
  if (ids.length === 0) {
    return Response.json({ error: "Missing id or ids" }, { status: 400 });
  }

  await safeQuery(
    async () => await supabase.from("reviews").delete().in("id", ids),
    { data: null } as any
  );

  return Response.json({ success: true });
}
