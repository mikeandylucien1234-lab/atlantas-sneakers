import { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { ovAdmin } from "@/lib/owner-vault/db";
import { ownerConfig } from "@/lib/owner-vault/config";

export const runtime = "nodejs";

// Dedicated Stripe webhook for Owner Vault subscriptions. Uses its OWN signing
// secret so it never interferes with any existing Stripe webhook.
export async function POST(request: NextRequest) {
  const secret = ownerConfig().stripeWebhookSecret;
  const sig = request.headers.get("stripe-signature");
  const raw = await request.text();
  if (!secret || !sig) return Response.json({ error: "Not configured" }, { status: 400 });

  let event: any;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err: any) {
    return Response.json({ error: `Signature error: ${err.message}` }, { status: 400 });
  }

  // Only act on our own events (tagged with ov metadata) to stay isolated.
  try {
    const obj = event.data.object as any;

    const findByAdminId = (id?: string) => (id ? ovAdmin.from("owner_premium_admins").select("*").eq("id", id).maybeSingle() : null);
    const findBySub = (subId?: string) => (subId ? ovAdmin.from("owner_premium_admins").select("*").eq("stripe_subscription_id", subId).maybeSingle() : null);

    switch (event.type) {
      case "checkout.session.completed": {
        if (obj.metadata?.ov !== "premium") break;
        const adminId = obj.metadata?.ov_premium_admin_id;
        await ovAdmin.from("owner_premium_admins").update({
          stripe_customer_id: obj.customer,
          stripe_subscription_id: obj.subscription,
          status: "active",
        }).eq("id", adminId);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const subId = obj.subscription;
        const res = await findBySub(subId);
        const rec = res?.data;
        if (!rec) break;
        const periodEnd = obj.lines?.data?.[0]?.period?.end ? new Date(obj.lines.data[0].period.end * 1000) : null;
        await ovAdmin.from("owner_premium_admins").update({
          status: "active",
          last_payment_at: new Date().toISOString(),
          next_payment_at: periodEnd ? periodEnd.toISOString() : null,
          current_period_end: periodEnd ? periodEnd.toISOString() : null,
        }).eq("id", rec.id);
        await ovAdmin.from("owner_subscription_payments").upsert({
          premium_admin_id: rec.id,
          email: rec.email,
          amount: (obj.amount_paid ?? 0) / 100,
          currency: obj.currency || "usd",
          stripe_invoice_id: obj.id,
          status: "paid",
          paid_at: new Date().toISOString(),
        }, { onConflict: "stripe_invoice_id" });
        break;
      }
      case "invoice.payment_failed": {
        const res = await findBySub(obj.subscription);
        if (res?.data) await ovAdmin.from("owner_premium_admins").update({ status: "past_due" }).eq("id", res.data.id);
        break;
      }
      case "customer.subscription.deleted": {
        const res = await findBySub(obj.id);
        if (res?.data) await ovAdmin.from("owner_premium_admins").update({ status: "expired" }).eq("id", res.data.id);
        break;
      }
    }
  } catch (err) {
    console.error("OV webhook handler error:", err);
  }

  return Response.json({ received: true });
}
