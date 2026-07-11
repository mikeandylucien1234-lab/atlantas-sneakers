// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import crypto from "crypto";

// Receives TikTok Shop / Business webhooks (order updates, product status...).
// Signature is verified with TIKTOK_WEBHOOK_SECRET when configured.
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const secret = process.env.TIKTOK_WEBHOOK_SECRET;
  const signature = request.headers.get("x-tt-signature") || request.headers.get("x-tiktok-signature") || "";

  if (secret) {
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (signature !== expected) {
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  try {
    const event = JSON.parse(raw || "{}");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    await supabase.from("tiktok_webhooks").insert({
      event_type: String(event.type || event.event || "unknown").slice(0, 80),
      status: "received",
      payload: event,
    });

    // Order-related events map into tiktok_orders
    if (event.type?.includes("order") && event.data?.order_id) {
      await supabase.from("tiktok_orders").upsert({
        tiktok_order_id: String(event.data.order_id),
        status: event.data.status || "pending",
        total: Number(event.data.total) || 0,
        currency: event.data.currency || "USD",
        raw: event,
        updated_at: new Date().toISOString(),
      }, { onConflict: "tiktok_order_id" });
    }

    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
