// @ts-nocheck
// Public storefront endpoint: resolve the warranty that applies to a product.
// Resolution order: direct product assignment → brand → category → default.
// Returns only active, show_on_product warranties + their public files. No auth.
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

function svc() {
  return createAnon(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  const s = svc();
  const sp = request.nextUrl.searchParams;
  const productId = sp.get("product_id");
  const lang = sp.get("lang") || null;
  if (!productId) return Response.json({ warranty: null });

  try {
    const { data: product } = await s.from("products").select("id,brand_id,category_id").eq("id", productId).maybeSingle();

    const active = (w) => w && w.status === "active" && w.show_on_product;
    let warranty = null;

    // 1) direct product assignment (highest priority)
    const { data: wp } = await s.from("warranty_products").select("warranty_id").eq("product_id", productId);
    const directIds = (wp || []).map(x => x.warranty_id);
    if (directIds.length) {
      const { data } = await s.from("warranties").select("*").in("id", directIds).eq("status", "active").eq("show_on_product", true).order("priority").limit(1);
      if (data?.[0]) warranty = data[0];
    }
    // 2) brand
    if (!warranty && product?.brand_id) {
      const { data: wb } = await s.from("warranty_brands").select("warranty_id").eq("brand_id", product.brand_id);
      const ids = (wb || []).map(x => x.warranty_id);
      if (ids.length) { const { data } = await s.from("warranties").select("*").in("id", ids).eq("status", "active").eq("show_on_product", true).order("priority").limit(1); if (data?.[0]) warranty = data[0]; }
    }
    // 3) category
    if (!warranty && product?.category_id) {
      const { data: wc } = await s.from("warranty_categories").select("warranty_id").eq("category_id", product.category_id);
      const ids = (wc || []).map(x => x.warranty_id);
      if (ids.length) { const { data } = await s.from("warranties").select("*").in("id", ids).eq("status", "active").eq("show_on_product", true).order("priority").limit(1); if (data?.[0]) warranty = data[0]; }
    }
    // 4) global default
    if (!warranty) {
      const { data } = await s.from("warranties").select("*").eq("is_default", true).eq("status", "active").eq("show_on_product", true).limit(1);
      if (data?.[0]) warranty = data[0];
    }

    if (!active(warranty)) return Response.json({ warranty: null });

    const [{ data: files }, { data: trans }] = await Promise.all([
      s.from("warranty_files").select("*").eq("warranty_id", warranty.id).order("sort_order"),
      lang ? s.from("warranty_translations").select("*").eq("warranty_id", warranty.id).eq("language", lang).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    // apply translation overlay
    if (trans && lang) {
      warranty = {
        ...warranty,
        name: trans.name || warranty.name,
        description: trans.description || warranty.description,
        badge_text: trans.badge_text || warranty.badge_text,
        coverage: (trans.coverage && trans.coverage.length) ? trans.coverage : warranty.coverage,
        exclusions: (trans.exclusions && trans.exclusions.length) ? trans.exclusions : warranty.exclusions,
        meta_title: trans.meta_title || warranty.meta_title,
        meta_description: trans.meta_description || warranty.meta_description,
      };
    }
    return Response.json({ warranty, files: files || [] });
  } catch (e) {
    return Response.json({ warranty: null, error: e.message }, { status: 200 });
  }
}
