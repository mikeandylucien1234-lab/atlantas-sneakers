// @ts-nocheck
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
        const now = new Date().toISOString();

        const [
          activeRes,
          scheduledRes,
          expiredRes,
          draftRes,
          allDealsRes,
          activeDealsForStats,
        ] = await Promise.all([
          supabase
            .from("flash_deals")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true)
            .gt("ends_at", now),
          supabase
            .from("flash_deals")
            .select("id", { count: "exact", head: true })
            .eq("is_active", false)
            .gt("ends_at", now),
          supabase
            .from("flash_deals")
            .select("id", { count: "exact", head: true })
            .lt("ends_at", now),
          supabase
            .from("flash_deals")
            .select("id", { count: "exact", head: true })
            .eq("is_active", false),
          supabase
            .from("flash_deals")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("flash_deals")
            .select("id, product_id, deal_price, original_price")
            .eq("is_active", true)
            .gt("ends_at", now),
        ]);

        const activeDeals = activeDealsForStats.data || [];
        const activeProductIds = activeDeals.map((d) => d.product_id);
        const totalProducts = new Set(activeProductIds).size;

        let revenueGenerated = 0;
        let ordersGenerated = 0;

        if (activeProductIds.length > 0) {
          const { data: orderItems } = await supabase
            .from("order_items")
            .select("order_id, price, quantity, product_id")
            .in("product_id", activeProductIds);

          const items = orderItems || [];
          revenueGenerated = items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );
          ordersGenerated = new Set(items.map((i) => i.order_id)).size;
        }

        let avgDiscount = 0;
        if (activeDeals.length > 0) {
          const totalDiscount = activeDeals.reduce((sum, d) => {
            if (d.original_price > 0) {
              return (
                sum +
                ((d.original_price - d.deal_price) / d.original_price) * 100
              );
            }
            return sum;
          }, 0);
          avgDiscount = totalDiscount / activeDeals.length;
        }

        return {
          activeDeals: activeRes.count || 0,
          scheduledDeals: scheduledRes.count || 0,
          expiredDeals: expiredRes.count || 0,
          draftDeals: draftRes.count || 0,
          totalProducts,
          revenueGenerated,
          ordersGenerated,
          avgDiscount: Math.round(avgDiscount * 100) / 100,
          totalDeals: allDealsRes.count || 0,
        };
      }, { data: null } as any);

      return Response.json(kpis);
    }

    if (section === "list") {
      const search = searchParams.get("search") || "";
      const status = searchParams.get("status") || "all";
      const categoryId = searchParams.get("category_id");
      const brandId = searchParams.get("brand_id");
      const sort = searchParams.get("sort") || "created_at";
      const order = searchParams.get("order") || "desc";
      const page = parseInt(searchParams.get("page") || "1");
      const perPage = parseInt(searchParams.get("per_page") || "20");
      const offset = (page - 1) * perPage;

      const result = await safeQuery(async () => {
        let query = supabase
          .from("flash_deals")
          .select(
            `
            *,
            product:products(
              id, name, slug, images, price,
              brand:brands(id, name),
              category:categories(id, name)
            )
          `,
            { count: "exact" }
          );

        if (search) {
          const { data: matchingProducts } = await supabase
            .from("products")
            .select("id")
            .ilike("name", `%${search}%`);
          const productIds = (matchingProducts || []).map((p) => p.id);
          if (productIds.length > 0) {
            query = query.in("product_id", productIds);
          } else {
            return { deals: [], total: 0, page, perPage };
          }
        }

        if (categoryId) {
          const { data: catProducts } = await supabase
            .from("products")
            .select("id")
            .eq("category_id", categoryId);
          const catProductIds = (catProducts || []).map((p) => p.id);
          if (catProductIds.length > 0) {
            query = query.in("product_id", catProductIds);
          } else {
            return { deals: [], total: 0, page, perPage };
          }
        }

        if (brandId) {
          const { data: brandProducts } = await supabase
            .from("products")
            .select("id")
            .eq("brand_id", brandId);
          const brandProductIds = (brandProducts || []).map((p) => p.id);
          if (brandProductIds.length > 0) {
            query = query.in("product_id", brandProductIds);
          } else {
            return { deals: [], total: 0, page, perPage };
          }
        }

        const now = new Date().toISOString();
        if (status === "active") {
          query = query.eq("is_active", true).gt("ends_at", now);
        } else if (status === "expired") {
          query = query.lt("ends_at", now);
        } else if (status === "scheduled") {
          query = query.eq("is_active", false).gt("ends_at", now);
        } else if (status === "draft") {
          query = query.eq("is_active", false).or(
            `ends_at.is.null,ends_at.gt.${now}`
          );
        }

        if (sort === "name") {
          query = query.order("created_at", { ascending: order === "asc" });
        } else if (sort === "discount") {
          query = query.order("deal_price", { ascending: order === "asc" });
        } else {
          query = query.order(sort, { ascending: order === "asc" });
        }

        query = query.range(offset, offset + perPage - 1);

        const { data, count } = await query;
        const deals = (data || []).map((deal) => {
          const discountPct =
            deal.original_price > 0
              ? Math.round(
                  ((deal.original_price - deal.deal_price) /
                    deal.original_price) *
                    100 *
                    100
                ) / 100
              : 0;

          const nowMs = Date.now();
          const endsAtMs = deal.ends_at
            ? new Date(deal.ends_at).getTime()
            : null;
          const remaining =
            endsAtMs && endsAtMs > nowMs
              ? Math.floor((endsAtMs - nowMs) / 1000)
              : null;

          let computedStatus = "draft";
          if (deal.is_active && endsAtMs && endsAtMs > nowMs) {
            computedStatus = "active";
          } else if (!deal.is_active && endsAtMs && endsAtMs > nowMs) {
            computedStatus = "scheduled";
          } else if (endsAtMs && endsAtMs < nowMs) {
            computedStatus = "expired";
          }

          return {
            ...deal,
            discount_pct: discountPct,
            remaining,
            status: computedStatus,
          };
        });

        return { deals, total: count || 0, page, perPage };
      }, { data: null } as any);

      return Response.json(result);
    }

    if (section === "detail") {
      const id = searchParams.get("id");
      if (!id) {
        return Response.json({ error: "Missing id" }, { status: 400 });
      }

      const detail = await safeQuery(async () => {
        const { data: deal } = await supabase
          .from("flash_deals")
          .select(
            `
            *,
            product:products(
              id, name, slug, description, price, compare_price, images, tags, is_featured, is_new, status, created_at,
              brand:brands(id, name, slug),
              category:categories(id, name, slug),
              variants:product_variants(id, size, color, color_hex, stock, sku)
            )
          `
          )
          .eq("id", id)
          .single();

        if (!deal) return null;

        let revenue = 0;
        let orders = 0;

        const { data: orderItems } = await supabase
          .from("order_items")
          .select("order_id, price, quantity")
          .eq("product_id", deal.product_id);

        const items = orderItems || [];
        revenue = items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        orders = new Set(items.map((i) => i.order_id)).size;

        const discountPct =
          deal.original_price > 0
            ? Math.round(
                ((deal.original_price - deal.deal_price) /
                  deal.original_price) *
                  100 *
                  100
              ) / 100
            : 0;

        const savings = deal.original_price - deal.deal_price;

        return {
          ...deal,
          salesStats: { revenue, orders },
          discountInfo: {
            original_price: deal.original_price,
            deal_price: deal.deal_price,
            discount_pct: discountPct,
            savings,
          },
        };
      }, { data: null } as any);

      if (!detail) {
        return Response.json(
          { error: "Flash deal not found" },
          { status: 404 }
        );
      }

      return Response.json(detail);
    }

    if (section === "export") {
      const exportData = await safeQuery(async () => {
        const { data } = await supabase
          .from("flash_deals")
          .select(
            `
            *,
            product:products(
              id, name, slug, price, images,
              brand:brands(id, name),
              category:categories(id, name)
            )
          `
          )
          .order("created_at", { ascending: false });

        return data || [];
      }, { data: null } as any);

      return Response.json(exportData);
    }

    return Response.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Flash deals GET error:", error);
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
    const { product_id, deal_price, original_price, ends_at, is_active } = body;

    if (!product_id || !deal_price || !ends_at) {
      return Response.json(
        { error: "Missing required fields: product_id, deal_price, ends_at" },
        { status: 400 }
      );
    }

    const { data: product } = await supabase
      .from("products")
      .select("id, price")
      .eq("id", product_id)
      .single();

    if (!product) {
      return Response.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const finalOriginalPrice = original_price || product.price;

    if (deal_price >= finalOriginalPrice) {
      return Response.json(
        { error: "Deal price must be less than original price" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data: existingDeal } = await supabase
      .from("flash_deals")
      .select("id")
      .eq("product_id", product_id)
      .eq("is_active", true)
      .gt("ends_at", now)
      .single();

    if (existingDeal) {
      return Response.json(
        { error: "Product already has an active flash deal" },
        { status: 409 }
      );
    }

    const { data: deal, error } = await supabase
      .from("flash_deals")
      .insert({
        product_id,
        deal_price,
        original_price: finalOriginalPrice,
        ends_at,
        is_active: is_active ?? false,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(deal, { status: 201 });
  } catch (error) {
    console.error("Flash deals POST error:", error);
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
    const { id, deal_price, original_price, ends_at, is_active } = body;

    if (!id) {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }

    if (deal_price !== undefined && original_price !== undefined) {
      if (deal_price >= original_price) {
        return Response.json(
          { error: "Deal price must be less than original price" },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, any> = {};
    if (deal_price !== undefined) updates.deal_price = deal_price;
    if (original_price !== undefined) updates.original_price = original_price;
    if (ends_at !== undefined) updates.ends_at = ends_at;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data: deal, error } = await supabase
      .from("flash_deals")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(deal);
  } catch (error) {
    console.error("Flash deals PUT error:", error);
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
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return Response.json(
        { error: "Missing or invalid ids array" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("flash_deals")
      .delete()
      .in("id", ids);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error("Flash deals DELETE error:", error);
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
    const { ids, action } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0 || !action) {
      return Response.json(
        { error: "Missing ids array or action" },
        { status: 400 }
      );
    }

    let error;

    switch (action) {
      case "activate": {
        const result = await supabase
          .from("flash_deals")
          .update({ is_active: true })
          .in("id", ids);
        error = result.error;
        break;
      }
      case "deactivate": {
        const result = await supabase
          .from("flash_deals")
          .update({ is_active: false })
          .in("id", ids);
        error = result.error;
        break;
      }
      case "delete": {
        const result = await supabase
          .from("flash_deals")
          .delete()
          .in("id", ids);
        error = result.error;
        break;
      }
      case "expire": {
        const result = await supabase
          .from("flash_deals")
          .update({ ends_at: new Date().toISOString() })
          .in("id", ids);
        error = result.error;
        break;
      }
      default:
        return Response.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, action, affected: ids.length });
  } catch (error) {
    console.error("Flash deals PATCH error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
