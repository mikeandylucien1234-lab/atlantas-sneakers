"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/ui/price-display";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const bestSellers = [
  { id: "bs1", slug: "nike-air-force-1", name: "Nike Air Force 1 '07", brand: "Nike", price: 109.99, image: "/placeholder.svg", rank: 1 },
  { id: "bs2", slug: "jordan-1-retro-high", name: "Jordan 1 Retro High OG", brand: "Jordan", price: 159.99, comparePrice: 189.99, image: "/placeholder.svg", rank: 2 },
  { id: "bs3", slug: "adidas-ultraboost-22", name: "Adidas Ultraboost 22", brand: "Adidas", price: 189.99, image: "/placeholder.svg", rank: 3 },
  { id: "bs4", slug: "new-balance-550", name: "New Balance 550", brand: "New Balance", price: 109.99, image: "/placeholder.svg", rank: 4 },
  { id: "bs5", slug: "nike-dunk-low", name: "Nike Dunk Low Retro", brand: "Nike", price: 109.99, image: "/placeholder.svg", rank: 5 },
  { id: "bs6", slug: "converse-chuck-70", name: "Converse Chuck 70 Hi", brand: "Converse", price: 89.99, image: "/placeholder.svg", rank: 6 },
  { id: "bs7", slug: "puma-suede-classic", name: "Puma Suede Classic XXI", brand: "Puma", price: 74.99, comparePrice: 89.99, image: "/placeholder.svg", rank: 7 },
  { id: "bs8", slug: "nike-air-max-90", name: "Nike Air Max 90", brand: "Nike", price: 129.99, image: "/placeholder.svg", rank: 8 },
];

function RankedCard({ id, slug, name, brand, price, comparePrice, image, rank }: typeof bestSellers[0]) {
  const toggleItem = useWishlistStore((s) => s.toggleItem);
  const isWishlisted = useWishlistStore((s) => s.isInWishlist(id));

  const rankColors: Record<number, string> = {
    1: "bg-[#fbbf24] text-[#78350f]",
    2: "bg-[#d1d5db] text-[#374151]",
    3: "bg-[#d97706] text-white",
  };

  return (
    <div className="group relative bg-white rounded-[14px] border border-[#eef0f3] overflow-hidden transition-[transform,box-shadow] duration-[160ms] ease-out hover:-translate-y-[3px] hover:shadow-[0_12px_26px_rgba(16,24,40,.12)]">
      <Link href={`/product/${slug}`} className="block">
        <div className="relative aspect-square bg-[#f4f5f7] overflow-hidden">
          <Image src={image} alt={name} fill className="object-cover transition-transform duration-[160ms] group-hover:scale-105" sizes="(max-width:768px) 50vw, 25vw" />
          {/* Rank badge */}
          <div className={cn(
            "absolute top-2 left-2 w-[30px] h-[30px] rounded-[8px] flex items-center justify-center text-[13px] font-extrabold",
            rankColors[rank] ?? "bg-[#eef0f3] text-[#5b6472]"
          )}>
            #{rank}
          </div>
          <Badge variant="bestseller" className="absolute top-2 right-10 text-[10px] px-2 py-1">Bestseller</Badge>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => toggleItem({ id: crypto.randomUUID(), productId: id, name, image, price })}
        className="absolute top-2 right-2 h-[30px] w-[30px] flex items-center justify-center rounded-full bg-white/[.92] shadow-[0_2px_7px_rgba(16,24,40,.16)] hover:bg-white transition-all duration-150 cursor-pointer"
      >
        <Heart className={cn("h-[15px] w-[15px] transition-colors", isWishlisted ? "fill-[#ef4444] text-[#ef4444]" : "text-[#9aa3ad]")} />
      </button>

      <div className="px-[13px] pt-[12px] pb-[14px]">
        <p className="text-[12px] font-medium text-[#9aa3ad] uppercase tracking-[.04em]">{brand}</p>
        <Link href={`/product/${slug}`}>
          <h3 className="mt-0.5 text-[13.5px] font-bold text-[#16181d] line-clamp-2 hover:text-[#2563eb] transition-colors leading-snug">{name}</h3>
        </Link>
        <div className="mt-1.5">
          <PriceDisplay price={price} comparePrice={comparePrice} />
        </div>
      </div>
    </div>
  );
}

export default function BestSellersPage() {
  return (
    <div className="mt-4 mb-6">
      {/* Hero */}
      <div className="bg-[linear-gradient(135deg,#1d4ed8,#2563eb)] rounded-[18px] px-6 sm:px-10 py-10 text-white relative overflow-hidden">
        <div className="absolute top-4 right-6 opacity-10">
          <Trophy className="w-[120px] h-[120px]" />
        </div>
        <p className="text-[13px] font-bold text-white/50 uppercase tracking-[.06em]">Most Popular</p>
        <h1 className="text-[32px] sm:text-[40px] font-extrabold tracking-[-.02em] mt-1">BEST SELLERS</h1>
        <p className="text-[14px] text-white/60 mt-2 max-w-[400px]">Our most loved sneakers, ranked by you. See what everyone&apos;s wearing.</p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 mt-5 bg-white text-[#1d4ed8] font-bold text-[13px] py-[12px] px-6 rounded-[13px] hover:bg-[#f7f8fa] active:scale-[.98] transition-all duration-150"
        >
          Shop All <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Products */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px] mt-6">
        {bestSellers.map((p) => (
          <RankedCard key={p.id} {...p} />
        ))}
      </div>
    </div>
  );
}
