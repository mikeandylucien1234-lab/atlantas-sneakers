import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get("section") || "list";

    if (section === "kpis") {
      const kpis = await safeQuery(async () => {
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [
          allProducts,
          variantsRes,
          orderItemsRes,
          reviewsRes,
          flashDealsRes,
          inventoryRes,
        ] = await Promise.all([
          supabase
            .from("products")
            .select("id, status, images, category_id, created_at"),
          supabase.from("product_variants").select("id, product_id, stock"),
          supabase.from("order_items").select("product_id, quantity"),
          supabase.from("reviews").select("rating"),
          supabase
            .from("flash_deals")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true),
          supabase
            .from("product_variants")
            .select("stock, product_id, product:products(price)"),
        ]);

        const products = allProducts.data || [];
        const variants = variantsRes.data || [];
        const orderItems = orderItemsRes.data || [];
        const reviews = reviewsRes.data || [];

        const totalProducts = products.length;
        const activeProducts = products.filter(
          (p) => p.status === "active"
        ).length;
        const draftProducts = products.filter(
          (p) => p.status === "draft"
        ).length;
        const archivedProducts = products.filter(
          (p) => p.status === "archived"
        ).length;

        const outOfStock = variants.filter((v) => v.stock === 0).length;
        const lowStock = variants.filter(
          (v) => v.stock >= 1 && v.stock <= 5
        ).length;

        // Best sellers
        const salesCount = new Map<string, number>();
        orderItems.forEach((item) => {
          salesCount.set(
            item.product_id,
            (salesCount.get(item.product_id) || 0) + (item.quantity || 1)
          );
        });
        const bestSellers = [...salesCount.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([product_id, count]) => ({ product_id, count }));

        const newProducts = products.filter(
          (p) => new Date(p.created_at) >= thirtyDaysAgo
        ).length;

        const flashDealProducts = flashDealsRes.count || 0;

        const averageRating =
          reviews.length > 0
            ? Math.round(
                (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) /
                  reviews.length) *
                  100
              ) / 100
            : 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inventoryData = (inventoryRes.data || []) as any[];
        const totalInventoryValue = inventoryData.reduce((sum, v) => {
          const price = Number(v.product?.price) || 0;
          const stock = v.stock || 0;
          return sum + price * stock;
        }, 0);

        const noImageProducts = products.filter(
          (p) => !p.images || (Array.isArray(p.images) && p.images.length === 0)
        ).length;

        const noCategoryProducts = products.filter(
          (p) => p.category_id === null
        ).length;

        return {
          totalProducts,
          activeProducts,
          draftProducts,
          archivedProducts,
          outOfStock,
          lowStock,
          bestSellers,
          newProducts,
          flashDealProducts,
          averageRating,
          totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
          noImageProducts,
          noCategoryProducts,
        };
      }, {
        totalProducts: 0, activeProducts: 0, draftProducts: 0,
        archivedProducts: 0, outOfStock: 0, lowStock: 0, bestSellers: [],
        newProducts: 0, flashDealProducts: 0, averageRating: 0,
        totalInventoryValue: 0, noImageProducts: 0, noCategoryProducts: 0,
      });

      return Response.json(kpis);
    }

    if (section === "list") {
      const page = parseInt(searchParams.get("page") || "1", 10);
      const per_page = parseInt(searchParams.get("per_page") || "20", 10);
      const search = searchParams.get("search");
      const status = searchParams.get("status");
      const category = searchParams.get("category");
      const brand = searchParams.get("brand");
      const stock = searchParams.get("stock");
      const featured = searchParams.get("featured");
      const is_new = searchParams.get("is_new");
      const has_flash_deal = searchParams.get("has_flash_deal");
      const sort = searchParams.get("sort") || "created_at";
      const order = searchParams.get("order") || "desc";

      const result = await safeQuery(async () => {
        // Build product query
        let query = supabase
          .from("products")
          .select(
            "id, name, slug, description, brand_id, category_id, price, compare_price, images, tags, is_featured, is_new, status, created_at, brand:brands(id, name, slug), category:categories(id, name, slug), variants:product_variants(id, size, color, color_hex, stock, sku)",
            { count: "exact" }
          );

        if (status) {
          query = query.eq("status", status);
        }
        if (category) {
          query = query.eq("category_id", category);
        }
        if (brand) {
          query = query.eq("brand_id", brand);
        }
        if (featured === "true") {
          query = query.eq("is_featured", true);
        } else if (featured === "false") {
          query = query.eq("is_featured", false);
        }
        if (is_new === "true") {
          query = query.eq("is_new", true);
        } else if (is_new === "false") {
          query = query.eq("is_new", false);
        }
        if (search) {
          query = query.or(
            `name.ilike.%${search}%,description.ilike.%${search}%`
          );
        }

        // Sort
        if (sort === "name" || sort === "price" || sort === "created_at") {
          query = query.order(sort, { ascending: order === "asc" });
        } else {
          query = query.order("created_at", { ascending: order === "asc" });
        }

        // Pagination
        const from = (page - 1) * per_page;
        const to = from + per_page - 1;
        query = query.range(from, to);

        const { data: products, count } = await query;

        if (!products || products.length === 0) {
          return { products: [], total: 0, page, per_page, totalPages: 0 };
        }

        const productIds = products.map((p) => p.id);

        // Get review stats, sales counts, and the CJ product identity (Product
        // ID + SKU, so an imported product's exact CJ listing is always
        // visible for manual searching/ordering) in parallel.
        const [reviewsRes, salesRes, flashDealsRes, supplierRes] = await Promise.all([
          supabase
            .from("reviews")
            .select("product_id, rating")
            .in("product_id", productIds),
          supabase
            .from("order_items")
            .select("product_id, quantity")
            .in("product_id", productIds),
          has_flash_deal === "true"
            ? supabase
                .from("flash_deals")
                .select("product_id")
                .eq("is_active", true)
                .in("product_id", productIds)
            : Promise.resolve({ data: null }),
          supabase
            .from("supplier_products")
            .select("imported_product_id, supplier_id, external_id, supplier_url, raw")
            .in("imported_product_id", productIds)
            .eq("imported", true),
        ]);

        // Supplier (CJ) identity per product: real Product ID + real SKU only
        // — never invented. `raw->sku` is the CJ product-level SKU captured at
        // import/sync (variant SKUs are separate, already shown per-variant).
        const supplierMap = new Map<string, { supplier_id: string; cj_product_id: string; cj_sku: string | null; supplier_url: string | null }>();
        (supplierRes.data || []).forEach((sp: { imported_product_id: string; supplier_id: string; external_id: string; supplier_url?: string | null; raw?: { sku?: string } }) => {
          supplierMap.set(sp.imported_product_id, {
            supplier_id: sp.supplier_id, cj_product_id: sp.external_id, cj_sku: sp.raw?.sku || null, supplier_url: sp.supplier_url || null,
          });
        });

        // Review stats per product
        const reviewStats = new Map<
          string,
          { count: number; total: number }
        >();
        (reviewsRes.data || []).forEach((r) => {
          const existing = reviewStats.get(r.product_id) || {
            count: 0,
            total: 0,
          };
          existing.count += 1;
          existing.total += r.rating || 0;
          reviewStats.set(r.product_id, existing);
        });

        // Sales count per product
        const salesMap = new Map<string, number>();
        (salesRes.data || []).forEach((item) => {
          salesMap.set(
            item.product_id,
            (salesMap.get(item.product_id) || 0) + (item.quantity || 1)
          );
        });

        // Flash deal product ids
        const flashDealIds = new Set(
          (flashDealsRes.data || []).map(
            (d: { product_id: string }) => d.product_id
          )
        );

        // Filter by stock at variant level
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let filteredProducts = products as any[];

        if (stock) {
          filteredProducts = filteredProducts.filter((p) => {
            const variants = p.variants || [];
            if (stock === "out") {
              return variants.some(
                (v: { stock: number }) => v.stock === 0
              );
            }
            if (stock === "low") {
              return variants.some(
                (v: { stock: number }) => v.stock >= 1 && v.stock <= 5
              );
            }
            if (stock === "ok") {
              return variants.every(
                (v: { stock: number }) => v.stock > 5
              );
            }
            return true;
          });
        }

        if (has_flash_deal === "true") {
          filteredProducts = filteredProducts.filter((p) =>
            flashDealIds.has(p.id)
          );
        }

        // Search in SKU (variant level + the CJ product-level SKU/Product ID)
        if (search) {
          const searchLower = search.toLowerCase();
          filteredProducts = filteredProducts.filter((p) => {
            const nameMatch = p.name?.toLowerCase().includes(searchLower);
            const descMatch = p.description
              ?.toLowerCase()
              .includes(searchLower);
            const skuMatch = (p.variants || []).some(
              (v: { sku: string }) =>
                v.sku?.toLowerCase().includes(searchLower)
            );
            const cjSupplier = supplierMap.get(p.id);
            const cjMatch = cjSupplier && (
              cjSupplier.cj_sku?.toLowerCase().includes(searchLower) ||
              cjSupplier.cj_product_id?.toLowerCase().includes(searchLower)
            );
            return nameMatch || descMatch || skuMatch || cjMatch;
          });
        }

        const enrichedProducts = filteredProducts.map((p) => {
          const rs = reviewStats.get(p.id);
          const sales = salesMap.get(p.id) || 0;
          const supplier = supplierMap.get(p.id);
          return {
            ...p,
            reviewCount: rs?.count || 0,
            averageRating: rs
              ? Math.round((rs.total / rs.count) * 10) / 10
              : 0,
            salesCount: sales,
            supplier_id: supplier?.supplier_id || null,
            cj_product_id: supplier?.cj_product_id || null,
            cj_sku: supplier?.cj_sku || null,
            supplier_url: supplier?.supplier_url || null,
          };
        });

        // Sort by computed fields
        if (sort === "stock") {
          enrichedProducts.sort((a, b) => {
            const aStock = (a.variants || []).reduce(
              (sum: number, v: { stock: number }) => sum + (v.stock || 0),
              0
            );
            const bStock = (b.variants || []).reduce(
              (sum: number, v: { stock: number }) => sum + (v.stock || 0),
              0
            );
            return order === "asc" ? aStock - bStock : bStock - aStock;
          });
        } else if (sort === "rating") {
          enrichedProducts.sort((a, b) =>
            order === "asc"
              ? a.averageRating - b.averageRating
              : b.averageRating - a.averageRating
          );
        } else if (sort === "sales") {
          enrichedProducts.sort((a, b) =>
            order === "asc"
              ? a.salesCount - b.salesCount
              : b.salesCount - a.salesCount
          );
        }

        const total = count || 0;
        return {
          products: enrichedProducts,
          total,
          page,
          per_page,
          totalPages: Math.ceil(total / per_page),
        };
      }, { products: [], total: 0, page, per_page, totalPages: 0 });

      return Response.json(result);
    }

    if (section === "detail") {
      const id = searchParams.get("id");
      if (!id) {
        return Response.json(
          { error: "Product id is required" },
          { status: 400 }
        );
      }

      const detail = await safeQuery(async () => {
        const [productRes, reviewsRes, flashDealsRes, salesRes, supplierRes] =
          await Promise.all([
            supabase
              .from("products")
              .select(
                "*, brand:brands(*), category:categories(*), variants:product_variants(*)"
              )
              .eq("id", id)
              .single(),
            supabase
              .from("reviews")
              .select("*, profile:profiles(id, full_name, email)")
              .eq("product_id", id)
              .order("created_at", { ascending: false }),
            supabase
              .from("flash_deals")
              .select("*")
              .eq("product_id", id)
              .order("created_at", { ascending: false }),
            supabase
              .from("order_items")
              .select("quantity, price")
              .eq("product_id", id),
            supabase
              .from("supplier_products")
              .select("supplier_id, external_id, supplier_url, supplier_price, weight, updated_at, raw")
              .eq("imported_product_id", id)
              .eq("imported", true)
              .maybeSingle(),
          ]);

        if (!productRes.data) return null;

        let supplierName: string | null = null;
        if (supplierRes.data?.supplier_id) {
          const { data: supRow } = await supabase.from("suppliers").select("name").eq("id", supplierRes.data.supplier_id).maybeSingle();
          supplierName = supRow?.name || null;
        }

        const salesData = salesRes.data || [];
        const totalSales = salesData.reduce(
          (sum, item) => sum + (item.quantity || 0),
          0
        );
        const totalRevenue = salesData.reduce(
          (sum, item) =>
            sum + (Number(item.price) || 0) * (item.quantity || 1),
          0
        );

        const sp = supplierRes.data as { supplier_id?: string; external_id?: string; supplier_url?: string | null; supplier_price?: number | null; weight?: number | null; updated_at?: string | null; raw?: { sku?: string } } | null;
        return {
          ...productRes.data,
          reviews: reviewsRes.data || [],
          flash_deals: flashDealsRes.data || [],
          salesStats: {
            totalSales,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
          },
          supplier_id: sp?.supplier_id || null,
          supplier_name: supplierName,
          cj_product_id: sp?.external_id || null,
          cj_sku: sp?.raw?.sku || null,
          supplier_url: sp?.supplier_url || null,
          supplier_cost: sp?.supplier_price ?? null,
          supplier_weight: sp?.weight ?? null,
          supplier_synced_at: sp?.updated_at || null,
        };
      }, null);

      if (!detail) {
        return Response.json(
          { error: "Product not found" },
          { status: 404 }
        );
      }

      return Response.json(detail);
    }

    if (section === "export") {
      const data = await safeQuery(async () => {
        const { data: products } = await supabase
          .from("products")
          .select(
            "*, brand:brands(id, name), category:categories(id, name), variants:product_variants(*)"
          )
          .order("created_at", { ascending: false });

        return products || [];
      }, []);

      return Response.json({ products: data });
    }

    return Response.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Products API GET error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { variants, ...productData } = body;

    const { data: product, error: productError } = await supabase
      .from("products")
      .insert(productData)
      .select()
      .single();

    if (productError) {
      return Response.json(
        { error: productError.message },
        { status: 400 }
      );
    }

    if (variants && Array.isArray(variants) && variants.length > 0) {
      const variantRows = variants.map(
        (v: { size: string; color: string; color_hex: string; stock: number; sku: string }) => ({
          ...v,
          product_id: product.id,
        })
      );

      const { error: variantError } = await supabase
        .from("product_variants")
        .insert(variantRows);

      if (variantError) {
        return Response.json(
          { error: variantError.message },
          { status: 400 }
        );
      }
    }

    // Return product with variants
    const { data: fullProduct } = await supabase
      .from("products")
      .select("*, variants:product_variants(*)")
      .eq("id", product.id)
      .single();

    return Response.json(fullProduct, { status: 201 });
  } catch (error) {
    console.error("Products API POST error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, variants, ...productData } = body;

    if (!id) {
      return Response.json(
        { error: "Product id is required" },
        { status: 400 }
      );
    }

    const { error: productError } = await supabase
      .from("products")
      .update(productData)
      .eq("id", id);

    if (productError) {
      return Response.json(
        { error: productError.message },
        { status: 400 }
      );
    }

    if (variants && Array.isArray(variants)) {
      // Delete old variants and insert new ones
      await supabase
        .from("product_variants")
        .delete()
        .eq("product_id", id);

      if (variants.length > 0) {
        const variantRows = variants.map(
          (v: { size: string; color: string; color_hex: string; stock: number; sku: string }) => ({
            ...v,
            product_id: id,
          })
        );

        const { error: variantError } = await supabase
          .from("product_variants")
          .insert(variantRows);

        if (variantError) {
          return Response.json(
            { error: variantError.message },
            { status: 400 }
          );
        }
      }
    }

    const { data: fullProduct } = await supabase
      .from("products")
      .select("*, variants:product_variants(*)")
      .eq("id", id)
      .single();

    return Response.json(fullProduct);
  } catch (error) {
    console.error("Products API PUT error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { id, ids, soft } = body;

    const targetIds: string[] = ids || (id ? [id] : []);
    if (targetIds.length === 0) {
      return Response.json(
        { error: "Product id or ids required" },
        { status: 400 }
      );
    }

    if (soft) {
      const { error } = await supabase
        .from("products")
        .update({ status: "archived" })
        .in("id", targetIds);

      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
    } else {
      // Hard delete: variants first, then products
      await supabase
        .from("product_variants")
        .delete()
        .in("product_id", targetIds);

      const { error } = await supabase
        .from("products")
        .delete()
        .in("id", targetIds);

      if (error) {
        return Response.json({ error: error.message }, { status: 400 });
      }
    }

    return Response.json({ success: true, deleted: targetIds.length });
  } catch (error) {
    console.error("Products API DELETE error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { ids, action, value } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return Response.json(
        { error: "ids array is required" },
        { status: 400 }
      );
    }

    if (!action) {
      return Response.json(
        { error: "action is required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "activate": {
        const { error } = await supabase
          .from("products")
          .update({ status: "active" })
          .in("id", ids);
        if (error)
          return Response.json({ error: error.message }, { status: 400 });
        break;
      }
      case "draft": {
        const { error } = await supabase
          .from("products")
          .update({ status: "draft" })
          .in("id", ids);
        if (error)
          return Response.json({ error: error.message }, { status: 400 });
        break;
      }
      case "archive": {
        const { error } = await supabase
          .from("products")
          .update({ status: "archived" })
          .in("id", ids);
        if (error)
          return Response.json({ error: error.message }, { status: 400 });
        break;
      }
      case "delete": {
        await supabase
          .from("product_variants")
          .delete()
          .in("product_id", ids);
        const { error } = await supabase
          .from("products")
          .delete()
          .in("id", ids);
        if (error)
          return Response.json({ error: error.message }, { status: 400 });
        break;
      }
      case "configure_supplier_source": {
        // Admin-entered "where this product actually comes from" — the exact
        // source/fournisseur URL used by "View Store" on Products + Orders.
        // Never auto-guessed: CJ's API does not return an official product
        // page URL, so this is set once by a human and reused everywhere.
        if (ids.length !== 1) {
          return Response.json({ error: "configure_supplier_source takes exactly one product id" }, { status: 400 });
        }
        const productId = ids[0];
        const supplierId = String(value?.supplier_id || "").trim();
        const supplierUrl = String(value?.supplier_url || "").trim();
        if (!supplierId) return Response.json({ error: "supplier_id is required" }, { status: 400 });
        if (supplierUrl) {
          let parsed: URL;
          try { parsed = new URL(supplierUrl); } catch { return Response.json({ error: "Invalid supplier URL" }, { status: 400 }); }
          if (parsed.protocol !== "https:") {
            return Response.json({ error: "Supplier URL must use https://" }, { status: 400 });
          }
        }
        const { data: existing } = await supabase
          .from("supplier_products")
          .select("id")
          .eq("imported_product_id", productId)
          .eq("supplier_id", supplierId)
          .maybeSingle();
        if (existing) {
          const { error } = await supabase
            .from("supplier_products")
            .update({ supplier_url: supplierUrl || null })
            .eq("id", existing.id);
          if (error) return Response.json({ error: error.message }, { status: 400 });
        } else {
          const { error } = await supabase
            .from("supplier_products")
            .insert({
              supplier_id: supplierId,
              imported_product_id: productId,
              external_id: String(value?.supplier_product_id || "").trim() || `manual-${productId}`,
              supplier_url: supplierUrl || null,
              imported: true,
            });
          if (error) return Response.json({ error: error.message }, { status: 400 });
        }
        break;
      }
      case "update_category": {
        const { error } = await supabase
          .from("products")
          .update({ category_id: value })
          .in("id", ids);
        if (error)
          return Response.json({ error: error.message }, { status: 400 });
        break;
      }
      case "update_brand": {
        const { error } = await supabase
          .from("products")
          .update({ brand_id: value })
          .in("id", ids);
        if (error)
          return Response.json({ error: error.message }, { status: 400 });
        break;
      }
      case "add_tags": {
        // Fetch current tags, merge, update
        const { data: products } = await supabase
          .from("products")
          .select("id, tags")
          .in("id", ids);

        if (products) {
          const updates = products.map((p) => {
            const currentTags: string[] = p.tags || [];
            const newTags = Array.isArray(value) ? value : [value];
            const merged = [...new Set([...currentTags, ...newTags])];
            return supabase
              .from("products")
              .update({ tags: merged })
              .eq("id", p.id);
          });
          await Promise.all(updates);
        }
        break;
      }
      case "remove_tags": {
        const { data: products } = await supabase
          .from("products")
          .select("id, tags")
          .in("id", ids);

        if (products) {
          const tagsToRemove = Array.isArray(value) ? value : [value];
          const updates = products.map((p) => {
            const currentTags: string[] = p.tags || [];
            const filtered = currentTags.filter(
              (t) => !tagsToRemove.includes(t)
            );
            return supabase
              .from("products")
              .update({ tags: filtered })
              .eq("id", p.id);
          });
          await Promise.all(updates);
        }
        break;
      }
      default:
        return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    return Response.json({ success: true, updated: ids.length });
  } catch (error) {
    console.error("Products API PATCH error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
