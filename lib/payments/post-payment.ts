import { supabaseAdmin, updatePaymentStatus, logPaymentEvent } from "./payment-service";
import type { Gateway } from "./payment-service";

export type PostPaymentData = {
  orderId: string;
  paymentId: string;
  userId: string | null;
  gateway: Gateway;
  transactionId: string;
  amount: number;
  currency: string;
};

export async function processPostPayment(data: PostPaymentData): Promise<void> {
  await updatePaymentStatus(data.paymentId, "paid", {
    transaction_id: data.transactionId,
    webhook_received_at: new Date().toISOString(),
    webhook_verified: true,
  });

  await supabaseAdmin
    .from("orders")
    .update({ status: "confirmed", payment_status: "paid" })
    .eq("id", data.orderId);

  await reduceInventory(data.orderId);

  await logPaymentEvent({
    paymentId: data.paymentId,
    gateway: data.gateway,
    eventType: "payment.completed",
    response: {
      transaction_id: data.transactionId,
      amount: data.amount,
      currency: data.currency,
    },
  });

  await supabaseAdmin.from("activity_logs").insert({
    user_id: data.userId,
    action: "payment_completed",
    resource: "orders",
    resource_id: data.orderId,
    details: {
      gateway: data.gateway,
      amount: data.amount,
      currency: data.currency,
      transaction_id: data.transactionId,
      payment_id: data.paymentId,
    },
  });

  if (data.userId) {
    await supabaseAdmin
      .from("cart_items")
      .delete()
      .eq("user_id", data.userId);
  }
}

async function reduceInventory(orderId: string): Promise<void> {
  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("variant_id, quantity")
    .eq("order_id", orderId);

  if (!items) return;

  for (const item of items) {
    if (!item.variant_id) continue;

    // Atomic decrement via Supabase RPC to avoid read-then-write race conditions.
    // The RPC function runs: UPDATE product_variants SET stock = GREATEST(0, stock - qty) WHERE id = vid;
    // Deploy it with:
    //   CREATE OR REPLACE FUNCTION decrement_variant_stock(p_variant_id UUID, p_quantity INT)
    //   RETURNS VOID LANGUAGE sql AS $$
    //     UPDATE product_variants SET stock = GREATEST(0, stock - p_quantity) WHERE id = p_variant_id;
    //   $$;
    await supabaseAdmin.rpc("decrement_variant_stock", {
      p_variant_id: item.variant_id,
      p_quantity: item.quantity,
    });
  }
}
