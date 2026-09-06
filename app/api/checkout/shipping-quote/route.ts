import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getShippingOptionsPreview } from "@/lib/shipping/quote";

// Lets the checkout page show the REAL CJ shipping options (weight +
// destination aware) before payment, instead of a flat guessed fee. Never
// invents a price — see lib/shipping/quote.ts for the fallback behavior.
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { items, shippingAddress } = body as {
      items: Array<{ productId: string; variantId: string | null; quantity: number }>;
      shippingAddress?: { country?: string; postalCode?: string };
    };
    if (!items?.length) return Response.json({ error: "No items provided" }, { status: 400 });
    if (!shippingAddress?.country) return Response.json({ error: "shippingAddress.country is required" }, { status: 400 });

    const productIds = [...new Set(items.map((i) => i.productId))];
    const { data: products } = await supabase.from("products").select("id, price").in("id", productIds);
    const priceMap = new Map((products || []).map((p: any) => [p.id, Number(p.price)]));
    const subtotal = items.reduce((sum, i) => sum + (priceMap.get(i.productId) || 0) * i.quantity, 0);

    const options = await getShippingOptionsPreview({ items, shippingAddress, subtotal });
    return Response.json({ options });
  } catch (err: any) {
    console.error("shipping-quote error:", err);
    return Response.json({ error: err?.message || "Failed to get shipping quote" }, { status: 500 });
  }
}
