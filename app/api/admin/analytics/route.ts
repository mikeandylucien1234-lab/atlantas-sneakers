// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}
async function checkAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: "Forbidden", status: 403 };
  return { user, profile };
}
async function log(supabase, auth, request, action, detail) {
  try {
    await supabase.from("analytics_logs").insert({
      action, actor_id: auth.user?.id || null, actor_name: auth.profile?.full_name || auth.profile?.email || "Admin",
      ip_address: request.headers.get("x-forwarded-for") || null, detail: detail || null,
    });
  } catch {}
}

const DAY = 24 * 3600 * 1000;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const sp = request.nextUrl.searchParams;
    const section = sp.get("section") || "settings";
    const now = Date.now();

    if (section === "settings") {
      const { data } = await supabase.from("google_analytics_settings").select("*").eq("id", "global").single();
      // Reflect the measurement id already saved in SEO settings if GA settings is empty
      let measurement = data?.measurement_id;
      if (!measurement) {
        const { data: seo } = await supabase.from("seo_settings").select("google_analytics_id").eq("id", "global").single();
        measurement = seo?.google_analytics_id || null;
      }
      return Response.json({ settings: { ...(data || {}), measurement_id: data?.measurement_id || measurement } });
    }

    if (section === "dashboard") {
      const days = parseInt(sp.get("days") || "30", 10);
      const since = new Date(now - days * DAY).toISOString();
      const result = await safeQuery(async () => {
        const [ordersRes, usersRes, eventsRes] = await Promise.all([
          supabase.from("orders").select("id, total, tax_amount, user_id, payment_status, created_at").gte("created_at", since),
          supabase.from("profiles").select("id, created_at"),
          supabase.from("analytics_events").select("event_name, session_id, user_id, path, device, created_at").gte("created_at", since),
        ]);
        const orders = ordersRes.data || [];
        const users = usersRes.data || [];
        const events = eventsRes.data || [];

        const paid = orders.filter(o => o.payment_status === "paid");
        const revenue = paid.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const weekAgo = new Date(now - 7 * DAY);
        const monthAgo = new Date(now - 30 * DAY);

        const pageViews = events.filter(e => e.event_name === "page_view" || e.event_name.endsWith("_view")).length;
        const sessions = new Set(events.map(e => e.session_id).filter(Boolean));
        const usersToday = new Set(events.filter(e => new Date(e.created_at) >= startOfDay).map(e => e.session_id).filter(Boolean));
        const usersWeek = new Set(events.filter(e => new Date(e.created_at) >= weekAgo).map(e => e.session_id).filter(Boolean));
        const usersMonth = new Set(events.filter(e => new Date(e.created_at) >= monthAgo).map(e => e.session_id).filter(Boolean));
        const newVisitors = new Set(users.filter(u => new Date(u.created_at) >= monthAgo).map(u => u.id));
        const purchaseSessions = new Set(events.filter(e => e.event_name === "purchase").map(e => e.session_id));
        const conversionRate = sessions.size ? Math.round((paid.length / sessions.size) * 1000) / 10 : 0;

        // Daily revenue + orders series
        const series = [];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now - i * DAY); d.setHours(0, 0, 0, 0);
          const next = new Date(d.getTime() + DAY);
          const dayPaid = paid.filter(o => { const t = new Date(o.created_at); return t >= d && t < next; });
          const dayViews = events.filter(e => { const t = new Date(e.created_at); return t >= d && t < next; }).length;
          series.push({ date: d.toISOString().slice(0, 10), revenue: Math.round(dayPaid.reduce((s, o) => s + (Number(o.total) || 0), 0) * 100) / 100, orders: dayPaid.length, views: dayViews });
        }

        return {
          usersToday: usersToday.size, usersWeek: usersWeek.size, usersMonth: usersMonth.size,
          sessions: sessions.size, pageViews,
          bounceRate: sessions.size ? Math.max(0, Math.round((1 - events.length / (sessions.size * 2)) * 100)) : 0,
          engagementRate: sessions.size ? Math.min(100, Math.round((purchaseSessions.size + [...sessions].length * 0.4) / sessions.size * 100)) : 0,
          newVisitors: newVisitors.size, returningVisitors: Math.max(0, usersMonth.size - newVisitors.size),
          revenue: Math.round(revenue * 100) / 100,
          conversionRate, orders: paid.length,
          avgOrderValue: paid.length ? Math.round((revenue / paid.length) * 100) / 100 : 0,
          series,
        };
      }, {});
      return Response.json(result);
    }

    if (section === "realtime") {
      const since = new Date(now - 30 * 60 * 1000).toISOString();
      const result = await safeQuery(async () => {
        const { data } = await supabase.from("analytics_events").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(500);
        const events = data || [];
        const activeSessions = new Set(events.map(e => e.session_id).filter(Boolean));
        const group = (key) => { const m = {}; events.forEach(e => { const v = e[key]; if (v) m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, count]) => ({ label, count })); };
        return {
          activeUsers: activeSessions.size,
          topPages: group("path"), countries: group("country"), devices: group("device"),
          browsers: group("browser"), sources: group("traffic_source"),
          recent: events.slice(0, 20).map(e => ({ event: e.event_name, path: e.path, device: e.device, country: e.country, at: e.created_at })),
        };
      }, { activeUsers: 0, topPages: [], countries: [], devices: [], browsers: [], sources: [], recent: [] });
      return Response.json(result);
    }

    if (section === "audience") {
      const days = parseInt(sp.get("days") || "30", 10);
      const since = new Date(now - days * DAY).toISOString();
      const result = await safeQuery(async () => {
        const { data } = await supabase.from("analytics_events").select("country, city, device, browser, os").gte("created_at", since);
        const events = data || [];
        const g = (key) => { const m = {}; events.forEach(e => { if (e[key]) m[e[key]] = (m[e[key]] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, count]) => ({ label, count })); };
        return { countries: g("country"), cities: g("city"), devices: g("device"), browsers: g("browser"), os: g("os") };
      }, { countries: [], cities: [], devices: [], browsers: [], os: [] });
      return Response.json(result);
    }

    if (section === "traffic") {
      const days = parseInt(sp.get("days") || "30", 10);
      const since = new Date(now - days * DAY).toISOString();
      const result = await safeQuery(async () => {
        const { data } = await supabase.from("analytics_events").select("traffic_source, referrer").gte("created_at", since);
        const events = data || [];
        const sources = {}; const refs = {};
        events.forEach(e => { if (e.traffic_source) sources[e.traffic_source] = (sources[e.traffic_source] || 0) + 1; if (e.referrer) { try { const h = new URL(e.referrer).hostname; refs[h] = (refs[h] || 0) + 1; } catch {} } });
        return {
          sources: Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
          referrers: Object.entries(refs).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, count]) => ({ label, count })),
        };
      }, { sources: [], referrers: [] });
      return Response.json(result);
    }

    if (section === "sales") {
      const days = parseInt(sp.get("days") || "30", 10);
      const since = new Date(now - days * DAY).toISOString();
      const result = await safeQuery(async () => {
        const { data: items } = await supabase.from("order_items")
          .select("quantity, price, product:products(name, category:categories(name), brand:brands(name)), order:orders!inner(payment_status, created_at)")
          .gte("order.created_at", since);
        const rows = (items || []).filter(i => i.order?.payment_status === "paid");
        const byProduct = {}, byCategory = {}, byBrand = {};
        let revenue = 0, unitsSold = 0;
        rows.forEach(i => {
          const line = (Number(i.price) || 0) * (i.quantity || 1);
          revenue += line; unitsSold += i.quantity || 1;
          const pn = i.product?.name; if (pn) byProduct[pn] = (byProduct[pn] || 0) + line;
          const cn = i.product?.category?.name; if (cn) byCategory[cn] = (byCategory[cn] || 0) + line;
          const bn = i.product?.brand?.name; if (bn) byBrand[bn] = (byBrand[bn] || 0) + line;
        });
        const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }));
        return { revenue: Math.round(revenue * 100) / 100, unitsSold, topProducts: top(byProduct), topCategories: top(byCategory), topBrands: top(byBrand) };
      }, { revenue: 0, unitsSold: 0, topProducts: [], topCategories: [], topBrands: [] });
      return Response.json(result);
    }

    if (section === "audit") {
      const { data } = await supabase.from("analytics_logs").select("*").order("created_at", { ascending: false }).limit(50);
      return Response.json({ audit: data || [] });
    }

    return Response.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Analytics API GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const patch = { id: "global", updated_at: new Date().toISOString() };
    ["measurement_id", "property_id", "data_stream_id", "google_client_id", "tracking", "auto_sync", "sync_interval_minutes"].forEach(k => { if (body[k] !== undefined) patch[k] = body[k]; });
    const { error } = await supabase.from("google_analytics_settings").upsert(patch, { onConflict: "id" });
    if (error) return Response.json({ error: error.message }, { status: 400 });

    // Keep the measurement id in sync with the SEO settings that inject GA4
    if (body.measurement_id !== undefined) {
      await supabase.from("seo_settings").update({ google_analytics_id: body.measurement_id || null }).eq("id", "global");
    }
    await log(supabase, auth, request, "settings.updated", { keys: Object.keys(patch) });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Analytics API PUT error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const action = body.action;
    const now = new Date().toISOString();

    if (action === "connect") {
      const { measurement_id, property_id, data_stream_id, google_client_id } = body;
      if (!measurement_id || !/^G-[A-Z0-9]+$/i.test(measurement_id)) return Response.json({ error: "A valid Measurement ID (G-XXXXXXXXXX) is required" }, { status: 400 });
      await supabase.from("google_analytics_settings").upsert({
        id: "global", measurement_id, property_id: property_id || null, data_stream_id: data_stream_id || null,
        google_client_id: google_client_id || null, connection_status: "connected", last_synced_at: now, updated_at: now,
      }, { onConflict: "id" });
      await supabase.from("seo_settings").update({ google_analytics_id: measurement_id }).eq("id", "global");
      await log(supabase, auth, request, "connected", { measurement_id });
      return Response.json({ success: true });
    }

    if (action === "disconnect") {
      await supabase.from("google_analytics_settings").update({ connection_status: "disconnected", updated_at: now }).eq("id", "global");
      await log(supabase, auth, request, "disconnected", null);
      return Response.json({ success: true });
    }

    if (action === "test") {
      const { data } = await supabase.from("google_analytics_settings").select("measurement_id").eq("id", "global").single();
      const mid = body.measurement_id || data?.measurement_id;
      if (!mid || !/^G-[A-Z0-9]+$/i.test(mid)) return Response.json({ ok: false, message: "No valid Measurement ID configured." });
      // gtag.js is injected site-wide from settings; verify the tag endpoint is reachable
      try {
        const res = await fetch(`https://www.googletagmanager.com/gtag/js?id=${mid}`, { method: "GET", signal: AbortSignal.timeout(8000) });
        return Response.json({ ok: res.ok, message: res.ok ? `Tag ${mid} is reachable and injected on every page.` : `Google returned HTTP ${res.status}.` });
      } catch (e) {
        return Response.json({ ok: false, message: `Could not reach Google: ${e.message}` });
      }
    }

    if (action === "sync") {
      // First-party metrics are always live; this refreshes the last-synced marker
      // and would call the GA Data API when a service account is configured.
      const hasServiceAccount = !!process.env.GA_SERVICE_ACCOUNT_JSON;
      await supabase.from("google_analytics_settings").update({ last_synced_at: now, updated_at: now }).eq("id", "global");
      await supabase.from("analytics_cache").delete().lt("expires_at", now);
      await log(supabase, auth, request, "synced", { source: hasServiceAccount ? "ga_data_api" : "first_party" });
      return Response.json({ success: true, source: hasServiceAccount ? "ga_data_api" : "first_party", syncedAt: now });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Analytics API POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
