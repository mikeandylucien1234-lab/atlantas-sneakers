// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import crypto from "crypto";
import { requirePermission } from "@/lib/rbac/server";
import { getAdapter } from "@/lib/suppliers/registry";
import { importProduct, createSupplierOrder, syncTracking, syncInventory } from "@/lib/suppliers/engine";
import { logAudit } from "@/lib/audit/log";
import { logActivity } from "@/lib/activity/log";

function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
function ipOf(r) { return r.headers.get("x-forwarded-for")?.split(",")[0] || null; }
async function slog(s, row) { try { await s.from("supplier_logs").insert(row); } catch {} }

export async function GET(request: NextRequest, { params }) {
  const { supplier, action } = await params;
  const auth = await requirePermission("products.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const sp = request.nextUrl.searchParams;

  try {
    if (action === "overview") {
      const { data: sup } = await s.from("suppliers").select("*").eq("id", supplier).single();
      const { data: conn } = await s.from("supplier_connections").select("*").eq("supplier_id", supplier).single();
      const adapter = getAdapter(supplier);
      const [{ count: products }, { count: orders }, { count: imported }] = await Promise.all([
        s.from("supplier_products").select("id", { count: "exact", head: true }).eq("supplier_id", supplier),
        s.from("supplier_orders").select("id", { count: "exact", head: true }).eq("supplier_id", supplier),
        s.from("supplier_products").select("id", { count: "exact", head: true }).eq("supplier_id", supplier).eq("imported", true),
      ]);
      return Response.json({ supplier: sup, connection: conn, configured: adapter.isConfigured(), missing_env: adapter.missingEnv?.() || [], env_keys: sup?.env_keys || [], stats: { products, orders, imported } });
    }
    if (action === "search") {
      const adapter = getAdapter(supplier);
      const started = Date.now();
      const res = await adapter.searchProducts({ keyword: sp.get("q"), page: parseInt(sp.get("page") || "1", 10), pageSize: 20, category: sp.get("category"), warehouse: sp.get("warehouse") });
      await slog(s, { supplier_id: supplier, action: "search", endpoint: "/product/list", status: res.ok ? "ok" : "error", latency_ms: Date.now() - started, error: res.ok ? null : res.message });
      // cache results for the explorer / import
      if (res.ok) for (const p of res.products) { await s.from("supplier_products").upsert({ supplier_id: supplier, external_id: p.external_id, name: p.name, main_image: p.image, supplier_price: p.supplier_price, category_external: p.category_external, processing_time: p.processing_time, raw: p.raw }, { onConflict: "supplier_id,external_id", ignoreDuplicates: true }).then(() => {}, () => {}); }
      return Response.json(res);
    }
    if (action === "product") {
      const id = sp.get("id");
      const adapter = getAdapter(supplier);
      const res = await adapter.getProduct(id);
      if (!res.ok) { const { data: cached } = await s.from("supplier_products").select("*").eq("supplier_id", supplier).eq("external_id", id).maybeSingle(); if (cached) return Response.json({ ok: true, product: { ...cached.raw, external_id: cached.external_id, name: cached.name, supplier_price: cached.supplier_price, images: cached.images, main_image: cached.main_image }, cached: true }); }
      return Response.json(res);
    }
    if (action === "products") {
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10)); const size = 24; const from = (page - 1) * size;
      let q = s.from("supplier_products").select("*", { count: "exact" }).eq("supplier_id", supplier).order("created_at", { ascending: false });
      if (sp.get("imported") === "1") q = q.eq("imported", true);
      const search = sp.get("q"); if (search) q = q.ilike("name", `%${search}%`);
      const { data, count } = await q.range(from, from + size - 1);
      return Response.json({ products: data || [], total: count || 0, page, pageSize: size });
    }
    if (action === "orders") { const { data } = await s.from("supplier_orders").select("*").eq("supplier_id", supplier).order("created_at", { ascending: false }).limit(200); return Response.json({ orders: data || [] }); }
    if (action === "tracking") { const { data } = await s.from("supplier_tracking").select("*").order("updated_at", { ascending: false }).limit(200); return Response.json({ tracking: data || [] }); }
    if (action === "inventory") { const { data } = await s.from("supplier_inventory").select("*").eq("supplier_id", supplier).order("synced_at", { ascending: false }).limit(300); return Response.json({ inventory: data || [] }); }
    if (action === "categories") { const { data } = await s.from("supplier_categories").select("*").eq("supplier_id", supplier).order("external_category").limit(1000); return Response.json({ categories: data || [] }); }
    if (action === "pricing-rules") { const { data } = await s.from("supplier_pricing_rules").select("*").eq("supplier_id", supplier).order("priority"); return Response.json({ rules: data || [] }); }
    if (action === "shipping-rules") { const { data } = await s.from("supplier_shipping_rules").select("*").eq("supplier_id", supplier); return Response.json({ rules: data || [] }); }
    if (action === "webhooks") { const { data } = await s.from("supplier_webhooks").select("id, event, url, secret_prefix, status, deliveries, failures, last_delivery_at").eq("supplier_id", supplier); return Response.json({ webhooks: data || [] }); }
    if (action === "queue") { const { data } = await s.from("supplier_sync_jobs").select("*").eq("supplier_id", supplier).order("created_at", { ascending: false }).limit(100); return Response.json({ jobs: data || [] }); }
    if (action === "logs") { const page = Math.max(1, parseInt(sp.get("page") || "1", 10)); const size = 40; const from = (page - 1) * size; const { data, count } = await s.from("supplier_logs").select("*", { count: "exact" }).eq("supplier_id", supplier).order("created_at", { ascending: false }).range(from, from + size - 1); return Response.json({ logs: data || [], total: count || 0, page }); }
    if (action === "api-monitor") {
      const { data } = await s.from("supplier_logs").select("action, status, status_code, latency_ms, created_at").eq("supplier_id", supplier).gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()).order("created_at", { ascending: false }).limit(2000);
      const L = data || []; const lat = L.filter(x => x.latency_ms);
      return Response.json({ calls: L.length, errors: L.filter(x => x.status !== "ok").length, avgLatency: lat.length ? Math.round(lat.reduce((a, x) => a + x.latency_ms, 0) / lat.length) : 0, recent: L.slice(0, 40) });
    }
    if (action === "warehouses") {
      // derived from products' warehouse metadata (raw)
      const { data } = await s.from("supplier_products").select("raw").eq("supplier_id", supplier).limit(500);
      const wh = {}; (data || []).forEach(p => { const w = p.raw?.warehouse || p.raw?.entryCode; if (w) wh[w] = (wh[w] || 0) + 1; });
      return Response.json({ warehouses: Object.entries(wh).map(([code, count]) => ({ code, products: count })) });
    }
    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}

export async function POST(request: NextRequest, { params }) {
  const { supplier, action } = await params;
  const perm = action === "import" || action === "bulk-import" ? "products.create" : ["connect", "disconnect", "generate-webhook", "pricing-rule", "shipping-rule", "category-map"].includes(action) ? "products.manage" : "products.view";
  const auth = await requirePermission(perm);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const actor = auth.profile; const b = await request.json().catch(() => ({})); const ip = ipOf(request);

  try {
    if (action === "test") {
      const adapter = getAdapter(supplier); const started = Date.now();
      const res = await adapter.testConnection();
      await s.from("supplier_connections").update({ last_api_call_at: new Date().toISOString(), api_health: res.ok ? "healthy" : "error", last_error: res.ok ? null : res.message, updated_at: new Date().toISOString() }).eq("supplier_id", supplier);
      await slog(s, { supplier_id: supplier, action: "test", status: res.ok ? "ok" : "error", latency_ms: Date.now() - started, error: res.ok ? null : res.message, actor_id: actor.id, actor_name: actor.full_name });
      await logAudit({ actor, module: "settings", submodule: "suppliers", action: "supplier_test", description: `${supplier}: ${res.ok ? "ok" : res.message}`, ip });
      return Response.json(res);
    }
    if (action === "connect" || action === "disconnect") {
      const connected = action === "connect";
      const adapter = getAdapter(supplier);
      if (connected && !adapter.isConfigured()) return Response.json({ ok: false, error: `Set credentials first: ${adapter.missingEnv?.().join(", ") || "env vars"}` }, { status: 400 });
      await s.from("supplier_connections").update({ connected, environment: b.environment || undefined, config: b.config || undefined, api_health: connected ? "healthy" : "unknown", updated_at: new Date().toISOString(), updated_by: actor.id }).eq("supplier_id", supplier);
      await s.from("suppliers").update({ status: connected ? "connected" : "available" }).eq("id", supplier);
      await logAudit({ actor, module: "settings", submodule: "suppliers", action: `supplier_${action}`, description: supplier, level: "warning", ip });
      await logActivity({ actor, module: "settings", activity_type: "system", action: `supplier_${action}`, description: `${supplier} ${connected ? "connected" : "disconnected"}`, status: "success" });
      return Response.json({ ok: true });
    }
    if (action === "import") {
      const res = await importProduct({ supplierId: supplier, externalId: b.external_id, overrides: b.overrides || {}, actor });
      if (!res.ok) return Response.json({ error: res.error }, { status: 500 });
      await logAudit({ actor, module: "products", submodule: "suppliers", action: "supplier_import", description: `${supplier}:${b.external_id} → product ${res.product_id}`, entity_id: res.product_id, ip });
      await logActivity({ actor, module: "products", activity_type: "product", action: "product_imported", description: `Imported from ${supplier}`, status: "success", object_type: "product", object_id: res.product_id });
      return Response.json({ ok: true, ...res });
    }
    if (action === "bulk-import") {
      const ids = b.external_ids || [];
      const { data: job } = await s.from("supplier_sync_jobs").insert({ supplier_id: supplier, job_type: "import", status: "running", total: ids.length, started_at: new Date().toISOString(), created_by: actor.id }).select("id").single();
      let ok = 0, fail = 0;
      for (const id of ids.slice(0, 500)) { const r = await importProduct({ supplierId: supplier, externalId: id, overrides: b.overrides || {}, actor }); if (r.ok) ok++; else fail++; await s.from("supplier_sync_jobs").update({ processed: ok + fail, succeeded: ok, failed: fail, progress: Math.round((ok + fail) / ids.length * 100) }).eq("id", job.id); }
      await s.from("supplier_sync_jobs").update({ status: "completed", finished_at: new Date().toISOString(), detail: `${ok} imported, ${fail} failed` }).eq("id", job.id);
      await logAudit({ actor, module: "products", submodule: "suppliers", action: "supplier_bulk_import", description: `${supplier}: ${ok}/${ids.length}`, ip });
      return Response.json({ ok: true, job_id: job.id, imported: ok, failed: fail });
    }
    if (action === "sync") {
      const type = b.job_type || "inventory";
      const { data: job } = await s.from("supplier_sync_jobs").insert({ supplier_id: supplier, job_type: type, status: "running", started_at: new Date().toISOString(), created_by: actor.id }).select("id").single();
      let result = { ok: true };
      if (type === "inventory" || type === "price") result = await syncInventory({ supplierId: supplier, actor });
      await s.from("supplier_sync_jobs").update({ status: result.ok ? "completed" : "failed", progress: 100, finished_at: new Date().toISOString(), detail: result.updated != null ? `${result.updated} updated` : result.message, error: result.ok ? null : result.message }).eq("id", job.id);
      return Response.json({ ok: result.ok, job_id: job.id, ...result });
    }
    if (action === "order") {
      const res = await createSupplierOrder({ supplierId: supplier, order: b.order, items: b.items, actor });
      await logAudit({ actor, module: "orders", submodule: "suppliers", action: "supplier_order", description: `${supplier}: ${res.external_order_id || res.message}`, ip });
      return Response.json(res);
    }
    if (action === "tracking") { const res = await syncTracking({ supplierId: supplier, supplierOrderId: b.supplier_order_id, trackingNumber: b.tracking_number, actor }); return Response.json(res); }
    if (action === "pricing-rule") {
      if (b.op === "delete") { await s.from("supplier_pricing_rules").delete().eq("id", b.id); return Response.json({ ok: true }); }
      if (b.id) await s.from("supplier_pricing_rules").update({ name: b.name, rule_type: b.rule_type, value: b.value, rounding: b.rounding, min_profit: b.min_profit, max_discount: b.max_discount, enabled: b.enabled, is_default: b.is_default }).eq("id", b.id);
      else await s.from("supplier_pricing_rules").insert({ supplier_id: supplier, name: b.name, rule_type: b.rule_type || "markup_percent", value: b.value ?? 35, rounding: b.rounding || "0.99", min_profit: b.min_profit || 0, is_default: !!b.is_default });
      await logAudit({ actor, module: "settings", action: "supplier_pricing_rule", description: supplier, ip });
      return Response.json({ ok: true });
    }
    if (action === "shipping-rule") {
      if (b.op === "delete") { await s.from("supplier_shipping_rules").delete().eq("id", b.id); return Response.json({ ok: true }); }
      await s.from("supplier_shipping_rules").insert({ supplier_id: supplier, name: b.name, method: b.method, countries: b.countries || [], cost: b.cost, min_days: b.min_days, max_days: b.max_days });
      return Response.json({ ok: true });
    }
    if (action === "category-map") {
      await s.from("supplier_categories").upsert({ supplier_id: supplier, external_category: b.external_category, external_category_id: b.external_category_id || b.external_category, mapped_category_id: b.mapped_category_id, auto_mapped: false }, { onConflict: "supplier_id,external_category_id" });
      return Response.json({ ok: true });
    }
    if (action === "generate-webhook") {
      const secret = "cjwh_" + crypto.randomBytes(24).toString("hex");
      const { data } = await s.from("supplier_webhooks").insert({ supplier_id: supplier, event: b.event || "order_shipped", url: b.url, secret_hash: crypto.createHash("sha256").update(secret).digest("hex"), secret_prefix: secret.slice(0, 12) + "…", created_by: actor.id }).select("id").single();
      await s.from("supplier_connections").update({ webhook_status: "active", webhook_prefix: secret.slice(0, 12) + "…" }).eq("supplier_id", supplier);
      await logAudit({ actor, module: "settings", action: "supplier_webhook", description: supplier, ip });
      return Response.json({ ok: true, secret, id: data.id });
    }
    if (action === "queue-action") {
      if (b.op === "retry") await s.from("supplier_sync_jobs").update({ status: "queued", error: null }).eq("id", b.id);
      if (b.op === "cancel") await s.from("supplier_sync_jobs").update({ status: "cancelled" }).eq("id", b.id);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
