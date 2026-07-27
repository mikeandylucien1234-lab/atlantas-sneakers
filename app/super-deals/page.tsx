"use client";

import Link from "next/link";
import { BadgePercent } from "lucide-react";
import { ProductCard } from "@/components/ui/product-card";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { getProducts } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";
import type { Product } from "@/types";

const discount = (p: Product) =>
  p.compare_price && Number(p.compare_price) > Number(p.price)
    ? Math.round(((Number(p.compare_price) - Number(p.price)) / Number(p.compare_price)) * 100)
    : 0;

export default function SuperDealsPage() {
  const { data, loading } = useQuery(() => getProducts({ limit: 60 }), []);

  // Biggest discounts first.
  const items = (data || [])
    .filter((p: Product) => discount(p) > 0)
    .sort((a: Product, b: Product) => discount(b) - discount(a));

  return (
    <div className="mt-4 mb-6">
      <div className="bg-[linear-gradient(135deg,#0b1e4d,#2563eb)] rounded-[18px] px-6 sm:px-10 py-8 text-white">
        <div className="flex items-center gap-2 mb-2">
          <BadgePercent className="w-[24px] h-[24px] text-[#f5c518]" />
          <span className="text-[13px] font-bold text-white/70 uppercase tracking-[.06em]">Best Discounts</span>
        </div>
        <h1 className="text-[30px] sm:text-[36px] font-extrabold tracking-[-.02em]">SUPER DEALS</h1>
        <p className="text-[14px] text-white/70 mt-1">The biggest markdowns across the store, ranked by savings.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px] mt-6">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : items.map((p: Product) => (
              <ProductCard key={p.id} id={p.id} slug={p.slug} name={p.name} brand={p.brand?.name ?? ""}
                price={Number(p.price)} comparePrice={p.compare_price ? Number(p.compare_price) : undefined}
                image={p.images?.[0] ?? "/placeholder.svg"} isNew={p.is_new} isFeatured={p.is_featured} />
            ))}
        {!loading && items.length === 0 && (
          <div className="col-span-full text-center py-12">
            <p className="text-[14px] text-[#5b6472]">No super deals right now. Check back soon!</p>
            <Link href="/shop" className="text-[14px] font-bold text-[#2563eb] hover:underline mt-2 inline-block">Shop All</Link>
          </div>
        )}
      </div>
    </div>
  );
}
