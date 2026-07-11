// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { runHealthChecks } from "@/lib/health/checks";
import { logAudit } from "@/lib/audit/log";

const DAY = 24 * 3600 * 1000;
function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
const SCORE = { healthy: 100, warning: 60, critical: 10, down: 0, unknown: 70 };

export async function GET(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("logs.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const sp = request.nextUrl.searchParams;

  try {
    if (action === "dashboard") {
      const monthAgo = new Date(Date.now() - 30 * DAY).toISOString();
      const dayAgo = new Date(Date.now() - DAY).toISOString();
      const [{ data: health }, { data: alerts }, { data: incidents }, { data: logs }, { data: metrics }, { data: orders }, { data: payments }, { data: sessions }] = await Promise.all([
        s.from("system_health").select("*"),
        s.from("health_alerts").select("*").eq("status", "open").order("created_at", { ascending: false }),
        s.from("health_incidents").select("*").order("created_at", { ascending: false }).limit(50),
        s.from("health_logs").select("service, status, created_at").gte("created_at", monthAgo),
        s.from("health_metrics").select("metric, value, created_at").in("metric", ["cpu", "ram", "server_latency", "database_latency", "api_latency"]).gte("created_at", dayAgo).order("created_at", { ascending: true }).limit(2000),
        s.from("orders").select("id, created_at").gte("created_at", dayAgo),
        s.from("payments").select("status").gte("created_at", dayAgo),
        s.from("staff_sessions").select("id").eq("revoked", false),
      ]);
      const H = health || [];
      const overall = H.length ? Math.round(H.reduce((a, h) => a + (SCORE[h.status] ?? 70), 0) / H.length) : 100;
      const server = H.find(h => h.service === "server")?.detail || {};
      const db = H.find(h => h.service === "database") || {};
      const api = H.find(h => h.service === "api")?.detail || {};
      const pay = H.find(h => h.service === "payments")?.detail || {};
      const queue = H.find(h => h.service === "queue")?.detail || {};
      // uptime from logs (healthy ratio)
      const L = logs || []; const up = L.filter(x => x.status === "healthy" || x.status === "warning").length;
      const uptimePct = L.length ? +(up / L.length * 100).toFixed(2) : 100;
      const P = payments || []; const paid = P.filter(x => ["paid", "completed", "success"].includes(x.status)).length; const pf = P.filter(x => ["failed", "declined"].includes(x.status)).length;
      const ordersPerMin = +((orders || []).length / (24 * 60)).toFixed(2);
      // time-series for charts
      const cpuSeries = (metrics || []).filter(m => m.metric === "cpu").map(m => ({ t: m.created_at, v: Number(m.value) }));
      const ramSeries = (metrics || []).filter(m => m.metric === "ram").map(m => ({ t: m.created_at, v: Number(m.value) }));
      const latSeries = (metrics || []).filter(m => m.metric === "database_latency").map(m => ({ t: m.created_at, v: Number(m.value) }));
      return Response.json({
        overall, services: H.map(h => ({ ...h })),
        kpis: {
          overall, cpu: server.cpu ?? null, ram: server.ram ?? null, cores: server.cores, load: server.load,
          heapMB: server.heapUsedMB, rssMB: server.rssMB, uptimeH: server.uptimeH, node: server.node, platform: server.platform,
          dbLatency: db.latency_ms ?? null, apiLatency: api.avgLatency ?? null, apiErrorRate: api.errorRate ?? 0,
          ordersPerMin, paymentSuccessRate: pay.successRate ?? 100, activeSessions: (sessions || []).length,
          failedJobs: queue.failed ?? 0, pendingJobs: queue.pending ?? 0,
          uptimePct, incidentCount: (incidents || []).filter(i => i.status !== "resolved").length, activeAlerts: (alerts || []).length,
          lastCheck: H.map(h => h.last_checked_at).filter(Boolean).sort().reverse()[0] || null,
        },
        alerts: alerts || [], incidents: incidents || [],
        charts: { cpu: cpuSeries, ram: ramSeries, latency: latSeries },
      });
    }

    if (action === "logs") {
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10)); const size = 40; const from = (page - 1) * size;
      let q = s.from("health_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + size - 1);
      const service = sp.get("service"); if (service && service !== "all") q = q.eq("service", service);
      const status = sp.get("status"); if (status && status !== "all") q = q.eq("status", status);
      const { data, count } = await q;
      return Response.json({ logs: data || [], total: count || 0, page, pageSize: size });
    }

    if (action === "incidents") { const { data } = await s.from("health_incidents").select("*").order("created_at", { ascending: false }).limit(100); return Response.json({ incidents: data || [] }); }
    if (action === "alerts") { const { data } = await s.from("health_alerts").select("*").order("created_at", { ascending: false }).limit(200); return Response.json({ alerts: data || [] }); }
    if (action === "metrics") { const metric = sp.get("metric") || "cpu"; const { data } = await s.from("health_metrics").select("value, created_at").eq("metric", metric).gte("created_at", new Date(Date.now() - DAY).toISOString()).order("created_at", { ascending: true }).limit(2000); return Response.json({ metric, points: data || [] }); }

    if (action === "export") {
      const { data } = await s.from("health_logs").select("created_at, service, status, latency_ms, duration_ms, message, error").order("created_at", { ascending: false }).limit(10000);
      const rows = data || [];
      if (sp.get("format") === "json") return new Response(JSON.stringify(rows, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="health-logs.json"' } });
      const header = "Date,Service,Status,Latency,Duration,Message,Error\n";
      const body = rows.map(r => [r.created_at, r.service, r.status, r.latency_ms, r.duration_ms, r.message, r.error].map(v => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
      return new Response(header + body, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="health-logs.csv"' } });
    }

    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission(action === "run" || action === "check" ? "logs.view" : "settings.manage");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const actor = auth.profile; const b = await request.json().catch(() => ({}));

  try {
    if (action === "run" || action === "check" || action === "test") {
      const results = await runHealthChecks(b.services);
      await logAudit({ actor, module: "settings", submodule: "health", action: "health_check", description: `${results.length} services checked`, ip: request.headers.get("x-forwarded-for")?.split(",")[0] });
      return Response.json({ ok: true, results });
    }
    if (action === "resolve-alert") {
      await s.from("health_alerts").update({ status: b.status || "resolved", resolved_at: new Date().toISOString() }).eq("id", b.id);
      await logAudit({ actor, module: "settings", action: "health_resolve_alert", description: b.id });
      return Response.json({ ok: true });
    }
    if (action === "incident") {
      if (b.op === "create") { const { data, error } = await s.from("health_incidents").insert({ title: b.title, priority: b.priority || "medium", affected_services: b.affected_services || [], impact: b.impact, created_by: actor.id }).select("*").single(); if (error) return Response.json({ error: error.message }, { status: 500 }); return Response.json({ incident: data }); }
      if (b.op === "assign") { await s.from("health_incidents").update({ assigned_to: actor.id, assigned_name: actor.full_name || actor.email }).eq("id", b.id); return Response.json({ ok: true }); }
      if (b.op === "status") { const patch = { status: b.status }; if (b.status === "resolved") patch.resolved_at = new Date().toISOString(); await s.from("health_incidents").update(patch).eq("id", b.id); await logAudit({ actor, module: "settings", action: "health_incident_status", description: `${b.id} → ${b.status}` }); return Response.json({ ok: true }); }
      return Response.json({ error: "Unknown op" }, { status: 400 });
    }
    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
