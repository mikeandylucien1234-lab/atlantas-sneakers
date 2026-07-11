// @ts-nocheck
// Real per-channel notification senders. Every secret is read from server
// environment variables only — never from the database or the browser.
// Each sender returns { ok, id?, error? } and performs a genuine network call
// to the provider (or an explicit "not configured" result — never a fake OK).

import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
}

// ---------- EMAIL (Resend, real) ----------
export async function sendEmail({ to, subject, html, from, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  const fromAddr = from || process.env.NOTIFY_FROM_EMAIL || "Atlanta Sneakers <onboarding@resend.dev>";
  if (!key) return { ok: false, error: "RESEND_API_KEY not configured" };
  if (!to) return { ok: false, error: "Missing recipient" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddr, to: [to], subject: subject || "(no subject)", html: html || "", ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    const d = await r.json();
    if (!r.ok) return { ok: false, error: d?.message || d?.error || `Resend ${r.status}` };
    return { ok: true, id: d.id };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ---------- SMS (Twilio / Vonage / MessageBird / Infobip) ----------
export async function sendSms({ to, body, provider }) {
  provider = provider || process.env.SMS_PROVIDER || "twilio";
  if (!to) return { ok: false, error: "Missing recipient" };
  try {
    if (provider === "twilio") {
      const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
      if (!sid || !token || !from) return { ok: false, error: "Twilio env not configured (TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM)" };
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST", headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: to, From: from, Body: body || "" }),
      });
      const d = await r.json(); if (!r.ok) return { ok: false, error: d?.message || `Twilio ${r.status}` };
      return { ok: true, id: d.sid };
    }
    if (provider === "vonage") {
      const key = process.env.VONAGE_API_KEY, secret = process.env.VONAGE_API_SECRET, from = process.env.VONAGE_FROM || "AtlantaSnk";
      if (!key || !secret) return { ok: false, error: "Vonage env not configured" };
      const r = await fetch("https://rest.nexmo.com/sms/json", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ api_key: key, api_secret: secret, to, from, text: body || "" }) });
      const d = await r.json(); const m = d?.messages?.[0]; if (m?.status !== "0") return { ok: false, error: m?.["error-text"] || "Vonage error" };
      return { ok: true, id: m["message-id"] };
    }
    if (provider === "messagebird") {
      const key = process.env.MESSAGEBIRD_API_KEY, from = process.env.MESSAGEBIRD_FROM || "AtlantaSnk";
      if (!key) return { ok: false, error: "MessageBird env not configured" };
      const r = await fetch("https://rest.messagebird.com/messages", { method: "POST", headers: { Authorization: `AccessKey ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ originator: from, recipients: [to], body: body || "" }) });
      const d = await r.json(); if (!r.ok) return { ok: false, error: d?.errors?.[0]?.description || `MessageBird ${r.status}` };
      return { ok: true, id: d.id };
    }
    if (provider === "infobip") {
      const key = process.env.INFOBIP_API_KEY, base = process.env.INFOBIP_BASE_URL, from = process.env.INFOBIP_FROM || "AtlantaSnk";
      if (!key || !base) return { ok: false, error: "Infobip env not configured (INFOBIP_API_KEY/BASE_URL)" };
      const r = await fetch(`${base.replace(/\/$/, "")}/sms/2/text/advanced`, { method: "POST", headers: { Authorization: `App ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ from, destinations: [{ to }], text: body || "" }] }) });
      const d = await r.json(); if (!r.ok) return { ok: false, error: d?.requestError?.serviceException?.text || `Infobip ${r.status}` };
      return { ok: true, id: d?.messages?.[0]?.messageId };
    }
    // custom: POST to SMS_CUSTOM_URL
    if (provider === "custom") {
      const url = process.env.SMS_CUSTOM_URL; if (!url) return { ok: false, error: "SMS_CUSTOM_URL not configured" };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(process.env.SMS_CUSTOM_AUTH ? { Authorization: process.env.SMS_CUSTOM_AUTH } : {}) }, body: JSON.stringify({ to, body }) });
      return r.ok ? { ok: true } : { ok: false, error: `Custom SMS ${r.status}` };
    }
    return { ok: false, error: `Unknown SMS provider: ${provider}` };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ---------- PUSH (FCM legacy / Web Push via FCM) ----------
export async function sendPush({ to, title, body, data }) {
  const key = process.env.FCM_SERVER_KEY;
  if (!key) return { ok: false, error: "FCM_SERVER_KEY not configured" };
  if (!to) return { ok: false, error: "Missing device token" };
  try {
    const r = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST", headers: { Authorization: `key=${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, notification: { title, body }, data: data || {} }),
    });
    const d = await r.json(); if (!r.ok || d.failure) return { ok: false, error: d?.results?.[0]?.error || `FCM ${r.status}` };
    return { ok: true, id: d?.multicast_id?.toString() };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ---------- WHATSAPP (Cloud API, real) ----------
export async function sendWhatsApp({ to, body }) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, error: "WhatsApp env not configured (WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID)" };
  if (!to) return { ok: false, error: "Missing recipient" };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/[^\d]/g, ""), type: "text", text: { body: body || "" } }),
    });
    const d = await r.json(); if (!r.ok) return { ok: false, error: d?.error?.message || `WhatsApp ${r.status}` };
    return { ok: true, id: d?.messages?.[0]?.id };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ---------- TELEGRAM (Bot API, real) ----------
export async function sendTelegram({ to, body }) {
  const token = process.env.TELEGRAM_BOT_TOKEN; const chatId = to || process.env.TELEGRAM_CHAT_ID;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN not configured" };
  if (!chatId) return { ok: false, error: "Missing chat id" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: body || "", parse_mode: "HTML" }) });
    const d = await r.json(); if (!d.ok) return { ok: false, error: d?.description || "Telegram error" };
    return { ok: true, id: d?.result?.message_id?.toString() };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ---------- DISCORD (webhook, real) ----------
export async function sendDiscord({ body, webhook }) {
  const url = webhook || process.env.DISCORD_WEBHOOK_URL;
  if (!url) return { ok: false, error: "DISCORD_WEBHOOK_URL not configured" };
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: body || "" }) });
    return r.ok || r.status === 204 ? { ok: true } : { ok: false, error: `Discord ${r.status}` };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ---------- SLACK (webhook, real) ----------
export async function sendSlack({ body, webhook }) {
  const url = webhook || process.env.SLACK_WEBHOOK_URL;
  if (!url) return { ok: false, error: "SLACK_WEBHOOK_URL not configured" };
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: body || "" }) });
    return r.ok ? { ok: true } : { ok: false, error: `Slack ${r.status}` };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ---------- IN-APP (persist to notifications table, real) ----------
export async function sendInApp({ userId, title, body, category, priority, data }) {
  try {
    const sb = admin();
    const { data: row, error } = await sb.from("notifications").insert({
      user_id: userId || null, recipient: userId || null, channel: "in_app", type: category || "general",
      category, title: title || null, message: body || null, priority: priority || "normal", status: "unread", data: data || {},
    }).select("id").single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: row.id };
  } catch (e) { return { ok: false, error: e.message }; }
}

// Dispatch by channel
export async function dispatch(channel, msg) {
  switch (channel) {
    case "email": return sendEmail({ to: msg.recipient, subject: msg.subject, html: msg.html || msg.body, from: msg.from, replyTo: msg.replyTo });
    case "sms": return sendSms({ to: msg.recipient, body: msg.body, provider: msg.provider });
    case "push": return sendPush({ to: msg.recipient, title: msg.subject, body: msg.body, data: msg.payload });
    case "whatsapp": return sendWhatsApp({ to: msg.recipient, body: msg.body });
    case "telegram": return sendTelegram({ to: msg.recipient, body: msg.body });
    case "discord": return sendDiscord({ body: msg.body, webhook: msg.webhook });
    case "slack": return sendSlack({ body: msg.body, webhook: msg.webhook });
    case "in_app": return sendInApp({ userId: msg.user_id, title: msg.subject, body: msg.body, category: msg.category, priority: msg.priority, data: msg.payload });
    default: return { ok: false, error: `Unknown channel: ${channel}` };
  }
}

export const CHANNEL_ENV = {
  email: ["RESEND_API_KEY"],
  sms: ["TWILIO_ACCOUNT_SID", "VONAGE_API_KEY", "MESSAGEBIRD_API_KEY", "INFOBIP_API_KEY", "SMS_CUSTOM_URL"],
  push: ["FCM_SERVER_KEY"],
  in_app: [],
  whatsapp: ["WHATSAPP_ACCESS_TOKEN"],
  telegram: ["TELEGRAM_BOT_TOKEN"],
  discord: ["DISCORD_WEBHOOK_URL"],
  slack: ["SLACK_WEBHOOK_URL"],
};
export function channelConfigured(channel) {
  const envs = CHANNEL_ENV[channel]; if (!envs || envs.length === 0) return true; // in_app always works
  return envs.some(e => !!process.env[e]);
}
