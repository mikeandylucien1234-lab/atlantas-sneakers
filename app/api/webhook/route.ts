import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { finalizeStripeOrder, markManualFulfillment } from "@/lib/orders/fulfillment";

// Stripe webhook — a BACKUP path for order creation. The primary path is the
// client-driven /api/checkout/confirm route; both share finalizeStripeOrder and
// are idempotent, so whichever fires first creates the order and the other
// no-ops. This keeps orders reliable whether or not the confirm route runs
// (e.g. the browser closed, or the app was restarting when it tried).
//
// Every outcome — including a signature-verification failure, which is exactly
// what happens when the endpoint URL/secret registered in the Stripe Dashboard
// doesn't match STRIPE_WEBHOOK_SECRET on this server — is logged to
// payment_logs so it's visible from the admin/DB without needing Stripe
// Dashboard access. Before this, a misconfigured webhook failed completely
// silently (zero rows anywhere), which is what happened on Aug 24.
function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}
async function log(row: Record<string, unknown>) {
  try { const s = admin(); if (s) await s.from("payment_logs").insert({ gateway: "stripe", ...row }); } catch { /* never let logging break the webhook */ }
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    await log({ event_type: "missing_signature", status_code: 400, error: "No stripe-signature header", latency_ms: Date.now() - started });
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    // Never fail silently: this is the exact misconfiguration that made the
    // webhook a no-op backup during the Aug 24 incident.
    await log({ event_type: "config_error", status_code: 500, error: "STRIPE_WEBHOOK_SECRET is not set on the server", latency_ms: Date.now() - started });
    console.error("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured.");
    return Response.json({ error: "Webhook not configured on server" }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err);
    // A signature mismatch almost always means the secret registered in the
    // Stripe Dashboard for this endpoint doesn't match STRIPE_WEBHOOK_SECRET
    // here (or the endpoint URL itself is wrong/not registered at all).
    await log({ event_type: "signature_verification_failed", status_code: 400, error: err?.message || String(err), latency_ms: Date.now() - started });
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as any;
    try {
      const result = await finalizeStripeOrder(paymentIntent);
      if (result.created) {
        await markManualFulfillment(result.orderId);
        console.log(`Order ${result.orderNumber} created via webhook for ${paymentIntent.id}`);
      }
      await log({
        event_type: event.type, status_code: 200, latency_ms: Date.now() - started,
        response: { orderNumber: result.orderNumber, created: result.created, paymentIntentId: paymentIntent.id },
      });
    } catch (err: any) {
      console.error("Webhook processing error:", err);
      await log({ event_type: event.type, status_code: 500, error: err?.message || String(err), latency_ms: Date.now() - started, request: { paymentIntentId: paymentIntent?.id } });
      // Non-2xx tells Stripe to retry this delivery automatically.
      return Response.json({ error: "Processing failed" }, { status: 500 });
    }
  } else if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as any;
    console.error(`Payment failed: ${paymentIntent.id}`, paymentIntent.last_payment_error?.message);
    await log({ event_type: event.type, status_code: 200, error: paymentIntent.last_payment_error?.message || null, latency_ms: Date.now() - started, request: { paymentIntentId: paymentIntent?.id } });
  } else {
    await log({ event_type: event.type, status_code: 200, latency_ms: Date.now() - started });
  }

  return Response.json({ received: true });
}
