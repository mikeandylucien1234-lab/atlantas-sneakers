import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const { userId, items: itemsJson, shippingCost, discount, subtotal } = paymentIntent.metadata;

    try {
      const items = JSON.parse(itemsJson || "[]") as Array<{
        pid: string; vid: string | null; qty: number; price: number;
      }>;

      const orderNumber = `AS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          order_number: orderNumber,
          user_id: userId !== "guest" ? userId : null,
          status: "confirmed",
          payment_status: "paid",
          subtotal: Number(subtotal),
          shipping_cost: Number(shippingCost),
          discount: Number(discount),
          total: paymentIntent.amount / 100,
        })
        .select()
        .single();

      if (orderError) {
        console.error("Order creation error:", orderError);
        return Response.json({ error: "Order creation failed" }, { status: 500 });
      }

      if (items.length > 0) {
        await supabaseAdmin
          .from("order_items")
          .insert(
            items.map((item) => ({
              order_id: order.id,
              product_id: item.pid,
              variant_id: item.vid,
              quantity: item.qty,
              price: item.price,
            }))
          );
      }

      if (userId && userId !== "guest") {
        await supabaseAdmin
          .from("cart_items")
          .delete()
          .eq("user_id", userId);
      }

      console.log(`Order ${orderNumber} created for payment ${paymentIntent.id}`);
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
