// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { invalidateIpCache } from "@/lib/security/guard";
import { resetPassword, setStatus } from "@/lib/staff/service";

const DAY = 24 * 3600 * 1000;
function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
function ipOf(r) { return r.headers.get("x-forwarded-for")?.split(",")[0] || null; }
async function audit(s, { actor, request, action, entity, entity_id, detail }) {
  try { await s.from("audit_logs").insert({ actor_id: actor?.id || null, actor_name: actor?.full_name || actor?.email || "Admin", action, entity, entity_id, ip_address: ipOf(request), detail }); } catch {}
}

export async function GET(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("logs.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const sp = request.nextUrl.searchParams;

  try {
    if (action === "dashboard") {
      const now = Date.now();
      const dayAgo = new Date(now - DAY).toISOString(), weekAgo = new Date(now - 7 * DAY).toISOString(), monthAgo = new Date(now - 30 * DAY).toISOString();
      const [{ data: recent }, { data: sessions }, { data: events }] = await Promise.all([
        s.from("login_history").select("status, risk_level, risk_factors, country, ip_address, device_type, browser, created_at, city, latitude, longitude, is_vpn, is_tor").gte("created_at", monthAgo).order("created_at", { ascending: false }).limit(5000),
        s.from("login_sessions").select("id, status, revoked").eq("status", "active"),
        s.from("login_security_events").select("event_type, severity, created_at").gte("created_at", weekAgo).order("created_at", { ascending: false }).limit(50),
      ]);
      const R = recent || [];
      const inRange = (from) => R.filter(x => x.created_at >= from);
      const succ = R.filter(x => x.status === "success");
      const knownCountries = new Set(succ.map(x => x.country).filter(Boolean));
      const heat = {}; // day-of-week x hour
      for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) heat[`${d}-${h}`] = 0;
      R.forEach(x => { const dt = new Date(x.created_at); const k = `${dt.getDay()}-${dt.getHours()}`; if (heat[k] != null) heat[k]++; });
      // world map points (aggregate by country)
      const byCountry = {}; succ.forEach(x => { if (x.country) { byCountry[x.country] = byCountry[x.country] || { country: x.country, count: 0, lat: x.latitude, lon: x.longitude, city: x.city }; byCountry[x.country].count++; } });
      // 14-day timeline
      const days = {}; for (let i = 13; i >= 0; i--) { const d = new Date(now - i * DAY).toISOString().slice(0, 10); days[d] = { date: d, success: 0, failed: 0 }; }
      R.forEach(x => { const d = (x.created_at || "").slice(0, 10); if (days[d]) { if (x.status === "success") days[d].success++; else days[d].failed++; } });
      return Response.json({
        kpis: {
          today: inRange(dayAgo).length, week: inRange(weekAgo).length, month: R.length,
          successful: succ.length, failed: R.filter(x => x.status !== "success").length,
          activeSessions: (sessions || []).length,
          lockedAccounts: R.filter(x => x.status === "locked").length,
          suspicious: R.filter(x => x.risk_level === "high" || x.risk_level === "critical").length,
          newDevices: R.filter(x => (x.risk_factors || []).includes?.("new_device")).length,
          newLocations: R.filter(x => (x.risk_factors || []).includes?.("new_country")).length,
          vpnTor: R.filter(x => x.is_vpn || x.is_tor).length,
          lastLogin: succ[0]?.created_at || null,
          lastFailed: R.filter(x => x.status !== "success")[0]?.created_at || null,
        },
        series: Object.values(days),
        heatmap: heat,
        worldMap: Object.values(byCountry).sort((a, b) => b.count - a.count),
        events: events || [],
        recent: R.slice(0, 12),
      });
    }

    if (action === "list" || action === "live") {
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
      const size = action === "live" ? 20 : Math.min(50, parseInt(sp.get("pageSize") || "25", 10));
      const from = (page - 1) * size;
      let q = s.from("login_history").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (action === "live") { q = q.gte("created_at", sp.get("since") || new Date(Date.now() - 5 * 60000).toISOString()); }
      else {
        const status = sp.get("status"); if (status && status !== "all") q = q.eq("status", status);
        const risk = sp.get("risk"); if (risk && risk !== "all") q = q.eq("risk_level", risk);
        const country = sp.get("country"); if (country) q = q.ilike("country", `%${country}%`);
        const method = sp.get("method"); if (method && method !== "all") q = q.eq("method", method);
        const search = sp.get("q"); if (search) q = q.or(`email.ilike.%${search}%,full_name.ilike.%${search}%,ip_address.ilike.%${search}%,city.ilike.%${search}%`);
        q = q.range(from, from + size - 1);
      }
      const { data, count } = await q;
      return Response.json({ logs: data || [], total: count || 0, page, pageSize: size });
    }

    if (action === "session") {
      const id = sp.get("id");
      const { data: login } = await s.from("login_history").select("*").eq("id", id).single();
      if (!login) return Response.json({ error: "Not found" }, { status: 404 });
      const [{ data: events }, { data: userHistory }, { data: session }] = await Promise.all([
        s.from("login_security_events").select("*").eq("login_id", id).order("created_at", { ascending: false }),
        login.user_id ? s.from("login_history").select("id, status, ip_address, country, city, created_at, risk_level").eq("user_id", login.user_id).order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
        login.session_id ? s.from("login_sessions").select("*").eq("id", login.session_id).single() : Promise.resolve({ data: null }),
      ]);
      let permissions = [];
      if (login.user_id) { const { data: ur } = await s.from("user_roles").select("roles(name,color)").eq("user_id", login.user_id); permissions = (ur || []).map(x => x.roles).filter(Boolean); }
      return Response.json({ login, events: events || [], history: userHistory || [], session, roles: permissions });
    }

    if (action === "export") {
      const fmt = sp.get("format") || "csv";
      const { data } = await s.from("login_history").select("created_at, email, full_name, role, method, status, ip_address, country, city, browser, os, device_type, risk_level").order("created_at", { ascending: false }).limit(10000);
      const rows = data || [];
      if (fmt === "json") return new Response(JSON.stringify(rows, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="login-history.json"' } });
      const header = "Date,Email,Name,Role,Method,Status,IP,Country,City,Browser,OS,Device,Risk\n";
      const body = rows.map(r => [r.created_at, r.email, r.full_name, r.role, r.method, r.status, r.ip_address, r.country, r.city, r.browser, r.os, r.device_type, r.risk_level].map(v => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
      return new Response(header + body, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="login-history.csv"' } });
    }

    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }) {
  const { action } = await params;
  // View is enough to see; mutating actions require security management.
  const auth = await requirePermission("special:manage_security");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const actor = auth.profile; const b = await request.json().catch(() => ({}));

  try {
    if (action === "block-ip") {
      if (!b.ip) return Response.json({ error: "IP required" }, { status: 400 });
      await s.from("blocked_ips").upsert({ ip_address: b.ip, reason: b.reason || "Blocked from login history", list_type: "blacklist", created_by: actor.id }, { onConflict: "ip_address" });
      invalidateIpCache();
      await audit(s, { actor, request, action: "block_ip", entity: "blocked_ips", entity_id: b.ip });
      return Response.json({ ok: true });
    }
    if (action === "unblock-ip") {
      await s.from("blocked_ips").delete().eq("ip_address", b.ip);
      invalidateIpCache();
      await audit(s, { actor, request, action: "unblock_ip", entity: "blocked_ips", entity_id: b.ip });
      return Response.json({ ok: true });
    }
    if (action === "block-device") {
      await s.from("login_devices").update({ status: "blocked" }).eq("user_id", b.user_id).eq("fingerprint", b.fingerprint);
      await audit(s, { actor, request, action: "block_device", entity: "login_devices", entity_id: b.fingerprint });
      return Response.json({ ok: true });
    }
    if (action === "logout-session") {
      // end login session + revoke staff session mirror if any
      await s.from("login_sessions").update({ status: "revoked", revoked: true, ended_at: new Date().toISOString() }).eq("id", b.session_id);
      if (b.user_id) { try { await s.auth.admin.signOut(b.user_id, "global"); } catch {} }
      await audit(s, { actor, request, action: "logout_session", entity: "login_sessions", entity_id: b.session_id });
      return Response.json({ ok: true });
    }
    if (action === "reset-password") {
      const r = await resetPassword(b.user_id, actor, ipOf(request));
      await audit(s, { actor, request, action: "force_reset_password", entity: "user", entity_id: b.user_id });
      return Response.json(r);
    }
    if (action === "suspend") {
      const r = await setStatus(b.user_id, "suspended", actor, ipOf(request));
      await audit(s, { actor, request, action: "suspend_user", entity: "user", entity_id: b.user_id });
      return Response.json(r);
    }
    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
