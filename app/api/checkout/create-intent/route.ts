import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { items, shippingMethod, couponCode } = body as {
      items: Array<{ productId: string; variantId: string | null; name: string; price: number; quantity: number }>;
      shippingMethod?: string;
      couponCode?: string;
    };

    if (!items?.length) {
      return Response.json({ error: "No items provided" }, { status: 400 });
    }

    // Look up actual prices from the database
    const productIds = [...new Set(items.map((i) => i.productId))];
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, price")
      .in("id", productIds);

    if (productsError || !products) {
      return Response.json({ error: "Failed to verify product prices" }, { status: 500 });
    }

    const productPriceMap = new Map(products.map((p) => [p.id, Number(p.price)]));

    // Look up variant prices if any items have variants
    const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId!);
    const variantPriceMap = new Map<string, number>();

    if (variantIds.length > 0) {
      const { data: variants } = await supabase
        .from("product_variants")
        .select("id, price")
        .in("id", variantIds);

      if (variants) {
        for (const v of variants) {
          if (v.price != null) {
            variantPriceMap.set(v.id, Number(v.price));
          }
        }
      }
    }

    // Calculate real subtotal from DB prices
    let subtotal = 0;
    for (const item of items) {
      const dbPrice = item.variantId
        ? variantPriceMap.get(item.variantId) ?? productPriceMap.get(item.productId)
        : productPriceMap.get(item.productId);

      if (dbPrice === undefined) {
        return Response.json({ error: `Product not found: ${item.productId}` }, { status: 400 });
      }

      // Reject if client-supplied price doesn't match DB price
      if (Math.abs(dbPrice - item.price) > 0.01) {
        return Response.json({ error: "Price mismatch detected" }, { status: 400 });
      }

      subtotal += dbPrice * item.quantity;
    }

    // Calculate shipping server-side: free over $100 for standard, otherwise $9.99
    let shippingCost: number;
    if (shippingMethod === "express") shippingCost = 19.99;
    else if (shippingMethod === "overnight") shippingCost = 39.99;
    else shippingCost = subtotal >= 100 ? 0 : 9.99;

    let discount = 0;
    let couponData = null;

    if (couponCode) {
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
        userId: user.id,
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
      // Return the publishable key so the client loads Stripe.js with the exact
      // key configured on the server (avoids build-time inlining mismatches and
      // guarantees the key mode matches the secret key that created the intent).
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || null,
      total,
      discount,
    });
  } catch (err: any) {
    console.error("create-intent error:", err);
    // Surface the real reason so the customer/admin can act on it instead of a
    // generic message. Stripe errors carry a human-readable `message`.
    const msg = err?.raw?.message || err?.message || "Failed to create payment intent";
    let hint = msg;
    if (/api key|no api key|authentication/i.test(msg)) {
      hint = "Stripe is not configured on the server (missing or invalid STRIPE_SECRET_KEY). Please set the live secret key in the server environment.";
    }
    return Response.json({ error: hint }, { status: 500 });
  }
}
