import { createClient } from "@supabase/supabase-js";
import { generateIdempotencyKey } from "./security";
import { stripe } from "@/lib/stripe";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type Gateway = "stripe" | "moncash" | "natcash" | "cod" | "bank_transfer";

export type PaymentStatus = "pending" | "processing" | "paid" | "failed" | "refunded" | "cancelled";

export type OrderData = {
  orderId: string;
  userId: string | null;
  amount: number;
  currency: string;
  gateway: Gateway;
};

export type PaymentResult = {
  success: boolean;
  paymentId?: string;
  redirectUrl?: string;
  transactionId?: string;
  error?: string;
};

export async function createPaymentRecord(data: OrderData): Promise<string> {
  const idempotencyKey = generateIdempotencyKey(data.orderId, data.gateway);
  const { data: existing } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .single();

  if (existing) return existing.id;

  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .insert({
      order_id: data.orderId,
      user_id: data.userId,
      gateway: data.gateway,
      amount: data.amount,
      currency: data.currency,
      status: "pending",
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create payment: ${error.message}`);
  return payment!.id;
}

export async function updatePaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("payments")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", paymentId);
  if (error) throw new Error(`Failed to update payment status: ${error.message}`);
}

export async function logPaymentEvent(data: {
  paymentId?: string;
  gateway: string;
  eventType: string;
  request?: unknown;
  response?: unknown;
  ipAddress?: string;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
}): Promise<void> {
  await supabaseAdmin.from("payment_logs").insert({
    payment_id: data.paymentId ?? null,
    gateway: data.gateway,
    event_type: data.eventType,
    request: data.request ?? null,
    response: data.response ?? null,
    ip_address: data.ipAddress ?? null,
    status_code: data.statusCode ?? null,
    latency_ms: data.latencyMs ?? null,
    error: data.error ?? null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SINGLE OFFICIAL REFUND FLOW.
// Every refund (Order Detail button, Payments module, /api/refunds) MUST go
// through refundOrder(). It performs a REAL Stripe refund for card payments and
// never marks the order refunded unless the gateway confirms it. Non-card
// gateways (MonCash/NatCash/COD/bank) are refunded manually off-platform and are
// recorded truthfully as manual refunds.
// ─────────────────────────────────────────────────────────────────────────────
export type RefundResult = {
  success: boolean;
  error?: string;
  refundId?: string;   // Stripe Refund ID (re_...) for card refunds
  amount?: number;
  type?: "full" | "partial";
  manual?: boolean;
};

export async function refundOrder(
  orderId: string,
  opts: { amount?: number; reason?: string } = {}
): Promise<RefundResult> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, total, payment_status, stripe_payment_intent_id")
    .eq("id", orderId)
    .single();
  if (!order) return { success: false, error: "Order not found" };
  if (order.payment_status === "refunded") return { success: false, error: "Order already fully refunded" };

  // Pick the settled payment for this order (prefer paid/completed).
  const { data: payments } = await supabaseAdmin
    .from("payments").select("*").eq("order_id", orderId).order("created_at", { ascending: false });
  const payment = (payments || []).find((p) => ["paid", "completed"].includes(p.status)) || (payments || [])[0];
  if (!payment) return { success: false, error: "No payment found for this order" };
  if (!["paid", "completed"].includes(payment.status)) return { success: false, error: "Payment not eligible for refund" };

  const paidAmount = Number(payment.amount || order.total || 0);

  // Anti-double-refund: never refund more than what remains.
  const { data: priorRefunds } = await supabaseAdmin.from("refunds").select("amount, status").eq("order_id", orderId);
  const alreadyRefunded = (priorRefunds || []).filter((r) => r.status === "completed").reduce((s, r) => s + Number(r.amount || 0), 0);
  const remaining = Math.round((paidAmount - alreadyRefunded) * 100) / 100;
  if (remaining <= 0) return { success: false, error: "Order already fully refunded" };

  const refundAmount = opts.amount != null ? Number(opts.amount) : remaining;
  if (!(refundAmount > 0)) return { success: false, error: "Invalid refund amount" };
  if (refundAmount - remaining > 0.001) return { success: false, error: `Refund exceeds remaining refundable amount ($${remaining.toFixed(2)})` };
  const type: "full" | "partial" = (alreadyRefunded + refundAmount >= paidAmount - 0.001) ? "full" : "partial";
  const reason = opts.reason || "Admin refund";

  // Audit row FIRST, as 'pending'. Only flips to 'completed' if the gateway confirms.
  const { data: refundRow, error: insErr } = await supabaseAdmin
    .from("refunds")
    .insert({ payment_id: payment.id, order_id: orderId, amount: refundAmount, type, reason, status: "pending" })
    .select("id").single();
  if (insErr) return { success: false, error: insErr.message };

  const markRefundedIfFull = async () => {
    if (type === "full") {
      await supabaseAdmin.from("payments").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", payment.id);
      await supabaseAdmin.from("orders").update({ payment_status: "refunded" }).eq("id", orderId);
    }
  };

  if (payment.gateway === "stripe") {
    const pi = order.stripe_payment_intent_id || payment.transaction_id;
    if (!pi) {
      await supabaseAdmin.from("refunds").update({ status: "failed" }).eq("id", refundRow!.id);
      return { success: false, error: "Missing Stripe PaymentIntent for this order" };
    }
    try {
      // Idempotency keyed on order+amount so a double-click can never create two
      // Stripe refunds — Stripe returns the same refund for a repeated key.
      const refund = await stripe.refunds.create(
        {
          payment_intent: pi,
          amount: Math.round(refundAmount * 100),
          reason: "requested_by_customer",
          metadata: { order_id: orderId, order_number: order.order_number, refund_row: refundRow!.id },
        },
        { idempotencyKey: `refund_${orderId}_${Math.round(refundAmount * 100)}` }
      );

      if (refund.status === "failed" || refund.status === "canceled") {
        await supabaseAdmin.from("refunds").update({ status: "failed", gateway_refund_id: refund.id }).eq("id", refundRow!.id);
        await logPaymentEvent({ paymentId: payment.id, gateway: "stripe", eventType: "refund.failed", response: { id: refund.id, status: refund.status } });
        return { success: false, error: `Stripe refund ${refund.status}` };
      }

      await supabaseAdmin.from("refunds").update({ status: "completed", gateway_refund_id: refund.id, processed_at: new Date().toISOString() }).eq("id", refundRow!.id);
      await markRefundedIfFull();
      await logPaymentEvent({ paymentId: payment.id, gateway: "stripe", eventType: "refund.completed", response: { id: refund.id, amount: refundAmount, status: refund.status } });
      return { success: true, refundId: refund.id, amount: refundAmount, type };
    } catch (e: any) {
      // Gateway refused/failed → keep everything as NOT refunded.
      await supabaseAdmin.from("refunds").update({ status: "failed" }).eq("id", refundRow!.id);
      await logPaymentEvent({ paymentId: payment.id, gateway: "stripe", eventType: "refund.error", error: e?.raw?.message || e?.message });
      return { success: false, error: e?.raw?.message || e?.message || "Stripe refund failed" };
    }
  }

  // Non-card gateways: the money is returned manually outside the platform.
  await supabaseAdmin.from("refunds").update({ status: "completed", reason: `${reason} (manual ${payment.gateway})`, processed_at: new Date().toISOString() }).eq("id", refundRow!.id);
  await markRefundedIfFull();
  await logPaymentEvent({ paymentId: payment.id, gateway: payment.gateway, eventType: "refund.manual", request: { amount: refundAmount } });
  return { success: true, manual: true, amount: refundAmount, type };
}

export { supabaseAdmin };
