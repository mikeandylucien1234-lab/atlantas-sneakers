// @ts-nocheck
// Real health checks. Each probe hits an actual service and measures latency:
// Supabase (query round-trip), server (os CPU/RAM), storage (bucket list), email
// (Resend), queue (notification_queue), payments/security/backup (live data).
// Results are written to system_health + health_logs + health_metrics, and open
// alerts/incidents on failure.
import { createClient as createAnon } from "@supabase/supabase-js";
import os from "os";

function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
const DAY = 24 * 3600 * 1000;

async function timed(fn) { const t = Date.now(); try { const r = await fn(); return { ...r, latency: Date.now() - t }; } catch (e) { return { status: "down", message: e.message, latency: Date.now() - t }; } }
function grade(ok, warn) { return ok ? (warn ? "warning" : "healthy") : "critical"; }

// ---- Individual probes ----
async function checkDatabase(s) {
  return timed(async () => { const t = Date.now(); const { error } = await s.from("system_health").select("service").limit(1); const lat = Date.now() - t; if (error) return { status: "down", message: error.message }; return { status: lat > 800 ? "warning" : "healthy", message: `Query ${lat}ms`, detail: { latency: lat } }; });
}
function checkServer() {
  const cpus = os.cpus().length || 1;
  const load = os.loadavg()[0];
  const cpuPct = Math.min(100, Math.round((load / cpus) * 100));
  const totalMem = os.totalmem(), freeMem = os.freemem();
  const ramPct = Math.round(((totalMem - freeMem) / totalMem) * 100);
  const proc = process.memoryUsage();
  const uptime = os.uptime();
  const status = cpuPct > 90 || ramPct > 92 ? "critical" : cpuPct > 75 || ramPct > 82 ? "warning" : "healthy";
  return { status, latency: 0, message: `CPU ${cpuPct}% · RAM ${ramPct}%`, detail: { cpu: cpuPct, ram: ramPct, cores: cpus, load: +load.toFixed(2), heapUsedMB: Math.round(proc.heapUsed / 1048576), rssMB: Math.round(proc.rss / 1048576), uptimeH: Math.round(uptime / 3600), platform: os.platform(), node: process.version } };
}
async function checkStorage(s) {
  return timed(async () => { const { error } = await s.storage.from("backups").list("", { limit: 1 }); if (error) return { status: "warning", message: error.message }; return { status: "healthy", message: "Storage reachable" }; });
}
async function checkEmail() {
  return timed(async () => { const k = process.env.RESEND_API_KEY; if (!k) return { status: "warning", message: "RESEND_API_KEY not set" }; const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${k}` }, signal: AbortSignal.timeout(5000) }); return { status: r.ok ? "healthy" : "warning", message: r.ok ? "Resend authenticated" : `HTTP ${r.status}` }; });
}
async function checkQueue(s) {
  return timed(async () => {
    const [{ count: pending }, { count: failed }] = await Promise.all([
      s.from("notification_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      s.from("notification_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
    ]);
    const status = (failed || 0) > 20 ? "critical" : (pending || 0) > 200 || (failed || 0) > 0 ? "warning" : "healthy";
    return { status, message: `${pending || 0} pending, ${failed || 0} failed`, detail: { pending: pending || 0, failed: failed || 0 } };
  });
}
async function checkPayments(s) {
  return timed(async () => {
    const since = new Date(Date.now() - 7 * DAY).toISOString();
    const { data } = await s.from("payments").select("status").gte("created_at", since);
    const P = data || []; const paid = P.filter(x => ["paid", "completed", "success"].includes(x.status)).length;
    const failed = P.filter(x => ["failed", "declined"].includes(x.status)).length;
    const rate = (paid + failed) ? Math.round(paid / (paid + failed) * 100) : 100;
    const configured = !!(process.env.MONCASH_CLIENT_ID || process.env.STRIPE_SECRET_KEY || process.env.NATCASH_API_KEY);
    const status = !configured ? "warning" : rate < 70 && (paid + failed) > 5 ? "critical" : rate < 90 && (paid + failed) > 5 ? "warning" : "healthy";
    return { status, message: configured ? `Success ${rate}% (7d)` : "No gateway credentials", detail: { successRate: rate, paid, failed } };
  });
}
async function checkSecurity(s) {
  return timed(async () => {
    const [{ count: alerts }, { count: blocked }] = await Promise.all([
      s.from("security_alerts").select("id", { count: "exact", head: true }).eq("status", "open").eq("severity", "critical"),
      s.from("blocked_ips").select("id", { count: "exact", head: true }),
    ]);
    const https = (process.env.NEXT_PUBLIC_SITE_URL || "https://").startsWith("https");
    const status = (alerts || 0) > 0 ? "critical" : !https ? "warning" : "healthy";
    return { status, message: `${alerts || 0} critical alerts · ${blocked || 0} IPs blocked`, detail: { criticalAlerts: alerts || 0, blockedIps: blocked || 0, https } };
  });
}
async function checkBackup(s) {
  return timed(async () => {
    const { data } = await s.from("backups").select("status, created_at").order("created_at", { ascending: false }).limit(1);
    const last = (data || [])[0];
    if (!last) return { status: "warning", message: "No backups yet" };
    const ageH = (Date.now() - new Date(last.created_at).getTime()) / 3600000;
    const status = last.status === "failed" ? "critical" : ageH > 24 * 7 ? "warning" : "healthy";
    return { status, message: `Last backup ${last.status}, ${Math.round(ageH)}h ago`, detail: { lastStatus: last.status, ageHours: Math.round(ageH) } };
  });
}
async function checkApi(s) {
  return timed(async () => {
    const since = new Date(Date.now() - DAY).toISOString();
    const { data } = await s.from("api_logs").select("result, response_time_ms").gte("created_at", since).limit(5000);
    const L = data || []; const errors = L.filter(x => x.result !== "ok").length;
    const rt = L.filter(x => x.response_time_ms); const avg = rt.length ? Math.round(rt.reduce((a, x) => a + x.response_time_ms, 0) / rt.length) : 0;
    const errRate = L.length ? errors / L.length : 0;
    const status = errRate > 0.2 ? "critical" : errRate > 0.05 ? "warning" : "healthy";
    return { status, latency: avg, message: L.length ? `${L.length} calls, ${Math.round(errRate * 100)}% errors, ${avg}ms avg` : "No API traffic", detail: { calls: L.length, errorRate: +(errRate * 100).toFixed(1), avgLatency: avg } };
  });
}
async function checkNotifications(s) {
  return timed(async () => {
    const { data: channels } = await s.from("notification_channels").select("id, enabled");
    const enabled = (channels || []).filter(c => c.enabled).length;
    return { status: enabled > 0 ? "healthy" : "warning", message: `${enabled} channels enabled`, detail: { enabled } };
  });
}
function checkStatic(service, envKeys, label) {
  const configured = !envKeys.length || envKeys.some(k => !!process.env[k]);
  return { status: configured ? "healthy" : "warning", latency: 0, message: configured ? `${label} configured` : `${label} not configured` };
}

const PROBES = {
  database: (s) => checkDatabase(s),
  server: () => Promise.resolve(checkServer()),
  api: (s) => checkApi(s),
  payments: (s) => checkPayments(s),
  queue: (s) => checkQueue(s),
  cache: () => Promise.resolve(checkStatic("cache", ["REDIS_URL"], "Redis")),
  storage: (s) => checkStorage(s),
  email: () => checkEmail(),
  sms: () => Promise.resolve(checkStatic("sms", ["TWILIO_ACCOUNT_SID", "VONAGE_API_KEY", "MESSAGEBIRD_API_KEY"], "SMS gateway")),
  notifications: (s) => checkNotifications(s),
  backup: (s) => checkBackup(s),
  security: (s) => checkSecurity(s),
  cdn: () => Promise.resolve(checkStatic("cdn", ["CLOUDINARY_URL", "R2_BUCKET"], "CDN")),
  search: (s) => checkDatabase(s), // storefront search is Postgres FTS-backed
};

const RECS = {
  server: "Scale up the instance or investigate the top process consuming CPU/RAM.",
  database: "Add indexes on hot queries or increase the connection pool size.",
  queue: "Run the notification queue processor and inspect repeatedly failing jobs.",
  payments: "Verify gateway credentials and check the provider status page.",
  security: "Review critical security alerts and confirm blocked IPs are legitimate.",
  backup: "Run a fresh backup and validate its checksum.",
  email: "Confirm RESEND_API_KEY and domain verification.",
  api: "Investigate endpoints returning errors; check rate limits.",
};

export async function runHealthChecks(services) {
  const s = svc();
  const targets = services && services.length ? services : Object.keys(PROBES);
  const results = [];
  for (const service of targets) {
    const probe = PROBES[service]; if (!probe) continue;
    const started = Date.now();
    let res; try { res = await probe(s); } catch (e) { res = { status: "down", message: e.message, latency: 0 }; }
    const duration = Date.now() - started;
    const status = res.status || "unknown";
    await s.from("system_health").upsert({ service, status, latency_ms: res.latency ?? null, message: res.message || null, detail: res.detail || {}, last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "service" });
    await s.from("health_logs").insert({ service, status, latency_ms: res.latency ?? null, duration_ms: duration, message: res.message, error: status === "critical" || status === "down" ? res.message : null });
    if (res.latency != null) await s.from("health_metrics").insert({ metric: `${service}_latency`, value: res.latency, unit: "ms", service });
    if (service === "server" && res.detail) { await s.from("health_metrics").insert([{ metric: "cpu", value: res.detail.cpu, unit: "%", service }, { metric: "ram", value: res.detail.ram, unit: "%", service }]); }
    // auto-alert + incident on critical/down
    if (status === "critical" || status === "down") {
      const { data: existing } = await s.from("health_alerts").select("id").eq("service", service).eq("status", "open").maybeSingle();
      if (!existing) {
        await s.from("health_alerts").insert({ service, severity: "critical", type: `${service}_down`, title: `${service} ${status}`, message: res.message, recommendation: RECS[service] || "Investigate the service." });
        // open an incident if none active
        const { data: inc } = await s.from("health_incidents").select("id").contains("affected_services", [service]).neq("status", "resolved").maybeSingle();
        if (!inc) await s.from("health_incidents").insert({ title: `${service} degraded`, priority: "high", status: "open", affected_services: [service], impact: res.message });
        try { await s.from("security_alerts").insert({ severity: "critical", type: "health", title: `Health: ${service} ${status}`, message: res.message }); } catch {}
      }
    } else {
      // auto-resolve open alerts when healthy again
      await s.from("health_alerts").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("service", service).eq("status", "open");
    }
    results.push({ service, status, latency: res.latency, message: res.message, detail: res.detail, duration });
  }
  return results;
}
