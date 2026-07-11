// @ts-nocheck
// Real security enforcement helpers.
//  - IP blocklist (cached, enforced at the edge in proxy.ts)
//  - Firewall payload inspection (SQLi/XSS/path-traversal/command-injection)
//  - Password-policy validation
import { createClient } from "@supabase/supabase-js";

function anon() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }

// Module-scoped cache (persists on a long-lived Node server such as o2switch).
let _ipCache = { at: 0, blocked: new Set(), whitelist: new Set() };
const IP_TTL = 30000;

export function clientIp(request) {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || null;
}

export async function loadIpLists(force = false) {
  if (!force && Date.now() - _ipCache.at < IP_TTL) return _ipCache;
  try {
    const sb = anon();
    const { data } = await sb.from("blocked_ips").select("ip_address, list_type, expires_at");
    const now = Date.now();
    const blocked = new Set(), whitelist = new Set();
    (data || []).forEach(r => {
      if (r.expires_at && new Date(r.expires_at).getTime() < now) return;
      if (r.list_type === "blacklist") blocked.add(r.ip_address);
      else if (r.list_type === "whitelist" || r.list_type === "trusted") whitelist.add(r.ip_address);
    });
    _ipCache = { at: now, blocked, whitelist };
  } catch { /* keep last cache */ }
  return _ipCache;
}
export function invalidateIpCache() { _ipCache.at = 0; }

export async function isIpBlocked(ip) {
  if (!ip) return false;
  const lists = await loadIpLists();
  return lists.blocked.has(ip);
}

// ---- Firewall payload inspection ----
const PATTERNS = {
  sql_injection: /(\bunion\b\s+\bselect\b|\bselect\b.+\bfrom\b|\binsert\b\s+\binto\b|\bdrop\b\s+\btable\b|--\s|\bor\b\s+1=1|;\s*drop\b)/i,
  xss: /(<script\b|javascript:|onerror\s*=|onload\s*=|<iframe\b|document\.cookie)/i,
  path_traversal: /(\.\.\/|\.\.\\|%2e%2e%2f|\/etc\/passwd|\/proc\/self)/i,
  command_injection: /(;\s*(rm|cat|wget|curl|nc|bash|sh)\b|\|\s*(rm|cat|wget|curl)\b|`[^`]+`|\$\([^)]+\))/i,
};
export function inspectPayload(str, firewall = {}) {
  if (!str || typeof str !== "string") return null;
  for (const [key, re] of Object.entries(PATTERNS)) {
    if (firewall[key] !== false && re.test(str)) return key;
  }
  return null;
}

// ---- Password policy ----
export function validatePassword(pw, policy = {}) {
  const errors = [];
  const min = policy.min_length ?? 8, max = policy.max_length ?? 64;
  if (!pw || pw.length < min) errors.push(`At least ${min} characters`);
  if (pw && pw.length > max) errors.push(`At most ${max} characters`);
  if (policy.uppercase && !/[A-Z]/.test(pw)) errors.push("An uppercase letter");
  if (policy.lowercase && !/[a-z]/.test(pw)) errors.push("A lowercase letter");
  if (policy.number && !/[0-9]/.test(pw)) errors.push("A number");
  if (policy.special && !/[^A-Za-z0-9]/.test(pw)) errors.push("A special character");
  return { valid: errors.length === 0, errors };
}

// ---- Security scoring (real, derived from current config + live signals) ----
export function computeSecurityScore(s, signals = {}) {
  let score = 0; const max = 100; const checks = [];
  const add = (ok, weight, label) => { checks.push({ ok: !!ok, label, weight }); if (ok) score += weight; };
  const pw = s?.password_policy || {}, tf = s?.two_factor || {}, ls = s?.login_security || {}, hd = s?.headers || {}, api = s?.api_security || {}, fw = s?.firewall || {};
  add((pw.min_length || 0) >= 8, 10, "Password minimum length ≥ 8");
  add(pw.uppercase && pw.number && pw.special, 8, "Strong password complexity");
  add(tf.enabled, 15, "Two-factor authentication enabled");
  add(tf.enforce_admins, 7, "2FA enforced for admins");
  add((ls.max_attempts || 99) <= 5, 8, "Login attempt limit ≤ 5");
  add(ls.email_verification, 5, "Email verification required");
  add(hd.csp !== false, 8, "Content-Security-Policy active");
  add(hd.hsts !== false, 7, "HSTS active");
  add(api.csrf, 6, "CSRF protection");
  add(api.rate_limit_per_min > 0, 6, "API rate limiting");
  add(fw.sql_injection && fw.xss, 8, "SQLi/XSS firewall active");
  add(fw.brute_force, 4, "Brute-force protection");
  add((signals.https !== false), 8, "HTTPS enforced");
  const level = score >= 80 ? "secure" : score >= 55 ? "warning" : "critical";
  return { score, max, level, checks };
}
