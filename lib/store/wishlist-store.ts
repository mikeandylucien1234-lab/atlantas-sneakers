import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WishlistItem } from "@/types";

type WishlistState = {
  items: WishlistItem[];
  count: number;

  addItem: (item: WishlistItem) => void;
  removeItem: (productId: string) => void;
  toggleItem: (item: WishlistItem) => void;
  isInWishlist: (productId: string) => boolean;
};

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      count: 0,

      addItem: (item) =>
        set((state) => {
          if (state.items.some((i) => i.productId === item.productId)) return state;
          const items = [...state.items, item];
          return { items, count: items.length };
        }),

      removeItem: (productId) =>
        set((state) => {
          const items = state.items.filter((i) => i.productId !== productId);
          return { items, count: items.length };
        }),

      toggleItem: (item) => {
        const { items } = get();
        if (items.some((i) => i.productId === item.productId)) {
          get().removeItem(item.productId);
        } else {
          get().addItem(item);
        }
      },

      isInWishlist: (productId) => get().items.some((i) => i.productId === productId),
    }),
    { name: "atlanta-wishlist" }
  )
);
