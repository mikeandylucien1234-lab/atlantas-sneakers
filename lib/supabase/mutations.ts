import { createClient } from "./client";
import type { Address } from "@/types";

export async function createOrder(orderData: {
  userId: string;
  items: Array<{ productId: string; variantId: string | null; quantity: number; price: number }>;
  shippingAddress: Address;
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
}) {
  const supabase = createClient();
  const orderNumber = `ATL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: orderData.userId,
      status: "pending",
      payment_status: "pending",
      subtotal: orderData.subtotal,
      shipping_cost: orderData.shippingCost,
      discount: orderData.discount,
      total: orderData.total,
      shipping_address: orderData.shippingAddress,
    })
    .select()
    .single();

  if (orderError) throw orderError;

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(
      orderData.items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        price: item.price,
      }))
    );

  if (itemsError) throw itemsError;

  return order;
}

export async function addToCart(userId: string, item: { productId: string; variantId: string | null; quantity: number }) {
  const supabase = createClient();
  let query = supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("product_id", item.productId);

  if (item.variantId != null) {
    query = query.eq("variant_id", item.variantId);
  } else {
    query = query.is("variant_id", null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: existing.quantity + item.quantity })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("cart_items")
      .insert({ user_id: userId, product_id: item.productId, variant_id: item.variantId, quantity: item.quantity });
    if (error) throw error;
  }
}

export async function removeFromCart(userId: string, variantId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", userId)
    .eq("variant_id", variantId);
  if (error) throw error;
}

export async function addToWishlist(userId: string, productId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("wishlist_items")
    .upsert({ user_id: userId, product_id: productId }, { onConflict: "user_id,product_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeFromWishlist(userId: string, productId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);
  if (error) throw error;
}

export async function createReview(reviewData: {
  userId: string;
  productId: string;
  rating: number;
  title?: string;
  comment?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      user_id: reviewData.userId,
      product_id: reviewData.productId,
      rating: reviewData.rating,
      title: reviewData.title ?? null,
      comment: reviewData.comment ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, data: { full_name?: string; avatar_url?: string }) {
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update(data)
    .eq("id", userId);
  if (error) throw error;
}
