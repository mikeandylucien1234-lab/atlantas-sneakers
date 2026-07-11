// @ts-nocheck
// Notification engine: template rendering, queue enqueue, and a real background
// queue processor with retry, priority ordering, expiration and logging.
import { createClient } from "@supabase/supabase-js";
import { dispatch } from "./senders";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
}

// {{var}} interpolation with graceful fallback.
export function render(str, vars = {}) {
  if (!str) return "";
  return str.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
}

function toHtml(text) {
  if (!text) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text; // already HTML
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#16181d">${text.replace(/\n/g, "<br/>")}</div>`;
}

// Enqueue one message per channel. Returns the created queue rows.
export async function enqueue({ channels, recipient, user_id, template_key, subject, body, payload, vars, priority, scheduled_for, timezone, repeat_rule, expires_at, created_by }) {
  const sb = admin();
  let tplSubject = subject, tplBody = body, tplChannels = channels;
  if (template_key) {
    const { data: tpl } = await sb.from("notification_templates").select("*").eq("key", template_key).single();
    if (tpl) { tplSubject = subject || tpl.subject; tplBody = body || tpl.body; if (!tplChannels) tplChannels = tpl.channels; }
  }
  const chans = (tplChannels && tplChannels.length ? tplChannels : ["in_app"]);
  const rows = chans.map(ch => ({
    channel: ch, recipient: recipient || null, user_id: user_id || null, template_key: template_key || null,
    subject: render(tplSubject, vars), body: render(tplBody, vars), payload: payload || {},
    priority: priority || 5, status: "pending", max_attempts: 3,
    scheduled_for: scheduled_for || new Date().toISOString(), timezone: timezone || "UTC",
    repeat_rule: repeat_rule || "none", expires_at: expires_at || null, created_by: created_by || null,
  }));
  const { data, error } = await sb.from("notification_queue").insert(rows).select("*");
  if (error) throw new Error(error.message);
  return data || [];
}

async function logEvent(sb, row) { try { await sb.from("notification_logs").insert(row); } catch {} }

function nextRun(rule, from) {
  const d = new Date(from);
  if (rule === "daily") d.setDate(d.getDate() + 1);
  else if (rule === "weekly") d.setDate(d.getDate() + 7);
  else if (rule === "monthly") d.setMonth(d.getMonth() + 1);
  else return null;
  return d.toISOString();
}

// Process due queue items. Called by the /process endpoint (cron or manual).
export async function processQueue({ limit = 25 } = {}) {
  const sb = admin();
  const now = new Date().toISOString();
  const summary = { processed: 0, sent: 0, failed: 0, expired: 0, retried: 0 };

  // Expire overdue items first
  await sb.from("notification_queue").update({ status: "expired", updated_at: now }).lt("expires_at", now).eq("status", "pending").not("expires_at", "is", null);

  const { data: due } = await sb.from("notification_queue")
    .select("*").eq("status", "pending").lte("scheduled_for", now)
    .order("priority", { ascending: true }).order("scheduled_for", { ascending: true }).limit(limit);

  for (const item of due || []) {
    summary.processed++;
    // claim
    await sb.from("notification_queue").update({ status: "processing", processing_at: now, attempts: (item.attempts || 0) + 1, updated_at: now }).eq("id", item.id);
    const start = Date.now();
    const res = await dispatch(item.channel, item);
    const duration = Date.now() - start;

    if (res.ok) {
      await sb.from("notification_queue").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("id", item.id);
      await sb.from("notification_channels").update({ last_used_at: new Date().toISOString() }).eq("id", item.channel);
      await logEvent(sb, { queue_id: item.id, channel: item.channel, recipient: item.recipient, event: "send", status: "ok", duration_ms: duration });
      summary.sent++;
      // schedule repeat
      const nr = nextRun(item.repeat_rule, item.scheduled_for);
      if (nr) { await sb.from("notification_queue").insert({ ...cleanRepeat(item), status: "pending", attempts: 0, scheduled_for: nr, sent_at: null, processing_at: null }); }
    } else {
      const attempts = (item.attempts || 0) + 1;
      const willRetry = attempts < (item.max_attempts || 3);
      await sb.from("notification_queue").update({ status: willRetry ? "pending" : "failed", last_error: res.error, scheduled_for: willRetry ? new Date(Date.now() + Math.pow(2, attempts) * 60000).toISOString() : item.scheduled_for, updated_at: new Date().toISOString() }).eq("id", item.id);
      await logEvent(sb, { queue_id: item.id, channel: item.channel, recipient: item.recipient, event: willRetry ? "retry" : "error", status: "error", duration_ms: duration, error: res.error });
      if (willRetry) summary.retried++; else summary.failed++;
    }
  }
  return summary;
}

function cleanRepeat(item) {
  const { id, created_at, updated_at, sent_at, processing_at, last_error, ...rest } = item;
  return rest;
}
