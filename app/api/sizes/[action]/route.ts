// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { logAudit } from "@/lib/audit/log";
import { logActivity } from "@/lib/activity/log";

function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
function ipOf(r) { return r.headers.get("x-forwarded-for")?.split(",")[0] || null; }
function slugify(s) { return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
const GROUP_FOR = { shoes: "shoes", clothing: "fashion", kids: "general", accessories: "general" };

export async function GET(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("products.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const sp = request.nextUrl.searchParams;

  try {
    if (action === "dashboard") {
      const [{ data: charts }, { data: sizes }, { data: cats }, { data: prods }] = await Promise.all([
        s.from("size_charts").select("id, name, updated_at"),
        s.from("sizes").select("id, chart_id, attribute_value_id"),
        s.from("size_categories").select("chart_id"),
        s.from("attribute_products").select("product_id, value_id"),
      ]);
      // products using sizes = products with an attribute_product whose value is a size value
      const sizeValueIds = new Set((sizes || []).map(x => x.attribute_value_id).filter(Boolean));
      const productsUsing = new Set((prods || []).filter(x => sizeValueIds.has(x.value_id)).map(x => x.product_id)).size;
      const byChart = {}; (sizes || []).forEach(x => byChart[x.chart_id] = (byChart[x.chart_id] || 0) + 1);
      const mostUsed = (charts || []).map(c => ({ name: c.name, count: byChart[c.id] || 0 })).sort((a, b) => b.count - a.count)[0];
      return Response.json({ kpis: {
        totalCharts: (charts || []).length, totalSizes: (sizes || []).length,
        productsUsing, categoriesUsing: new Set((cats || []).map(x => x.chart_id)).size,
        lastUpdated: (charts || []).map(c => c.updated_at).filter(Boolean).sort().reverse()[0] || null,
        mostUsedChart: mostUsed?.name || "—",
      } });
    }

    if (action === "charts") {
      const { data: charts } = await s.from("size_charts").select("*").order("sort_order").order("name");
      const { data: sizes } = await s.from("sizes").select("chart_id");
      const { data: cats } = await s.from("size_categories").select("chart_id");
      const sc = {}; (sizes || []).forEach(x => sc[x.chart_id] = (sc[x.chart_id] || 0) + 1);
      const cc = {}; (cats || []).forEach(x => cc[x.chart_id] = (cc[x.chart_id] || 0) + 1);
      return Response.json({ charts: (charts || []).map(c => ({ ...c, sizes_count: sc[c.id] || 0, categories_count: cc[c.id] || 0 })) });
    }

    if (action === "chart") {
      const id = sp.get("id");
      const [{ data: chart }, { data: sizes }, { data: catLinks }, { data: guide }] = await Promise.all([
        s.from("size_charts").select("*").eq("id", id).single(),
        s.from("sizes").select("*").eq("chart_id", id).order("sort_order"),
        s.from("size_categories").select("category_id").eq("chart_id", id),
        s.from("size_guides").select("*").eq("chart_id", id).maybeSingle(),
      ]);
      if (!chart) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ chart, sizes: sizes || [], category_ids: (catLinks || []).map(c => c.category_id), guide });
    }

    if (action === "conversion") {
      const system = sp.get("system") || "shoes";
      const { data } = await s.from("size_conversion").select("*").eq("system", system).order("sort_order");
      return Response.json({ system, rows: data || [] });
    }
    if (action === "convert") {
      // convert a value from one system column to the others
      const system = sp.get("system") || "shoes"; const col = sp.get("from") || "us"; const val = sp.get("value");
      const { data } = await s.from("size_conversion").select("*").eq("system", system).eq(col, val).maybeSingle();
      return Response.json({ match: data || null });
    }
    if (action === "categories") { const { data } = await s.from("categories").select("id, name").eq("is_active", true).order("name"); return Response.json({ categories: data || [] }); }
    if (action === "mapping") { const { data } = await s.from("size_mapping").select("*, sizes(label)").eq("supplier_id", sp.get("supplier") || "cj").order("created_at", { ascending: false }); return Response.json({ mappings: data || [] }); }
    if (action === "for-category") {
      const catId = sp.get("category_id");
      const { data: links } = await s.from("size_categories").select("chart_id").eq("category_id", catId);
      const ids = (links || []).map(l => l.chart_id); if (!ids.length) return Response.json({ charts: [] });
      const { data } = await s.from("size_charts").select("*, sizes(*)").in("id", ids).eq("status", "active");
      return Response.json({ charts: data || [] });
    }
    if (action === "export") {
      const { data: charts } = await s.from("size_charts").select("*");
      const { data: sizes } = await s.from("sizes").select("*");
      return new Response(JSON.stringify({ charts, sizes }, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="size-charts.json"' } });
    }
    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request: NextRequest, { params }) {
  const { action } = await params;
  const perm = action === "chart-create" ? "products.create" : action.includes("delete") ? "products.delete" : "products.edit";
  const auth = await requirePermission(perm);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const actor = auth.profile; const b = await request.json().catch(() => ({})); const ip = ipOf(request);

  try {
    if (action === "chart-create") {
      const slug = b.slug ? slugify(b.slug) : slugify(b.name) + "-" + Math.random().toString(36).slice(2, 4);
      // create the specialized system attribute that backs this chart
      const { data: grp } = await s.from("attribute_groups").select("id").eq("slug", GROUP_FOR[b.category] || "general").maybeSingle();
      const { data: attr } = await s.from("attributes").insert({ name: b.name + " Size", slug: slug + "-size", display_name: "Size", group_id: grp?.id || null, attribute_type: "size", display_type: "buttons", is_filterable: true, is_searchable: true, is_comparable: true, is_system: true, seo_schema: "size", created_by: actor.id }).select("id").single();
      const { data: chart, error } = await s.from("size_charts").insert({ name: b.name, slug, description: b.description, category: b.category || "shoes", gender: b.gender || "unisex", country: b.country, system: b.system || (b.category === "clothing" ? "clothing" : "shoes"), attribute_id: attr?.id || null, status: b.status || "active", sort_order: b.sort_order ?? 100, created_by: actor.id, created_by_name: actor.full_name || actor.email }).select("id").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await logAudit({ actor, module: "products", submodule: "sizes", action: "size_chart_create", description: b.name, entity_id: chart.id, ip });
      await logActivity({ actor, module: "products", activity_type: "product", action: "size_chart_created", description: `Size chart "${b.name}"`, status: "success" });
      return Response.json({ ok: true, id: chart.id });
    }

    if (action === "chart-update") {
      const row = { updated_at: new Date().toISOString() }; ["name", "description", "category", "gender", "country", "system", "status", "sort_order"].forEach(k => { if (k in b) row[k] = b[k]; });
      await s.from("size_charts").update(row).eq("id", b.id);
      if (Array.isArray(b.category_ids)) { await s.from("size_categories").delete().eq("chart_id", b.id); if (b.category_ids.length) await s.from("size_categories").insert(b.category_ids.map(c => ({ chart_id: b.id, category_id: c }))); }
      await logAudit({ actor, module: "products", submodule: "sizes", action: "size_chart_update", description: b.id, entity_id: b.id, ip });
      return Response.json({ ok: true });
    }

    if (action === "chart-delete") {
      const { data: chart } = await s.from("size_charts").select("attribute_id, is_system, name").eq("id", b.id).single();
      if (chart?.is_system) return Response.json({ error: "System charts cannot be deleted" }, { status: 403 });
      if (chart?.attribute_id) await s.from("attributes").delete().eq("id", chart.attribute_id); // cascade removes attribute_values
      await s.from("size_charts").delete().eq("id", b.id);
      await logAudit({ actor, module: "products", submodule: "sizes", action: "size_chart_delete", description: chart?.name || b.id, level: "warning", ip });
      return Response.json({ ok: true });
    }

    if (action === "size-add") {
      // create the size + the backing attribute_value so it is reusable everywhere
      const { data: chart } = await s.from("size_charts").select("attribute_id").eq("id", b.chart_id).single();
      let avId = null;
      if (chart?.attribute_id) { const { data: av } = await s.from("attribute_values").insert({ attribute_id: chart.attribute_id, label: b.label, value: b.value || b.abbreviation || b.label, sort_order: b.sort_order ?? 100 }).select("id").single(); avId = av?.id; }
      const { data, error } = await s.from("sizes").insert({ chart_id: b.chart_id, label: b.label, abbreviation: b.abbreviation, value: b.value || b.label, sort_order: b.sort_order ?? 100, measurements: b.measurements || {}, attribute_value_id: avId }).select("*").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await logAudit({ actor, module: "products", submodule: "sizes", action: "size_add", description: `${b.chart_id}: ${b.label}`, ip });
      return Response.json({ size: data });
    }
    if (action === "size-update") {
      await s.from("sizes").update({ label: b.label, abbreviation: b.abbreviation, value: b.value, sort_order: b.sort_order, measurements: b.measurements }).eq("id", b.id);
      // keep the backing attribute_value in sync
      const { data: sz } = await s.from("sizes").select("attribute_value_id").eq("id", b.id).single();
      if (sz?.attribute_value_id) await s.from("attribute_values").update({ label: b.label, value: b.value || b.label, sort_order: b.sort_order }).eq("id", sz.attribute_value_id);
      return Response.json({ ok: true });
    }
    if (action === "size-delete") {
      const { data: sz } = await s.from("sizes").select("attribute_value_id").eq("id", b.id).single();
      if (sz?.attribute_value_id) await s.from("attribute_values").delete().eq("id", sz.attribute_value_id);
      await s.from("sizes").delete().eq("id", b.id);
      await logAudit({ actor, module: "products", submodule: "sizes", action: "size_delete", description: b.id, ip });
      return Response.json({ ok: true });
    }

    if (action === "guide") {
      const { data: existing } = await s.from("size_guides").select("id").eq("chart_id", b.chart_id).maybeSingle();
      const row = { chart_id: b.chart_id, title: b.title, content: b.content, image_url: b.image_url, tips: b.tips, measurements: b.measurements || [], updated_at: new Date().toISOString() };
      if (existing) await s.from("size_guides").update(row).eq("id", existing.id);
      else await s.from("size_guides").insert(row);
      await logAudit({ actor, module: "products", submodule: "sizes", action: "size_guide_save", description: b.chart_id, ip });
      return Response.json({ ok: true });
    }

    if (action === "conversion-save") {
      await s.from("size_conversion").upsert({ system: b.system || "shoes", us: b.us, eu: b.eu, uk: b.uk, cm: b.cm, jp: b.jp, intl: b.intl, sort_order: b.sort_order ?? 100 }, { onConflict: "system,us,eu" });
      return Response.json({ ok: true });
    }

    if (action === "map") {
      await s.from("size_mapping").upsert({ supplier_id: b.supplier_id || "cj", external_size: b.external_size, size_id: b.size_id, chart_id: b.chart_id || null }, { onConflict: "supplier_id,external_size" });
      await logAudit({ actor, module: "products", submodule: "sizes", action: "size_map", description: `${b.external_size} → ${b.size_id}`, ip });
      return Response.json({ ok: true });
    }
    if (action === "map-delete") { await s.from("size_mapping").delete().eq("id", b.id); return Response.json({ ok: true }); }

    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
