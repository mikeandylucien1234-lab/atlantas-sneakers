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

const PAYMENT_SELECT = `*,
  order:orders(id, order_number, total, status, shipping_address),
  customer:profiles!payments_user_id_fkey(id, full_name, email)`;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const sp = request.nextUrl.searchParams;
    const section = sp.get("section") || "list";

    if (section === "kpis") {
      const kpis = await safeQuery(async () => {
        const [paymentsRes, refundsRes] = await Promise.all([
          supabase.from("payments").select("id, gateway, amount, fee_amount, net_amount, status, created_at"),
          supabase.from("refunds").select("id, amount, status, type, created_at"),
        ]);
        const rows = paymentsRes.data || [];
        const refunds = refundsRes.data || [];
        const today = new Date(); today.setHours(0, 0, 0, 0);

        const paid = rows.filter(r => r.status === "paid");
        const totalRevenue = paid.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const totalFees = paid.reduce((s, r) => s + (Number(r.fee_amount) || 0), 0);
        const todayRevenue = paid.filter(r => new Date(r.created_at) >= today).reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const refundedAmount = refunds.filter(r => r.status === "completed").reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const chargebacks = refunds.filter(r => r.type === "chargeback").length;

        // Gateway performance
        const byGateway = {};
        rows.forEach(r => {
          if (!byGateway[r.gateway]) byGateway[r.gateway] = { total: 0, paid: 0, revenue: 0 };
          byGateway[r.gateway].total++;
          if (r.status === "paid") { byGateway[r.gateway].paid++; byGateway[r.gateway].revenue += Number(r.amount) || 0; }
        });
        const gatewayPerformance = Object.entries(byGateway).map(([gateway, g]) => ({
          gateway, total: g.total, paid: g.paid,
          successRate: g.total ? Math.round((g.paid / g.total) * 100) : 0,
          revenue: Math.round(g.revenue * 100) / 100,
        })).sort((a, b) => b.revenue - a.revenue);

        return {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          todayRevenue: Math.round(todayRevenue * 100) / 100,
          pending: rows.filter(r => r.status === "pending").length,
          completed: paid.length,
          failed: rows.filter(r => r.status === "failed").length,
          refunded: rows.filter(r => r.status === "refunded").length,
          chargebacks,
          avgOrderValue: paid.length ? Math.round((totalRevenue / paid.length) * 100) / 100 : 0,
          netRevenue: Math.round((totalRevenue - totalFees - refundedAmount) * 100) / 100,
          totalFees: Math.round(totalFees * 100) / 100,
          refundedAmount: Math.round(refundedAmount * 100) / 100,
          gatewayPerformance,
        };
      }, { totalRevenue: 0, todayRevenue: 0, pending: 0, completed: 0, failed: 0, refunded: 0, chargebacks: 0, avgOrderValue: 0, netRevenue: 0, totalFees: 0, refundedAmount: 0, gatewayPerformance: [] });
      return Response.json(kpis);
    }

    if (section === "list") {
      const page = parseInt(sp.get("page") || "1", 10);
      const per_page = parseInt(sp.get("per_page") || "20", 10);
      const search = sp.get("search");
      const status = sp.get("status");
      const gateway = sp.get("gateway");
      const from_date = sp.get("from");
      const to_date = sp.get("to");

      const result = await safeQuery(async () => {
        let query = supabase.from("payments").select(PAYMENT_SELECT, { count: "exact" });
        if (status) query = query.eq("status", status);
        if (gateway) query = query.eq("gateway", gateway);
        if (from_date) query = query.gte("created_at", from_date);
        if (to_date) query = query.lte("created_at", `${to_date}T23:59:59`);
        if (search) query = query.or(`transaction_id.ilike.%${search}%,merchant_reference.ilike.%${search}%,id.eq.${/^[0-9a-f-]{36}$/.test(search) ? search : "00000000-0000-0000-0000-000000000000"}`);
        query = query.order("created_at", { ascending: false });
        const from = (page - 1) * per_page;
        query = query.range(from, from + per_page - 1);
        const { data, count } = await query;
        return { payments: data || [], total: count || 0, page, per_page, totalPages: Math.ceil((count || 0) / per_page) };
      }, { payments: [], total: 0, page, per_page, totalPages: 0 });
      return Response.json(result);
    }

    if (section === "detail") {
      const id = sp.get("id");
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const detail = await safeQuery(async () => {
        const [payRes, logsRes] = await Promise.all([
          supabase.from("payments").select(PAYMENT_SELECT).eq("id", id).single(),
          supabase.from("payment_logs").select("*").eq("payment_id", id).order("created_at", { ascending: true }),
        ]);
        if (!payRes.data) return null;
        const { data: refunds } = await supabase.from("refunds").select("*").eq("order_id", payRes.data.order_id).order("created_at", { ascending: false });
        // fraud context: other payments from same user
        let customerStats = null;
        if (payRes.data.user_id) {
          const { data: history } = await supabase.from("payments").select("id, status, amount, created_at").eq("user_id", payRes.data.user_id);
          const h = history || [];
          customerStats = {
            total: h.length,
            failed: h.filter(x => x.status === "failed").length,
            lifetime: Math.round(h.filter(x => x.status === "paid").reduce((s, x) => s + (Number(x.amount) || 0), 0) * 100) / 100,
          };
        }
        return { ...payRes.data, logs: logsRes.data || [], refunds: refunds || [], customerStats };
      }, null);
      if (!detail) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json(detail);
    }

    if (section === "analytics") {
      const analytics = await safeQuery(async () => {
        const [paymentsRes, refundsRes] = await Promise.all([
          supabase.from("payments").select("gateway, amount, fee_amount, currency, country, status, created_at"),
          supabase.from("refunds").select("amount, status, type, created_at"),
        ]);
        const rows = paymentsRes.data || [];
        const refunds = refundsRes.data || [];
        const paid = rows.filter(r => r.status === "paid");

        const monthly = {};
        paid.forEach(r => {
          const m = new Date(r.created_at).toISOString().slice(0, 7);
          if (!monthly[m]) monthly[m] = { revenue: 0, fees: 0, count: 0 };
          monthly[m].revenue += Number(r.amount) || 0;
          monthly[m].fees += Number(r.fee_amount) || 0;
          monthly[m].count++;
        });
        const refundMonthly = {};
        refunds.filter(r => r.status === "completed").forEach(r => {
          const m = new Date(r.created_at).toISOString().slice(0, 7);
          refundMonthly[m] = (refundMonthly[m] || 0) + (Number(r.amount) || 0);
        });

        const byGateway = {}; const byCountry = {}; const byCurrency = {};
        paid.forEach(r => {
          byGateway[r.gateway] = (byGateway[r.gateway] || 0) + (Number(r.amount) || 0);
          if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + (Number(r.amount) || 0);
          byCurrency[r.currency || "USD"] = (byCurrency[r.currency || "USD"] || 0) + (Number(r.amount) || 0);
        });

        const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }));

        return {
          monthly: Object.entries(monthly).sort().map(([month, m]) => ({ month, revenue: Math.round(m.revenue * 100) / 100, fees: Math.round(m.fees * 100) / 100, refunds: Math.round((refundMonthly[month] || 0) * 100) / 100, count: m.count })),
          gateways: top(byGateway),
          countries: top(byCountry),
          currencies: top(byCurrency),
          chargebacks: refunds.filter(r => r.type === "chargeback").length,
        };
      }, { monthly: [], gateways: [], countries: [], currencies: [], chargebacks: 0 });
      return Response.json(analytics);
    }

    if (section === "export") {
      const data = await safeQuery(async () => {
        const { data: rows } = await supabase.from("payments").select(PAYMENT_SELECT).order("created_at", { ascending: false }).limit(2000);
        return rows || [];
      }, []);
      return Response.json({ payments: data });
    }

    return Response.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Payments API GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const actor = auth.profile?.full_name || auth.profile?.email || "Admin";

    const body = await request.json();
    const { id, action } = body;
    if (!id || !action) return Response.json({ error: "id and action required" }, { status: 400 });

    const { data: payment } = await supabase.from("payments").select("*").eq("id", id).single();
    if (!payment) return Response.json({ error: "Payment not found" }, { status: 404 });
    const now = new Date().toISOString();

    const log = (event_type, response) =>
      supabase.from("payment_logs").insert({ payment_id: id, gateway: payment.gateway, event_type, response: { ...response, actor } });

    if (action === "capture") {
      if (payment.status !== "pending") return Response.json({ error: "Only pending payments can be captured" }, { status: 400 });
      await supabase.from("payments").update({ status: "paid", updated_at: now }).eq("id", id);
      await supabase.from("orders").update({ payment_status: "paid", status: "confirmed" }).eq("id", payment.order_id);
      await log("payment.captured", { manual: true });
      return Response.json({ success: true });
    }

    if (action === "cancel") {
      if (!["pending", "failed"].includes(payment.status)) return Response.json({ error: "Only pending or failed payments can be cancelled" }, { status: 400 });
      await supabase.from("payments").update({ status: "cancelled", updated_at: now }).eq("id", id);
      await log("payment.cancelled", { manual: true });
      return Response.json({ success: true });
    }

    if (action === "retry") {
      if (payment.status !== "failed") return Response.json({ error: "Only failed payments can be retried" }, { status: 400 });
      await supabase.from("payments").update({ status: "pending", updated_at: now }).eq("id", id);
      await log("payment.retry", { manual: true });
      return Response.json({ success: true });
    }

    if (action === "refund") {
      // Route through the single official refund flow (REAL Stripe refund for
      // card payments). No fake DB-only "refunded" here.
      if (!payment.order_id) return Response.json({ error: "Payment has no associated order" }, { status: 400 });
      const { refundOrder } = await import("@/lib/payments/payment-service");
      const result = await refundOrder(payment.order_id, { amount: body.amount != null ? Number(body.amount) : undefined, reason: body.reason || "Admin refund" });
      if (!result.success) return Response.json({ error: result.error }, { status: 400 });
      await log("payment.refunded", { amount: result.amount, type: result.type, refundId: result.refundId, manual: result.manual, reason: body.reason || null });
      return Response.json({ success: true, refundId: result.refundId, amount: result.amount, type: result.type, manual: result.manual });
    }

    if (action === "resend_receipt") {
      await log("receipt.resent", { to: body.email || "customer email" });
      return Response.json({ success: true, message: "Receipt resend logged" });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Payments API PUT error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
