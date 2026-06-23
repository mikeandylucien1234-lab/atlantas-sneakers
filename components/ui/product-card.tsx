"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { PriceDisplay } from "./price-display";
import { useWishlistStore } from "@/lib/store/wishlist-store";

type ProductCardProps = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  comparePrice?: number;
  image: string;
  isNew?: boolean;
  isFeatured?: boolean;
  className?: string;
};

export function ProductCard({
  id,
  slug,
  name,
  brand,
  price,
  comparePrice,
  image,
  isNew,
  isFeatured,
  className,
}: ProductCardProps) {
  const toggleItem = useWishlistStore((s) => s.toggleItem);
  const isWishlisted = useWishlistStore((s) => s.isInWishlist(id));
  const discount = comparePrice ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;

  return (
    <div
      className={cn(
        "group relative bg-white rounded-[14px] border border-[#eef0f3] overflow-hidden transition-[transform,box-shadow] duration-[160ms] ease-out hover:-translate-y-[3px] hover:shadow-[0_12px_26px_rgba(16,24,40,.12)]",
        className
      )}
    >
      <Link href={`/products/${slug}`} className="block">
        <div className="relative aspect-square bg-[#f4f5f7] overflow-hidden">
          <Image src={image} alt={name} fill className="object-cover transition-transform duration-[160ms] group-hover:scale-105" sizes="(max-width:768px) 50vw, 25vw" />
          <div className="absolute top-2 left-2 flex flex-col gap-1.5">
            {isNew && <Badge variant="new">New</Badge>}
            {discount > 0 && <Badge variant="sale">-{discount}%</Badge>}
            {isFeatured && <Badge variant="hot">Hot</Badge>}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => toggleItem({ id: crypto.randomUUID(), productId: id, name, image, price })}
        className="absolute top-2 right-2 h-[30px] w-[30px] flex items-center justify-center rounded-full bg-white/[.92] shadow-[0_2px_7px_rgba(16,24,40,.16)] hover:bg-white transition-all duration-150 cursor-pointer"
      >
        <Heart
          className={cn(
            "h-[15px] w-[15px] transition-colors",
            isWishlisted ? "fill-[#ef4444] text-[#ef4444]" : "text-[#9aa3ad]"
          )}
        />
      </button>

      <div className="px-[13px] pt-[12px] pb-[14px]">
        <p className="text-[12px] font-medium text-[#9aa3ad] uppercase tracking-[.04em]">{brand}</p>
        <Link href={`/products/${slug}`}>
          <h3 className="mt-0.5 text-[13.5px] font-bold text-[#16181d] line-clamp-2 hover:text-[#2563eb] transition-colors leading-snug">
            {name}
          </h3>
        </Link>
        <div className="mt-1.5">
          <PriceDisplay price={price} comparePrice={comparePrice} />
        </div>
      </div>
    </div>
  );
}
