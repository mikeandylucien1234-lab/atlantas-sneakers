import { NextRequest } from "next/server";
import { isOwner } from "@/lib/owner-vault/auth";
import { ovAdmin } from "@/lib/owner-vault/db";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

// Subscription lifecycle actions: suspend / reactivate / cancel.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isOwner())) return Response.json({ error: "Accès refusé." }, { status: 403 });

  const { id } = await params;
  const { action } = await request.json().catch(() => ({}));

  const { data: rec } = await ovAdmin.from("owner_premium_admins").select("*").eq("id", id).single();
  if (!rec) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    const stripe = getStripe();
    const sub = rec.stripe_subscription_id;

    if (action === "suspend") {
      if (sub) await stripe.subscriptions.update(sub, { pause_collection: { behavior: "void" } });
      await ovAdmin.from("owner_premium_admins").update({ status: "suspended" }).eq("id", id);
    } else if (action === "reactivate") {
      if (sub) await stripe.subscriptions.update(sub, { pause_collection: null as any });
      await ovAdmin.from("owner_premium_admins").update({ status: "active" }).eq("id", id);
    } else if (action === "cancel") {
      if (sub) await stripe.subscriptions.cancel(sub);
      await ovAdmin.from("owner_premium_admins").update({ status: "canceled" }).eq("id", id);
    } else {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err?.message || "Stripe error" }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isOwner())) return Response.json({ error: "Accès refusé." }, { status: 403 });
  const { id } = await params;
  await ovAdmin.from("owner_premium_admins").delete().eq("id", id);
  return Response.json({ ok: true });
}
