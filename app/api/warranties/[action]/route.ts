// @ts-nocheck
// Enterprise Warranty Management API. Single [action] route covering the full
// lifecycle: dashboard, list, detail, create, update, delete, assignment,
// automatic rules, files, translations, claims, CJ mapping, import & export.
// Every mutating action enforces an RBAC permission, writes audit + activity
// logs, and (where relevant) enqueues a notification.
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { logAudit } from "@/lib/audit/log";
import { logActivity } from "@/lib/activity/log";

function svc() {
  return createAnon(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
function ipOf(r) { return r.headers.get("x-forwarded-for")?.split(",")[0] || null; }
function slugify(s) { return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function j(data, status = 200) { return Response.json(data, { status }); }

// Best-effort notification enqueue (never blocks the request).
async function notify(s, { subject, body, payload }) {
  try {
    await s.from("notification_queue").insert({
      channel: "in_app", subject, body, payload: payload || {}, priority: 5,
      status: "pending", max_attempts: 3, scheduled_for: new Date().toISOString(),
      timezone: "UTC", repeat_rule: "none",
    });
  } catch {}
}

const DURATION_LABEL = (t, v, custom) => {
  if (t === "lifetime") return "Lifetime";
  if (t === "none") return "No Warranty";
  if (t === "custom") return custom || "Custom";
  if (!v) return "—";
  return `${v} ${t}${v > 1 ? "" : ""}`.replace("months", v > 1 ? "months" : "month").replace("years", v > 1 ? "years" : "year").replace("days", v > 1 ? "days" : "day");
};

// Compute an absolute expiry from duration (used for "expiring soon" + expired KPIs).
function expiryFrom(w) {
  if (["lifetime", "none", "custom"].includes(w.duration_type) || !w.duration_value) return null;
  const d = new Date(w.updated_at || w.created_at || Date.now());
  if (w.duration_type === "days") d.setDate(d.getDate() + w.duration_value);
  else if (w.duration_type === "months") d.setMonth(d.getMonth() + w.duration_value);
  else if (w.duration_type === "years") d.setFullYear(d.getFullYear() + w.duration_value);
  return d;
}

function autoSeo(w) {
  const dur = DURATION_LABEL(w.duration_type, w.duration_value, w.duration_custom);
  return {
    meta_title: w.meta_title || `${w.name} — ${dur} Warranty | Atlanta Sneakers`,
    meta_description: w.meta_description || (w.short_description || `${w.name}: ${dur} ${w.warranty_type} warranty. Coverage, claim process and support at Atlanta Sneakers.`).slice(0, 300),
  };
}

// ---------------- GET ----------------
export async function GET(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("warranties.view");
  if (!auth.ok) return j({ error: auth.error }, auth.status);
  const s = svc(); const sp = request.nextUrl.searchParams;

  try {
    if (action === "dashboard") {
      const [{ data: ws }, { data: wp }, { data: wc }, { data: wb }] = await Promise.all([
        s.from("warranties").select("id,name,status,warranty_type,duration_type,duration_value,duration_custom,created_at,updated_at"),
        s.from("warranty_products").select("warranty_id,product_id"),
        s.from("warranty_categories").select("category_id"),
        s.from("warranty_brands").select("brand_id"),
      ]);
      const list = ws || [];
      const now = Date.now();
      let expired = 0;
      list.forEach(w => { const e = expiryFrom(w); if (e && e.getTime() < now) expired++; });
      const usage = {}; (wp || []).forEach(x => { usage[x.warranty_id] = (usage[x.warranty_id] || 0) + 1; });
      const mostUsedId = Object.keys(usage).sort((a, b) => usage[b] - usage[a])[0];
      const mostUsed = list.find(w => w.id === mostUsedId);
      const recent = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5)
        .map(w => ({ id: w.id, name: w.name, created_at: w.created_at, status: w.status }));
      return j({ kpis: {
        total: list.length,
        active: list.filter(w => w.status === "active").length,
        inactive: list.filter(w => w.status !== "active").length,
        productsCovered: new Set((wp || []).map(x => x.product_id)).size,
        categoriesCovered: new Set((wc || []).map(x => x.category_id)).size,
        brandsCovered: new Set((wb || []).map(x => x.brand_id)).size,
        expired,
        mostUsed: mostUsed?.name || "—",
        mostUsedCount: mostUsedId ? usage[mostUsedId] : 0,
      }, recent });
    }

    if (action === "list") {
      const q = (sp.get("q") || "").toLowerCase();
      const status = sp.get("status") || "";
      const type = sp.get("type") || "";
      const sort = sp.get("sort") || "created_at";
      const dir = sp.get("dir") === "asc";
      const page = Math.max(1, parseInt(sp.get("page") || "1"));
      const pageSize = Math.min(100, parseInt(sp.get("pageSize") || "20"));

      let query = s.from("warranties").select("*");
      if (status) query = query.eq("status", status);
      if (type) query = query.eq("warranty_type", type);
      const { data: allRows } = await query;
      let rows = allRows || [];
      if (q) rows = rows.filter(w => (w.name || "").toLowerCase().includes(q) || (w.code || "").toLowerCase().includes(q) || (w.warranty_type || "").toLowerCase().includes(q));
      rows.sort((a, b) => {
        const av = a[sort], bv = b[sort];
        if (av == null) return 1; if (bv == null) return -1;
        return (av > bv ? 1 : av < bv ? -1 : 0) * (dir ? 1 : -1);
      });
      const total = rows.length;
      const paged = rows.slice((page - 1) * pageSize, page * pageSize);
      // usage counts
      const { data: wp } = await s.from("warranty_products").select("warranty_id");
      const { data: wc } = await s.from("warranty_categories").select("warranty_id");
      const { data: wb } = await s.from("warranty_brands").select("warranty_id");
      const cnt = (arr, id) => (arr || []).filter(x => x.warranty_id === id).length;
      return j({
        warranties: paged.map(w => ({
          ...w,
          duration_label: DURATION_LABEL(w.duration_type, w.duration_value, w.duration_custom),
          products_count: cnt(wp, w.id),
          categories_count: cnt(wc, w.id),
          brands_count: cnt(wb, w.id),
          applies_to: [cnt(wp, w.id) ? "products" : null, cnt(wc, w.id) ? "categories" : null, cnt(wb, w.id) ? "brands" : null].filter(Boolean),
        })),
        total, page, pageSize, pages: Math.ceil(total / pageSize),
      });
    }

    if (action === "detail") {
      const id = sp.get("id");
      const [{ data: w }, { data: prods }, { data: cats }, { data: brands }, { data: files }, { data: trans }, { data: rules }] = await Promise.all([
        s.from("warranties").select("*").eq("id", id).single(),
        s.from("warranty_products").select("product_id,source").eq("warranty_id", id),
        s.from("warranty_categories").select("category_id").eq("warranty_id", id),
        s.from("warranty_brands").select("brand_id").eq("warranty_id", id),
        s.from("warranty_files").select("*").eq("warranty_id", id).order("sort_order"),
        s.from("warranty_translations").select("*").eq("warranty_id", id),
        s.from("warranty_rules").select("*").eq("warranty_id", id).order("created_at"),
      ]);
      if (!w) return j({ error: "Not found" }, 404);
      return j({
        warranty: w,
        product_ids: (prods || []).map(p => p.product_id),
        category_ids: (cats || []).map(c => c.category_id),
        brand_ids: (brands || []).map(b => b.brand_id),
        files: files || [], translations: trans || [], rules: rules || [],
      });
    }

    // catalog data for the assignment pickers
    if (action === "products") {
      const q = (sp.get("q") || "").toLowerCase();
      let query = s.from("products").select("id,name,slug,images,brand_id,category_id,status,tags").order("created_at", { ascending: false }).limit(200);
      const { data } = await query;
      let rows = data || [];
      if (q) rows = rows.filter(p => (p.name || "").toLowerCase().includes(q));
      return j({ products: rows.map(p => ({ ...p, image: Array.isArray(p.images) ? p.images[0] : null })) });
    }
    if (action === "categories") {
      const { data } = await s.from("categories").select("id,name,slug").order("name");
      return j({ categories: data || [] });
    }
    if (action === "brands") {
      const { data } = await s.from("brands").select("id,name,slug,logo_url").order("name");
      return j({ brands: data || [] });
    }

    if (action === "claims") {
      const { data } = await s.from("warranty_claims").select("*").order("created_at", { ascending: false }).limit(200);
      return j({ claims: data || [] });
    }

    if (action === "export") {
      const fmt = sp.get("format") || "csv";
      const { data } = await s.from("warranties").select("*").order("created_at", { ascending: false });
      const rows = data || [];
      if (fmt === "json") {
        return new Response(JSON.stringify(rows, null, 2), {
          headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="warranties.json"' },
        });
      }
      const cols = ["name", "code", "warranty_type", "duration_type", "duration_value", "status", "claim_email", "claim_phone", "processing_time"];
      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
      await logActivity({ actor: auth.profile, module: "warranties", action: "export", description: `Exported ${rows.length} warranties (${fmt})`, ip: ipOf(request) });
      return new Response(csv, {
        headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="warranties.csv"' },
      });
    }

    return j({ error: "Unknown action" }, 404);
  } catch (e) {
    return j({ error: e.message || "Server error" }, 500);
  }
}

// ---------------- POST ----------------
export async function POST(request: NextRequest, { params }) {
  const { action } = await params;
  // map action -> required permission
  const PERM = {
    create: "warranties.create", update: "warranties.edit", "toggle-status": "warranties.edit",
    delete: "warranties.delete", "bulk-status": "warranties.edit", "bulk-delete": "warranties.delete",
    assign: "warranties.assign", "rule-save": "warranties.assign", "rule-delete": "warranties.assign",
    "rule-apply": "warranties.assign", "file-add": "warranties.edit", "file-delete": "warranties.edit",
    "translation-save": "warranties.edit", "translation-delete": "warranties.edit",
    import: "warranties.import", "claim-update": "warranties.edit", "cj-default": "warranties.edit",
  };
  const auth = await requirePermission(PERM[action] || "warranties.edit");
  if (!auth.ok) return j({ error: auth.error }, auth.status);
  const s = svc();
  const actor = auth.profile;
  const ip = ipOf(request);
  let body = {};
  try { body = await request.json(); } catch {}

  const audit = (a, description, extra = {}) => logAudit({ actor, module: "warranties", action: a, description, ip, ...extra });
  const activity = (a, description, extra = {}) => logActivity({ actor, module: "warranties", action: a, description, ip, ...extra });

  try {
    if (action === "create") {
      if (!body.name) return j({ error: "Warranty name is required" }, 400);
      const seo = autoSeo(body);
      const row = {
        name: body.name, slug: slugify(body.slug || body.name) || null, code: body.code || null,
        description: body.description || null, short_description: body.short_description || null,
        icon_url: body.icon_url || null, banner_url: body.banner_url || null,
        status: body.status || "active",
        warranty_type: body.warranty_type || "manufacturer",
        duration_type: body.duration_type || "months", duration_value: body.duration_value ?? 12,
        duration_custom: body.duration_custom || null,
        coverage: body.coverage || [], exclusions: body.exclusions || [],
        claim_steps: body.claim_steps || [], claim_docs: body.claim_docs || [],
        claim_email: body.claim_email || null, claim_phone: body.claim_phone || null,
        claim_url: body.claim_url || null, processing_time: body.processing_time || null,
        countries: body.countries || ["Worldwide"], languages: body.languages || ["English"],
        default_language: body.default_language || "English",
        badge_text: body.badge_text || null, badge_color: body.badge_color || "#2563eb",
        show_on_product: body.show_on_product ?? true,
        meta_title: seo.meta_title, meta_description: seo.meta_description, og_image: body.og_image || body.banner_url || null,
        schema_enabled: body.schema_enabled ?? true,
        is_default: body.is_default ?? false, cj_default: body.cj_default ?? false,
        priority: body.priority ?? 100,
        created_by: actor?.id || null, created_by_name: actor?.full_name || actor?.email || "Admin",
      };
      const { data, error } = await s.from("warranties").insert(row).select("*").single();
      if (error) return j({ error: error.message }, 400);
      await audit("create", `Created warranty "${data.name}"`, { object_type: "warranty", object_id: data.id, new_value: data });
      await activity("create", `New warranty "${data.name}" created`, { object_type: "warranty", object_id: data.id, priority: "medium" });
      await notify(s, { subject: "Warranty added", body: `Warranty "${data.name}" was created.`, payload: { warranty_id: data.id, event: "added" } });
      return j({ warranty: data });
    }

    if (action === "update") {
      if (!body.id) return j({ error: "id required" }, 400);
      const { data: before } = await s.from("warranties").select("*").eq("id", body.id).single();
      if (!before) return j({ error: "Not found" }, 404);
      const seo = autoSeo({ ...before, ...body });
      const patch = {};
      const fields = ["name", "slug", "code", "description", "short_description", "icon_url", "banner_url", "status",
        "warranty_type", "duration_type", "duration_value", "duration_custom", "coverage", "exclusions",
        "claim_steps", "claim_docs", "claim_email", "claim_phone", "claim_url", "processing_time",
        "countries", "languages", "default_language", "badge_text", "badge_color", "show_on_product",
        "og_image", "schema_enabled", "is_default", "cj_default", "priority"];
      fields.forEach(f => { if (f in body) patch[f] = body[f]; });
      if ("slug" in patch) patch.slug = slugify(patch.slug || before.name) || null;
      patch.meta_title = body.meta_title ?? seo.meta_title;
      patch.meta_description = body.meta_description ?? seo.meta_description;
      const { data, error } = await s.from("warranties").update(patch).eq("id", body.id).select("*").single();
      if (error) return j({ error: error.message }, 400);
      await audit("update", `Updated warranty "${data.name}"`, { object_type: "warranty", object_id: data.id, old_value: before, new_value: data });
      await activity("update", `Warranty "${data.name}" updated`, { object_type: "warranty", object_id: data.id });
      await notify(s, { subject: "Warranty updated", body: `Warranty "${data.name}" was updated.`, payload: { warranty_id: data.id, event: "updated" } });
      return j({ warranty: data });
    }

    if (action === "toggle-status") {
      const { data: w } = await s.from("warranties").select("id,name,status").eq("id", body.id).single();
      if (!w) return j({ error: "Not found" }, 404);
      const status = w.status === "active" ? "inactive" : "active";
      await s.from("warranties").update({ status }).eq("id", w.id);
      await audit("toggle-status", `${status === "active" ? "Activated" : "Deactivated"} warranty "${w.name}"`, { object_type: "warranty", object_id: w.id });
      await activity("toggle-status", `Warranty "${w.name}" ${status === "active" ? "activated" : "deactivated"}`, { object_type: "warranty", object_id: w.id });
      return j({ ok: true, status });
    }

    if (action === "bulk-status") {
      const ids = body.ids || []; const status = body.status === "active" ? "active" : "inactive";
      if (!ids.length) return j({ error: "No rows selected" }, 400);
      await s.from("warranties").update({ status }).in("id", ids);
      await audit("bulk-status", `Set ${ids.length} warranties to ${status}`, { new_value: { ids, status } });
      await activity("bulk-status", `${ids.length} warranties set to ${status}`);
      return j({ ok: true, count: ids.length });
    }

    if (action === "delete" || action === "bulk-delete") {
      const ids = action === "delete" ? [body.id] : (body.ids || []);
      if (!ids.length || !ids[0]) return j({ error: "No rows selected" }, 400);
      const { data: rows } = await s.from("warranties").select("id,name").in("id", ids);
      await s.from("warranties").delete().in("id", ids);
      await audit("delete", `Deleted ${ids.length} warranty(ies): ${(rows || []).map(r => r.name).join(", ")}`, { risk_level: "medium", old_value: rows });
      await activity("delete", `${ids.length} warranty(ies) deleted`, { priority: "medium" });
      await notify(s, { subject: "Warranty removed", body: `${ids.length} warranty(ies) removed.`, payload: { event: "removed", ids } });
      return j({ ok: true, count: ids.length });
    }

    // ------- assignment: replace the full set for one target type -------
    if (action === "assign") {
      const { warranty_id, target, ids = [], source = "manual" } = body;
      if (!warranty_id || !target) return j({ error: "warranty_id and target required" }, 400);
      const { data: w } = await s.from("warranties").select("name").eq("id", warranty_id).single();
      if (target === "products") {
        await s.from("warranty_products").delete().eq("warranty_id", warranty_id);
        if (ids.length) await s.from("warranty_products").insert(ids.map(id => ({ warranty_id, product_id: id, source })));
      } else if (target === "categories") {
        await s.from("warranty_categories").delete().eq("warranty_id", warranty_id);
        if (ids.length) await s.from("warranty_categories").insert(ids.map(id => ({ warranty_id, category_id: id })));
      } else if (target === "brands") {
        await s.from("warranty_brands").delete().eq("warranty_id", warranty_id);
        if (ids.length) await s.from("warranty_brands").insert(ids.map(id => ({ warranty_id, brand_id: id })));
      } else return j({ error: "Unknown target" }, 400);
      await audit("assign", `Assigned warranty "${w?.name}" to ${ids.length} ${target}`, { object_type: "warranty", object_id: warranty_id, new_value: { target, ids } });
      await activity("assign", `Warranty "${w?.name}" assigned to ${ids.length} ${target}`, { object_type: "warranty", object_id: warranty_id });
      await notify(s, { subject: "Warranty assigned", body: `Warranty "${w?.name}" assigned to ${ids.length} ${target}.`, payload: { event: "assigned", warranty_id, target } });
      return j({ ok: true, count: ids.length });
    }

    // ------- automatic assignment rules -------
    if (action === "rule-save") {
      const { warranty_id, id, name, match_type, match_value, match_label, is_active } = body;
      if (!warranty_id || !name) return j({ error: "warranty_id and name required" }, 400);
      const row = { warranty_id, name, match_type: match_type || "brand", match_value: match_value || null, match_label: match_label || null, is_active: is_active ?? true };
      let data;
      if (id) { ({ data } = await s.from("warranty_rules").update(row).eq("id", id).select("*").single()); }
      else { ({ data } = await s.from("warranty_rules").insert(row).select("*").single()); }
      await audit("rule-save", `Saved automatic rule "${name}"`, { object_type: "warranty_rule", object_id: data?.id });
      return j({ rule: data });
    }
    if (action === "rule-delete") {
      await s.from("warranty_rules").delete().eq("id", body.id);
      await audit("rule-delete", `Deleted automatic rule`, { object_type: "warranty_rule", object_id: body.id });
      return j({ ok: true });
    }
    // apply one rule now: resolve matching products and attach them
    if (action === "rule-apply") {
      const { data: rule } = await s.from("warranty_rules").select("*").eq("id", body.id).single();
      if (!rule) return j({ error: "Rule not found" }, 404);
      let matched = [];
      if (rule.match_type === "brand" && rule.match_value) {
        const { data } = await s.from("products").select("id").eq("brand_id", rule.match_value);
        matched = (data || []).map(p => p.id);
      } else if (rule.match_type === "category" && rule.match_value) {
        const { data } = await s.from("products").select("id").eq("category_id", rule.match_value);
        matched = (data || []).map(p => p.id);
      } else if (rule.match_type === "tag" && rule.match_value) {
        const { data } = await s.from("products").select("id,tags");
        matched = (data || []).filter(p => Array.isArray(p.tags) && p.tags.map(t => String(t).toLowerCase()).includes(rule.match_value.toLowerCase())).map(p => p.id);
      } else if (rule.match_type === "all") {
        const { data } = await s.from("products").select("id");
        matched = (data || []).map(p => p.id);
      }
      if (matched.length) {
        await s.from("warranty_products").upsert(
          matched.map(id => ({ warranty_id: rule.warranty_id, product_id: id, source: "rule" })),
          { onConflict: "warranty_id,product_id", ignoreDuplicates: true }
        );
      }
      await audit("rule-apply", `Applied rule "${rule.name}" → ${matched.length} products`, { object_type: "warranty_rule", object_id: rule.id });
      await activity("rule-apply", `Rule "${rule.name}" attached ${matched.length} products`, { object_type: "warranty", object_id: rule.warranty_id });
      return j({ ok: true, count: matched.length });
    }

    // ------- files -------
    if (action === "file-add") {
      const { warranty_id, file_type, title, url, size_bytes } = body;
      if (!warranty_id || !url) return j({ error: "warranty_id and url required" }, 400);
      const { data } = await s.from("warranty_files").insert({ warranty_id, file_type: file_type || "pdf", title: title || null, url, size_bytes: size_bytes || null }).select("*").single();
      await audit("file-add", `Added ${file_type} attachment`, { object_type: "warranty", object_id: warranty_id });
      return j({ file: data });
    }
    if (action === "file-delete") {
      await s.from("warranty_files").delete().eq("id", body.id);
      return j({ ok: true });
    }

    // ------- translations -------
    if (action === "translation-save") {
      const { warranty_id, language } = body;
      if (!warranty_id || !language) return j({ error: "warranty_id and language required" }, 400);
      const row = {
        warranty_id, language, name: body.name || null, description: body.description || null,
        badge_text: body.badge_text || null, coverage: body.coverage || [], exclusions: body.exclusions || [],
        meta_title: body.meta_title || null, meta_description: body.meta_description || null,
      };
      const { data } = await s.from("warranty_translations").upsert(row, { onConflict: "warranty_id,language" }).select("*").single();
      await audit("translation-save", `Saved ${language} translation`, { object_type: "warranty", object_id: warranty_id });
      return j({ translation: data });
    }
    if (action === "translation-delete") {
      await s.from("warranty_translations").delete().eq("id", body.id);
      return j({ ok: true });
    }

    // ------- CJ default warranty toggle -------
    if (action === "cj-default") {
      const { warranty_id } = body;
      await s.from("warranties").update({ cj_default: false }).eq("cj_default", true);
      if (warranty_id) await s.from("warranties").update({ cj_default: true }).eq("id", warranty_id);
      await audit("cj-default", `Set CJ default warranty`, { object_type: "warranty", object_id: warranty_id });
      return j({ ok: true });
    }

    // ------- claims -------
    if (action === "claim-update") {
      const { id, status, resolution } = body;
      const { data } = await s.from("warranty_claims").update({ status, resolution: resolution || null }).eq("id", id).select("*").single();
      await audit("claim-update", `Updated claim ${data?.reference} → ${status}`, { object_type: "warranty_claim", object_id: id });
      return j({ claim: data });
    }

    // ------- CSV import -------
    if (action === "import") {
      const rows = body.rows || [];
      if (!Array.isArray(rows) || !rows.length) return j({ error: "No rows to import" }, 400);
      let created = 0, failed = 0;
      for (const r of rows) {
        if (!r.name) { failed++; continue; }
        const seo = autoSeo(r);
        const { error } = await s.from("warranties").insert({
          name: r.name, slug: slugify(r.name) || null, code: r.code || null,
          warranty_type: r.warranty_type || "manufacturer",
          duration_type: r.duration_type || "months", duration_value: r.duration_value ? parseInt(r.duration_value) : 12,
          status: r.status || "active", claim_email: r.claim_email || null, claim_phone: r.claim_phone || null,
          processing_time: r.processing_time || null, meta_title: seo.meta_title, meta_description: seo.meta_description,
          created_by: actor?.id || null, created_by_name: actor?.full_name || actor?.email || "Admin",
        });
        if (error) failed++; else created++;
      }
      await audit("import", `Imported ${created} warranties (${failed} failed)`, { new_value: { created, failed } });
      await activity("import", `Imported ${created} warranties`, { priority: "medium" });
      return j({ ok: true, created, failed });
    }

    return j({ error: "Unknown action" }, 404);
  } catch (e) {
    return j({ error: e.message || "Server error" }, 500);
  }
}
