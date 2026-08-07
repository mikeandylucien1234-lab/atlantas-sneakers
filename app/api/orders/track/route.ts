import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Public order tracking: look up by order number, verified by the email used at
// checkout (so one can't enumerate others' orders). Returns the real status +
// tracking that the supplier sync/webhook wrote onto the order.
export async function GET(request: NextRequest) {
  const number = (request.nextUrl.searchParams.get("number") || "").trim();
  const email = (request.nextUrl.searchParams.get("email") || "").trim().toLowerCase();
  if (!number) return Response.json({ error: "Order number required" }, { status: 400 });

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return Response.json({ error: "Service not configured" }, { status: 500 });
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });

  const { data: order } = await s
    .from("orders")
    .select("order_number, status, fulfillment_status, tracking_number, carrier, tracking_status, tracking_history, shipped_at, total, created_at, shipping_address, items:order_items(quantity, price, product:products(name, images))")
    .eq("order_number", number)
    .maybeSingle();

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  // Email gate (skipped only if the order has no email on file).
  const onFile = String(order.shipping_address?.email || "").toLowerCase();
  if (onFile && email !== onFile) {
    return Response.json({ error: "Email does not match this order" }, { status: 403 });
  }

  const { shipping_address, ...safe } = order;
  return Response.json({ order: safe });
}
