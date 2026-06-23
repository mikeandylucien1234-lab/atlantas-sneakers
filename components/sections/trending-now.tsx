"use client";

import Link from "next/link";
import { ArrowRight, Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlistStore } from "@/lib/store/wishlist-store";

const products = [
  { id: "tr1", name: "Nike Air Force 1 '07", label: "AIR FORCE 1", price: "$129.99", rating: "4.8", reviews: "512" },
  { id: "tr2", name: "Jordan 4 Retro Red Cement", label: "JORDAN 4", price: "$209.99", rating: "4.8", reviews: "620" },
  { id: "tr3", name: "Adidas Samba OG", label: "SAMBA OG", price: "$99.99", rating: "4.7", reviews: "341" },
  { id: "tr4", name: "New Balance 550", label: "NB 550", price: "$129.99", rating: "4.9", reviews: "892" },
  { id: "tr5", name: "Nike Dunk Low Retro", label: "DUNK LOW", price: "$109.99", rating: "4.6", reviews: "823" },
  { id: "tr6", name: "Converse Chuck 70 Hi", label: "CHUCK 70", price: "$89.99", rating: "4.8", reviews: "445" },
];

export function TrendingNow() {
  const toggleItem = useWishlistStore((s) => s.toggleItem);
  const isInWishlist = useWishlistStore((s) => s.isInWishlist);

  return (
    <div className="mt-[38px]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-[19px] sm:text-[20px] lg:text-[21px] font-extrabold tracking-[-.01em]">TRENDING NOW</h2>
        <Link href="/best-sellers" className="text-[13px] font-semibold text-[#2563eb] flex items-center gap-1 whitespace-nowrap hover:underline">
          View all <ArrowRight className="w-[15px] h-[15px]" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {products.map((p) => {
          const wishlisted = isInWishlist(p.id);
          return (
            <div
              key={p.id}
              className="bg-white border border-[#eef0f3] rounded-[14px] p-3 cursor-pointer transition-[transform,box-shadow] duration-[180ms] ease-out hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,24,40,.12)]"
            >
              <div className="relative mb-[11px]">
                <div className="aspect-square rounded-[10px] bg-[repeating-linear-gradient(135deg,#eef0f3_0,#eef0f3_9px,#e4e7eb_9px,#e4e7eb_18px)] flex items-center justify-center">
                  <span className="font-mono text-[9px] tracking-[.08em] text-[#9aa3ad]">{p.label}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleItem({ id: p.id, productId: p.id, name: p.name, image: "", price: parseFloat(p.price.slice(1)) }); }}
                  className="absolute top-2 right-2 w-[30px] h-[30px] rounded-full bg-white shadow-[0_3px_8px_rgba(16,24,40,.16)] flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                >
                  <Heart className={cn("w-[18px] h-[18px]", wishlisted ? "fill-[#ef4444] text-[#ef4444]" : "text-[#9ca3af]")} />
                </button>
              </div>
              <div className="text-[13px] font-semibold text-[#16181d] leading-[1.3] mb-[5px] min-h-[34px]">{p.name}</div>
              <div className="text-[16px] font-extrabold text-[#16181d] mb-1.5">{p.price}</div>
              <div className="flex items-center gap-1 text-[12px] text-[#6b7280]">
                <Star className="w-[14px] h-[14px] fill-[#f59e0b] text-[#f59e0b]" />
                <span className="font-bold text-[#374151]">{p.rating}</span>
                <span>({p.reviews})</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
