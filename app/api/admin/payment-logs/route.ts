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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const sp = request.nextUrl.searchParams;
    const section = sp.get("section") || "list";

    if (section === "kpis") {
      const kpis = await safeQuery(async () => {
        const { data } = await supabase
          .from("payment_logs")
          .select("id, gateway, event_type, status_code, latency_ms, error, created_at")
          .order("created_at", { ascending: false })
          .limit(5000);
        const rows = data || [];
        const isWebhook = r => (r.event_type || "").startsWith("webhook");
        const failed = rows.filter(r => r.error || (r.status_code && r.status_code >= 400));
        const latencies = rows.filter(r => r.latency_ms != null).map(r => r.latency_ms);
        const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
        const p95 = latencies.length ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] : 0;
        return {
          total: rows.length,
          webhookEvents: rows.filter(isWebhook).length,
          apiCalls: rows.filter(r => !isWebhook(r)).length,
          gatewayErrors: failed.length,
          timeouts: rows.filter(r => (r.error || "").toLowerCase().includes("timeout") || r.status_code === 408 || r.status_code === 504).length,
          retries: rows.filter(r => (r.event_type || "").includes("retry")).length,
          successful: rows.filter(r => !r.error && (!r.status_code || r.status_code < 400)).length,
          failed: failed.length,
          avgLatency,
          p95Latency: p95,
        };
      }, { total: 0, webhookEvents: 0, apiCalls: 0, gatewayErrors: 0, timeouts: 0, retries: 0, successful: 0, failed: 0, avgLatency: 0, p95Latency: 0 });
      return Response.json(kpis);
    }

    if (section === "list") {
      const page = parseInt(sp.get("page") || "1", 10);
      const per_page = parseInt(sp.get("per_page") || "25", 10);
      const gateway = sp.get("gateway");
      const event = sp.get("event"); // webhook | api | retry
      const status = sp.get("status"); // success | error | 4xx | 5xx
      const code = sp.get("code");
      const search = sp.get("search");

      const result = await safeQuery(async () => {
        let query = supabase.from("payment_logs").select("*", { count: "exact" });
        if (gateway) query = query.eq("gateway", gateway);
        if (event === "webhook") query = query.like("event_type", "webhook%");
        else if (event === "retry") query = query.like("event_type", "%retry%");
        else if (event === "api") query = query.not("event_type", "like", "webhook%");
        if (status === "error") query = query.or("error.not.is.null,status_code.gte.400");
        else if (status === "success") query = query.is("error", null).or("status_code.is.null,status_code.lt.400");
        if (code) query = query.eq("status_code", parseInt(code));
        if (search) query = query.or(`event_type.ilike.%${search}%,error.ilike.%${search}%,ip_address.ilike.%${search}%`);
        query = query.order("created_at", { ascending: false });
        const from = (page - 1) * per_page;
        query = query.range(from, from + per_page - 1);
        const { data, count } = await query;
        return { logs: data || [], total: count || 0, page, per_page, totalPages: Math.ceil((count || 0) / per_page) };
      }, { logs: [], total: 0, page, per_page, totalPages: 0 });
      return Response.json(result);
    }

    if (section === "detail") {
      const id = sp.get("id");
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const detail = await safeQuery(async () => {
        const { data: log } = await supabase.from("payment_logs").select("*").eq("id", id).single();
        if (!log) return null;
        // Related logs: same payment
        let related = [];
        if (log.payment_id) {
          const { data: rel } = await supabase.from("payment_logs").select("id, event_type, status_code, error, created_at").eq("payment_id", log.payment_id).neq("id", id).order("created_at", { ascending: true });
          related = rel || [];
        }
        let payment = null;
        if (log.payment_id) {
          const { data: pay } = await supabase.from("payments").select("id, gateway, amount, currency, status, transaction_id, order:orders(order_number)").eq("id", log.payment_id).single();
          payment = pay;
        }
        return { ...log, related, payment };
      }, null);
      if (!detail) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json(detail);
    }

    if (section === "health") {
      const health = await safeQuery(async () => {
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { data } = await supabase
          .from("payment_logs")
          .select("gateway, event_type, status_code, latency_ms, error, created_at")
          .gte("created_at", since);
        const rows = data || [];
        const byGateway = {};
        rows.forEach(r => {
          if (!byGateway[r.gateway]) byGateway[r.gateway] = { total: 0, errors: 0, latencies: [], lastEvent: null };
          const g = byGateway[r.gateway];
          g.total++;
          if (r.error || (r.status_code && r.status_code >= 400)) g.errors++;
          if (r.latency_ms != null) g.latencies.push(r.latency_ms);
          if (!g.lastEvent || r.created_at > g.lastEvent) g.lastEvent = r.created_at;
        });
        return Object.entries(byGateway).map(([gateway, g]) => {
          const errorRate = g.total ? Math.round((g.errors / g.total) * 100) : 0;
          return {
            gateway, total: g.total, errors: g.errors, errorRate,
            avgLatency: g.latencies.length ? Math.round(g.latencies.reduce((a, b) => a + b, 0) / g.latencies.length) : null,
            lastEvent: g.lastEvent,
            status: errorRate >= 50 ? "down" : errorRate >= 15 ? "degraded" : "healthy",
          };
        }).sort((a, b) => b.total - a.total);
      }, []);
      return Response.json({ health });
    }

    if (section === "export") {
      const data = await safeQuery(async () => {
        const { data: rows } = await supabase.from("payment_logs").select("*").order("created_at", { ascending: false }).limit(2000);
        return rows || [];
      }, []);
      return Response.json({ logs: data });
    }

    return Response.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Payment logs API GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const actor = auth.profile?.full_name || auth.profile?.email || "Admin";

    const body = await request.json();

    if (body.action === "retry") {
      const { id } = body;
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const { data: log } = await supabase.from("payment_logs").select("*").eq("id", id).single();
      if (!log) return Response.json({ error: "Log not found" }, { status: 404 });

      // Re-verify the payment state and record a retry entry in the log stream
      let outcome = { requeued: true };
      if (log.payment_id) {
        const { data: payment } = await supabase.from("payments").select("id, status, gateway").eq("id", log.payment_id).single();
        outcome.payment_status = payment?.status || "unknown";
      }
      const { data: entry, error } = await supabase.from("payment_logs").insert({
        payment_id: log.payment_id, gateway: log.gateway,
        event_type: `${log.event_type}.retry`,
        request: { retried_log_id: id, actor },
        response: outcome,
        ip_address: request.headers.get("x-forwarded-for") ?? null,
      }).select().single();
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ success: true, entry });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Payment logs API POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
