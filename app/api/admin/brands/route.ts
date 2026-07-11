// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Forbidden", status: 403 };
  }

  return { user };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const params = request.nextUrl.searchParams;
  const section = params.get("section") || "list";

  if (section === "kpis") {
    const { data: brands } = await safeQuery(
      async () => supabase.from("brands").select("id, name, is_active, logo_url"),
      { data: null } as any
    );
    const allBrands: any[] = brands || [];

    const totalBrands = allBrands.length;
    const activeBrands = allBrands.filter((b) => b.is_active).length;
    const hiddenBrands = allBrands.filter((b) => !b.is_active).length;
    const brandsWithoutLogo = allBrands.filter((b) => !b.logo_url).length;

    const { data: products } = await safeQuery(
      async () => supabase.from("products").select("id, brand_id"),
      { data: null } as any
    );
    const allProducts: any[] = products || [];

    const brandIdsWithProducts = new Set(
      allProducts.map((p) => p.brand_id)
    );
    const brandsWithoutProducts = allBrands.filter(
      (b) => !brandIdsWithProducts.has(b.id)
    ).length;

    // Top selling brand by revenue
    const { data: orderItems } = await safeQuery(
      async () => supabase.from("order_items").select("product_id, quantity, price"),
      { data: null } as any
    );
    const allOrderItems: any[] = orderItems || [];

    const productBrandMap = new Map<string, string>();
    for (const p of allProducts) {
      productBrandMap.set(p.id, p.brand_id);
    }

    const brandRevenue = new Map<string, number>();
    for (const item of allOrderItems) {
      const brandId = productBrandMap.get(item.product_id);
      if (brandId) {
        brandRevenue.set(
          brandId,
          (brandRevenue.get(brandId) || 0) + item.price * item.quantity
        );
      }
    }

    const brandNameMap = new Map<string, string>();
    for (const b of allBrands) {
      brandNameMap.set(b.id, b.name);
    }

    let topSellingBrand: { name: string; revenue: number } | null = null;
    let maxRevenue = 0;
    for (const [brandId, revenue] of brandRevenue) {
      if (revenue > maxRevenue) {
        maxRevenue = revenue;
        topSellingBrand = {
          name: brandNameMap.get(brandId) || "",
          revenue,
        };
      }
    }

    // Most products brand
    const brandProductCount = new Map<string, number>();
    for (const p of allProducts) {
      brandProductCount.set(
        p.brand_id,
        (brandProductCount.get(p.brand_id) || 0) + 1
      );
    }

    let mostProductsBrand: { name: string; count: number } | null = null;
    let maxCount = 0;
    for (const [brandId, count] of brandProductCount) {
      if (count > maxCount) {
        maxCount = count;
        mostProductsBrand = {
          name: brandNameMap.get(brandId) || "",
          count,
        };
      }
    }

    return Response.json({
      totalBrands,
      activeBrands,
      hiddenBrands,
      brandsWithoutLogo,
      brandsWithoutProducts,
      topSellingBrand,
      mostProductsBrand,
    });
  }

  if (section === "detail") {
    const id = params.get("id");
    if (!id) {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }

    const { data: brand } = await safeQuery(
      async () => supabase.from("brands").select("*").eq("id", id).single(),
      { data: null } as any
    );
    if (!brand) {
      return Response.json({ error: "Brand not found" }, { status: 404 });
    }

    const { data: products } = await safeQuery(
      async () =>
        supabase
          .from("products")
          .select(
            "id, name, slug, price, status, images, product_variants(id, size, color, color_hex, stock, sku)"
          )
          .eq("brand_id", id)
          .limit(50),
      { data: null } as any
    );
    const brandProducts = products || [];

    // Distinct categories
    const { data: catProducts } = await safeQuery(
      async () =>
        supabase
          .from("products")
          .select("category_id")
          .eq("brand_id", id),
      { data: null } as any
    );
    const categoryIds = [
      ...new Set((catProducts || [] as any[]).map((p: any) => p.category_id).filter(Boolean)),
    ];

    let categories: string[] = [];
    if (categoryIds.length > 0) {
      const { data: cats } = await safeQuery(
        async () =>
          supabase
            .from("categories")
            .select("name")
            .in("id", categoryIds),
        { data: null } as any
      );
      categories = (cats || []).map((c) => c.name);
    }

    // Revenue stats
    const productIds = brandProducts.map((p) => p.id);
    let totalRevenue = 0;
    let totalSold = 0;
    let topProduct: string | null = null;

    if (productIds.length > 0) {
      const { data: orderItems } = await safeQuery(
        async () =>
          supabase
            .from("order_items")
            .select("product_id, quantity, price")
            .in("product_id", productIds),
        { data: null } as any
      );
      const items = orderItems || [];

      const productRevenue = new Map<string, number>();
      for (const item of items) {
        totalRevenue += item.price * item.quantity;
        totalSold += item.quantity;
        productRevenue.set(
          item.product_id,
          (productRevenue.get(item.product_id) || 0) +
            item.price * item.quantity
        );
      }

      let maxRev = 0;
      for (const [pid, rev] of productRevenue) {
        if (rev > maxRev) {
          maxRev = rev;
          const prod = brandProducts.find((p) => p.id === pid);
          topProduct = prod?.name || null;
        }
      }
    }

    // Review stats
    let avgRating = 0;
    let totalReviews = 0;
    if (productIds.length > 0) {
      const { data: reviews } = await safeQuery(
        async () =>
          supabase
            .from("reviews")
            .select("rating")
            .in("product_id", productIds),
        { data: null } as any
      );
      const allReviews = reviews || [];
      totalReviews = allReviews.length;
      if (totalReviews > 0) {
        avgRating =
          allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
      }
    }

    return Response.json({
      brand,
      products: brandProducts,
      categories,
      revenueStats: { totalRevenue, totalSold, topProduct },
      reviewStats: { avgRating, totalReviews },
    });
  }

  // section=list (default)
  const page = parseInt(params.get("page") || "1", 10);
  const perPage = parseInt(params.get("per_page") || "25", 10);
  const search = params.get("search");
  const status = params.get("status");
  const hasProducts = params.get("has_products");
  const sort = params.get("sort") || "name";
  const order = params.get("order") || "asc";

  // Fetch all brands (we need to compute aggregates)
  let brandsQuery = supabase.from("brands").select("*");

  if (search) {
    brandsQuery = brandsQuery.or(
      `name.ilike.%${search}%,slug.ilike.%${search}%`
    );
  }
  if (status === "active") {
    brandsQuery = brandsQuery.eq("is_active", true);
  } else if (status === "hidden") {
    brandsQuery = brandsQuery.eq("is_active", false);
  }

  const { data: allBrands } = await safeQuery(
    async () => brandsQuery,
    { data: null } as any
  );
  const brands = allBrands || [];

  // Fetch products grouped by brand
  const { data: allProducts } = await safeQuery(
    async () => supabase.from("products").select("id, brand_id"),
    { data: null } as any
  );
  const products = allProducts || [];

  const brandProductCount = new Map<string, number>();
  const brandProductIds = new Map<string, string[]>();
  for (const p of products) {
    brandProductCount.set(
      p.brand_id,
      (brandProductCount.get(p.brand_id) || 0) + 1
    );
    const ids = brandProductIds.get(p.brand_id) || [];
    ids.push(p.id);
    brandProductIds.set(p.brand_id, ids);
  }

  // Revenue per brand
  const { data: orderItems } = await safeQuery(
    async () => supabase.from("order_items").select("product_id, quantity, price"),
    { data: null } as any
  );
  const items = orderItems || [];

  const productBrandMap = new Map<string, string>();
  for (const p of products) {
    productBrandMap.set(p.id, p.brand_id);
  }

  const brandRevenue = new Map<string, number>();
  for (const item of items) {
    const brandId = productBrandMap.get(item.product_id);
    if (brandId) {
      brandRevenue.set(
        brandId,
        (brandRevenue.get(brandId) || 0) + item.price * item.quantity
      );
    }
  }

  // Avg rating per brand
  const { data: reviews } = await safeQuery(
    async () => supabase.from("reviews").select("product_id, rating"),
    { data: null } as any
  );
  const allReviews = reviews || [];

  const brandRatingSum = new Map<string, number>();
  const brandRatingCount = new Map<string, number>();
  for (const r of allReviews) {
    const brandId = productBrandMap.get(r.product_id);
    if (brandId) {
      brandRatingSum.set(
        brandId,
        (brandRatingSum.get(brandId) || 0) + r.rating
      );
      brandRatingCount.set(
        brandId,
        (brandRatingCount.get(brandId) || 0) + 1
      );
    }
  }

  // Enrich brands
  let enriched = brands.map((b) => ({
    ...b,
    productCount: brandProductCount.get(b.id) || 0,
    revenue: brandRevenue.get(b.id) || 0,
    avgRating:
      brandRatingCount.get(b.id)
        ? (brandRatingSum.get(b.id) || 0) / brandRatingCount.get(b.id)!
        : 0,
  }));

  // Filter by has_products
  if (hasProducts === "true") {
    enriched = enriched.filter((b) => b.productCount > 0);
  } else if (hasProducts === "false") {
    enriched = enriched.filter((b) => b.productCount === 0);
  }

  // Sort
  const dir = order === "desc" ? -1 : 1;
  enriched.sort((a, b) => {
    switch (sort) {
      case "created_at":
        return (
          dir *
          (new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime())
        );
      case "products_count":
        return dir * (a.productCount - b.productCount);
      case "revenue":
        return dir * (a.revenue - b.revenue);
      case "name":
      default:
        return dir * a.name.localeCompare(b.name);
    }
  });

  const total = enriched.length;
  const start = (page - 1) * perPage;
  const paginated = enriched.slice(start, start + perPage);

  return Response.json({
    brands: paginated,
    total,
    page,
    per_page: perPage,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const body = await request.json();
  const { name, logo_url, is_active, meta_title, meta_description } = body;

  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  let slug = body.slug || slugify(name);

  // Check slug uniqueness
  const { data: existing } = await safeQuery(
    async () =>
      supabase
        .from("brands")
        .select("slug")
        .like("slug", `${slug}%`),
    { data: null } as any
  );
  const existingSlugs = new Set((existing || []).map((b) => b.slug));
  if (existingSlugs.has(slug)) {
    let counter = 2;
    while (existingSlugs.has(`${slug}-${counter}`)) {
      counter++;
    }
    slug = `${slug}-${counter}`;
  }

  const { data: brand, error } = await supabase
    .from("brands")
    .insert({
      name,
      slug,
      logo_url: logo_url || null,
      is_active: is_active ?? true,
      meta_title: meta_title || null,
      meta_description: meta_description || null,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ brand }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const body = await request.json();
  const { id, ...fields } = body;

  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: brand, error } = await supabase
    .from("brands")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ brand });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const body = await request.json();
  const { ids, transfer_to } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "Missing ids" }, { status: 400 });
  }

  // Check which brands have products
  const { data: products } = await safeQuery(
    async () =>
      supabase
        .from("products")
        .select("brand_id")
        .in("brand_id", ids),
    { data: null } as any
  );

  const brandIdsWithProducts = new Set(
    (products || []).map((p) => p.brand_id)
  );

  const blockedIds = ids.filter((id: string) => brandIdsWithProducts.has(id));

  if (blockedIds.length > 0) {
    // If a transfer target is provided, reassign the products then allow deletion
    if (transfer_to) {
      if (ids.includes(transfer_to)) {
        return Response.json(
          { error: "Cannot transfer products to a brand that is being deleted" },
          { status: 400 }
        );
      }
      const { data: targetBrand } = await safeQuery(
        async () => supabase.from("brands").select("id").eq("id", transfer_to).single(),
        { data: null } as any
      );
      if (!targetBrand) {
        return Response.json({ error: "Transfer target brand not found" }, { status: 400 });
      }
      const { error: transferError } = await supabase
        .from("products")
        .update({ brand_id: transfer_to })
        .in("brand_id", blockedIds);
      if (transferError) {
        return Response.json({ error: transferError.message }, { status: 500 });
      }
    } else {
      // No transfer target — block and report which brands are in use, with counts
      const counts = new Map<string, number>();
      (products || []).forEach((p) => counts.set(p.brand_id, (counts.get(p.brand_id) || 0) + 1));
      const { data: blockedBrands } = await safeQuery(
        async () =>
          supabase
            .from("brands")
            .select("id, name")
            .in("id", blockedIds),
        { data: null } as any
      );
      const detail = (blockedBrands || []).map((b) => ({ name: b.name, count: counts.get(b.id) || 0 }));
      return Response.json(
        {
          error: "Some brands are used by products and cannot be deleted",
          blocked: detail,
          requiresTransfer: true,
        },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase.from("brands").delete().in("id", ids);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ deleted: ids.length });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const body = await request.json();
  const { ids, action } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "Missing ids" }, { status: 400 });
  }

  if (action === "activate") {
    const { error } = await supabase
      .from("brands")
      .update({ is_active: true })
      .in("id", ids);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ updated: ids.length });
  }

  if (action === "hide") {
    const { error } = await supabase
      .from("brands")
      .update({ is_active: false })
      .in("id", ids);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ updated: ids.length });
  }

  if (action === "delete") {
    // Same checks as DELETE
    const { data: products } = await safeQuery(
      async () =>
        supabase
          .from("products")
          .select("brand_id")
          .in("brand_id", ids),
      { data: null } as any
    );

    const brandIdsWithProducts = new Set(
      (products || []).map((p) => p.brand_id)
    );

    const blockedIds = ids.filter((id: string) =>
      brandIdsWithProducts.has(id)
    );
    const deletableIds = ids.filter(
      (id: string) => !brandIdsWithProducts.has(id)
    );

    if (blockedIds.length > 0) {
      const { data: blockedBrands } = await safeQuery(
        async () =>
          supabase
            .from("brands")
            .select("name")
            .in("id", blockedIds),
        { data: null } as any
      );
      const names = (blockedBrands || []).map((b) => b.name);

      if (deletableIds.length === 0) {
        return Response.json(
          {
            error: "All selected brands have products and cannot be deleted",
            brands: names,
          },
          { status: 400 }
        );
      }

      // Delete those without products
      await supabase.from("brands").delete().in("id", deletableIds);

      return Response.json({
        deleted: deletableIds.length,
        skipped: names,
      });
    }

    const { error } = await supabase
      .from("brands")
      .delete()
      .in("id", ids);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ deleted: ids.length });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
