// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

// First-party analytics beacon. Records real events (page views, product views,
// add-to-cart, purchases...) into analytics_events, powering the realtime,
// audience and traffic reports. Runs alongside GA4 (which is injected in the
// layout) — this gives the admin panel live data without the GA Data API.

function parseUA(ua: string) {
  const u = (ua || "").toLowerCase();
  let device = "desktop";
  if (/mobile|iphone|android(?!.*tablet)/.test(u)) device = "mobile";
  else if (/ipad|tablet/.test(u)) device = "tablet";
  let browser = "Other";
  if (u.includes("edg/")) browser = "Edge";
  else if (u.includes("chrome") && !u.includes("edg")) browser = "Chrome";
  else if (u.includes("safari") && !u.includes("chrome")) browser = "Safari";
  else if (u.includes("firefox")) browser = "Firefox";
  else if (u.includes("opera") || u.includes("opr/")) browser = "Opera";
  let os = "Other";
  if (u.includes("windows")) os = "Windows";
  else if (u.includes("mac os") || u.includes("macintosh")) os = "macOS";
  else if (u.includes("android")) os = "Android";
  else if (u.includes("iphone") || u.includes("ipad") || u.includes("ios")) os = "iOS";
  else if (u.includes("linux")) os = "Linux";
  return { device, browser, os };
}

function classifyReferrer(ref: string, host: string) {
  if (!ref) return "direct";
  try {
    const r = new URL(ref).hostname.toLowerCase();
    if (host && r.includes(host.replace(/^www\./, ""))) return "direct";
    if (/google\.|bing\.|yahoo\.|duckduckgo\./.test(r)) return "organic";
    if (/facebook\.|instagram\.|twitter\.|x\.com|tiktok\.|youtube\.|linkedin\.|pinterest\./.test(r)) return "social";
    if (/mail\.|gmail\.|outlook\./.test(r)) return "email";
    return "referral";
  } catch { return "direct"; }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_name, path, session_id, user_id, country, city, value, metadata } = body;
    if (!event_name) return Response.json({ error: "event_name required" }, { status: 400 });

    const ua = request.headers.get("user-agent") || "";
    const referrer = body.referrer || request.headers.get("referer") || "";
    const host = request.headers.get("host") || "";
    const { device, browser, os } = parseUA(ua);
    // Vercel/edge geo headers when present
    const geoCountry = country || request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry") || null;
    const geoCity = city || request.headers.get("x-vercel-ip-city") || null;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    await supabase.from("analytics_events").insert({
      event_name: String(event_name).slice(0, 60),
      path: path ? String(path).slice(0, 300) : null,
      referrer: referrer ? String(referrer).slice(0, 300) : null,
      traffic_source: classifyReferrer(referrer, host),
      session_id: session_id ? String(session_id).slice(0, 64) : null,
      user_id: user_id || null,
      country: geoCountry, city: geoCity,
      device, browser, os,
      value: value != null ? Number(value) : null,
      metadata: metadata || null,
    });

    return Response.json({ ok: true });
  } catch {
    // Analytics must never surface errors to the visitor
    return Response.json({ ok: false });
  }
}
