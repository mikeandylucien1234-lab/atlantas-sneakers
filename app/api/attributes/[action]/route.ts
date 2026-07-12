// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { logAudit } from "@/lib/audit/log";
import { logActivity } from "@/lib/activity/log";

function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
function ipOf(r) { return r.headers.get("x-forwarded-for")?.split(",")[0] || null; }
function slugify(s) { return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export async function GET(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("products.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const sp = request.nextUrl.searchParams;

  try {
    if (action === "dashboard") {
      const [{ data: attrs }, { data: values }, { data: cats }, { data: prods }] = await Promise.all([
        s.from("attributes").select("id, status, is_system, created_at, updated_at"),
        s.from("attribute_values").select("id"),
        s.from("attribute_categories").select("attribute_id"),
        s.from("attribute_products").select("product_id"),
      ]);
      const A = attrs || [];
      return Response.json({ kpis: {
        total: A.length, published: A.filter(x => x.status === "active").length, hidden: A.filter(x => x.status !== "active").length,
        system: A.filter(x => x.is_system).length, custom: A.filter(x => !x.is_system).length,
        totalValues: (values || []).length, productsUsing: new Set((prods || []).map(x => x.product_id)).size,
        categoriesLinked: new Set((cats || []).map(x => x.attribute_id)).size,
        lastCreated: A.map(x => x.created_at).sort().reverse()[0] || null, lastUpdated: A.map(x => x.updated_at).filter(Boolean).sort().reverse()[0] || null,
      } });
    }

    if (action === "list") {
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10)); const size = 25; const from = (page - 1) * size;
      let q = s.from("attributes").select("*, attribute_groups(name)", { count: "exact" }).order("display_order").order("name");
      const group = sp.get("group"); if (group && group !== "all") q = q.eq("group_id", group);
      const status = sp.get("status"); if (status && status !== "all") q = q.eq("status", status);
      const type = sp.get("type"); if (type && type !== "all") q = q.eq("attribute_type", type);
      const search = sp.get("q"); if (search) q = q.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
      const { data, count } = await q.range(from, from + size - 1);
      const ids = (data || []).map(a => a.id);
      // counts
      const { data: vc } = await s.from("attribute_values").select("attribute_id").in("attribute_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const { data: pc } = await s.from("attribute_products").select("attribute_id, product_id").in("attribute_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const { data: cc } = await s.from("attribute_categories").select("attribute_id").in("attribute_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const vCount = {}; (vc || []).forEach(x => vCount[x.attribute_id] = (vCount[x.attribute_id] || 0) + 1);
      const pCount = {}; (pc || []).forEach(x => { (pCount[x.attribute_id] = pCount[x.attribute_id] || new Set()).add(x.product_id); });
      const cCount = {}; (cc || []).forEach(x => cCount[x.attribute_id] = (cCount[x.attribute_id] || 0) + 1);
      return Response.json({ attributes: (data || []).map(a => ({ ...a, group_name: a.attribute_groups?.name, values_count: vCount[a.id] || 0, products_count: (pCount[a.id]?.size) || 0, categories_count: cCount[a.id] || 0 })), total: count || 0, page, pageSize: size });
    }

    if (action === "detail") {
      const id = sp.get("id");
      const [{ data: attr }, { data: values }, { data: catLinks }] = await Promise.all([
        s.from("attributes").select("*").eq("id", id).single(),
        s.from("attribute_values").select("*").eq("attribute_id", id).order("sort_order"),
        s.from("attribute_categories").select("category_id").eq("attribute_id", id),
      ]);
      if (!attr) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ attribute: attr, values: values || [], category_ids: (catLinks || []).map(c => c.category_id) });
    }

    if (action === "groups") { const { data } = await s.from("attribute_groups").select("*").order("sort_order"); return Response.json({ groups: data || [] }); }
    if (action === "categories") { const { data } = await s.from("categories").select("id, name").eq("is_active", true).order("name"); return Response.json({ categories: data || [] }); }
    if (action === "mapping") { const { data } = await s.from("attribute_mapping").select("*, attributes(name)").eq("supplier_id", sp.get("supplier") || "cj").order("created_at", { ascending: false }); return Response.json({ mappings: data || [] }); }

    if (action === "for-category") {
      // attributes linked to a category (used by product forms / storefront filters)
      const catId = sp.get("category_id");
      const { data: links } = await s.from("attribute_categories").select("attribute_id").eq("category_id", catId);
      const ids = (links || []).map(l => l.attribute_id);
      if (!ids.length) return Response.json({ attributes: [] });
      const { data } = await s.from("attributes").select("*, attribute_values(*)").in("id", ids).eq("status", "active");
      return Response.json({ attributes: data || [] });
    }

    if (action === "export") {
      const { data: attrs } = await s.from("attributes").select("*");
      const { data: values } = await s.from("attribute_values").select("*");
      if (sp.get("format") === "csv") {
        const header = "Name,Slug,Type,DisplayType,Status,Values\n";
        const vByAttr = {}; (values || []).forEach(v => (vByAttr[v.attribute_id] = vByAttr[v.attribute_id] || []).push(v.label));
        const body = (attrs || []).map(a => `"${a.name}","${a.slug}","${a.attribute_type}","${a.display_type}","${a.status}","${(vByAttr[a.id] || []).join("|")}"`).join("\n");
        return new Response(header + body, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="attributes.csv"' } });
      }
      return new Response(JSON.stringify({ attributes: attrs, values }, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="attributes.json"' } });
    }

    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request: NextRequest, { params }) {
  const { action } = await params;
  const perm = action === "create" ? "products.create" : action === "delete" || action === "bulk" ? "products.delete" : "products.edit";
  const auth = await requirePermission(perm);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const actor = auth.profile; const b = await request.json().catch(() => ({})); const ip = ipOf(request);
  const FIELDS = ["name", "display_name", "description", "group_id", "attribute_type", "display_type", "default_value", "display_order", "is_required", "is_filterable", "is_searchable", "is_comparable", "visible_product", "visible_search", "visible_category", "status", "seo_schema"];

  try {
    if (action === "create") {
      const row = {}; FIELDS.forEach(k => { if (k in b) row[k] = b[k]; });
      row.slug = b.slug ? slugify(b.slug) : slugify(b.name) + (Math.random().toString(36).slice(2, 4));
      row.created_by = actor.id; row.created_by_name = actor.full_name || actor.email;
      const { data, error } = await s.from("attributes").insert(row).select("id").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      if (Array.isArray(b.values)) for (const [i, v] of b.values.entries()) await s.from("attribute_values").insert({ attribute_id: data.id, label: v.label, value: v.value || v.label, color_hex: v.color_hex || null, image_url: v.image_url || null, icon: v.icon || null, sort_order: i });
      await logAudit({ actor, module: "products", submodule: "attributes", action: "attribute_create", description: row.name, entity_id: data.id, ip });
      await logActivity({ actor, module: "products", activity_type: "product", action: "attribute_created", description: `Attribute "${row.name}"`, status: "success" });
      return Response.json({ ok: true, id: data.id });
    }

    if (action === "update") {
      const { data: cur } = await s.from("attributes").select("is_system, slug").eq("id", b.id).single();
      const row = { updated_at: new Date().toISOString() }; FIELDS.forEach(k => { if (k in b) row[k] = b[k]; });
      if (b.slug && !cur?.is_system) row.slug = slugify(b.slug);
      const { error } = await s.from("attributes").update(row).eq("id", b.id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      // category links (replace)
      if (Array.isArray(b.category_ids)) { await s.from("attribute_categories").delete().eq("attribute_id", b.id); if (b.category_ids.length) await s.from("attribute_categories").insert(b.category_ids.map(c => ({ attribute_id: b.id, category_id: c }))); }
      await logAudit({ actor, module: "products", submodule: "attributes", action: "attribute_update", description: b.id, entity_id: b.id, ip });
      return Response.json({ ok: true });
    }

    if (action === "delete") {
      const { data: cur } = await s.from("attributes").select("is_system, name").eq("id", b.id).single();
      if (cur?.is_system) return Response.json({ error: "System attributes cannot be deleted" }, { status: 403 });
      await s.from("attributes").delete().eq("id", b.id);
      await logAudit({ actor, module: "products", submodule: "attributes", action: "attribute_delete", description: cur?.name || b.id, level: "warning", ip });
      return Response.json({ ok: true });
    }

    if (action === "value") {
      if (b.op === "delete") { await s.from("attribute_values").delete().eq("id", b.id); await logAudit({ actor, module: "products", action: "attribute_value_delete", description: b.id, ip }); return Response.json({ ok: true }); }
      if (b.op === "update") { await s.from("attribute_values").update({ label: b.label, value: b.value, color_hex: b.color_hex, image_url: b.image_url, icon: b.icon, sort_order: b.sort_order }).eq("id", b.id); return Response.json({ ok: true }); }
      const { data, error } = await s.from("attribute_values").insert({ attribute_id: b.attribute_id, label: b.label, value: b.value || b.label, color_hex: b.color_hex || null, image_url: b.image_url || null, icon: b.icon || null, sort_order: b.sort_order ?? 100 }).select("*").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await logAudit({ actor, module: "products", action: "attribute_value_add", description: `${b.attribute_id}: ${b.label}`, ip });
      return Response.json({ value: data });
    }

    if (action === "bulk") {
      const ids = b.ids || []; if (!ids.length) return Response.json({ error: "No ids" }, { status: 400 });
      if (b.op === "activate") await s.from("attributes").update({ status: "active" }).in("id", ids);
      else if (b.op === "deactivate") await s.from("attributes").update({ status: "hidden" }).in("id", ids);
      else if (b.op === "delete") await s.from("attributes").delete().in("id", ids).eq("is_system", false);
      else if (b.op === "duplicate") { const { data: src } = await s.from("attributes").select("*").in("id", ids); for (const a of (src || [])) { const { id, slug, created_at, updated_at, is_system, ...rest } = a; const { data: nw } = await s.from("attributes").insert({ ...rest, name: a.name + " Copy", slug: slugify(a.name) + "-copy-" + Math.random().toString(36).slice(2, 5), is_system: false, created_by: actor.id }).select("id").single(); const { data: vals } = await s.from("attribute_values").select("label, value, color_hex, image_url, icon, sort_order").eq("attribute_id", a.id); if (nw && vals?.length) await s.from("attribute_values").insert(vals.map(v => ({ ...v, attribute_id: nw.id }))); } }
      await logAudit({ actor, module: "products", submodule: "attributes", action: `attribute_bulk_${b.op}`, description: `${ids.length} items`, level: "warning", ip });
      return Response.json({ ok: true });
    }

    if (action === "map") {
      await s.from("attribute_mapping").upsert({ supplier_id: b.supplier_id || "cj", external_attribute: b.external_attribute, external_value: b.external_value || null, attribute_id: b.attribute_id, value_id: b.value_id || null }, { onConflict: "supplier_id,external_attribute,external_value" });
      await logAudit({ actor, module: "products", action: "attribute_map", description: `${b.external_attribute} → ${b.attribute_id}`, ip });
      return Response.json({ ok: true });
    }
    if (action === "map-delete") { await s.from("attribute_mapping").delete().eq("id", b.id); return Response.json({ ok: true }); }

    if (action === "import") {
      const items = b.attributes || [];
      let imported = 0;
      for (const a of items) {
        const slug = slugify(a.slug || a.name); if (!slug) continue;
        const { data: nw } = await s.from("attributes").upsert({ name: a.name, slug, attribute_type: a.attribute_type || "dropdown", display_type: a.display_type || "dropdown", status: a.status || "active" }, { onConflict: "slug" }).select("id").single();
        if (nw && Array.isArray(a.values)) for (const [i, v] of a.values.entries()) { const label = typeof v === "string" ? v : v.label; await s.from("attribute_values").upsert({ attribute_id: nw.id, label, value: label, sort_order: i }, { onConflict: "id", ignoreDuplicates: true }).then(() => {}, () => {}); }
        imported++;
      }
      await logAudit({ actor, module: "products", submodule: "attributes", action: "attribute_import", description: `${imported} attributes`, ip });
      return Response.json({ ok: true, imported });
    }

    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
