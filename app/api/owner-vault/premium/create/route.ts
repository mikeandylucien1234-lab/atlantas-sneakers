import { NextRequest } from "next/server";
import { isOwner } from "@/lib/owner-vault/auth";
import { ovAdmin, PREMIUM_PLAN } from "@/lib/owner-vault/db";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

// Create an Administrator Premium subscription via Stripe Checkout (subscription
// mode). The owner enters the card ONCE on Stripe's hosted page — no card /
// CVC / expiry ever touches or is stored by this platform.
export async function POST(request: NextRequest) {
  if (!(await isOwner())) return Response.json({ error: "Accès refusé." }, { status: 403 });

  try {
    const { email, name, photo } = await request.json().catch(() => ({}));
    if (!email) return Response.json({ error: "Email requis" }, { status: 400 });

    const stripe = getStripe();
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";

    // Pre-create the local record (status incomplete until the first invoice pays).
    const { data: rec, error } = await ovAdmin
      .from("owner_premium_admins")
      .insert({ email, name: name || null, photo: photo || null, plan: PREMIUM_PLAN.name, price: PREMIUM_PLAN.price, status: "incomplete" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: PREMIUM_PLAN.currency,
          product_data: { name: PREMIUM_PLAN.name },
          recurring: { interval: "month" },
          unit_amount: PREMIUM_PLAN.price * 100,
        },
      }],
      metadata: { ov_premium_admin_id: rec.id, ov: "premium" },
      subscription_data: { metadata: { ov_premium_admin_id: rec.id, ov: "premium" } },
      success_url: `${origin}/owner-vault?created=1`,
      cancel_url: `${origin}/owner-vault?canceled=1`,
    });

    return Response.json({ url: session.url });
  } catch (err: any) {
    return Response.json({ error: err?.message || "Stripe error" }, { status: 502 });
  }
}
