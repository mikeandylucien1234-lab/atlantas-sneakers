// @ts-nocheck
// Order fulfillment core — the single source of truth for turning a *paid*
// Stripe PaymentIntent into a real order. Used by BOTH the Stripe webhook and
// the client-driven /api/checkout/confirm route, so an order is created even if
// one of those two paths fails (e.g. the webhook is not reachable on the host).
// Every write is idempotent on orders.stripe_payment_intent_id.
import { createClient } from "@supabase/supabase-js";

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}

type Finalized = { orderId: string; orderNumber: string; created: boolean };

// Create (or return the existing) order for a succeeded PaymentIntent.
export async function finalizeStripeOrder(
  paymentIntent: any,
  opts: { shippingAddress?: any } = {}
): Promise<Finalized> {
  const s = admin();
  const piId = paymentIntent.id;

  // Idempotency: never create two orders for the same intent.
  const { data: existing } = await s.from("orders").select("id, order_number").eq("stripe_payment_intent_id", piId).maybeSingle();
  if (existing) return { orderId: existing.id, orderNumber: existing.order_number, created: false };

  const md = paymentIntent.metadata || {};
  const userId = md.userId && md.userId !== "guest" ? md.userId : null;
  const parsedItems: Array<{ pid: string; vid: string | null; qty: number; price: number }> =
    (() => { try { return JSON.parse(md.items || "[]"); } catch { return []; } })();

  const subtotal = Number(md.subtotal || 0);
  const shippingCost = Number(md.shippingCost || 0);
  const discount = Number(md.discount || 0);
  const total = typeof paymentIntent.amount === "number" ? paymentIntent.amount / 100 : subtotal + shippingCost - discount;
  const orderNumber = `AS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const { data: order, error: orderErr } = await s
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: userId,
      status: "confirmed",
      payment_status: "paid",
      subtotal,
      shipping_cost: shippingCost,
      discount,
      total,
      payment_method: "stripe",
      stripe_payment_intent_id: piId,
      ...(opts.shippingAddress ? { shipping_address: opts.shippingAddress } : {}),
    })
    .select("id, order_number")
    .single();

  // A concurrent path (webhook vs confirm) may have inserted between our check
  // and insert — the unique index rejects the duplicate; fetch and return it.
  if (orderErr) {
    const { data: raced } = await s.from("orders").select("id, order_number").eq("stripe_payment_intent_id", piId).maybeSingle();
    if (raced) return { orderId: raced.id, orderNumber: raced.order_number, created: false };
    throw new Error(`Order creation failed: ${orderErr.message}`);
  }

  if (parsedItems.length > 0) {
    await s.from("order_items").insert(
      parsedItems.map((it) => ({ order_id: order.id, product_id: it.pid, variant_id: it.vid, quantity: it.qty, price: it.price }))
    );
  }

  // Record the payment (idempotent on the intent id via merchant_reference).
  await s.from("payments").insert({
    order_id: order.id,
    user_id: userId,
    gateway: "stripe",
    amount: total,
    currency: (paymentIntent.currency || "usd").toUpperCase(),
    status: "completed",
    transaction_id: piId,
    merchant_reference: orderNumber,
    idempotency_key: piId,
    webhook_verified: true,
    webhook_received_at: new Date().toISOString(),
    gateway_response: { id: piId, amount: paymentIntent.amount, status: paymentIntent.status },
  }).then(() => {}, () => {});

  // Clear the server-side cart for signed-in buyers.
  if (userId) await s.from("cart_items").delete().eq("user_id", userId).then(() => {}, () => {});

  return { orderId: order.id, orderNumber: order.order_number, created: true };
}

// Best-effort automatic dispatch to dropshipping suppliers (CJ). NEVER throws —
// a supplier/credential failure must not affect the customer order. Records the
// attempt in supplier_orders so the admin can see/complete it.
export async function dispatchSupplierOrders(orderId: string): Promise<void> {
  try {
    const s = admin();
    const { data: order } = await s.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (!order) return;
    const { data: oItems } = await s.from("order_items").select("product_id, variant_id, quantity, price").eq("order_id", orderId);
    if (!oItems?.length) return;

    // Map our products → CJ imported mapping (supplier_products).
    const productIds = [...new Set(oItems.map((i) => i.product_id).filter(Boolean))];
    const { data: mappings } = await s
      .from("supplier_products")
      .select("supplier_id, external_id, imported_product_id, raw")
      .eq("supplier_id", "cj")
      .eq("imported", true)
      .in("imported_product_id", productIds);
    if (!mappings?.length) return; // nothing sourced from CJ → nothing to dispatch

    const mapByProduct = new Map(mappings.map((m) => [m.imported_product_id, m]));

    // Resolve a CJ variant id (vid) for each item, best-effort, from raw variants.
    const items = [];
    for (const it of oItems) {
      const m = mapByProduct.get(it.product_id);
      if (!m) continue;
      let vid = null;
      const variants = m.raw?.variants || m.raw?.data?.variants || [];
      if (Array.isArray(variants) && variants.length) {
        vid = variants[0]?.vid || variants[0]?.variantId || null; // single-variant products dispatch cleanly
      }
      items.push({ external_variant_id: vid, external_product_id: m.external_id, quantity: it.quantity });
    }
    if (!items.length) return;

    const addr = order.shipping_address || {};
    const shipping = {
      countryCode: addr.country || null, province: addr.state || null, city: addr.city || null,
      address: addr.address || null, name: [addr.firstName, addr.lastName].filter(Boolean).join(" ") || null,
      zip: addr.postalCode || null, phone: addr.phone || null,
    };

    const { createSupplierOrder } = await import("@/lib/suppliers/engine");
    await createSupplierOrder({ supplierId: "cj", order: { ...order, shipping }, items, actor: null });
  } catch (err) {
    // Swallow — dispatch is best-effort. The failure is already recorded by the
    // engine into supplier_orders (status "failed") when it gets that far.
    console.error("dispatchSupplierOrders (non-blocking) failed:", err);
  }
}
