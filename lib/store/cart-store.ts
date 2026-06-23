import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Coupon } from "@/types";
import { createClient } from "@/lib/supabase/client";

type CartState = {
  items: CartItem[];
  total: number;
  count: number;
  isOpen: boolean;
  coupon: Coupon | null;
  discount: number;

  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  toggleCart: () => void;
};

function recalc(items: CartItem[], coupon: Coupon | null) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  let discount = 0;
  if (coupon && subtotal >= coupon.min_order) {
    discount = coupon.type === "percentage"
      ? subtotal * (coupon.value / 100)
      : coupon.value;
  }
  return { total: Math.max(0, subtotal - discount), count, discount };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,
      count: 0,
      isOpen: false,
      coupon: null,
      discount: 0,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          const items = existing
            ? state.items.map((i) =>
                i.variantId === item.variantId ? { ...i, quantity: i.quantity + item.quantity } : i
              )
            : [...state.items, { ...item, id: crypto.randomUUID() }];
          return { items, ...recalc(items, state.coupon) };
        }),

      removeItem: (variantId) =>
        set((state) => {
          const items = state.items.filter((i) => i.variantId !== variantId);
          return { items, ...recalc(items, state.coupon) };
        }),

      updateQuantity: (variantId, quantity) =>
        set((state) => {
          const items = quantity <= 0
            ? state.items.filter((i) => i.variantId !== variantId)
            : state.items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i));
          return { items, ...recalc(items, state.coupon) };
        }),

      clearCart: () => set({ items: [], total: 0, count: 0, coupon: null, discount: 0 }),

      applyCoupon: async (code) => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("coupons")
          .select("*")
          .eq("code", code.toUpperCase())
          .eq("is_active", true)
          .single();

        if (error || !data) return { success: false, message: "Invalid coupon code" };

        const coupon = data as Coupon;
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
          return { success: false, message: "This coupon has expired" };
        }

        const { items } = get();
        const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        if (subtotal < coupon.min_order) {
          return { success: false, message: `Minimum order of $${coupon.min_order} required` };
        }

        set((state) => {
          const calc = recalc(state.items, coupon);
          return { coupon, ...calc };
        });

        const discountLabel = coupon.type === "percentage" ? `${coupon.value}%` : `$${coupon.value}`;
        return { success: true, message: `Coupon applied! ${discountLabel} off` };
      },

      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
    }),
    { name: "atlanta-cart" }
  )
);
