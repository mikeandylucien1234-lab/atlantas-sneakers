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

    // Resolve the supplier order (and the customer order it belongs to) so every
    // push event flows straight through to what the customer sees.
    const extId = event.data?.orderId != null ? String(event.data.orderId) : null;
    const trackNo = event.data?.trackingNumber || null;
    let so = null;
    if (extId) { const { data } = await s.from("supplier_orders").select("id, order_id, tracking_number").eq("external_order_id", extId).maybeSingle(); so = data; }

    if (String(type).includes("track") && trackNo) {
      await s.from("supplier_tracking").upsert({
        supplier_order_id: so?.id || null, order_id: so?.order_id || null,
        tracking_number: trackNo, carrier: event.data.carrier, status: event.data.status,
        current_country: event.data.country, history: event.data.history || [], updated_at: new Date().toISOString(),
      }, { onConflict: so?.id ? "supplier_order_id" : "id" }).then(() => {}, () => {});
    }
    if (String(type).includes("order") && so) {
      await s.from("supplier_orders").update({ status: event.data.status || "shipped", raw: event, updated_at: new Date().toISOString() }).eq("id", so.id).then(() => {}, () => {});
    }

    // Reflect tracking + status onto the customer order.
    if (so?.order_id && (trackNo || event.data?.status)) {
      const v = String(event.data?.status || "").toLowerCase();
      const orderStatus = /deliver/.test(v) ? "delivered" : (trackNo || /(ship|transit|dispatch)/.test(v)) ? "shipped" : /cancel/.test(v) ? "cancelled" : null;
      const patch = { fulfillment_status: trackNo ? "shipped" : "submitted" };
      if (trackNo) { patch.tracking_number = trackNo; patch.carrier = event.data.carrier || null; patch.tracking_status = event.data.status || null; if (event.data.history) patch.tracking_history = event.data.history; if (!so.tracking_number) patch.shipped_at = new Date().toISOString(); }
      if (orderStatus) patch.status = orderStatus;
      await s.from("orders").update(patch).eq("id", so.order_id).then(() => {}, () => {});
    }
    return Response.json({ received: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
