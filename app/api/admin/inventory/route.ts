// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function checkAdmin(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin")
    return { error: "Forbidden", status: 403 };
  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) {
      return Response.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get("section") || "kpis";

    // ─── KPIs ───
    if (section === "kpis") {
      const kpis = await safeQuery(async () => {
        const [
          productsCount,
          variantsCount,
          stockSum,
          outOfStockCount,
          lowStockCount,
          allVariantsWithProduct,
          reservedStockData,
        ] = await Promise.all([
          supabase
            .from("products")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("product_variants")
            .select("id", { count: "exact", head: true }),
          supabase.from("product_variants").select("stock"),
          supabase
            .from("product_variants")
            .select("id", { count: "exact", head: true })
            .eq("stock", 0),
          supabase
            .from("product_variants")
            .select("id", { count: "exact", head: true })
            .gt("stock", 0)
            .lte("stock", 5),
          supabase
            .from("product_variants")
            .select("id, stock, product_id, product:products(price)"),
          supabase
            .from("order_items")
            .select("quantity, order:orders!inner(status)")
            .in("order.status", ["pending", "processing"]),
        ]);

        const totalProducts = productsCount.count || 0;
        const totalVariants = variantsCount.count || 0;
        const totalStock = (stockSum.data || []).reduce(
          (sum: number, v: any) => sum + (Number(v.stock) || 0),
          0
        );
        const reservedStock = (reservedStockData.data || []).reduce(
          (sum: number, item: any) => sum + (Number(item.quantity) || 0),
          0
        );
        const availableStock = totalStock - reservedStock;
        const outOfStock = outOfStockCount.count || 0;
        const lowStock = lowStockCount.count || 0;

        const inventoryValue = (allVariantsWithProduct.data || []).reduce(
          (sum: number, v: any) => {
            const price = Number(v.product?.price) || 0;
            const stock = Number(v.stock) || 0;
            return sum + price * stock;
          },
          0
        );
        const inventoryCost = inventoryValue * 0.6;
        const potentialRevenue = inventoryValue - inventoryCost;
        const avgStockPerVariant =
          totalVariants > 0 ? Math.round((totalStock / totalVariants) * 100) / 100 : 0;
        const variantsInStock = totalVariants - outOfStock;
        const stockAccuracy =
          totalVariants > 0
            ? Math.round((variantsInStock / totalVariants) * 100 * 10) / 10
            : 0;

        return {
          totalProducts,
          totalVariants,
          totalStock,
          reservedStock,
          availableStock,
          outOfStock,
          lowStock,
          inventoryValue: Math.round(inventoryValue * 100) / 100,
          inventoryCost: Math.round(inventoryCost * 100) / 100,
          potentialRevenue: Math.round(potentialRevenue * 100) / 100,
          avgStockPerVariant,
          stockAccuracy,
        };
      }, {
        totalProducts: 0,
        totalVariants: 0,
        totalStock: 0,
        reservedStock: 0,
        availableStock: 0,
        outOfStock: 0,
        lowStock: 0,
        inventoryValue: 0,
        inventoryCost: 0,
        potentialRevenue: 0,
        avgStockPerVariant: 0,
        stockAccuracy: 0,
      });

      return Response.json({ kpis });
    }

    // ─── LIST ───
    if (section === "list") {
      const search = searchParams.get("search") || "";
      const status = searchParams.get("status") || "";
      const category_id = searchParams.get("category_id") || "";
      const brand_id = searchParams.get("brand_id") || "";
      const sort = searchParams.get("sort") || "name";
      const order = searchParams.get("order") || "asc";
      const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
      const per_page = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20")));

      const list = await safeQuery(async () => {
        let query = supabase
          .from("product_variants")
          .select(
            "id, product_id, size, color, color_hex, stock, sku, product:products(id, name, slug, price, compare_price, images, status, brand_id, category_id, brand:brands(id, name), category:categories(id, name))",
            { count: "exact" }
          );

        if (search) {
          query = query.or(
            `sku.ilike.%${search}%,product.name.ilike.%${search}%`
          );
        }

        if (status === "out_of_stock") {
          query = query.eq("stock", 0);
        } else if (status === "low_stock") {
          query = query.gt("stock", 0).lte("stock", 5);
        } else if (status === "in_stock") {
          query = query.gt("stock", 5);
        }

        if (category_id) {
          query = query.eq("product.category_id", category_id);
        }
        if (brand_id) {
          query = query.eq("product.brand_id", brand_id);
        }

        const sortColumn =
          sort === "name" ? "product.name" :
          sort === "stock" ? "stock" :
          sort === "price" ? "product.price" :
          sort === "sku" ? "sku" :
          "stock";

        const ascending = order === "asc";

        if (sort === "name" || sort === "price") {
          // For nested sorts, fall back to stock sort
          query = query.order("stock", { ascending });
        } else {
          query = query.order(sortColumn, { ascending });
        }

        const from = (page - 1) * per_page;
        const to = from + per_page - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;

        const items = (data || []).map((v: any) => ({
          variant_id: v.id,
          product_id: v.product_id,
          product_name: v.product?.name || "Unknown",
          product_slug: v.product?.slug || "",
          product_image: v.product?.images?.[0] || null,
          product_status: v.product?.status || "draft",
          price: Number(v.product?.price) || 0,
          compare_price: Number(v.product?.compare_price) || 0,
          brand_id: v.product?.brand_id || null,
          brand_name: v.product?.brand?.name || "",
          category_id: v.product?.category_id || null,
          category_name: v.product?.category?.name || "",
          size: v.size,
          color: v.color,
          color_hex: v.color_hex,
          stock: v.stock || 0,
          sku: v.sku || "",
          stock_status:
            v.stock === 0
              ? "out_of_stock"
              : v.stock <= 5
              ? "low_stock"
              : "in_stock",
        }));

        const total = count || 0;
        return {
          items,
          total,
          page,
          per_page,
          total_pages: Math.ceil(total / per_page),
        };
      }, { items: [], total: 0, page: 1, per_page: 20, total_pages: 0 });

      return Response.json(list);
    }

    // ─── DETAIL ───
    if (section === "detail") {
      const product_id = searchParams.get("product_id");
      if (!product_id) {
        return Response.json(
          { error: "product_id is required" },
          { status: 400 }
        );
      }

      const detail = await safeQuery(async () => {
        const [productRes, variantsRes, orderItemsRes, reviewsRes] =
          await Promise.all([
            supabase
              .from("products")
              .select(
                "id, name, slug, description, price, compare_price, images, tags, is_featured, is_new, status, created_at, brand:brands(id, name), category:categories(id, name)"
              )
              .eq("id", product_id)
              .single(),
            supabase
              .from("product_variants")
              .select("id, size, color, color_hex, stock, sku")
              .eq("product_id", product_id),
            supabase
              .from("order_items")
              .select(
                "id, variant_id, quantity, price, order:orders(id, status, created_at)"
              )
              .eq("product_id", product_id)
              .order("created_at", { ascending: false, referencedTable: "orders" })
              .limit(50),
            supabase
              .from("reviews")
              .select("id, rating, comment, created_at")
              .eq("product_id", product_id),
          ]);

        const product = productRes.data;
        const variants = variantsRes.data || [];
        const orderItems = orderItemsRes.data || [];
        const reviews = reviewsRes.data || [];

        // Get reserved stock per variant
        const variantIds = variants.map((v: any) => v.id);
        let reservedByVariant: Record<string, number> = {};
        if (variantIds.length > 0) {
          const { data: reservedData } = await supabase
            .from("order_items")
            .select("variant_id, quantity, order:orders!inner(status)")
            .in("variant_id", variantIds)
            .in("order.status", ["pending", "processing"]);

          (reservedData || []).forEach((item: any) => {
            reservedByVariant[item.variant_id] =
              (reservedByVariant[item.variant_id] || 0) +
              (Number(item.quantity) || 0);
          });
        }

        const stockSummary = variants.map((v: any) => {
          const reserved = reservedByVariant[v.id] || 0;
          return {
            variant_id: v.id,
            size: v.size,
            color: v.color,
            sku: v.sku,
            total: v.stock || 0,
            reserved,
            available: Math.max(0, (v.stock || 0) - reserved),
          };
        });

        const avgRating =
          reviews.length > 0
            ? Math.round(
                (reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) /
                  reviews.length) *
                  10
              ) / 10
            : 0;

        return {
          product,
          variants,
          orderHistory: orderItems.map((item: any) => ({
            id: item.id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            price: Number(item.price) || 0,
            order_id: item.order?.id,
            order_status: item.order?.status,
            order_date: item.order?.created_at,
          })),
          stockSummary,
          reviewStats: {
            totalReviews: reviews.length,
            avgRating,
          },
        };
      }, { data: null } as any);

      return Response.json(detail);
    }

    // ─── MOVEMENTS ───
    if (section === "movements") {
      const product_id = searchParams.get("product_id");
      if (!product_id) {
        return Response.json(
          { error: "product_id is required" },
          { status: 400 }
        );
      }

      const movements = await safeQuery(async () => {
        const { data: variantsRes } = await supabase
          .from("product_variants")
          .select("id")
          .eq("product_id", product_id);

        const variantIds = (variantsRes || []).map((v: any) => v.id);
        if (variantIds.length === 0) return [];

        const { data: items } = await supabase
          .from("order_items")
          .select(
            "id, variant_id, quantity, price, order:orders(id, status, created_at)"
          )
          .in("variant_id", variantIds)
          .order("created_at", { ascending: false, referencedTable: "orders" })
          .limit(100);

        return (items || []).map((item: any) => ({
          id: item.id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          price: Number(item.price) || 0,
          order_id: item.order?.id,
          order_status: item.order?.status,
          date: item.order?.created_at,
          type: "sale",
        }));
      }, []);

      return Response.json({ movements });
    }

    // ─── EXPORT ───
    if (section === "export") {
      const exportData = await safeQuery(async () => {
        const { data } = await supabase
          .from("product_variants")
          .select(
            "id, product_id, size, color, color_hex, stock, sku, product:products(id, name, slug, price, compare_price, images, status, brand:brands(id, name), category:categories(id, name))"
          );

        return (data || []).map((v: any) => ({
          variant_id: v.id,
          product_id: v.product_id,
          product_name: v.product?.name || "",
          product_slug: v.product?.slug || "",
          price: Number(v.product?.price) || 0,
          compare_price: Number(v.product?.compare_price) || 0,
          brand: v.product?.brand?.name || "",
          category: v.product?.category?.name || "",
          size: v.size,
          color: v.color,
          color_hex: v.color_hex,
          stock: v.stock || 0,
          sku: v.sku || "",
          status: v.product?.status || "draft",
          stock_status:
            v.stock === 0
              ? "out_of_stock"
              : v.stock <= 5
              ? "low_stock"
              : "in_stock",
        }));
      }, []);

      return Response.json({ data: exportData });
    }

    return Response.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Inventory API error:", error);
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
      return Response.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const { variant_id, stock } = body;

    if (!variant_id || stock === undefined || stock === null) {
      return Response.json(
        { error: "variant_id and stock are required" },
        { status: 400 }
      );
    }

    if (typeof stock !== "number" || stock < 0) {
      return Response.json(
        { error: "stock must be a non-negative number" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("product_variants")
      .update({ stock })
      .eq("id", variant_id)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, variant: data });
  } catch (error) {
    console.error("Inventory PUT error:", error);
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
      return Response.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const { action, variant_ids, value } = body;

    if (!action || !variant_ids || !Array.isArray(variant_ids) || variant_ids.length === 0) {
      return Response.json(
        { error: "action and variant_ids array are required" },
        { status: 400 }
      );
    }

    const validActions = ["adjust_stock", "add_stock", "reduce_stock", "mark_out_of_stock"];
    if (!validActions.includes(action)) {
      return Response.json(
        { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    let results: any[] = [];

    if (action === "mark_out_of_stock") {
      const { data, error } = await supabase
        .from("product_variants")
        .update({ stock: 0 })
        .in("id", variant_ids)
        .select();

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      results = data || [];
    } else if (action === "adjust_stock") {
      if (value === undefined || typeof value !== "number" || value < 0) {
        return Response.json(
          { error: "value must be a non-negative number for adjust_stock" },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from("product_variants")
        .update({ stock: value })
        .in("id", variant_ids)
        .select();

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      results = data || [];
    } else if (action === "add_stock" || action === "reduce_stock") {
      if (value === undefined || typeof value !== "number" || value < 0) {
        return Response.json(
          { error: "value must be a non-negative number" },
          { status: 400 }
        );
      }

      // Fetch current stock for all variants
      const { data: currentVariants } = await supabase
        .from("product_variants")
        .select("id, stock")
        .in("id", variant_ids);

      if (!currentVariants || currentVariants.length === 0) {
        return Response.json(
          { error: "No variants found" },
          { status: 404 }
        );
      }

      // Update each variant individually
      const updates = await Promise.all(
        currentVariants.map(async (v: any) => {
          const newStock =
            action === "add_stock"
              ? (v.stock || 0) + value
              : Math.max(0, (v.stock || 0) - value);

          const { data, error } = await supabase
            .from("product_variants")
            .update({ stock: newStock })
            .eq("id", v.id)
            .select()
            .single();

          return data;
        })
      );

      results = updates.filter(Boolean);
    }

    return Response.json({
      success: true,
      updated: results.length,
      variants: results,
    });
  } catch (error) {
    console.error("Inventory PATCH error:", error);
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
      return Response.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const { variant_id, adjustment, reason } = body;

    if (!variant_id || adjustment === undefined || typeof adjustment !== "number") {
      return Response.json(
        { error: "variant_id and adjustment (number) are required" },
        { status: 400 }
      );
    }

    // Get current stock
    const { data: variant, error: fetchError } = await supabase
      .from("product_variants")
      .select("id, stock")
      .eq("id", variant_id)
      .single();

    if (fetchError || !variant) {
      return Response.json(
        { error: "Variant not found" },
        { status: 404 }
      );
    }

    const newStock = Math.max(0, (variant.stock || 0) + adjustment);

    const { data, error } = await supabase
      .from("product_variants")
      .update({ stock: newStock })
      .eq("id", variant_id)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      variant: data,
      previous_stock: variant.stock || 0,
      new_stock: newStock,
      adjustment,
      reason: reason || "",
    });
  } catch (error) {
    console.error("Inventory POST error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
