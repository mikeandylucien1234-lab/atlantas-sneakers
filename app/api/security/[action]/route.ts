// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import crypto from "crypto";
import { requirePermission } from "@/lib/rbac/server";
import { computeSecurityScore, validatePassword, invalidateIpCache, clientIp } from "@/lib/security/guard";
import { buildSecurityHeaders } from "@/lib/security/headers";

const DAY = 24 * 3600 * 1000;
function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
function ipOf(r) { return clientIp(r); }

async function getSettings(s) { const { data } = await s.from("security_settings").select("*").eq("id", "global").single(); return data || { id: "global" }; }
async function secLog(s, { actor, request, action, category = "general", result = "ok", detail }) {
  try { await s.from("security_logs").insert({ actor_id: actor?.id || null, actor_name: actor?.full_name || actor?.email || "Admin", action, category, ip_address: ipOf(request), result, detail }); } catch {}
}
async function audit(s, { actor, request, action, entity, entity_id, detail }) {
  try { await s.from("audit_logs").insert({ actor_id: actor?.id || null, actor_name: actor?.full_name || actor?.email || "Admin", action, entity, entity_id, ip_address: ipOf(request), detail }); } catch {}
}
async function alert(s, { severity, type, title, message, ip, actor_id }) {
  try { await s.from("security_alerts").insert({ severity, type, title, message, ip_address: ip || null, actor_id: actor_id || null }); } catch {}
}

// ============ GET ============
export async function GET(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("special:manage_security");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc();

  try {
    if (action === "settings") return Response.json({ settings: await getSettings(s) });

    if (action === "dashboard") {
      const settings = await getSettings(s);
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const [{ data: secLogs }, { data: staffSessions }, { data: alerts }, { data: devices }, { data: apiKeys }, { data: perm }, { data: staffLogs }] = await Promise.all([
        s.from("security_logs").select("action, result, created_at").gte("created_at", new Date(Date.now() - 30 * DAY).toISOString()),
        s.from("staff_sessions").select("id, revoked, last_activity"),
        s.from("security_alerts").select("severity, status, created_at").eq("status", "open"),
        s.from("trusted_devices").select("id, status"),
        s.from("api_keys").select("id, status"),
        s.from("permission_logs").select("event, created_at").gte("created_at", todayStart),
        s.from("staff_activity_logs").select("action, created_at, status").gte("created_at", todayStart),
      ]);
      const SL = secLogs || [], SS = staffSessions || [], AL = alerts || [];
      const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://atlantassneakers.com");
      const scoring = computeSecurityScore(settings, { https: base.startsWith("https") });
      const loginsToday = (staffLogs || []).filter(l => l.action === "login").length + (perm || []).filter(p => p.event === "login").length;
      const failedToday = SL.filter(l => (l.result === "failed" || l.result === "denied") && l.created_at >= todayStart).length + (staffLogs || []).filter(l => l.status === "error").length;
      const activeSessions = SS.filter(x => !x.revoked).length;
      const online = SS.filter(x => !x.revoked && x.last_activity > new Date(Date.now() - 15 * 60000).toISOString()).length;
      // 14-day timeline of security events
      const days = {}; for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10); days[d] = { date: d, ok: 0, blocked: 0 }; }
      SL.forEach(l => { const d = (l.created_at || "").slice(0, 10); if (days[d]) { if (l.result === "blocked" || l.result === "denied" || l.result === "failed") days[d].blocked++; else days[d].ok++; } });
      return Response.json({
        score: scoring,
        kpis: {
          loginsToday, failedToday,
          lockedAccounts: 0,
          activeSessions, connectedDevices: (devices || []).filter(d => d.status === "active").length, onlineNow: online,
          activeApiKeys: (apiKeys || []).filter(k => k.status === "active").length,
          criticalAlerts: AL.filter(a => a.severity === "critical").length,
          mediumAlerts: AL.filter(a => a.severity === "medium").length,
          lowAlerts: AL.filter(a => a.severity === "low").length,
          threatsBlocked: SL.filter(l => l.result === "blocked").length,
          lastScan: settings.updated_at, lastBackup: null,
        },
        series: Object.values(days),
      });
    }

    if (action === "logs") {
      const sp = request.nextUrl.searchParams; const page = Math.max(1, parseInt(sp.get("page") || "1", 10)); const size = 40; const from = (page - 1) * size;
      let q = s.from("security_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + size - 1);
      const res = sp.get("result"); if (res && res !== "all") q = q.eq("result", res);
      const search = sp.get("q"); if (search) q = q.or(`action.ilike.%${search}%,actor_name.ilike.%${search}%,ip_address.ilike.%${search}%`);
      const { data, count } = await q;
      return Response.json({ logs: data || [], total: count || 0, page, pageSize: size });
    }

    if (action === "audit") {
      const sp = request.nextUrl.searchParams; const page = Math.max(1, parseInt(sp.get("page") || "1", 10)); const size = 40; const from = (page - 1) * size;
      const { data, count } = await s.from("audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + size - 1);
      return Response.json({ audit: data || [], total: count || 0, page, pageSize: size });
    }

    if (action === "alerts") {
      const { data } = await s.from("security_alerts").select("*").order("created_at", { ascending: false }).limit(200);
      return Response.json({ alerts: data || [] });
    }

    if (action === "sessions") {
      const { data } = await s.from("staff_sessions").select("*, profiles:staff_id(email, full_name)").order("last_activity", { ascending: false }).limit(200);
      return Response.json({ sessions: data || [] });
    }

    if (action === "devices") {
      const { data } = await s.from("trusted_devices").select("*, profiles:user_id(email, full_name)").order("last_seen", { ascending: false }).limit(200);
      return Response.json({ devices: data || [] });
    }

    if (action === "ip-lists") {
      const { data } = await s.from("blocked_ips").select("*").order("created_at", { ascending: false });
      return Response.json({ ips: data || [] });
    }

    if (action === "firewall") {
      const settings = await getSettings(s);
      const { data: rules } = await s.from("firewall_rules").select("*").order("created_at", { ascending: false });
      return Response.json({ firewall: settings.firewall, rules: rules || [] });
    }

    if (action === "api-keys") {
      const { data } = await s.from("api_keys").select("id, name, key_prefix, scopes, status, last_used_at, expires_at, created_at").order("created_at", { ascending: false });
      return Response.json({ keys: data || [] });
    }

    if (action === "encryption") {
      const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://atlantassneakers.com");
      return Response.json({ encryption: {
        https: base.startsWith("https"), ssl: base.startsWith("https") ? "Valid (managed by host)" : "Not detected",
        password_hash: "bcrypt (Supabase Auth / GoTrue)", hash_algorithm: "SHA-256 (API keys, tokens)",
        jwt: process.env.SUPABASE_JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Configured (server-side)" : "Not configured",
        at_rest: "AES-256 (Supabase managed Postgres)",
      } });
    }

    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// ============ POST ============
export async function POST(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("special:manage_security");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const actor = auth.profile;
  const b = await request.json().catch(() => ({}));

  try {
    if (action === "settings") {
      const patch = { updated_at: new Date().toISOString(), updated_by: actor.id };
      ["authentication", "password_policy", "two_factor", "login_security", "api_security", "headers", "firewall", "ip_security"].forEach(k => { if (k in b) patch[k] = b[k]; });
      const { error } = await s.from("security_settings").update(patch).eq("id", "global");
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await secLog(s, { actor, request, action: "settings_update", category: "config", detail: Object.keys(patch).filter(k => k !== "updated_at" && k !== "updated_by").join(",") });
      await audit(s, { actor, request, action: "security_settings_update", entity: "security_settings" });
      return Response.json({ ok: true });
    }

    if (action === "test") {
      // Real self-test: fetch own homepage and verify security headers are present.
      const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://atlantassneakers.com").replace(/\/$/, "");
      const settings = await getSettings(s);
      const expected = buildSecurityHeaders(settings.headers);
      const checks = [];
      try {
        const r = await fetch(base, { method: "GET" });
        for (const k of Object.keys(expected)) checks.push({ name: k, ok: !!r.headers.get(k), value: r.headers.get(k) || "missing" });
      } catch (e) { checks.push({ name: "reachability", ok: false, value: e.message }); }
      checks.push({ name: "HTTPS", ok: base.startsWith("https"), value: base.split(":")[0] });
      const pwTest = validatePassword(b.sample || "Weak1", settings.password_policy);
      await secLog(s, { actor, request, action: "security_test", category: "test" });
      return Response.json({ ok: checks.every(c => c.ok), checks, passwordSample: pwTest });
    }

    if (action === "block-ip") {
      const ip = (b.ip || "").trim(); if (!ip) return Response.json({ error: "IP required" }, { status: 400 });
      const { error } = await s.from("blocked_ips").upsert({ ip_address: ip, reason: b.reason || "Manual block", list_type: b.list_type || "blacklist", created_by: actor.id, expires_at: b.expires_at || null }, { onConflict: "ip_address" });
      if (error) return Response.json({ error: error.message }, { status: 500 });
      invalidateIpCache();
      await secLog(s, { actor, request, action: "ip_block", category: "firewall", detail: ip });
      await alert(s, { severity: "medium", type: "ip_block", title: "IP blocked", message: `${ip} added to ${b.list_type || "blacklist"}`, ip, actor_id: actor.id });
      await audit(s, { actor, request, action: "block_ip", entity: "blocked_ips", entity_id: ip });
      return Response.json({ ok: true });
    }

    if (action === "unblock-ip") {
      const ip = (b.ip || "").trim();
      await s.from("blocked_ips").delete().eq("ip_address", ip);
      invalidateIpCache();
      await secLog(s, { actor, request, action: "ip_unblock", category: "firewall", detail: ip });
      await audit(s, { actor, request, action: "unblock_ip", entity: "blocked_ips", entity_id: ip });
      return Response.json({ ok: true });
    }

    if (action === "logout-all") {
      // Revoke every tracked staff session (real) and log out via auth admin where possible.
      await s.from("staff_sessions").update({ revoked: true }).eq("revoked", false);
      if (b.user_id) { try { await s.auth.admin.signOut(b.user_id, "global"); } catch {} }
      await secLog(s, { actor, request, action: "logout_all", category: "session", result: "ok" });
      await alert(s, { severity: "medium", type: "logout_all", title: "All sessions revoked", message: "An admin signed out all tracked sessions", actor_id: actor.id });
      await audit(s, { actor, request, action: "logout_all", entity: "sessions" });
      return Response.json({ ok: true });
    }

    if (action === "revoke-session") {
      await s.from("staff_sessions").update({ revoked: true }).eq("id", b.session_id);
      await secLog(s, { actor, request, action: "session_revoke", category: "session", detail: b.session_id });
      return Response.json({ ok: true });
    }

    if (action === "block-device") {
      await s.from("trusted_devices").update({ status: b.status === "active" ? "active" : "blocked" }).eq("id", b.device_id);
      await secLog(s, { actor, request, action: "device_block", category: "device", detail: b.device_id });
      return Response.json({ ok: true });
    }

    if (action === "resolve-alert") {
      await s.from("security_alerts").update({ status: b.status || "resolved", resolved_at: new Date().toISOString() }).eq("id", b.id);
      await audit(s, { actor, request, action: "resolve_alert", entity: "security_alerts", entity_id: b.id });
      return Response.json({ ok: true });
    }

    if (action === "firewall-rule") {
      if (b.op === "delete") { await s.from("firewall_rules").delete().eq("id", b.id); }
      else if (b.op === "toggle") { await s.from("firewall_rules").update({ enabled: b.enabled }).eq("id", b.id); }
      else { const { error } = await s.from("firewall_rules").insert({ name: b.name, rule_type: b.rule_type, pattern: b.pattern, action: b.action || "block", created_by: actor.id }); if (error) return Response.json({ error: error.message }, { status: 500 }); }
      await secLog(s, { actor, request, action: "firewall_rule", category: "firewall", detail: `${b.op || "create"} ${b.name || b.id}` });
      return Response.json({ ok: true });
    }

    if (action === "create-api-key") {
      const raw = "atl_" + crypto.randomBytes(24).toString("hex");
      const key_hash = crypto.createHash("sha256").update(raw).digest("hex");
      const key_prefix = raw.slice(0, 12) + "…";
      const { data, error } = await s.from("api_keys").insert({ name: b.name || "API Key", key_prefix, key_hash, scopes: b.scopes || ["read"], created_by: actor.id, expires_at: b.expires_at || null }).select("id, name, key_prefix").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await secLog(s, { actor, request, action: "api_key_create", category: "api", detail: data.name });
      await audit(s, { actor, request, action: "create_api_key", entity: "api_keys", entity_id: data.id });
      return Response.json({ ok: true, key: raw, prefix: key_prefix, id: data.id }); // full key returned once
    }

    if (action === "revoke-api-key") {
      await s.from("api_keys").update({ status: "revoked" }).eq("id", b.id);
      await secLog(s, { actor, request, action: "api_key_revoke", category: "api", detail: b.id });
      return Response.json({ ok: true });
    }

    if (action === "scan") {
      // Real scan over stored media/upload records: flag dangerous extensions & names.
      const dangerous = /\.(php|phtml|exe|sh|bat|cmd|js|jsp|asp|aspx|dll|bin|htaccess)$/i;
      let scanned = 0, flagged = [];
      try {
        const { data: media } = await s.from("media").select("id, url, name").limit(2000);
        (media || []).forEach(m => { scanned++; const n = (m.name || m.url || ""); if (dangerous.test(n)) flagged.push(n); });
      } catch {}
      await secLog(s, { actor, request, action: "malware_scan", category: "scan", result: flagged.length ? "blocked" : "ok", detail: `${scanned} scanned, ${flagged.length} flagged` });
      if (flagged.length) await alert(s, { severity: "critical", type: "malware", title: "Suspicious files detected", message: `${flagged.length} file(s) with dangerous extensions`, actor_id: actor.id });
      return Response.json({ ok: true, scanned, flagged });
    }

    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) {
    await secLog(s, { actor, request, action: `error:${action}`, result: "failed", detail: e.message });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
