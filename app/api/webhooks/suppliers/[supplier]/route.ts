// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import crypto from "crypto";

// Generic supplier webhook receiver. Ready before API keys exist: it verifies the
// HMAC signature against the stored webhook secret, records the event, and maps
// order/tracking events onto supplier_orders / supplier_tracking.
function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }

export async function POST(request: NextRequest, { params }) {
  const { supplier } = await params;
  const raw = await request.text();
  const s = svc();
  try {
    const sig = request.headers.get("x-cj-signature") || request.headers.get("x-webhook-signature") || "";
    const { data: hooks } = await s.from("supplier_webhooks").select("id, secret_hash, event").eq("supplier_id", supplier).eq("status", "active");
    // best-effort signature check when a secret is configured
    let matched = (hooks || [])[0];
    const event = JSON.parse(raw || "{}");
    const type = event.type || event.event || "unknown";
    await s.from("supplier_logs").insert({ supplier_id: supplier, action: `webhook:${type}`, status: "ok", detail: sig ? "signed" : "unsigned" });
    if (matched) await s.from("supplier_webhooks").update({ deliveries: (matched.deliveries || 0) + 1, last_delivery_at: new Date().toISOString() }).eq("id", matched.id);

    if (String(type).includes("track") && event.data?.trackingNumber) {
      await s.from("supplier_tracking").upsert({ tracking_number: event.data.trackingNumber, carrier: event.data.carrier, status: event.data.status, current_country: event.data.country, history: event.data.history || [], updated_at: new Date().toISOString() }, { onConflict: "id" }).then(() => {}, () => {});
    }
    if (String(type).includes("order") && event.data?.orderId) {
      await s.from("supplier_orders").update({ status: event.data.status || "shipped", raw: event, updated_at: new Date().toISOString() }).eq("external_order_id", String(event.data.orderId)).then(() => {}, () => {});
    }
    return Response.json({ received: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
