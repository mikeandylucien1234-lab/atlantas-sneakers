// @ts-nocheck
// Real login-event ingestion: parses User-Agent, geolocates the IP, computes a
// risk score against the user's history, persists login_history + device +
// location + session, and raises security events / alerts / notifications.
import { createClient as createAnon } from "@supabase/supabase-js";
import crypto from "crypto";
import { sendEmail } from "@/lib/notifications/senders";

function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }

// ---- Minimal, dependency-free User-Agent parser ----
export function parseUA(ua = "") {
  const s = ua || "";
  let browser = "Unknown", version = "";
  const bm = s.match(/(Edg|OPR|Chrome|Firefox|Safari|SamsungBrowser)\/([\d.]+)/);
  if (bm) { browser = { Edg: "Edge", OPR: "Opera", SamsungBrowser: "Samsung Internet" }[bm[1]] || bm[1]; version = bm[2]; }
  if (/Chrome/.test(s) && /Safari/.test(s) && !/Edg|OPR/.test(s)) browser = "Chrome";
  else if (/Safari/.test(s) && !/Chrome/.test(s)) { browser = "Safari"; version = (s.match(/Version\/([\d.]+)/) || [])[1] || version; }
  let os = "Unknown";
  if (/Windows NT 10/.test(s)) os = "Windows 10/11"; else if (/Windows/.test(s)) os = "Windows";
  else if (/Mac OS X/.test(s)) os = "macOS"; else if (/Android/.test(s)) os = "Android";
  else if (/iPhone|iPad|iOS/.test(s)) os = "iOS"; else if (/Linux/.test(s)) os = "Linux";
  const isTablet = /iPad|Tablet/.test(s);
  const isPhone = /Mobile|iPhone|Android.*Mobile/.test(s);
  const device_type = isTablet ? "tablet" : isPhone ? "phone" : /Macintosh|Windows|Linux/.test(s) ? "desktop" : "desktop";
  const device = os === "iOS" ? (isTablet ? "iPad" : "iPhone") : os === "Android" ? "Android device" : device_type;
  return { browser, browser_version: version, os, device, device_type };
}

// ---- Real IP geolocation via ipwho.is (free, https, no key) ----
async function geolocate(ip) {
  if (!ip || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) return {};
  try {
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: AbortSignal.timeout(3500) });
    const d = await r.json();
    if (!d || d.success === false) return {};
    return {
      country: d.country, state: d.region, city: d.city, latitude: d.latitude, longitude: d.longitude,
      isp: d.connection?.isp, network: d.connection?.org,
      timezone: d.timezone?.id,
      is_vpn: !!d.security?.vpn, is_proxy: !!d.security?.proxy, is_tor: !!d.security?.tor,
    };
  } catch { return {}; }
}

function haversine(a, b, c, d) {
  if ([a, b, c, d].some(x => x == null)) return null;
  const R = 6371, toR = (x) => x * Math.PI / 180;
  const dLat = toR(c - a), dLon = toR(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function recordLogin({ ip, ua, status = "success", method = "email", email, user_id, screen_resolution, language, timezone }) {
  const s = svc();
  const parsed = parseUA(ua);
  const geo = await geolocate(ip);
  const fingerprint = crypto.createHash("sha256").update(`${ua}|${screen_resolution || ""}|${language || ""}`).digest("hex").slice(0, 32);

  // resolve identity
  let profile = null;
  if (user_id) { const { data } = await s.from("profiles").select("id, email, full_name, role").eq("id", user_id).single(); profile = data; }
  else if (email) { const { data } = await s.from("profiles").select("id, email, full_name, role").eq("email", email).maybeSingle(); profile = data; }
  const uid = profile?.id || user_id || null;

  // ---- Risk analysis ----
  const factors = []; let score = 0;
  if (status !== "success") { score += 25; factors.push(`login_${status}`); }
  if (geo.is_tor) { score += 45; factors.push("tor"); }
  if (geo.is_vpn) { score += 20; factors.push("vpn"); }
  if (geo.is_proxy) { score += 20; factors.push("proxy"); }

  if (uid) {
    const [{ data: hist }, { data: dev }, { data: locs }, { data: recentFails }] = await Promise.all([
      s.from("login_history").select("country, ip_address, latitude, longitude, created_at").eq("user_id", uid).eq("status", "success").order("created_at", { ascending: false }).limit(20),
      s.from("login_devices").select("fingerprint").eq("user_id", uid),
      s.from("login_locations").select("country, city").eq("user_id", uid),
      s.from("login_history").select("id").eq("user_id", uid).in("status", ["failed", "password_incorrect", "2fa_failed", "otp_failed"]).gte("created_at", new Date(Date.now() - 30 * 60000).toISOString()),
    ]);
    const knownCountries = new Set((locs || []).map(l => l.country));
    const knownDevices = new Set((dev || []).map(d => d.fingerprint));
    const knownIps = new Set((hist || []).map(h => h.ip_address));
    if (geo.country && knownCountries.size > 0 && !knownCountries.has(geo.country)) { score += 30; factors.push("new_country"); }
    if (knownDevices.size > 0 && !knownDevices.has(fingerprint)) { score += 20; factors.push("new_device"); }
    if (ip && knownIps.size > 0 && !knownIps.has(ip)) { score += 10; factors.push("new_ip"); }
    if ((recentFails || []).length >= 3) { score += 30; factors.push("multiple_failures"); }
    // impossible travel
    const last = (hist || [])[0];
    if (last && last.latitude != null && geo.latitude != null) {
      const km = haversine(last.latitude, last.longitude, geo.latitude, geo.longitude);
      const hours = (Date.now() - new Date(last.created_at).getTime()) / 3600000;
      if (km != null && hours > 0 && km / hours > 900) { score += 35; factors.push("impossible_travel"); }
    }
  }
  const risk_level = score >= 70 ? "critical" : score >= 45 ? "high" : score >= 20 ? "medium" : "low";

  // ---- Create session for successful logins ----
  let session_id = null;
  if (status === "success" && uid) {
    const { data: sess } = await s.from("login_sessions").insert({
      user_id: uid, ip_address: ip, device_type: parsed.device_type, browser: parsed.browser, os: parsed.os,
      country: geo.country, city: geo.city, status: "active",
    }).select("id").single();
    session_id = sess?.id || null;
  }

  // ---- Persist login_history ----
  const { data: row } = await s.from("login_history").insert({
    user_id: uid, email: profile?.email || email || null, full_name: profile?.full_name || null, role: profile?.role || null,
    method, status, ip_address: ip, country: geo.country, state: geo.state, city: geo.city,
    latitude: geo.latitude, longitude: geo.longitude, isp: geo.isp, network: geo.network,
    is_vpn: geo.is_vpn, is_proxy: geo.is_proxy, is_tor: geo.is_tor, timezone: timezone || geo.timezone,
    browser: parsed.browser, browser_version: parsed.browser_version, os: parsed.os, device: parsed.device, device_type: parsed.device_type,
    screen_resolution, language, user_agent: ua, risk_level, risk_score: score, risk_factors: factors, session_id,
  }).select("id").single();
  const login_id = row?.id;

  // ---- Upsert device & location, security events ----
  if (uid) {
    await s.from("login_devices").upsert({ user_id: uid, fingerprint, device_type: parsed.device_type, os: parsed.os, browser: parsed.browser, browser_version: parsed.browser_version, last_seen: new Date().toISOString() }, { onConflict: "user_id,fingerprint" });
    if (geo.country) await s.from("login_locations").upsert({ user_id: uid, country: geo.country, state: geo.state, city: geo.city, latitude: geo.latitude, longitude: geo.longitude, ip_address: ip, last_seen: new Date().toISOString() }, { onConflict: "user_id,country,city" });

    // security events + alerts + notifications for suspicious factors
    const suspicious = factors.filter(f => ["new_country", "new_device", "impossible_travel", "vpn", "tor", "proxy", "multiple_failures"].includes(f));
    for (const f of suspicious) {
      const sev = ["tor", "impossible_travel"].includes(f) ? "critical" : ["new_country", "multiple_failures", "vpn", "proxy"].includes(f) ? "medium" : "low";
      await s.from("login_security_events").insert({ user_id: uid, login_id, event_type: f, severity: sev, ip_address: ip, detail: `${f} for ${profile?.email || email}` });
    }
    if (risk_level === "high" || risk_level === "critical") {
      await s.from("security_alerts").insert({ severity: risk_level === "critical" ? "critical" : "medium", type: "suspicious_login", title: "Suspicious login detected", message: `${profile?.email || email} · ${factors.join(", ")} · ${geo.city || ""} ${geo.country || ""}`, ip_address: ip, actor_id: uid }).then(() => {}, () => {});
      // notify the user + persist in-app notification
      await s.from("notifications").insert({ user_id: uid, channel: "in_app", type: "security", category: "security", title: "New sign-in detected", message: `A ${risk_level}-risk sign-in from ${geo.city || "unknown"}, ${geo.country || "unknown"} (${ip}).`, priority: "high", status: "unread" }).then(() => {}, () => {});
      if (profile?.email) sendEmail({ to: profile.email, subject: "Security alert: new sign-in to your account", html: `<div style="font-family:system-ui,sans-serif"><p>Hi ${profile.full_name || "there"}, we detected a <b>${risk_level}-risk</b> sign-in to your Atlanta Sneakers account.</p><p>Location: ${geo.city || "unknown"}, ${geo.country || "unknown"}<br/>IP: ${ip}<br/>Device: ${parsed.browser} on ${parsed.os}</p><p>If this wasn't you, reset your password immediately.</p></div>` }).catch(() => {});
    }
  }

  return { ok: true, id: login_id, risk_level, risk_score: score, factors };
}
