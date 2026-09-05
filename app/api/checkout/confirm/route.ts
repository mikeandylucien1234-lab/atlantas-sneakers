import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { finalizeStripeOrder, markManualFulfillment } from "@/lib/orders/fulfillment";

// Server-side finalization for Stripe payments. The client calls this right
// after stripe.confirmPayment() succeeds, so the order is created reliably even
// when the Stripe webhook is not reachable. Idempotent: safe to call more than
// once, and safe alongside the webhook (both key on the PaymentIntent id).
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
        },
      }
    );

    // The live session is used ONLY to (a) prevent a different logged-in account
    // from hijacking someone else's paid intent, and (b) as a hint for logging.
    // It is NOT required to exist — if the browser's session expired or was lost
    // between payment and this call (e.g. a redeploy/restart in between), the
    // payment already succeeded at Stripe and must still become an order. The
    // real authorization boundary is knowledge of paymentIntentId (an
    // unguessable Stripe-issued id) combined with Stripe's own server-verified
    // "succeeded" status below — the same trust model the webhook (which has NO
    // user session at all) already relies on.
    const { data: { user } } = await supabase.auth.getUser();

    const { paymentIntentId, shippingAddress } = await request.json();
    if (!paymentIntentId) return Response.json({ error: "paymentIntentId required" }, { status: 400 });

    // Verify the payment really succeeded — never trust the client.
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!pi || pi.status !== "succeeded") {
      return Response.json({ error: `Payment not completed (status: ${pi?.status || "unknown"})` }, { status: 402 });
    }
    // Ownership: the order is attributed to pi.metadata.userId (set at
    // create-intent by an authenticated call, already trustworthy). Only block
    // when a DIFFERENT live session is trying to confirm someone else's intent.
    if (user && pi.metadata?.userId && pi.metadata.userId !== user.id) {
      return Response.json({ error: "Payment does not belong to this account" }, { status: 403 });
    }

    const result = await finalizeStripeOrder(pi, { shippingAddress });

    // Manual fulfillment mode: flag for a human to place the CJ order by hand
    // (Admin → Orders → View Store), never auto-dispatch to the supplier.
    markManualFulfillment(result.orderId).catch(() => {});

    return Response.json({ orderId: result.orderId, orderNumber: result.orderNumber });
  } catch (err: any) {
    console.error("checkout/confirm error:", err);
    return Response.json({ error: err?.message || "Failed to finalize order" }, { status: 500 });
  }
}
