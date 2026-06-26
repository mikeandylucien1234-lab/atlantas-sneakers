"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, ShoppingCart, Trash2, AlertTriangle } from "lucide-react";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import { useCartStore } from "@/lib/store/cart-store";
import { ProductCard } from "@/components/ui/product-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

const recentlyViewed = [
  { id: "rv1", slug: "adidas-superstar", name: "Adidas Superstar", brand: "Adidas", price: 99.99, image: "/placeholder.svg" },
  { id: "rv2", slug: "converse-run-star", name: "Converse Run Star Hike", brand: "Converse", price: 119.99, image: "/placeholder.svg", isNew: true },
  { id: "rv3", slug: "puma-ca-pro", name: "Puma CA Pro Classic", brand: "Puma", price: 84.99, comparePrice: 99.99, image: "/placeholder.svg" },
  { id: "rv4", slug: "nb-574", name: "New Balance 574", brand: "New Balance", price: 89.99, image: "/placeholder.svg" },
];

const recommended = [
  { id: "rc1", slug: "nike-blazer-mid", name: "Nike Blazer Mid '77", brand: "Nike", price: 104.99, image: "/placeholder.svg", isFeatured: true },
  { id: "rc2", slug: "jordan-ma2", name: "Jordan MA2", brand: "Jordan", price: 149.99, comparePrice: 179.99, image: "/placeholder.svg" },
  { id: "rc3", slug: "adidas-nmd-r1", name: "Adidas NMD R1", brand: "Adidas", price: 139.99, image: "/placeholder.svg", isNew: true },
  { id: "rc4", slug: "nike-vapormax", name: "Nike Air VaporMax 2023", brand: "Nike", price: 209.99, image: "/placeholder.svg" },
];

export default function WishlistPage() {
  const items = useWishlistStore((s) => s.items);
  const count = useWishlistStore((s) => s.count);
  const removeItem = useWishlistStore((s) => s.removeItem);
  const addToCart = useCartStore((s) => s.addItem);

  const handleMoveToCart = (item: typeof items[0]) => {
    addToCart({
      productId: item.productId,
      variantId: `${item.productId}-default`,
      name: item.name,
      image: item.image,
      price: item.price,
      comparePrice: null,
      size: "10",
      color: null,
      quantity: 1,
    });
    removeItem(item.productId);
  };

  if (items.length === 0) {
    return (
      <div className="mt-4">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-[120px] h-[120px] rounded-full bg-[#fef2f2] flex items-center justify-center mb-6">
            <Heart className="w-[48px] h-[48px] text-[#ef4444]" />
          </div>
          <h1 className="text-[24px] font-extrabold text-[#16181d] tracking-[-.02em]">Your wishlist is empty</h1>
          <p className="text-[14px] text-[#5b6472] mt-2">Save items you love for later.</p>
          <Link href="/shop">
            <Button size="lg" className="mt-6">Discover Products</Button>
          </Link>
        </div>

        <div className="mt-10">
          <h2 className="text-[19px] font-extrabold text-[#16181d] tracking-[-.01em] mb-4">Recommended For You</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px]">
            {recommended.map((p) => <ProductCard key={p.id} {...p} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em]">
        My Wishlist ({count} {count === 1 ? "item" : "items"})
      </h1>

      {/* Urgency banner */}
      <div className="mt-4 bg-[#fef3c7] border border-[#fde68a] rounded-[12px] px-4 py-3 flex items-center gap-2">
        <AlertTriangle className="w-[18px] h-[18px] text-[#f59e0b] shrink-0" />
        <p className="text-[13px] font-semibold text-[#92400e]">Don&apos;t miss out — items sell fast!</p>
      </div>

      {/* Wishlist grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px] mt-5">
        {items.map((item) => (
          <div key={item.productId} className="bg-white border border-[#eef0f3] rounded-[14px] overflow-hidden">
            <div className="relative aspect-square bg-[#f4f5f7] overflow-hidden">
              <Image src={item.image} alt={item.name} fill className="object-cover" sizes="(max-width:768px) 50vw, 25vw" />
            </div>
            <div className="p-[13px]">
              <h3 className="text-[13.5px] font-bold text-[#16181d] line-clamp-2 leading-snug">{item.name}</h3>
              <p className="text-[15px] font-extrabold text-[#16181d] mt-1.5">${item.price.toFixed(2)}</p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => handleMoveToCart(item)}
                  className="flex-1 h-[38px] flex items-center justify-center gap-1.5 bg-[#2563eb] text-white text-[12px] font-bold rounded-[10px] cursor-pointer hover:brightness-105 active:scale-[.98] transition-all duration-150"
                >
                  <ShoppingCart className="w-[14px] h-[14px]" />
                  Add to Cart
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.productId)}
                  className="w-[38px] h-[38px] flex items-center justify-center rounded-[10px] border border-[#eef0f3] text-[#9aa3ad] hover:text-[#ef4444] hover:border-[#ef4444] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-[14px] h-[14px]" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recently Viewed */}
      <div className="mt-10">
        <h2 className="text-[19px] font-extrabold text-[#16181d] tracking-[-.01em] mb-4">Recently Viewed</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px]">
          {recentlyViewed.map((p) => <ProductCard key={p.id} {...p} />)}
        </div>
      </div>

      {/* Recommended */}
      <div className="mt-10 mb-4">
        <h2 className="text-[19px] font-extrabold text-[#16181d] tracking-[-.01em] mb-4">Recommended For You</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px]">
          {recommended.map((p) => <ProductCard key={p.id} {...p} />)}
        </div>
      </div>
    </div>
  );
}
