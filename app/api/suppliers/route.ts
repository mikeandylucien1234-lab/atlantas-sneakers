// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { getAdapter } from "@/lib/suppliers/registry";

const DAY = 24 * 3600 * 1000;
function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }

// GET /api/suppliers?section=dashboard|list
export async function GET(request: NextRequest) {
  const auth = await requirePermission("products.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const section = request.nextUrl.searchParams.get("section") || "list";

  try {
    if (section === "list") {
      const { data: suppliers } = await s.from("suppliers").select("*").order("sort_order");
      const { data: conns } = await s.from("supplier_connections").select("*");
      const byId = Object.fromEntries((conns || []).map(c => [c.supplier_id, c]));
      const [{ data: prodCounts }, { data: orderCounts }] = await Promise.all([
        s.from("supplier_products").select("supplier_id"),
        s.from("supplier_orders").select("supplier_id"),
      ]);
      const pc = {}; (prodCounts || []).forEach(x => pc[x.supplier_id] = (pc[x.supplier_id] || 0) + 1);
      const oc = {}; (orderCounts || []).forEach(x => oc[x.supplier_id] = (oc[x.supplier_id] || 0) + 1);
      const list = (suppliers || []).map(sup => {
        const adapter = getAdapter(sup.id); const conn = byId[sup.id] || {};
        const configured = adapter.isConfigured();
        return { ...sup, connection: conn, configured, missing_env: adapter.missingEnv ? adapter.missingEnv() : [],
          products: pc[sup.id] || 0, orders: oc[sup.id] || 0,
          status: conn.connected ? "connected" : configured ? "ready" : "available", api_health: conn.api_health || "unknown", last_sync: conn.last_sync_at };
      });
      return Response.json({ suppliers: list });
    }

    if (section === "dashboard") {
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const [{ data: suppliers }, { data: conns }, { data: sp }, { data: orders }, { data: inv }, { data: images }, { data: cats }, { data: logs }, { data: webhooks }] = await Promise.all([
        s.from("suppliers").select("id"),
        s.from("supplier_connections").select("*"),
        s.from("supplier_products").select("imported"),
        s.from("supplier_orders").select("status"),
        s.from("supplier_inventory").select("id, synced_at"),
        s.from("supplier_images").select("id"),
        s.from("supplier_categories").select("id"),
        s.from("supplier_logs").select("action, status, latency_ms, error, created_at").gte("created_at", new Date(Date.now() - 30 * DAY).toISOString()).order("created_at", { ascending: false }).limit(5000),
        s.from("supplier_webhooks").select("deliveries"),
      ]);
      const C = conns || []; const SP = sp || []; const O = orders || []; const L = logs || [];
      const lat = L.filter(x => x.latency_ms); const avg = lat.length ? Math.round(lat.reduce((a, x) => a + x.latency_ms, 0) / lat.length) : 0;
      const connectedIds = C.filter(c => c.connected).length;
      const configured = (suppliers || []).filter(x => getAdapter(x.id).isConfigured()).length;
      return Response.json({
        kpis: {
          connectedSuppliers: connectedIds, configuredSuppliers: configured, totalSuppliers: (suppliers || []).length,
          apiStatus: C.some(c => c.api_health === "healthy" || c.connected) ? "operational" : "idle",
          productsImported: SP.filter(x => x.imported).length, productsSynced: (inv || []).length,
          ordersSent: O.length, ordersFailed: O.filter(x => x.status === "failed").length,
          inventoryUpdated: (inv || []).filter(x => x.synced_at >= new Date(Date.now() - DAY).toISOString()).length,
          imagesImported: (images || []).length, categoriesSynced: (cats || []).length,
          avgSyncTime: avg, lastSync: C.map(c => c.last_sync_at).filter(Boolean).sort().reverse()[0] || null,
          lastError: L.find(x => x.error)?.error || null,
          apiRequestsToday: L.filter(x => x.created_at >= todayStart).length,
          webhookEvents: (webhooks || []).reduce((a, w) => a + (w.deliveries || 0), 0),
        },
        recent: L.slice(0, 12),
      });
    }

    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
