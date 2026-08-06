import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { finalizeStripeOrder, dispatchSupplierOrders } from "@/lib/orders/fulfillment";

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { paymentIntentId, shippingAddress } = await request.json();
    if (!paymentIntentId) return Response.json({ error: "paymentIntentId required" }, { status: 400 });

    // Verify the payment really succeeded — never trust the client.
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!pi || pi.status !== "succeeded") {
      return Response.json({ error: `Payment not completed (status: ${pi?.status || "unknown"})` }, { status: 402 });
    }
    // The intent must belong to the caller (metadata.userId set at create-intent).
    if (pi.metadata?.userId && pi.metadata.userId !== user.id) {
      return Response.json({ error: "Payment does not belong to this account" }, { status: 403 });
    }

    const result = await finalizeStripeOrder(pi, { shippingAddress });

    // Fire-and-forget supplier dispatch (never blocks the response / the order).
    dispatchSupplierOrders(result.orderId).catch(() => {});

    return Response.json({ orderId: result.orderId, orderNumber: result.orderNumber });
  } catch (err: any) {
    console.error("checkout/confirm error:", err);
    return Response.json({ error: err?.message || "Failed to finalize order" }, { status: 500 });
  }
}
