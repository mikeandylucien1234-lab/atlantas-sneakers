import { createClient } from "@supabase/supabase-js";
import { generateIdempotencyKey } from "./security";

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

export async function processRefund(
  paymentId: string,
  amount: number,
  reason: string,
  type: "full" | "partial" = "full"
): Promise<{ success: boolean; error?: string }> {
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single();

  if (!payment) return { success: false, error: "Payment not found" };
  if (payment.status !== "paid") return { success: false, error: "Payment not eligible for refund" };

  const { data: refund, error } = await supabaseAdmin
    .from("refunds")
    .insert({
      payment_id: paymentId,
      order_id: payment.order_id,
      amount,
      type,
      reason,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  // TODO: Integrate with payment gateway (Stripe, MonCash, NatCash) to actually
  // process the refund. Do not mark as "completed" or update payment to "refunded"
  // until the gateway confirms the refund has been processed.

  await logPaymentEvent({
    paymentId,
    gateway: payment.gateway,
    eventType: "refund.initiated",
    request: { refundId: refund!.id, amount, reason, type },
  });

  return { success: true };
}

export { supabaseAdmin };
