import { NextRequest } from "next/server";
import { verifyWebhookSignature, validatePaymentAmount, checkReplayAttack } from "@/lib/payments/security";
import { updatePaymentStatus, logPaymentEvent, supabaseAdmin } from "@/lib/payments/payment-service";
import { processPostPayment } from "@/lib/payments/post-payment";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-moncash-signature") ?? "";
  const secret = process.env.MONCASH_WEBHOOK_SECRET!;

  if (!secret) {
    console.error("MONCASH_WEBHOOK_SECRET is not configured");
    return Response.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  if (!verifyWebhookSignature(body, signature, secret)) {
    await logPaymentEvent({
      gateway: "moncash",
      eventType: "webhook.signature_failed",
      request: { body: body.slice(0, 500) },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const event = JSON.parse(body);
    const { transactionId, orderId, amount, timestamp } = event;

    if (timestamp && !checkReplayAttack(timestamp)) {
      return Response.json({ error: "Replay attack detected" }, { status: 400 });
    }

    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("*, order:orders(total)")
      .eq("id", orderId)
      .single();

    if (!payment) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "paid") {
      return Response.json({ received: true, duplicate: true });
    }

    if (!validatePaymentAmount(payment.amount, amount)) {
      await updatePaymentStatus(payment.id, "failed", {
        gateway_response: event,
        webhook_received_at: new Date().toISOString(),
      });
      return Response.json({ error: "Amount mismatch" }, { status: 400 });
    }

    await processPostPayment({
      orderId: payment.order_id,
      paymentId: payment.id,
      userId: payment.user_id,
      gateway: "moncash",
      transactionId: String(transactionId),
      amount: payment.amount,
      currency: "HTG",
    });

    await logPaymentEvent({
      paymentId: payment.id,
      gateway: "moncash",
      eventType: "webhook.success",
      response: event,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return Response.json({ received: true });
  } catch (err) {
    console.error("MonCash webhook error:", err);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
