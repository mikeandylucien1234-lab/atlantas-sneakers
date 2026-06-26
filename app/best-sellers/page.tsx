"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/ui/price-display";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBestSellers } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";
import type { Product } from "@/types";

function RankedCard({ product, rank }: { product: Product; rank: number }) {
  const toggleItem = useWishlistStore((s) => s.toggleItem);
  const isWishlisted = useWishlistStore((s) => s.isInWishlist(product.id));
  const image = product.images?.[0] ?? "/placeholder.svg";

  const rankColors: Record<number, string> = {
    1: "bg-[#fbbf24] text-[#78350f]",
    2: "bg-[#d1d5db] text-[#374151]",
    3: "bg-[#d97706] text-white",
  };

  return (
    <div className="group relative bg-white rounded-[14px] border border-[#eef0f3] overflow-hidden transition-[transform,box-shadow] duration-[160ms] ease-out hover:-translate-y-[3px] hover:shadow-[0_12px_26px_rgba(16,24,40,.12)]">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-square bg-[#f4f5f7] overflow-hidden">
          <Image src={image} alt={product.name} fill className="object-cover transition-transform duration-[160ms] group-hover:scale-105" sizes="(max-width:768px) 50vw, 25vw" />
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
        onClick={() => toggleItem({ id: crypto.randomUUID(), productId: product.id, name: product.name, image, price: Number(product.price) })}
        className="absolute top-2 right-2 h-[30px] w-[30px] flex items-center justify-center rounded-full bg-white/[.92] shadow-[0_2px_7px_rgba(16,24,40,.16)] hover:bg-white transition-all duration-150 cursor-pointer"
      >
        <Heart className={cn("h-[15px] w-[15px] transition-colors", isWishlisted ? "fill-[#ef4444] text-[#ef4444]" : "text-[#9aa3ad]")} />
      </button>

      <div className="px-[13px] pt-[12px] pb-[14px]">
        <p className="text-[12px] font-medium text-[#9aa3ad] uppercase tracking-[.04em]">{product.brand?.name ?? ""}</p>
        <Link href={`/product/${product.slug}`}>
          <h3 className="mt-0.5 text-[13.5px] font-bold text-[#16181d] line-clamp-2 hover:text-[#2563eb] transition-colors leading-snug">{product.name}</h3>
        </Link>
        <div className="mt-1.5">
          <PriceDisplay price={Number(product.price)} comparePrice={product.compare_price ? Number(product.compare_price) : undefined} />
        </div>
      </div>
    </div>
  );
}

export default function BestSellersPage() {
  const { data: products, loading } = useQuery(() => getBestSellers(), []);

  return (
    <div className="mt-4 mb-6">
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px] mt-6">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : products?.map((p, i) => <RankedCard key={p.id} product={p} rank={i + 1} />)
        }
      </div>
    </div>
  );
}
