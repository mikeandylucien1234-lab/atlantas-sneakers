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
    const { items, shippingCost, couponCode } = body as {
      items: Array<{ productId: string; variantId: string | null; name: string; price: number; quantity: number }>;
      shippingCost: number;
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
      total,
      discount,
    });
  } catch (err) {
    console.error("create-intent error:", err);
    return Response.json({ error: "Failed to create payment intent" }, { status: 500 });
  }
}
