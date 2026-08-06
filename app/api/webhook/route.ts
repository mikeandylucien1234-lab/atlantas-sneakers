import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { finalizeStripeOrder, dispatchSupplierOrders } from "@/lib/orders/fulfillment";

// Stripe webhook — a BACKUP path for order creation. The primary path is the
// client-driven /api/checkout/confirm route; both share finalizeStripeOrder and
// are idempotent, so whichever fires first creates the order and the other
// no-ops. This keeps orders reliable whether or not the webhook is configured.
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    try {
      const result = await finalizeStripeOrder(paymentIntent);
      if (result.created) {
        await dispatchSupplierOrders(result.orderId);
        console.log(`Order ${result.orderNumber} created via webhook for ${paymentIntent.id}`);
      }
    } catch (err) {
      console.error("Webhook processing error:", err);
      return Response.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object;
    console.error(`Payment failed: ${paymentIntent.id}`, paymentIntent.last_payment_error?.message);
  }

  return Response.json({ received: true });
}
