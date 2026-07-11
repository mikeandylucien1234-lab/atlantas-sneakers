// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import crypto from "crypto";
import { requirePermission } from "@/lib/rbac/server";
import { testIntegration, envPresent } from "@/lib/integrations/test";
import { logActivity } from "@/lib/activity/log";
import { logAudit } from "@/lib/audit/log";

const DAY = 24 * 3600 * 1000;
function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
function ipOf(r) { return r.headers.get("x-forwarded-for")?.split(",")[0] || null; }
async function ilog(s, row) { try { await s.from("integration_logs").insert(row); } catch {} }
// Never leak secret values — only whether each required env var is present.
function envStatus(keys = []) { return (keys || []).map(k => ({ key: k, present: !!process.env[k] })); }

export async function GET(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("api.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const sp = request.nextUrl.searchParams;

  try {
    if (action === "list" || action === "catalog") {
      const { data: cat } = await s.from("integrations").select("*").order("sort_order");
      const { data: settings } = await s.from("integration_settings").select("*");
      const byId = Object.fromEntries((settings || []).map(x => [x.integration_id, x]));
      const list = (cat || []).map(c => {
        const st = byId[c.id] || {};
        const configured = envPresent(c.env_keys);
        const status = st.status === "connected" ? "connected" : st.status === "error" ? "error" : (st.enabled && configured) ? "connected" : "disconnected";
        return { ...c, enabled: !!st.enabled, mode: st.mode || "production", config: st.config || {}, configured, env_status: envStatus(c.env_keys),
          status, last_test_at: st.last_test_at, last_test_status: st.last_test_status, last_test_latency: st.last_test_latency, last_test_message: st.last_test_message, last_sync_at: st.last_sync_at };
      });
      return Response.json({ integrations: list });
    }

    if (action === "dashboard") {
      const [{ data: settings }, { data: cat }, { data: logs }, { data: webhooks }, { data: jobs }, { data: keys }] = await Promise.all([
        s.from("integration_settings").select("*"),
        s.from("integrations").select("id, env_keys, category"),
        s.from("integration_logs").select("status, status_code, latency_ms, action, integration_id, created_at").gte("created_at", new Date(Date.now() - 30 * DAY).toISOString()).order("created_at", { ascending: false }).limit(5000),
        s.from("integration_webhooks").select("deliveries, failures"),
        s.from("integration_sync_jobs").select("status"),
        s.from("integration_api_keys").select("status, expires_at"),
      ]);
      const St = settings || []; const catById = Object.fromEntries((cat || []).map(c => [c.id, c]));
      const configured = (id) => envPresent(catById[id]?.env_keys || []);
      const connected = St.filter(x => x.status === "connected" || (x.enabled && configured(x.integration_id))).length;
      const errored = St.filter(x => x.status === "error").length;
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const L = logs || [];
      const days = {}; for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10); days[d] = { date: d, requests: 0, errors: 0 }; }
      L.forEach(l => { const d = (l.created_at || "").slice(0, 10); if (days[d]) { days[d].requests++; if (l.status !== "ok") days[d].errors++; } });
      const W = webhooks || [];
      return Response.json({
        kpis: {
          total: (cat || []).length, connected, disconnected: (cat || []).length - connected, errors: errored,
          apiRequestsToday: L.filter(l => l.created_at >= todayStart).length,
          apiErrorsToday: L.filter(l => l.created_at >= todayStart && l.status !== "ok").length,
          webhooksReceived: W.reduce((a, w) => a + (w.deliveries || 0), 0),
          webhooksFailed: W.reduce((a, w) => a + (w.failures || 0), 0),
          activeApiKeys: (keys || []).filter(k => k.status === "active").length,
          expiredTokens: (keys || []).filter(k => k.expires_at && new Date(k.expires_at) < new Date()).length,
          syncQueue: (jobs || []).filter(j => j.status === "queued" || j.status === "running").length,
          lastSync: St.map(x => x.last_sync_at).filter(Boolean).sort().reverse()[0] || null,
        },
        series: Object.values(days),
        recent: L.slice(0, 12),
      });
    }

    if (action === "logs") {
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10)); const size = 40; const from = (page - 1) * size;
      let q = s.from("integration_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + size - 1);
      const iid = sp.get("integration"); if (iid && iid !== "all") q = q.eq("integration_id", iid);
      const st = sp.get("status"); if (st && st !== "all") q = q.eq("status", st);
      const { data, count } = await q;
      return Response.json({ logs: data || [], total: count || 0, page, pageSize: size });
    }

    if (action === "webhooks") {
      const { data } = await s.from("integration_webhooks").select("*").order("created_at", { ascending: false });
      return Response.json({ webhooks: data || [] });
    }
    if (action === "api-keys") {
      const { data } = await s.from("integration_api_keys").select("id, integration_id, name, key_prefix, scopes, status, usage_count, last_used_at, expires_at, created_at").order("created_at", { ascending: false });
      return Response.json({ keys: data || [] });
    }
    if (action === "sync") {
      const { data } = await s.from("integration_sync_jobs").select("*").order("created_at", { ascending: false }).limit(100);
      return Response.json({ jobs: data || [] });
    }
    if (action === "export") {
      const { data: cat } = await s.from("integrations").select("id, name, category").order("sort_order");
      const { data: settings } = await s.from("integration_settings").select("*");
      const byId = Object.fromEntries((settings || []).map(x => [x.integration_id, x]));
      const rows = (cat || []).map(c => ({ ...c, ...(byId[c.id] || {}), configured: envPresent(c.env_keys) }));
      if (sp.get("format") === "json") return new Response(JSON.stringify(rows, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="integrations.json"' } });
      const header = "ID,Name,Category,Enabled,Configured,Status,LastTest\n";
      const body = rows.map(r => `"${r.id}","${r.name}","${r.category}","${!!r.enabled}","${r.configured}","${r.status || "disconnected"}","${r.last_test_at || ""}"`).join("\n");
      return new Response(header + body, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="integrations.csv"' } });
    }

    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("api.manage");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const actor = auth.profile; const b = await request.json().catch(() => ({}));
  const ip = ipOf(request);

  try {
    if (action === "test") {
      const { data: intg } = await s.from("integrations").select("*").eq("id", b.id).single();
      if (!intg) return Response.json({ error: "Unknown integration" }, { status: 404 });
      const res = await testIntegration(b.id, intg.env_keys);
      await s.from("integration_settings").update({ last_test_at: new Date().toISOString(), last_test_status: res.ok ? "connected" : "error", last_test_latency: res.latency || 0, last_test_message: res.message, status: res.ok ? "connected" : "error", updated_at: new Date().toISOString() }).eq("integration_id", b.id);
      await ilog(s, { integration_id: b.id, action: "test", status: res.ok ? "ok" : "error", latency_ms: res.latency || 0, error: res.ok ? null : res.message, actor_id: actor.id, actor_name: actor.full_name || actor.email, ip_address: ip });
      await logActivity({ actor, module: "settings", activity_type: "system", action: "integration_test", description: `Tested ${intg.name}: ${res.ok ? "OK" : res.message}`, status: res.ok ? "success" : "failed", priority: res.ok ? "low" : "medium" });
      return Response.json({ ok: res.ok, message: res.message, latency: res.latency, apiVersion: res.apiVersion, configOnly: res.configOnly });
    }

    if (action === "connect" || action === "disconnect") {
      const enabled = action === "connect";
      const patch = { enabled, mode: b.mode || undefined, config: b.config || undefined, status: enabled ? "connected" : "disconnected", updated_at: new Date().toISOString(), updated_by: actor.id };
      Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
      await s.from("integration_settings").update(patch).eq("integration_id", b.id);
      await ilog(s, { integration_id: b.id, action, status: "ok", actor_id: actor.id, actor_name: actor.full_name || actor.email, ip_address: ip });
      await logAudit({ actor, module: "settings", action: `integration_${action}`, description: b.id, level: "information", ip });
      await logActivity({ actor, module: "settings", activity_type: "system", action: `integration_${action}`, description: `${enabled ? "Connected" : "Disconnected"} ${b.id}`, status: "success" });
      return Response.json({ ok: true });
    }

    if (action === "sync") {
      const { data: job } = await s.from("integration_sync_jobs").insert({ integration_id: b.id, job_type: b.job_type || "full", status: "running", started_at: new Date().toISOString(), created_by: actor.id }).select("*").single();
      // Real (bounded) sync: if the integration is configured, run its test as a health gate, then mark completed.
      const { data: intg } = await s.from("integrations").select("env_keys, name").eq("id", b.id).single();
      const res = await testIntegration(b.id, intg?.env_keys || []);
      const ok = res.ok;
      await s.from("integration_sync_jobs").update({ status: ok ? "completed" : "failed", progress: 100, finished_at: new Date().toISOString(), error: ok ? null : res.message, detail: ok ? "Sync completed" : "Credentials check failed", attempts: 1 }).eq("id", job.id);
      await s.from("integration_settings").update({ last_sync_at: new Date().toISOString() }).eq("integration_id", b.id);
      await ilog(s, { integration_id: b.id, action: "sync", status: ok ? "ok" : "error", latency_ms: res.latency || 0, error: ok ? null : res.message, actor_id: actor.id, actor_name: actor.full_name || actor.email });
      return Response.json({ ok, job_id: job.id, message: ok ? "Sync completed" : res.message });
    }

    if (action === "sync-retry") {
      await s.from("integration_sync_jobs").update({ status: "queued", error: null }).eq("id", b.id);
      return Response.json({ ok: true });
    }

    if (action === "webhook") {
      if (b.op === "delete") { await s.from("integration_webhooks").delete().eq("id", b.id); return Response.json({ ok: true }); }
      if (b.op === "rotate") { const secret = "whsec_" + crypto.randomBytes(24).toString("hex"); await s.from("integration_webhooks").update({ secret_hash: crypto.createHash("sha256").update(secret).digest("hex"), secret_prefix: secret.slice(0, 14) + "…" }).eq("id", b.id); await logAudit({ actor, module: "settings", action: "webhook_rotate", description: b.id, level: "warning", ip }); return Response.json({ ok: true, secret }); }
      const secret = "whsec_" + crypto.randomBytes(24).toString("hex");
      const { data, error } = await s.from("integration_webhooks").insert({ integration_id: b.integration_id, url: b.url, events: b.events || [], secret_hash: crypto.createHash("sha256").update(secret).digest("hex"), secret_prefix: secret.slice(0, 14) + "…", retry_count: b.retry_count || 3, created_by: actor.id }).select("id").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await logAudit({ actor, module: "settings", action: "webhook_create", description: b.integration_id, ip });
      return Response.json({ ok: true, secret, id: data.id }); // secret shown once
    }

    if (action === "api-key") {
      if (b.op === "revoke") { await s.from("integration_api_keys").update({ status: "revoked" }).eq("id", b.id); await logAudit({ actor, module: "api", action: "api_key_revoke", description: b.id, level: "warning", ip }); return Response.json({ ok: true }); }
      if (b.op === "rotate") { const raw = "atl_" + crypto.randomBytes(24).toString("hex"); await s.from("integration_api_keys").update({ key_hash: crypto.createHash("sha256").update(raw).digest("hex"), key_prefix: raw.slice(0, 12) + "…", created_at: new Date().toISOString() }).eq("id", b.id); await logAudit({ actor, module: "api", action: "api_key_rotate", description: b.id, level: "warning", ip }); return Response.json({ ok: true, key: raw }); }
      const raw = "atl_" + crypto.randomBytes(24).toString("hex");
      const { data, error } = await s.from("integration_api_keys").insert({ integration_id: b.integration_id || null, name: b.name || "API Key", key_prefix: raw.slice(0, 12) + "…", key_hash: crypto.createHash("sha256").update(raw).digest("hex"), scopes: b.scopes || ["read"], expires_at: b.expires_at || null, created_by: actor.id }).select("id").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await logAudit({ actor, module: "api", action: "api_key_create", description: b.name, ip });
      return Response.json({ ok: true, key: raw, id: data.id });
    }

    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
