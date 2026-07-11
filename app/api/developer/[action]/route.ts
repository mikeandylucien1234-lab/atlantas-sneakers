// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import crypto from "crypto";
import { requirePermission } from "@/lib/rbac/server";
import { sha256 } from "@/lib/api-keys/verify";
import { logAudit } from "@/lib/audit/log";
import { logActivity } from "@/lib/activity/log";

const DAY = 24 * 3600 * 1000;
function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
function ipOf(r) { return r.headers.get("x-forwarded-for")?.split(",")[0] || null; }
function baseUrl(request) { return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(request.url).origin; }
const rl = new Map();
function limited(key, max, win) { const now = Date.now(); const e = rl.get(key) || { c: 0, t: now }; if (now - e.t > win) { e.c = 0; e.t = now; } e.c++; rl.set(key, e); return e.c > max; }
// public fields only — never key_hash/old_hash
const PUBLIC = "id, name, description, key_id, key_type, owner, application_id, environment, permissions, status, rate_per_minute, rate_per_hour, rate_per_day, burst_limit, allowed_domains, allowed_ips, webhook_access, logging_enabled, monitoring_enabled, notifications_enabled, usage_count, last_used_at, expires_at, created_by, created_at, old_hash_expires_at";

export async function GET(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("api.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const sp = request.nextUrl.searchParams;

  try {
    if (action === "dashboard") {
      const monthAgo = new Date(Date.now() - 30 * DAY).toISOString();
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const [{ data: keys }, { data: logs }, { data: apps }, { data: webhooks }] = await Promise.all([
        s.from("api_keys").select("id, status, environment, expires_at, owner"),
        s.from("api_logs").select("status_code, result, response_time_ms, created_at").gte("created_at", monthAgo).order("created_at", { ascending: false }).limit(10000),
        s.from("api_applications").select("id, status"),
        s.from("api_webhooks").select("id, status"),
      ]);
      const K = keys || []; const L = logs || [];
      const days = {}; for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10); days[d] = { date: d, requests: 0, errors: 0 }; }
      L.forEach(l => { const d = (l.created_at || "").slice(0, 10); if (days[d]) { days[d].requests++; if (l.result !== "ok") days[d].errors++; } });
      const rt = L.filter(l => l.response_time_ms); const avgRt = rt.length ? Math.round(rt.reduce((a, l) => a + l.response_time_ms, 0) / rt.length) : 0;
      return Response.json({
        kpis: {
          total: K.length, active: K.filter(k => k.status === "active").length, disabled: K.filter(k => k.status === "disabled").length,
          expired: K.filter(k => k.expires_at && new Date(k.expires_at) < new Date()).length, revoked: K.filter(k => k.status === "revoked").length,
          requestsToday: L.filter(l => l.created_at >= todayStart).length, requestsMonth: L.length,
          failed: L.filter(l => l.result !== "ok").length, blocked: L.filter(l => l.result === "denied").length,
          rateLimited: L.filter(l => l.status_code === 429).length,
          activeDevelopers: new Set(K.map(k => k.owner).filter(Boolean)).size,
          activeApplications: (apps || []).filter(a => a.status === "active").length,
          webhooksConnected: (webhooks || []).filter(w => w.status === "active").length,
          avgResponseTime: avgRt,
        },
        series: Object.values(days),
        recent: L.slice(0, 12),
      });
    }

    if (action === "keys") {
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10)); const size = 25; const from = (page - 1) * size;
      let q = s.from("api_keys").select(PUBLIC, { count: "exact" }).order("created_at", { ascending: false });
      const env = sp.get("environment"); if (env && env !== "all") q = q.eq("environment", env);
      const st = sp.get("status"); if (st && st !== "all") q = q.eq("status", st);
      const owner = sp.get("owner"); if (owner) q = q.ilike("owner", `%${owner}%`);
      const search = sp.get("q"); if (search) q = q.or(`name.ilike.%${search}%,key_id.ilike.%${search}%,owner.ilike.%${search}%`);
      const { data, count } = await q.range(from, from + size - 1);
      return Response.json({ keys: data || [], total: count || 0, page, pageSize: size });
    }

    if (action === "detail") {
      const id = sp.get("id");
      const { data: key } = await s.from("api_keys").select(PUBLIC).eq("id", id).single();
      if (!key) return Response.json({ error: "Not found" }, { status: 404 });
      const [{ data: logs }, { data: usage }, { data: webhooks }] = await Promise.all([
        s.from("api_logs").select("*").eq("api_key_id", id).order("created_at", { ascending: false }).limit(50),
        s.from("api_usage").select("*").eq("api_key_id", id).order("day", { ascending: false }).limit(30),
        s.from("api_webhooks").select("id, url, secret_prefix, events, status, deliveries, failures, last_delivery_at").eq("api_key_id", id),
      ]);
      return Response.json({ key, logs: logs || [], usage: usage || [], webhooks: webhooks || [] });
    }

    if (action === "logs") {
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10)); const size = 40; const from = (page - 1) * size;
      let q = s.from("api_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + size - 1);
      const kid = sp.get("key"); if (kid && kid !== "all") q = q.eq("api_key_id", kid);
      const res = sp.get("result"); if (res && res !== "all") q = q.eq("result", res);
      const { data, count } = await q;
      return Response.json({ logs: data || [], total: count || 0, page, pageSize: size });
    }

    if (action === "usage") {
      const kid = sp.get("key");
      let q = s.from("api_usage").select("*").order("day", { ascending: false }).limit(60);
      if (kid && kid !== "all") q = q.eq("api_key_id", kid);
      const { data } = await q;
      return Response.json({ usage: data || [] });
    }

    if (action === "applications") { const { data } = await s.from("api_applications").select("*").order("created_at", { ascending: false }); return Response.json({ applications: data || [] }); }
    if (action === "permissions-catalog") { const { data } = await s.from("api_permissions").select("*").order("module"); return Response.json({ permissions: data || [] }); }

    if (action === "export") {
      const { data } = await s.from("api_keys").select("name, key_id, key_type, owner, environment, status, usage_count, last_used_at, expires_at, created_at").order("created_at", { ascending: false });
      const rows = data || [];
      if (sp.get("format") === "json") return new Response(JSON.stringify(rows, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="api-keys.json"' } });
      const header = "Name,KeyID,Type,Owner,Environment,Status,Usage,LastUsed,Expires,Created\n";
      const body = rows.map(r => [r.name, r.key_id, r.key_type, r.owner, r.environment, r.status, r.usage_count, r.last_used_at, r.expires_at, r.created_at].map(v => `"${v ?? ""}"`).join(",")).join("\n");
      return new Response(header + body, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="api-keys.csv"' } });
    }

    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }) {
  const { action } = await params;
  const perm = action === "create" ? "api.create" : action === "delete" ? "api.delete" : "api.manage";
  const auth = await requirePermission(perm);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const actor = auth.profile; const b = await request.json().catch(() => ({})); const ip = ipOf(request);

  try {
    if (action === "create") {
      if (limited(`apikey:${actor.id}`, 20, 60000)) return Response.json({ error: "Rate limit" }, { status: 429 });
      const env = b.environment || "production";
      const key_id = "ak_" + crypto.randomBytes(8).toString("hex");
      const secret = `sk_${env === "production" ? "live" : "test"}_` + crypto.randomBytes(28).toString("hex");
      const row = {
        name: b.name || "API Key", description: b.description || null, key_id, key_type: b.key_type || "private",
        owner: b.owner || actor.email, environment: env, permissions: b.permissions || {},
        key_hash: sha256(secret), key_prefix: secret.slice(0, 12) + "…", scopes: Object.keys(b.permissions || {}),
        rate_per_minute: b.rate_per_minute ?? 120, rate_per_hour: b.rate_per_hour ?? 5000, rate_per_day: b.rate_per_day ?? 50000, burst_limit: b.burst_limit ?? 40,
        allowed_domains: b.allowed_domains || [], allowed_ips: b.allowed_ips || [], webhook_access: !!b.webhook_access,
        logging_enabled: b.logging_enabled !== false, monitoring_enabled: b.monitoring_enabled !== false, notifications_enabled: !!b.notifications_enabled,
        application_id: b.application_id || null, expires_at: b.expires_at || null, status: "active", created_by: actor.id,
      };
      const { data, error } = await s.from("api_keys").insert(row).select("id, key_id").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await logAudit({ actor, module: "api", action: "api_key_create", description: row.name, entity_id: data.id, level: "warning", ip });
      await logActivity({ actor, module: "settings", activity_type: "system", action: "api_key_created", description: `API key "${row.name}" (${env})`, status: "success" });
      return Response.json({ ok: true, id: data.id, key_id: data.key_id, secret }); // secret shown once
    }

    if (action === "update") {
      const patch = { updated_at: new Date().toISOString() };
      ["name", "description", "owner", "permissions", "environment", "key_type", "rate_per_minute", "rate_per_hour", "rate_per_day", "burst_limit", "allowed_domains", "allowed_ips", "webhook_access", "logging_enabled", "monitoring_enabled", "notifications_enabled", "expires_at", "application_id"].forEach(k => { if (k in b) patch[k] = b[k]; });
      await s.from("api_keys").update(patch).eq("id", b.id);
      await logAudit({ actor, module: "api", action: "api_key_update", description: b.id, entity_id: b.id, ip });
      return Response.json({ ok: true });
    }

    if (action === "rotate") {
      const { data: key } = await s.from("api_keys").select("*").eq("id", b.id).single();
      if (!key) return Response.json({ error: "Not found" }, { status: 404 });
      const secret = `sk_${key.environment === "production" ? "live" : "test"}_` + crypto.randomBytes(28).toString("hex");
      const grace = b.grace === "24h" ? 24 * 3600000 : b.grace === "7d" ? 7 * DAY : 0; // immediate=0
      await s.from("api_keys").update({
        key_hash: sha256(secret), key_prefix: secret.slice(0, 12) + "…",
        old_hash: grace ? key.key_hash : null, old_hash_expires_at: grace ? new Date(Date.now() + grace).toISOString() : null,
        rotated_from: key.id, updated_at: new Date().toISOString(),
      }).eq("id", b.id);
      await logAudit({ actor, module: "api", action: "api_key_rotate", description: `${key.name} (grace: ${b.grace || "immediate"})`, entity_id: b.id, level: "warning", ip });
      await logActivity({ actor, module: "settings", activity_type: "system", action: "api_key_rotated", description: `Rotated "${key.name}"`, status: "warning", priority: "medium" });
      return Response.json({ ok: true, secret }); // new secret shown once
    }

    if (["revoke", "disable", "enable", "restore"].includes(action)) {
      const status = action === "revoke" ? "revoked" : action === "disable" ? "disabled" : "active";
      await s.from("api_keys").update({ status, updated_at: new Date().toISOString() }).eq("id", b.id);
      await logAudit({ actor, module: "api", action: `api_key_${action}`, description: b.id, entity_id: b.id, level: action === "revoke" ? "critical" : "warning", ip });
      await logActivity({ actor, module: "settings", activity_type: "system", action: `api_key_${action}`, description: `API key ${action}`, status: action === "revoke" ? "failed" : "success", priority: action === "revoke" ? "high" : "low" });
      return Response.json({ ok: true });
    }

    if (action === "delete") {
      await s.from("api_keys").delete().eq("id", b.id);
      await logAudit({ actor, module: "api", action: "api_key_delete", description: b.id, entity_id: b.id, level: "critical", ip });
      return Response.json({ ok: true });
    }

    if (action === "application") {
      const { data, error } = await s.from("api_applications").insert({ name: b.name, description: b.description, owner: b.owner || actor.email, website: b.website, created_by: actor.id }).select("*").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ application: data });
    }

    if (action === "webhook") {
      if (b.op === "delete") { await s.from("api_webhooks").delete().eq("id", b.id); return Response.json({ ok: true }); }
      const secret = "whsec_" + crypto.randomBytes(24).toString("hex");
      const { data, error } = await s.from("api_webhooks").insert({ api_key_id: b.api_key_id, url: b.url, events: b.events || [], secret_hash: sha256(secret), secret_prefix: secret.slice(0, 14) + "…", created_by: actor.id }).select("id").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await s.from("api_keys").update({ webhook_access: true }).eq("id", b.api_key_id);
      return Response.json({ ok: true, secret, id: data.id });
    }

    if (action === "test") {
      // Real end-to-end test: call the public /api/v1 surface with the provided key.
      if (!b.secret) return Response.json({ error: "Provide the API key secret to test" }, { status: 400 });
      const path = b.endpoint || "/api/v1/ping";
      const method = (b.method || "GET").toUpperCase();
      const t = Date.now();
      try {
        const r = await fetch(`${baseUrl(request)}${path}`, { method, headers: { Authorization: `Bearer ${b.secret}`, "Content-Type": "application/json" }, body: method !== "GET" && b.body ? b.body : undefined, signal: AbortSignal.timeout(8000) });
        const time = Date.now() - t;
        const text = await r.text();
        const headers = {}; r.headers.forEach((v, k) => { headers[k] = v; });
        return Response.json({ ok: r.ok, status: r.status, time, headers, response: text.slice(0, 4000) });
      } catch (e) { return Response.json({ ok: false, error: e.message }); }
    }

    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
