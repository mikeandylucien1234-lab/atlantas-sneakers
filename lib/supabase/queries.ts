import { createClient } from "./client";
import type { Product, Category, Brand, FlashDeal } from "@/types";

const PRODUCT_SELECT = "*, brand:brands(*), category:categories(*), variants:product_variants(*)";

export type ProductFilters = {
  brandSlugs?: string[];
  categorySlugs?: string[];
  minPrice?: number;
  maxPrice?: number;
  isNew?: boolean;
  isFeatured?: boolean;
  sort?: "price_asc" | "price_desc" | "newest" | "featured" | "best_selling";
  limit?: number;
  offset?: number;
  search?: string;
};

export async function getProducts(filters?: ProductFilters) {
  const supabase = createClient();
  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active");

  if (filters?.isNew) query = query.eq("is_new", true);
  if (filters?.isFeatured) query = query.eq("is_featured", true);
  if (filters?.minPrice != null) query = query.gte("price", filters.minPrice);
  if (filters?.maxPrice != null) query = query.lte("price", filters.maxPrice);
  if (filters?.search) query = query.textSearch("fts", filters.search, { type: "websearch" });

  switch (filters?.sort) {
    case "price_asc": query = query.order("price", { ascending: true }); break;
    case "price_desc": query = query.order("price", { ascending: false }); break;
    case "newest": query = query.order("created_at", { ascending: false }); break;
    default: query = query.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  }

  if (filters?.limit) query = query.limit(filters.limit);
  if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit ?? 20) - 1);

  const { data, error } = await query;
  if (error) throw error;

  let products = data as Product[];

  if (filters?.brandSlugs?.length) {
    products = products.filter((p) => p.brand && filters.brandSlugs!.includes(p.brand.slug));
  }
  if (filters?.categorySlugs?.length) {
    products = products.filter((p) => p.category && filters.categorySlugs!.includes(p.category.slug));
  }

  return products;
}

export async function getProductBySlug(slug: string) {
  const supabase = createClient();
  // Try with the reviews + reviewer-profile embed first.
  const { data, error } = await supabase
    .from("products")
    .select(`${PRODUCT_SELECT}, reviews(*, profile:profiles(full_name, avatar_url))`)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!error && data) {
    return data as Product & { reviews: Array<{ id: string; rating: number; title: string | null; comment: string | null; created_at: string; profile: { full_name: string | null; avatar_url: string | null } | null }> };
  }
  // Fallback: the reviews/profiles embed can fail (e.g. missing relationship in
  // PostgREST's cache). Never break the whole detail page over reviews — load
  // the core product (with brand/category/variants) and fetch reviews best-effort.
  const { data: core, error: coreErr } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (coreErr) throw coreErr;
  if (!core) return null;
  let reviews: any[] = [];
  try {
    const { data: rv } = await supabase
      .from("reviews")
      .select("*, profile:profiles(full_name, avatar_url)")
      .eq("product_id", (core as any).id)
      .order("created_at", { ascending: false });
    reviews = rv || [];
  } catch {
    reviews = [];
  }
  return { ...(core as any), reviews } as Product & { reviews: any[] };
}

export async function getCategories() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data as Category[];
}

export async function getBrands() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data as Brand[];
}

// Trending Now — products explicitly flagged as trending (falls back to
// featured so the section is never empty on a fresh catalog).
export async function getFeaturedProducts() {
  const supabase = createClient();
  const { data } = await supabase
    .from("products").select(PRODUCT_SELECT)
    .eq("status", "active").eq("is_trending", true)
    .order("created_at", { ascending: false }).limit(8);
  if (data && data.length) return data as Product[];
  return getProducts({ isFeatured: true, limit: 8 });
}

export async function getNewArrivals() {
  return getProducts({ isNew: true, sort: "newest", limit: 8 });
}

// Best Sellers — products explicitly flagged as best sellers (falls back to
// featured so the section is never empty).
export async function getBestSellers() {
  const supabase = createClient();
  const { data } = await supabase
    .from("products").select(PRODUCT_SELECT)
    .eq("status", "active").eq("is_best_seller", true)
    .order("created_at", { ascending: false }).limit(8);
  if (data && data.length) return data as Product[];
  const { data: fb } = await supabase
    .from("products").select(PRODUCT_SELECT)
    .eq("status", "active").eq("is_featured", true)
    .order("created_at", { ascending: true }).limit(8);
  return (fb || []) as Product[];
}

export async function getFlashDeals() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("flash_deals")
    .select("*, product:products(*, brand:brands(*), category:categories(*))")
    .eq("is_active", true)
    .gte("ends_at", new Date().toISOString())
    .lte("starts_at", new Date().toISOString());
  if (error) throw error;
  return data as FlashDeal[];
}

// Active banners for a given storefront location, in schedule, by priority.
export async function getBannersByLocation(location: string) {
  const supabase = createClient();
  const now = new Date();
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .eq("location", location)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []).filter((b: any) =>
    (!b.starts_at || new Date(b.starts_at) <= now) &&
    (!b.ends_at || new Date(b.ends_at) >= now)
  );
}

// Active hero-carousel banners for the storefront, ordered by priority.
export async function getHeroBanners() {
  return getBannersByLocation("hero_carousel");
}

// CMS-managed homepage "Shop by Category" tiles (active + shown), ordered.
export async function getHomepageCategories() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("homepage_categories")
    .select("id, name, image_url, alt_text, border_radius, bg_color, open_new_tab, display_order, linked_category_id, category:categories(slug)")
    .eq("status", "active")
    .eq("show_on_homepage", true)
    .order("display_order", { ascending: true });
  if (error) return [];
  return data || [];
}

// CMS-managed top navigation tabs (All / Men / Women / …), active + ordered.
export async function getNavTabs() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("homepage_nav_tabs")
    .select("id, label, href, icon, open_new_tab, display_order, linked_category_id, category:categories(slug)")
    .eq("status", "active")
    .order("display_order", { ascending: true });
  if (error) return [];
  return data || [];
}

// Active coupons for the storefront "Special Offers" section.
export async function getActiveCoupons() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("coupons")
    .select("code, type, value, min_order")
    .eq("is_active", true)
    .order("value", { ascending: false });
  if (error) return [];
  return data || [];
}

export async function searchProducts(query: string) {
  return getProducts({ search: query, limit: 20 });
}

export async function getProductsByCategory(slug: string) {
  const supabase = createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .single();
  if (!category) return [];

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .eq("category_id", category.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Product[];
}

export async function getRelatedProducts(productId: string, categoryId: string | null) {
  const supabase = createClient();
  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .neq("id", productId)
    .limit(5);

  if (categoryId) query = query.eq("category_id", categoryId);

  const { data, error } = await query;
  if (error) throw error;
  return data as Product[];
}

export async function validateCoupon(code: string, total: number) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .single();

  if (error || !data) return { valid: false, message: "Invalid coupon code" } as const;

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, message: "This coupon has expired" } as const;
  }
  if (total < Number(data.min_order)) {
    return { valid: false, message: `Minimum order of $${data.min_order} required` } as const;
  }

  return { valid: true, coupon: data } as const;
}
