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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

function computeLevels(
  categories: { id: string; parent_id: string | null }[]
): Map<string, number> {
  const parentMap = new Map<string, string | null>();
  for (const c of categories) {
    parentMap.set(c.id, c.parent_id);
  }
  const levelCache = new Map<string, number>();

  function getLevel(id: string): number {
    if (levelCache.has(id)) return levelCache.get(id)!;
    const parentId = parentMap.get(id);
    if (!parentId) {
      levelCache.set(id, 0);
      return 0;
    }
    const level = getLevel(parentId) + 1;
    levelCache.set(id, level);
    return level;
  }

  for (const c of categories) {
    getLevel(c.id);
  }
  return levelCache;
}

function getDescendantIds(
  categoryId: string,
  categories: { id: string; parent_id: string | null }[]
): Set<string> {
  const childrenMap = new Map<string, string[]>();
  for (const c of categories) {
    if (c.parent_id) {
      const arr = childrenMap.get(c.parent_id) || [];
      arr.push(c.id);
      childrenMap.set(c.parent_id, arr);
    }
  }
  const descendants = new Set<string>();
  const stack = [categoryId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = childrenMap.get(current) || [];
    for (const child of children) {
      descendants.add(child);
      stack.push(child);
    }
  }
  return descendants;
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
        const [categoriesRes, productsRes, orderItemsRes] = await Promise.all([
          supabase.from("categories").select("id, name, parent_id, image_url, is_active"),
          supabase.from("products").select("id, category_id"),
          supabase.from("order_items").select("product_id, quantity, price"),
        ]);

        const categories = categoriesRes.data || [];
        const products = productsRes.data || [];
        const orderItems = orderItemsRes.data || [];

        const totalCategories = categories.length;
        const activeCategories = categories.filter((c) => c.is_active).length;
        const hiddenCategories = categories.filter((c) => !c.is_active).length;
        const rootCategories = categories.filter((c) => !c.parent_id).length;
        const subcategories = categories.filter((c) => c.parent_id).length;

        // Categories without products
        const categoryIdsWithProducts = new Set(
          products.map((p) => p.category_id).filter(Boolean)
        );
        const categoriesWithoutProducts = categories.filter(
          (c) => !categoryIdsWithProducts.has(c.id)
        ).length;

        // Categories without image
        const categoriesWithoutImage = categories.filter(
          (c) => !c.image_url || c.image_url === ""
        ).length;

        // Revenue by category
        const productCategoryMap = new Map<string, string>();
        for (const p of products) {
          if (p.category_id) productCategoryMap.set(p.id, p.category_id);
        }

        const revenueByCategory = new Map<string, number>();
        for (const item of orderItems) {
          const catId = productCategoryMap.get(item.product_id);
          if (catId) {
            revenueByCategory.set(
              catId,
              (revenueByCategory.get(catId) || 0) + item.price * item.quantity
            );
          }
        }

        let highestRevenueCategory: { name: string; revenue: number } | null = null;
        let maxRevenue = 0;
        for (const [catId, revenue] of revenueByCategory) {
          if (revenue > maxRevenue) {
            maxRevenue = revenue;
            const cat = categories.find((c) => c.id === catId);
            highestRevenueCategory = { name: cat?.name || "", revenue };
          }
        }

        // Most products category
        const productCountByCategory = new Map<string, number>();
        for (const p of products) {
          if (p.category_id) {
            productCountByCategory.set(
              p.category_id,
              (productCountByCategory.get(p.category_id) || 0) + 1
            );
          }
        }

        let mostProductsCategory: { name: string; count: number } | null = null;
        let maxCount = 0;
        for (const [catId, count] of productCountByCategory) {
          if (count > maxCount) {
            maxCount = count;
            const cat = categories.find((c) => c.id === catId);
            mostProductsCategory = { name: cat?.name || "", count };
          }
        }

        return {
          totalCategories,
          activeCategories,
          hiddenCategories,
          rootCategories,
          subcategories,
          categoriesWithoutProducts,
          categoriesWithoutImage,
          highestRevenueCategory,
          mostProductsCategory,
        };
      }, {
        totalCategories: 0,
        activeCategories: 0,
        hiddenCategories: 0,
        rootCategories: 0,
        subcategories: 0,
        categoriesWithoutProducts: 0,
        categoriesWithoutImage: 0,
        highestRevenueCategory: null,
        mostProductsCategory: null,
      });

      return Response.json(kpis);
    }

    if (section === "list") {
      const page = parseInt(searchParams.get("page") || "1", 10);
      const per_page = parseInt(searchParams.get("per_page") || "25", 10);
      const search = searchParams.get("search") || "";
      const status = searchParams.get("status") || "";
      const parent = searchParams.get("parent") || "";
      const has_products = searchParams.get("has_products") || "";
      const sort = searchParams.get("sort") || "name";
      const order = searchParams.get("order") || "asc";

      const [allCategoriesRes, productsRes, orderItemsRes] = await Promise.all([
        supabase.from("categories").select("id, name, slug, parent_id, image_url, is_active, created_at"),
        supabase.from("products").select("id, category_id"),
        supabase.from("order_items").select("product_id, quantity, price"),
      ]);

      const allCategories = allCategoriesRes.data || [];
      const products = productsRes.data || [];
      const orderItems = orderItemsRes.data || [];

      // Product counts by category
      const productCountMap = new Map<string, number>();
      for (const p of products) {
        if (p.category_id) {
          productCountMap.set(p.category_id, (productCountMap.get(p.category_id) || 0) + 1);
        }
      }

      // Children counts
      const childrenCountMap = new Map<string, number>();
      for (const c of allCategories) {
        if (c.parent_id) {
          childrenCountMap.set(c.parent_id, (childrenCountMap.get(c.parent_id) || 0) + 1);
        }
      }

      // Levels
      const levelMap = computeLevels(allCategories);

      // Revenue by category
      const productCategoryMap = new Map<string, string>();
      for (const p of products) {
        if (p.category_id) productCategoryMap.set(p.id, p.category_id);
      }
      const revenueMap = new Map<string, number>();
      for (const item of orderItems) {
        const catId = productCategoryMap.get(item.product_id);
        if (catId) {
          revenueMap.set(catId, (revenueMap.get(catId) || 0) + item.price * item.quantity);
        }
      }

      // Filter
      let filtered = allCategories;

      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(
          (c) => c.name.toLowerCase().includes(s) || c.slug.toLowerCase().includes(s)
        );
      }

      if (status === "active") {
        filtered = filtered.filter((c) => c.is_active);
      } else if (status === "hidden") {
        filtered = filtered.filter((c) => !c.is_active);
      }

      if (parent === "root") {
        filtered = filtered.filter((c) => !c.parent_id);
      } else if (parent) {
        filtered = filtered.filter((c) => c.parent_id === parent);
      }

      if (has_products === "true") {
        filtered = filtered.filter((c) => (productCountMap.get(c.id) || 0) > 0);
      } else if (has_products === "false") {
        filtered = filtered.filter((c) => (productCountMap.get(c.id) || 0) === 0);
      }

      // Sort
      const ascending = order === "asc";
      filtered.sort((a, b) => {
        let cmp = 0;
        if (sort === "name") {
          cmp = a.name.localeCompare(b.name);
        } else if (sort === "created_at") {
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        } else if (sort === "products_count") {
          cmp = (productCountMap.get(a.id) || 0) - (productCountMap.get(b.id) || 0);
        }
        return ascending ? cmp : -cmp;
      });

      const total = filtered.length;
      const start = (page - 1) * per_page;
      const paginated = filtered.slice(start, start + per_page);

      const categories = paginated.map((c) => ({
        ...c,
        productCount: productCountMap.get(c.id) || 0,
        childrenCount: childrenCountMap.get(c.id) || 0,
        level: levelMap.get(c.id) || 0,
        revenue: revenueMap.get(c.id) || 0,
      }));

      return Response.json({ categories, total, page, per_page });
    }

    if (section === "tree") {
      const [categoriesRes, productsRes] = await Promise.all([
        supabase.from("categories").select("id, name, slug, image_url, is_active, parent_id"),
        supabase.from("products").select("id, category_id"),
      ]);

      const categories = categoriesRes.data || [];
      const products = productsRes.data || [];

      const productCountMap = new Map<string, number>();
      for (const p of products) {
        if (p.category_id) {
          productCountMap.set(p.category_id, (productCountMap.get(p.category_id) || 0) + 1);
        }
      }

      interface TreeNode {
        id: string;
        name: string;
        slug: string;
        image_url: string | null;
        is_active: boolean;
        parent_id: string | null;
        productCount: number;
        children: TreeNode[];
      }

      const nodeMap = new Map<string, TreeNode>();
      for (const c of categories) {
        nodeMap.set(c.id, {
          ...c,
          productCount: productCountMap.get(c.id) || 0,
          children: [],
        });
      }

      const roots: TreeNode[] = [];
      for (const c of categories) {
        const node = nodeMap.get(c.id)!;
        if (c.parent_id && nodeMap.has(c.parent_id)) {
          nodeMap.get(c.parent_id)!.children.push(node);
        } else {
          roots.push(node);
        }
      }

      return Response.json(roots);
    }

    if (section === "detail") {
      const id = searchParams.get("id");
      if (!id) {
        return Response.json({ error: "Missing id parameter" }, { status: 400 });
      }

      const { data: category, error: catError } = await supabase
        .from("categories")
        .select("*")
        .eq("id", id)
        .single();

      if (catError || !category) {
        return Response.json({ error: "Category not found" }, { status: 404 });
      }

      // Parent
      let parent = null;
      if (category.parent_id) {
        const { data } = await supabase
          .from("categories")
          .select("id, name")
          .eq("id", category.parent_id)
          .single();
        parent = data;
      }

      // Children
      const { data: children } = await supabase
        .from("categories")
        .select("id, name, slug, is_active, image_url")
        .eq("parent_id", id);

      // Products with variants
      const { data: productsData } = await supabase
        .from("products")
        .select("*, variants:product_variants(*)")
        .eq("category_id", id)
        .limit(50);

      const categoryProducts = productsData || [];

      // Revenue stats
      const productIds = categoryProducts.map((p) => p.id);
      let totalRevenue = 0;
      let totalSold = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let topProduct: { name: string; revenue: number } | null = null;

      if (productIds.length > 0) {
        const { data: items } = await supabase
          .from("order_items")
          .select("product_id, quantity, price")
          .in("product_id", productIds);

        const revenueByProduct = new Map<string, number>();
        for (const item of items || []) {
          const rev = item.price * item.quantity;
          totalRevenue += rev;
          totalSold += item.quantity;
          revenueByProduct.set(
            item.product_id,
            (revenueByProduct.get(item.product_id) || 0) + rev
          );
        }

        let maxRev = 0;
        for (const [prodId, rev] of revenueByProduct) {
          if (rev > maxRev) {
            maxRev = rev;
            const prod = categoryProducts.find((p) => p.id === prodId);
            topProduct = { name: prod?.name || "", revenue: rev };
          }
        }
      }

      // Review stats
      let reviewStats = { totalReviews: 0, averageRating: 0 };
      if (productIds.length > 0) {
        const { data: reviews } = await supabase
          .from("reviews")
          .select("rating")
          .in("product_id", productIds);

        const allReviews = reviews || [];
        if (allReviews.length > 0) {
          const avg =
            allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
          reviewStats = {
            totalReviews: allReviews.length,
            averageRating: Math.round(avg * 100) / 100,
          };
        }
      }

      return Response.json({
        category,
        parent,
        children: children || [],
        products: categoryProducts,
        revenueStats: { totalRevenue, totalSold, topProduct },
        reviewStats,
      });
    }

    return Response.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Categories GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
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
    const {
      name, slug: rawSlug, parent_id, image_url, is_active,
      category_type, sort_order, banner_url, icon_url, cover_url,
      meta_title, meta_description, filter_attributes,
      is_featured, show_in_nav, show_on_homepage,
    } = body;

    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    // Generate or use provided slug
    let slug = rawSlug ? slugify(rawSlug) : slugify(name);

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from("categories")
      .select("slug")
      .eq("slug", slug);

    if (existing && existing.length > 0) {
      let counter = 2;
      let candidate = `${slug}-${counter}`;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: check } = await supabase
          .from("categories")
          .select("slug")
          .eq("slug", candidate);
        if (!check || check.length === 0) {
          slug = candidate;
          break;
        }
        counter++;
        candidate = `${slug}-${counter}`;
      }
    }

    const insertData: Record<string, unknown> = {
      name,
      slug,
      is_active: is_active ?? true,
      category_type: category_type === "digital" ? "digital" : "physical",
      sort_order: Number.isFinite(Number(sort_order)) ? parseInt(sort_order) : 0,
      meta_title: meta_title || null,
      meta_description: meta_description || null,
      filter_attributes: Array.isArray(filter_attributes) ? filter_attributes : [],
      is_featured: !!is_featured,
      show_in_nav: show_in_nav !== false,
      show_on_homepage: !!show_on_homepage,
    };
    if (parent_id) insertData.parent_id = parent_id;
    if (image_url) insertData.image_url = image_url;
    if (banner_url) insertData.banner_url = banner_url;
    if (icon_url) insertData.icon_url = icon_url;
    if (cover_url) insertData.cover_url = cover_url;

    const { data: created, error } = await supabase
      .from("categories")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(created, { status: 201 });
  } catch (error) {
    console.error("Categories POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
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
    const { id, ...fields } = body;

    if (!id) {
      return Response.json({ error: "ID is required" }, { status: 400 });
    }

    // Prevent setting parent_id to self
    if (fields.parent_id === id) {
      return Response.json(
        { error: "Cannot set parent to self" },
        { status: 400 }
      );
    }

    // Prevent setting parent_id to a descendant (would create cycle)
    if (fields.parent_id) {
      const { data: allCategories } = await supabase
        .from("categories")
        .select("id, parent_id");

      const descendants = getDescendantIds(id, allCategories || []);
      if (descendants.has(fields.parent_id)) {
        return Response.json(
          { error: "Cannot set parent to a descendant category" },
          { status: 400 }
        );
      }
    }

    // If slug is being updated, ensure uniqueness
    if (fields.slug) {
      fields.slug = slugify(fields.slug);
      const { data: existing } = await supabase
        .from("categories")
        .select("id, slug")
        .eq("slug", fields.slug)
        .neq("id", id);

      if (existing && existing.length > 0) {
        return Response.json(
          { error: "Slug already in use" },
          { status: 400 }
        );
      }
    }

    const { data: updated, error } = await supabase
      .from("categories")
      .update(fields)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("Categories PUT error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
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
      return Response.json({ error: "IDs array is required" }, { status: 400 });
    }

    // Check for products
    const { data: productsInCategories } = await supabase
      .from("products")
      .select("id, name, category_id")
      .in("category_id", ids);

    if (productsInCategories && productsInCategories.length > 0) {
      const categoryNames = new Map<string, string[]>();
      for (const p of productsInCategories) {
        const arr = categoryNames.get(p.category_id) || [];
        arr.push(p.name);
        categoryNames.set(p.category_id, arr);
      }
      return Response.json(
        {
          error: "Cannot delete categories that have products",
          categoriesWithProducts: Object.fromEntries(categoryNames),
        },
        { status: 400 }
      );
    }

    // Check for children
    const { data: childCategories } = await supabase
      .from("categories")
      .select("id, parent_id")
      .in("parent_id", ids);

    if (childCategories && childCategories.length > 0) {
      return Response.json(
        { error: "Cannot delete categories that have subcategories" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .in("id", ids);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ deleted: ids.length });
  } catch (error) {
    console.error("Categories DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
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
      return Response.json({ error: "IDs array is required" }, { status: 400 });
    }

    if (!action) {
      return Response.json({ error: "Action is required" }, { status: 400 });
    }

    if (action === "activate") {
      const { error } = await supabase
        .from("categories")
        .update({ is_active: true })
        .in("id", ids);

      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ updated: ids.length });
    }

    if (action === "hide") {
      const { error } = await supabase
        .from("categories")
        .update({ is_active: false })
        .in("id", ids);

      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ updated: ids.length });
    }

    if (action === "delete") {
      // Same checks as DELETE
      const { data: productsInCategories } = await supabase
        .from("products")
        .select("id, name, category_id")
        .in("category_id", ids);

      if (productsInCategories && productsInCategories.length > 0) {
        const categoryNames = new Map<string, string[]>();
        for (const p of productsInCategories) {
          const arr = categoryNames.get(p.category_id) || [];
          arr.push(p.name);
          categoryNames.set(p.category_id, arr);
        }
        return Response.json(
          {
            error: "Cannot delete categories that have products",
            categoriesWithProducts: Object.fromEntries(categoryNames),
          },
          { status: 400 }
        );
      }

      const { data: childCategories } = await supabase
        .from("categories")
        .select("id, parent_id")
        .in("parent_id", ids);

      if (childCategories && childCategories.length > 0) {
        return Response.json(
          { error: "Cannot delete categories that have subcategories" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("categories")
        .delete()
        .in("id", ids);

      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ deleted: ids.length });
    }

    if (action === "move") {
      const newParentId = value === null || value === "null" ? null : value;

      if (newParentId) {
        // Validate parent exists
        const { data: parentCat } = await supabase
          .from("categories")
          .select("id")
          .eq("id", newParentId)
          .single();

        if (!parentCat) {
          return Response.json({ error: "Parent category not found" }, { status: 400 });
        }

        // Prevent cycles: none of the ids should be an ancestor of newParentId
        const { data: allCategories } = await supabase
          .from("categories")
          .select("id, parent_id");

        for (const id of ids) {
          if (id === newParentId) {
            return Response.json(
              { error: "Cannot move a category to itself" },
              { status: 400 }
            );
          }
          const descendants = getDescendantIds(id, allCategories || []);
          if (descendants.has(newParentId)) {
            return Response.json(
              { error: "Cannot move a category to one of its descendants" },
              { status: 400 }
            );
          }
        }
      }

      const { error } = await supabase
        .from("categories")
        .update({ parent_id: newParentId })
        .in("id", ids);

      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ updated: ids.length });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Categories PATCH error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
