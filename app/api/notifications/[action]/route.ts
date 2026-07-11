// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { enqueue, processQueue, render } from "@/lib/notifications/engine";
import { dispatch, channelConfigured, CHANNEL_ENV } from "@/lib/notifications/senders";

const DAY = 24 * 3600 * 1000;
function anon() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }

async function checkAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: "Forbidden", status: 403 };
  return { user, profile };
}
async function log(supabase, auth, request, event, extra = {}) {
  try { await supabase.from("notification_logs").insert({ event, status: extra.status || "ok", actor_id: auth?.user?.id || null, actor_name: auth?.profile?.full_name || auth?.profile?.email || "Admin", ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null, ...extra }); } catch {}
}

// Simple in-memory rate limiter per admin+action (best-effort).
const rl = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now(); const e = rl.get(key) || { c: 0, t: now };
  if (now - e.t > windowMs) { e.c = 0; e.t = now; }
  e.c++; rl.set(key, e); return e.c > max;
}

// ============================ GET ============================
export async function GET(request: NextRequest, { params }) {
  const { action } = await params;
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const sp = request.nextUrl.searchParams;

  try {
    if (action === "dashboard") {
      const now = Date.now();
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [allN, queueRes, logsRes, series] = await Promise.all([
        supabase.from("notifications").select("status, channel, read_at, created_at"),
        supabase.from("notification_queue").select("status, created_at, sent_at, scheduled_for, processing_at"),
        supabase.from("notification_logs").select("event, status, duration_ms, created_at").gte("created_at", new Date(now - 30 * DAY).toISOString()),
        Promise.resolve(null),
      ]);
      const N = allN.data || [], Q = queueRes.data || [], L = logsRes.data || [];
      const sends = L.filter(l => l.event === "send");
      const sentToday = Q.filter(q => q.status === "sent" && q.sent_at >= todayStart).length + L.filter(l => l.event === "send" && l.status === "ok" && l.created_at >= todayStart).length;
      const sentMonth = Q.filter(q => q.status === "sent" && q.sent_at >= monthStart).length;
      const avgMs = sends.length ? Math.round(sends.reduce((s, l) => s + (l.duration_ms || 0), 0) / sends.length) : 0;
      const attempted = Q.filter(q => ["sent", "failed"].includes(q.status)).length;
      const deliveryRate = attempted ? +(Q.filter(q => q.status === "sent").length / attempted * 100).toFixed(1) : 0;
      // 14-day timeline
      const days = {};
      for (let i = 13; i >= 0; i--) { const d = new Date(now - i * DAY).toISOString().slice(0, 10); days[d] = { date: d, sent: 0, failed: 0 }; }
      L.forEach(l => { const d = (l.created_at || "").slice(0, 10); if (days[d]) { if (l.event === "send") days[d].sent++; else if (l.event === "error") days[d].failed++; } });
      return Response.json({
        kpis: {
          total: N.length + Q.length,
          sentToday, sentMonth,
          pending: Q.filter(q => q.status === "pending").length,
          failed: Q.filter(q => q.status === "failed").length,
          scheduled: Q.filter(q => q.status === "pending" && q.scheduled_for > new Date().toISOString()).length,
          read: N.filter(n => n.status === "read").length,
          unread: N.filter(n => n.status === "unread").length,
          deliveryRate, avgMs,
        },
        series: Object.values(days),
        recentActivity: L.slice(0, 12),
      });
    }

    if (action === "channels") {
      const { data } = await supabase.from("notification_channels").select("*").order("id");
      const channels = (data || []).map(c => ({ ...c, configured: channelConfigured(c.id), env: CHANNEL_ENV[c.id] || [] }));
      return Response.json({ channels });
    }

    if (action === "templates") {
      const { data } = await supabase.from("notification_templates").select("*").order("category").order("name");
      return Response.json({ templates: data || [] });
    }

    if (action === "queue") {
      const status = sp.get("status");
      let q = supabase.from("notification_queue").select("*").order("scheduled_for", { ascending: true }).limit(200);
      if (status && status !== "all") q = q.eq("status", status);
      const { data } = await q;
      return Response.json({ queue: data || [] });
    }

    if (action === "history") {
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10)); const pageSize = 30; const fromR = (page - 1) * pageSize;
      let q = supabase.from("notification_queue").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(fromR, fromR + pageSize - 1);
      const ch = sp.get("channel"); if (ch && ch !== "all") q = q.eq("channel", ch);
      const st = sp.get("status"); if (st && st !== "all") q = q.eq("status", st);
      const { data, count } = await q;
      return Response.json({ history: data || [], total: count || 0, page, pageSize });
    }

    if (action === "logs") {
      const ev = sp.get("event");
      let q = supabase.from("notification_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (ev && ev !== "all") q = q.eq("event", ev);
      const { data } = await q;
      return Response.json({ logs: data || [] });
    }

    if (action === "settings") {
      const { data } = await supabase.from("notification_settings").select("*").eq("id", "global").single();
      return Response.json({ settings: data || { id: "global" } });
    }

    if (action === "audience") {
      // Broadcast audience preview based on filters
      const sb = anon();
      const filter = sp.get("filter") || "all";
      let q = sb.from("profiles").select("id, email, full_name, created_at", { count: "exact" }).not("email", "is", null);
      const country = sp.get("country"); if (country) q = q.eq("country", country);
      if (filter === "new") q = q.gte("created_at", new Date(Date.now() - 30 * DAY).toISOString());
      const { count } = await q;
      return Response.json({ count: count || 0, filter });
    }

    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// ============================ POST ============================
export async function POST(request: NextRequest, { params }) {
  const { action } = await params;
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const b = await request.json().catch(() => ({}));

  try {
    // ---- Test a single channel (real network call) ----
    if (action === "test") {
      if (rateLimited(`test:${auth.user.id}`, 10, 60000)) return Response.json({ ok: false, message: "Rate limit — wait a minute." }, { status: 429 });
      const channel = b.channel;
      if (!channelConfigured(channel)) return Response.json({ ok: false, message: `${channel} is not configured. Set ${(CHANNEL_ENV[channel] || []).join(" or ")} on the server.` });
      const start = Date.now();
      const res = await dispatch(channel, { recipient: b.recipient, subject: b.subject || "Test notification", body: b.body || "This is a test notification from Atlanta Sneakers.", user_id: b.user_id || auth.user.id, category: "test", priority: "normal" });
      const duration = Date.now() - start;
      await supabase.from("notification_channels").update({ last_test_at: new Date().toISOString(), last_test_status: res.ok ? "ok" : "error" }).eq("id", channel);
      await log(supabase, auth, request, "test", { channel, recipient: b.recipient, status: res.ok ? "ok" : "error", duration_ms: duration, error: res.error || null });
      return Response.json({ ok: res.ok, message: res.ok ? `Test sent via ${channel}.` : res.error });
    }

    // ---- Send now (enqueue + immediately process those items) ----
    if (action === "send") {
      if (rateLimited(`send:${auth.user.id}`, 60, 60000)) return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
      const rows = await enqueue({
        channels: b.channels, recipient: b.recipient, user_id: b.user_id, template_key: b.template_key,
        subject: b.subject, body: b.body, payload: b.payload, vars: b.vars, priority: b.priority || 3,
        created_by: auth.user.id,
      });
      // process immediately (background-style, but awaited so we can report)
      const summary = await processQueue({ limit: rows.length + 5 });
      await log(supabase, auth, request, "send", { detail: `${rows.length} queued`, status: "ok" });
      return Response.json({ ok: true, queued: rows.length, summary });
    }

    // ---- Schedule ----
    if (action === "schedule") {
      const rows = await enqueue({
        channels: b.channels, recipient: b.recipient, user_id: b.user_id, template_key: b.template_key,
        subject: b.subject, body: b.body, payload: b.payload, vars: b.vars, priority: b.priority || 5,
        scheduled_for: b.scheduled_for, timezone: b.timezone, repeat_rule: b.repeat_rule, expires_at: b.expires_at,
        created_by: auth.user.id,
      });
      await log(supabase, auth, request, "schedule", { detail: `${rows.length} scheduled for ${b.scheduled_for}`, status: "ok" });
      return Response.json({ ok: true, scheduled: rows.length });
    }

    // ---- Process the queue (cron endpoint / manual button) ----
    if (action === "process") {
      const summary = await processQueue({ limit: b.limit || 50 });
      await log(supabase, auth, request, "send", { detail: `queue run: ${JSON.stringify(summary)}`, status: "ok" });
      return Response.json({ ok: true, summary });
    }

    // ---- Broadcast to an audience segment ----
    if (action === "broadcast") {
      if (rateLimited(`broadcast:${auth.user.id}`, 5, 60000)) return Response.json({ error: "Rate limit — broadcasts are throttled." }, { status: 429 });
      const sb = anon();
      const filter = b.filter || "all";
      let q = sb.from("profiles").select("id, email, full_name").not("email", "is", null);
      if (b.country) q = q.eq("country", b.country);
      if (filter === "new") q = q.gte("created_at", new Date(Date.now() - 30 * DAY).toISOString());
      const { data: users } = await q.limit(5000);
      const channels = b.channels && b.channels.length ? b.channels : ["in_app"];
      let queued = 0;
      for (const u of users || []) {
        const vars = { customer_name: u.full_name || "there", store_name: "Atlanta Sneakers", ...(b.vars || {}) };
        const rows = await enqueue({ channels, recipient: channels.includes("email") ? u.email : u.id, user_id: u.id, template_key: b.template_key, subject: b.subject, body: b.body, vars, priority: 6, scheduled_for: b.scheduled_for, created_by: auth.user.id });
        queued += rows.length;
      }
      await log(supabase, auth, request, "send", { detail: `broadcast ${filter}: ${queued} queued to ${(users || []).length} users`, status: "ok" });
      // kick off processing (non-scheduled ones)
      if (!b.scheduled_for) processQueue({ limit: 100 }).catch(() => {});
      return Response.json({ ok: true, recipients: (users || []).length, queued });
    }

    // ---- Channel enable/disable ----
    if (action === "toggle-channel") {
      const { error } = await supabase.from("notification_channels").update({ enabled: !!b.enabled, updated_at: new Date().toISOString() }).eq("id", b.id);
      if (error) { const sb = anon(); await sb.from("notification_channels").update({ enabled: !!b.enabled, updated_at: new Date().toISOString() }).eq("id", b.id); }
      await log(supabase, auth, request, "update", { channel: b.id, detail: b.enabled ? "enabled" : "disabled" });
      return Response.json({ ok: true });
    }

    // ---- Channel config (non-secret) ----
    if (action === "save-channel") {
      const patch = { provider: b.provider, config: b.config || {}, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("notification_channels").update(patch).eq("id", b.id);
      if (error) { const sb = anon(); await sb.from("notification_channels").update(patch).eq("id", b.id); }
      await log(supabase, auth, request, "update", { channel: b.id, detail: "config saved" });
      return Response.json({ ok: true });
    }

    // ---- Template create/update ----
    if (action === "save-template") {
      const row = { name: b.name, category: b.category, subject: b.subject, body: b.body, channels: b.channels || ["email"], variables: b.variables || [], is_active: b.is_active !== false, updated_at: new Date().toISOString() };
      let res;
      if (b.id) res = await supabase.from("notification_templates").update(row).eq("id", b.id).select("*").single();
      else res = await supabase.from("notification_templates").insert({ ...row, key: b.key || (b.name || "template").toLowerCase().replace(/[^a-z0-9]+/g, "_") }).select("*").single();
      if (res.error) return Response.json({ error: res.error.message }, { status: 500 });
      await log(supabase, auth, request, b.id ? "update" : "create", { detail: `template ${row.name}` });
      return Response.json({ ok: true, template: res.data });
    }

    if (action === "delete-template") {
      const { error } = await supabase.from("notification_templates").delete().eq("id", b.id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await log(supabase, auth, request, "delete", { detail: `template ${b.id}` });
      return Response.json({ ok: true });
    }

    // ---- Automations & permissions settings ----
    if (action === "save-settings") {
      const patch = { updated_at: new Date().toISOString() };
      ["automations", "permissions", "channels"].forEach(k => { if (k in b) patch[k] = b[k]; });
      const { error } = await supabase.from("notification_settings").update(patch).eq("id", "global");
      if (error) { const sb = anon(); await sb.from("notification_settings").upsert({ id: "global", ...patch }, { onConflict: "id" }); }
      await log(supabase, auth, request, "update", { detail: "settings saved" });
      return Response.json({ ok: true });
    }

    // ---- Cancel / retry a queue item ----
    if (action === "queue-action") {
      if (b.op === "cancel") await supabase.from("notification_queue").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", b.id);
      else if (b.op === "retry") await supabase.from("notification_queue").update({ status: "pending", scheduled_for: new Date().toISOString(), attempts: 0, last_error: null, updated_at: new Date().toISOString() }).eq("id", b.id);
      await log(supabase, auth, request, "update", { queue_id: b.id, detail: `queue ${b.op}` });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) {
    await log(supabase, auth, request, "error", { detail: `${action}: ${e.message}`, status: "error", error: e.message });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
