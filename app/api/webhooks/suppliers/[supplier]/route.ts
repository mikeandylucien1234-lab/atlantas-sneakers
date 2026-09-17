// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import crypto from "crypto";

// Generic supplier webhook receiver. CJ's webhook API doesn't sign payloads
// with a shared secret we can verify against, so instead of trusting an
// unverifiable header, the callback URL we register with CJ carries our own
// random ?token= — generated in generate-webhook and known only to whoever
// registered it. A request without a matching token is rejected outright,
// never processed. Records the event and maps order/tracking updates onto
// supplier_orders / supplier_tracking / orders.
function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex"), bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch { return false; }
}

export async function POST(request: NextRequest, { params }) {
  const { supplier } = await params;
  const raw = await request.text();
  const s = svc();
  try {
    const token = request.nextUrl.searchParams.get("token") || "";
    const { data: hooks } = await s.from("supplier_webhooks").select("id, secret_hash, event, deliveries").eq("supplier_id", supplier).eq("status", "active");

    let matched = null;
    if (token) {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      matched = (hooks || []).find((h) => h.secret_hash && safeEqualHex(h.secret_hash, tokenHash)) || null;
    }
    if (!matched) {
      await s.from("supplier_logs").insert({ supplier_id: supplier, action: "webhook:rejected", status: "error", detail: token ? "token mismatch" : "no token" });
      return Response.json({ error: "Invalid or missing webhook token." }, { status: 401 });
    }

    const event = JSON.parse(raw || "{}");
    const type = event.type || event.event || "unknown";
    await s.from("supplier_logs").insert({ supplier_id: supplier, action: `webhook:${type}`, status: "ok", detail: "verified" });
    await s.from("supplier_webhooks").update({ deliveries: (matched.deliveries || 0) + 1, last_delivery_at: new Date().toISOString() }).eq("id", matched.id);

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
      // A CJ order only exists here at all once an admin has manually placed it
      // (automatic dispatch is currently off) — so absent tracking yet, the
      // correct state is "manual_order_placed", not the old auto-dispatch
      // "submitted" label.
      const patch = { fulfillment_status: trackNo ? "shipped" : "manual_order_placed" };
      if (trackNo) { patch.tracking_number = trackNo; patch.carrier = event.data.carrier || null; patch.tracking_status = event.data.status || null; if (event.data.history) patch.tracking_history = event.data.history; if (!so.tracking_number) patch.shipped_at = new Date().toISOString(); }
      if (orderStatus) patch.status = orderStatus;
      await s.from("orders").update(patch).eq("id", so.order_id).then(() => {}, () => {});
    }
    return Response.json({ received: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
