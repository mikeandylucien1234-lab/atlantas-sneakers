import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, shippingCost, couponCode, userId } = body as {
      items: Array<{ productId: string; variantId: string | null; name: string; price: number; quantity: number }>;
      shippingCost: number;
      couponCode?: string;
      userId?: string;
    };

    if (!items?.length) {
      return Response.json({ error: "No items provided" }, { status: 400 });
    }

    let subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    let discount = 0;
    let couponData = null;

    if (couponCode) {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet) {
              try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
            },
          },
        }
      );

      const { data } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", couponCode.toUpperCase())
        .eq("is_active", true)
        .single();

      if (data) {
        const expired = data.expires_at && new Date(data.expires_at) < new Date();
        const meetsMin = subtotal >= Number(data.min_order);
        if (!expired && meetsMin) {
          couponData = data;
          discount = data.type === "percentage"
            ? subtotal * (Number(data.value) / 100)
            : Number(data.value);
        }
      }
    }

    const total = Math.max(0, subtotal + shippingCost - discount);
    const amountInCents = Math.round(total * 100);

    if (amountInCents < 50) {
      return Response.json({ error: "Order total too low" }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      metadata: {
        userId: userId ?? "guest",
        itemCount: String(items.length),
        couponCode: couponCode ?? "",
        shippingCost: String(shippingCost),
        discount: String(discount),
        subtotal: String(subtotal),
        items: JSON.stringify(items.map((i) => ({ pid: i.productId, vid: i.variantId, qty: i.quantity, price: i.price }))),
      },
    });

    return Response.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      total,
      discount,
    });
  } catch (err) {
    console.error("create-intent error:", err);
    return Response.json({ error: "Failed to create payment intent" }, { status: 500 });
  }
}
