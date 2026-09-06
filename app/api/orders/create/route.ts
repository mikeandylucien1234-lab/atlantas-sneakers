import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getAuthoritativeShippingCost } from "@/lib/shipping/quote";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    const { items, shippingAddress, shippingMethod, couponCode, paymentMethod } = body as {
      items: Array<{ productId: string; variantId: string | null; name: string; price: number; quantity: number }>;
      shippingAddress: { email: string; phone: string; firstName: string; lastName: string; address: string; address2?: string; city: string; state?: string; country: string; postalCode: string };
      shippingMethod: string;
      couponCode?: string;
      paymentMethod: string;
    };

    if (!items?.length) {
      return Response.json({ error: "No items provided" }, { status: 400 });
    }

    // Validate prices against DB
    const productIds = [...new Set(items.map((i) => i.productId))];
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, price, category_id, brand_id")
      .in("id", productIds);

    if (productsError || !products) {
      return Response.json({ error: "Failed to verify product prices" }, { status: 500 });
    }

    const productPriceMap = new Map(products.map((p) => [p.id, Number(p.price)]));
    const productMetaMap = new Map(products.map((p) => [p.id, { category_id: p.category_id, brand_id: p.brand_id }]));

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

    let subtotal = 0;
    for (const item of items) {
      const dbPrice = item.variantId
        ? variantPriceMap.get(item.variantId) ?? productPriceMap.get(item.productId)
        : productPriceMap.get(item.productId);

      if (dbPrice === undefined) {
        return Response.json({ error: `Product not found: ${item.productId}` }, { status: 400 });
      }

      if (Math.abs(dbPrice - item.price) > 0.01) {
        return Response.json({ error: "Price mismatch detected" }, { status: 400 });
      }

      subtotal += dbPrice * item.quantity;
    }

    // Compute shipping server-side using the real CJ freight (weight +
    // destination) whenever possible — see lib/shipping/quote.ts.
    const shippingQuote = await getAuthoritativeShippingCost({
      items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
      shippingAddress: shippingAddress || {},
      shippingMethod: shippingMethod ?? "standard",
      subtotal,
    });
    const shippingCost = shippingQuote.cost;

    let discount = 0;
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
          discount = data.type === "percentage"
            ? subtotal * (Number(data.value) / 100)
            : Number(data.value);
        }
      }
    }

    // Compute tax server-side via the shared engine — the source of truth
    let taxAmount = 0;
    let taxDetails: unknown[] = [];
    try {
      const { data: taxRules } = await supabase.from("tax_rules").select("*").eq("status", "active");
      if (taxRules && taxRules.length > 0) {
        const { calculateTaxes } = await import("@/lib/tax/tax-engine");
        const taxItems = items.map((item) => {
          const meta = productMetaMap.get(item.productId) || {};
          const dbPrice = item.variantId
            ? variantPriceMap.get(item.variantId) ?? productPriceMap.get(item.productId)
            : productPriceMap.get(item.productId);
          return {
            product_id: item.productId,
            category_id: (meta as { category_id?: string }).category_id,
            brand_id: (meta as { brand_id?: string }).brand_id,
            is_digital: false,
            price: Number(dbPrice) || item.price,
            quantity: item.quantity,
          };
        });
        const result = calculateTaxes(taxRules as never, {
          country: shippingAddress?.country,
          state: (shippingAddress as { state?: string })?.state,
          city: shippingAddress?.city,
          postal_code: shippingAddress?.postalCode,
          customer_type: user ? "registered" : "guest",
          items: taxItems,
          subtotal,
        });
        taxAmount = result.totalTax;
        taxDetails = result.taxes;
      }
    } catch (taxErr) {
      console.error("Tax computation failed (order proceeds untaxed):", taxErr);
    }

    const total = Math.max(0, subtotal + shippingCost - discount + taxAmount);

    const orderNumber = `AS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: user.id,
        status: "pending",
        payment_status: "pending",
        subtotal,
        shipping_cost: shippingCost,
        shipping_quote_source: shippingQuote.source,
        shipping_needs_review: shippingQuote.needsReview,
        discount,
        tax_amount: taxAmount,
        tax_details: taxDetails,
        total,
        payment_method: paymentMethod,
        shipping_address: shippingAddress,
      })
      .select("id, order_number")
      .single();

    if (orderError) {
      console.error("Order creation error:", orderError);
      return Response.json({ error: "Failed to create order" }, { status: 500 });
    }

    // Create order items
    if (items.length > 0) {
      const { error: itemsError } = await supabaseAdmin
        .from("order_items")
        .insert(
          items.map((item) => ({
            order_id: order.id,
            product_id: item.productId,
            variant_id: item.variantId,
            quantity: item.quantity,
            price: item.price,
          }))
        );

      if (itemsError) {
        console.error("Order items creation error:", itemsError);
      }
    }

    return Response.json({
      orderId: order.id,
      orderNumber: order.order_number,
      total,
      shippingCost,
      discount,
      taxAmount,
      taxDetails,
    });
  } catch (err) {
    console.error("Order creation error:", err);
    return Response.json({ error: "Failed to create order" }, { status: 500 });
  }
}
