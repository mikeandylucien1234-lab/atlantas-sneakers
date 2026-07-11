// @ts-nocheck
// Real API-key authentication. Validates the Bearer key against the hashed
// record, enforces status/expiry/IP-allowlist/domain/permission/rate-limit, and
// records usage + logs. Used by the public /api/v1/* surface so keys genuinely
// gate access. Secrets are only ever compared as SHA-256 hashes.
import { createClient as createAnon } from "@supabase/supabase-js";
import crypto from "crypto";

function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
export function sha256(v) { return crypto.createHash("sha256").update(v).digest("hex"); }
function ipOf(request) { return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null; }

// Sliding-window rate check backed by api_rate_limits counters.
async function checkRate(s, key) {
  const now = new Date();
  const windows = [
    ["minute", new Date(Math.floor(now.getTime() / 60000) * 60000), key.rate_per_minute],
    ["hour", new Date(Math.floor(now.getTime() / 3600000) * 3600000), key.rate_per_hour],
    ["day", new Date(new Date().setHours(0, 0, 0, 0)), key.rate_per_day],
  ];
  for (const [type, start, limit] of windows) {
    if (!limit) continue;
    const { data } = await s.from("api_rate_limits").select("count").eq("api_key_id", key.id).eq("window_type", type).eq("window_start", start.toISOString()).maybeSingle();
    if ((data?.count || 0) >= limit) return { ok: false, window: type, limit };
  }
  // increment counters
  for (const [type, start] of windows) {
    await s.from("api_rate_limits").upsert({ api_key_id: key.id, window_type: type, window_start: start.toISOString(), count: 1 }, { onConflict: "api_key_id,window_type,window_start", ignoreDuplicates: false }).then(async () => {
      await s.rpc("increment_rate", { p_key: key.id, p_type: type, p_start: start.toISOString() }).then(() => {}, async () => {
        // fallback: read-modify-write
        const { data } = await s.from("api_rate_limits").select("count").eq("api_key_id", key.id).eq("window_type", type).eq("window_start", start.toISOString()).maybeSingle();
        await s.from("api_rate_limits").update({ count: (data?.count || 0) + 1 }).eq("api_key_id", key.id).eq("window_type", type).eq("window_start", start.toISOString());
      });
    }, () => {});
  }
  return { ok: true };
}

export function hasPermission(key, perm) {
  if (!key) return false;
  const [module, action] = perm.split(".");
  const perms = key.permissions || {};
  const arr = perms[module] || [];
  if (key.key_type === "read_only" && action !== "read") return false;
  return arr.includes(action) || arr.includes("*");
}

// Authenticate a request. Returns { key } on success or { error, status }.
export async function verifyApiKey(request, requiredPerm) {
  const s = svc();
  const started = Date.now();
  const authz = request.headers.get("authorization") || request.headers.get("x-api-key") || "";
  const raw = authz.replace(/^Bearer\s+/i, "").trim();
  if (!raw) return { error: "Missing API key", status: 401 };

  const hash = sha256(raw);
  const { data: key } = await s.from("api_keys").select("*").or(`key_hash.eq.${hash},old_hash.eq.${hash}`).maybeSingle();
  const ip = ipOf(request);
  const logDeny = async (code, err) => { try { await s.from("api_logs").insert({ api_key_id: key?.id || null, key_id: key?.key_id || null, endpoint: new URL(request.url).pathname, method: request.method, status_code: code, result: "denied", response_time_ms: Date.now() - started, ip_address: ip, user_agent: request.headers.get("user-agent"), error: err }); } catch {} };

  if (!key) { await logDeny(401, "Invalid key"); return { error: "Invalid API key", status: 401 }; }
  // old (rotated) hash only valid during grace window
  if (key.old_hash === hash && sha256(raw) !== key.key_hash) {
    if (!key.old_hash_expires_at || new Date(key.old_hash_expires_at) < new Date()) { await logDeny(401, "Rotated key expired"); return { error: "Key rotated — old secret expired", status: 401 }; }
  }
  if (key.status === "revoked") { await logDeny(403, "Revoked"); return { error: "Key revoked", status: 403 }; }
  if (key.status === "disabled") { await logDeny(403, "Disabled"); return { error: "Key disabled", status: 403 }; }
  if (key.expires_at && new Date(key.expires_at) < new Date()) { await logDeny(403, "Expired"); return { error: "Key expired", status: 403 }; }

  // IP allowlist
  if ((key.allowed_ips || []).length && ip && !key.allowed_ips.includes(ip)) { await logDeny(403, "IP not allowed"); return { error: "IP not allowed", status: 403 }; }
  // Domain allowlist (Origin/Referer)
  if ((key.allowed_domains || []).length) {
    const origin = request.headers.get("origin") || request.headers.get("referer") || "";
    const host = (() => { try { return new URL(origin).hostname; } catch { return ""; } })();
    if (host && !key.allowed_domains.some(d => host === d || host.endsWith("." + d))) { await logDeny(403, "Domain not allowed"); return { error: "Domain not allowed", status: 403 }; }
  }
  // Permission
  if (requiredPerm && !hasPermission(key, requiredPerm)) { await logDeny(403, `Missing permission ${requiredPerm}`); return { error: `Missing permission: ${requiredPerm}`, status: 403 }; }
  // Rate limit
  const rl = await checkRate(s, key);
  if (!rl.ok) {
    await s.from("api_usage").upsert({ api_key_id: key.id, day: new Date().toISOString().slice(0, 10), rate_limited: 1 }, { onConflict: "api_key_id,day" });
    await logDeny(429, `Rate limit (${rl.window})`);
    return { error: `Rate limit exceeded (${rl.window}: ${rl.limit})`, status: 429 };
  }
  return { key, s, started, ip };
}

// Record a successful call's usage + log (call after producing the response).
export async function recordApiCall({ s, key, started, ip, request, statusCode = 200, payloadSize = 0, bytes = 0 }) {
  const rt = Date.now() - started;
  try {
    if (key.logging_enabled) await s.from("api_logs").insert({ api_key_id: key.id, key_id: key.key_id, endpoint: new URL(request.url).pathname, method: request.method, status_code: statusCode, result: "ok", response_time_ms: rt, ip_address: ip, user_agent: request.headers.get("user-agent"), payload_size: payloadSize });
    await s.from("api_keys").update({ last_used_at: new Date().toISOString(), usage_count: (key.usage_count || 0) + 1 }).eq("id", key.id);
    const day = new Date().toISOString().slice(0, 10);
    const { data: u } = await s.from("api_usage").select("*").eq("api_key_id", key.id).eq("day", day).maybeSingle();
    await s.from("api_usage").upsert({ api_key_id: key.id, day, requests: (u?.requests || 0) + 1, total_response_time: (u?.total_response_time || 0) + rt, bandwidth: (u?.bandwidth || 0) + bytes, errors: u?.errors || 0 }, { onConflict: "api_key_id,day" });
  } catch {}
  return rt;
}
