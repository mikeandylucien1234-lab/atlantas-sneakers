// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";

const DAY = 24 * 3600 * 1000;
function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }

function applyFilters(q, sp) {
  const module = sp.get("module"); if (module && module !== "all") q = q.eq("module", module);
  const type = sp.get("type"); if (type && type !== "all") q = q.eq("activity_type", type);
  const status = sp.get("status"); if (status && status !== "all") q = q.eq("status", status);
  const priority = sp.get("priority"); if (priority && priority !== "all") q = q.eq("priority", priority);
  const country = sp.get("country"); if (country) q = q.ilike("country", `%${country}%`);
  const from = sp.get("from"); if (from) q = q.gte("created_at", from);
  const search = sp.get("q"); if (search) q = q.or(`actor_name.ilike.%${search}%,action.ilike.%${search}%,description.ilike.%${search}%`);
  return q;
}
async function overlay(s, adminId, rows) {
  // attach pinned/favorited flags for this admin
  const ids = rows.map(r => r.id);
  if (!ids.length) return rows;
  const [{ data: pins }, { data: favs }] = await Promise.all([
    s.from("activity_pins").select("activity_id").eq("admin_id", adminId).in("activity_id", ids),
    s.from("activity_favorites").select("activity_id").eq("admin_id", adminId).in("activity_id", ids),
  ]);
  const P = new Set((pins || []).map(x => x.activity_id)); const F = new Set((favs || []).map(x => x.activity_id));
  return rows.map(r => ({ ...r, pinned: P.has(r.id), favorite: F.has(r.id) }));
}

export async function GET(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("logs.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const sp = request.nextUrl.searchParams; const adminId = auth.profile.id;

  try {
    if (action === "dashboard") {
      const now = Date.now();
      const dayAgo = new Date(now - DAY).toISOString(), weekAgo = new Date(now - 7 * DAY).toISOString(), monthAgo = new Date(now - 30 * DAY).toISOString();
      // Real business counts, computed directly against source tables
      const cnt = (tbl, since, extra) => { let q = s.from(tbl).select("id", { count: "exact", head: true }).gte("created_at", since); if (extra) q = extra(q); return q; };
      const [stream, ordersToday, ordersPending, ordersFailed, custMonth, prodMonth, revMonth, payMonth, payFailed, activeUsers] = await Promise.all([
        s.from("activity_stream").select("module, activity_type, status, priority, created_at, actor_id").gte("created_at", monthAgo).limit(20000),
        cnt("orders", dayAgo),
        s.from("orders").select("id", { count: "exact", head: true }).neq("payment_status", "paid"),
        s.from("orders").select("id", { count: "exact", head: true }).eq("status", "cancelled").gte("created_at", monthAgo),
        s.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").gte("created_at", monthAgo),
        cnt("products", monthAgo),
        cnt("reviews", monthAgo),
        cnt("payments", monthAgo),
        s.from("payments").select("id", { count: "exact", head: true }).in("status", ["failed", "declined"]).gte("created_at", monthAgo),
        s.from("login_history").select("user_id").eq("status", "success").gte("created_at", dayAgo).limit(5000),
      ]);
      const S = stream.data || [];
      const inRange = (since) => S.filter(x => x.created_at >= since);
      const cntType = (t, since) => S.filter(x => x.activity_type === t && x.created_at >= since).length;
      // timeline + heatmap
      const days = {}; for (let i = 13; i >= 0; i--) { const d = new Date(now - i * DAY).toISOString().slice(0, 10); days[d] = { date: d, count: 0 }; }
      const heat = {}; for (let dd = 0; dd < 7; dd++) for (let h = 0; h < 24; h++) heat[`${dd}-${h}`] = 0;
      const byModule = {};
      S.forEach(x => { const d = (x.created_at || "").slice(0, 10); if (days[d]) days[d].count++; const dt = new Date(x.created_at); const hk = `${dt.getDay()}-${dt.getHours()}`; if (heat[hk] != null) heat[hk]++; byModule[x.module] = (byModule[x.module] || 0) + 1; });
      return Response.json({
        kpis: {
          today: inRange(dayAgo).length, week: inRange(weekAgo).length, month: S.length,
          activeUsers: new Set((activeUsers.data || []).map(x => x.user_id)).size,
          activeStaff: new Set(S.filter(x => x.actor_id).map(x => x.actor_id)).size,
          newOrders: ordersToday.count || 0, newCustomers: custMonth.count || 0, newProducts: prodMonth.count || 0,
          newReviews: revMonth.count || 0, newPayments: payMonth.count || 0,
          refundRequests: cntType("refund", monthAgo), couponsUsed: cntType("coupon", monthAgo),
          blogsPublished: cntType("blog", monthAgo), failedPayments: payFailed.count || 0,
          pendingOrders: ordersPending.count || 0, cancelledOrders: ordersFailed.count || 0,
        },
        series: Object.values(days), heatmap: heat,
        byModule: Object.entries(byModule).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12),
      });
    }

    if (action === "list" || action === "live") {
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
      const size = action === "live" ? 25 : Math.min(50, parseInt(sp.get("pageSize") || "30", 10));
      const from = (page - 1) * size;
      let q = s.from("activity_stream").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (action === "live") q = q.gte("created_at", sp.get("since") || new Date(Date.now() - 5 * 60000).toISOString());
      else q = applyFilters(q, sp).range(from, from + size - 1);
      const { data, count } = await q;
      let rows = await overlay(s, adminId, data || []);
      // pinned filter / show pinned first on first page
      if (sp.get("pinned") === "1") rows = rows.filter(r => r.pinned);
      if (sp.get("favorite") === "1") rows = rows.filter(r => r.favorite);
      return Response.json({ activities: rows, total: count || 0, page, pageSize: size });
    }

    if (action === "pinned") {
      const { data: pins } = await s.from("activity_pins").select("activity_id").eq("admin_id", adminId).order("created_at", { ascending: false }).limit(50);
      const ids = (pins || []).map(x => x.activity_id);
      if (!ids.length) return Response.json({ activities: [] });
      const { data } = await s.from("activity_stream").select("*").in("id", ids);
      return Response.json({ activities: (data || []).map(r => ({ ...r, pinned: true })) });
    }

    if (action === "detail") {
      const id = sp.get("id");
      const { data } = await s.from("activity_stream").select("*").eq("id", id).maybeSingle();
      if (!data) return Response.json({ error: "Not found" }, { status: 404 });
      const [{ data: comments }, { data: context }, pinFav] = await Promise.all([
        s.from("activity_comments").select("*").eq("activity_id", id).order("created_at", { ascending: false }),
        data.actor_id ? s.from("activity_stream").select("id, action, module, status, created_at").eq("actor_id", data.actor_id).order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [] }),
        overlay(s, adminId, [data]),
      ]);
      return Response.json({ activity: pinFav[0], comments: comments || [], context: context || [] });
    }

    if (action === "export") {
      const fmt = sp.get("format") || "csv";
      let q = s.from("activity_stream").select("created_at, module, activity_type, action, description, status, priority, actor_name, country").order("created_at", { ascending: false }).limit(20000);
      q = applyFilters(q, sp);
      const { data } = await q; const rows = data || [];
      if (fmt === "json") return new Response(JSON.stringify(rows, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="activity.json"' } });
      const header = "Date,Module,Type,Action,Description,Status,Priority,Actor,Country\n";
      const body = rows.map(r => [r.created_at, r.module, r.activity_type, r.action, r.description, r.status, r.priority, r.actor_name, r.country].map(v => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
      return new Response(header + body, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="activity.csv"' } });
    }

    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("logs.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const adminId = auth.profile.id; const b = await request.json().catch(() => ({}));
  if (!b.activity_id && action !== "log") return Response.json({ error: "activity_id required" }, { status: 400 });

  try {
    if (action === "pin") {
      if (b.on === false) await s.from("activity_pins").delete().eq("activity_id", b.activity_id).eq("admin_id", adminId);
      else await s.from("activity_pins").upsert({ activity_id: b.activity_id, admin_id: adminId }, { onConflict: "activity_id,admin_id" });
      return Response.json({ ok: true });
    }
    if (action === "favorite") {
      if (b.on === false) await s.from("activity_favorites").delete().eq("activity_id", b.activity_id).eq("admin_id", adminId);
      else await s.from("activity_favorites").upsert({ activity_id: b.activity_id, admin_id: adminId }, { onConflict: "activity_id,admin_id" });
      return Response.json({ ok: true });
    }
    if (action === "comment") {
      if (!b.note) return Response.json({ error: "note required" }, { status: 400 });
      const { data, error } = await s.from("activity_comments").insert({ activity_id: b.activity_id, admin_id: adminId, admin_name: auth.profile.full_name || auth.profile.email, note: b.note }).select("*").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ comment: data });
    }
    if (action === "comment-delete") {
      await s.from("activity_comments").delete().eq("id", b.id).eq("admin_id", adminId);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
