"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getBestSellers, getNewArrivals, getProducts } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";
import { ProductCard } from "@/components/ui/product-card";
import { ProductCardSkeleton } from "@/components/ui/skeleton";

export function BestSellersNewArrivals() {
  const { data: bestSellers, loading: bsLoading } = useQuery(() => getBestSellers(), []);
  const { data: newArrivals, loading: naLoading } = useQuery(() => getNewArrivals(), []);
  const { data: fallback } = useQuery(() => getProducts({ sort: "featured", limit: 8 }), []);

  const bsProducts = bestSellers?.length ? bestSellers : fallback ?? [];
  const naProducts = newArrivals?.length ? newArrivals : fallback ?? [];

  return (
    <div className="space-y-10 mt-10">
      {/* Best Sellers */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[19px] sm:text-[20px] font-extrabold tracking-[-.01em]">BEST SELLERS</h2>
          <Link href="/best-sellers" className="text-[13px] font-semibold text-[#2563eb] flex items-center gap-1 whitespace-nowrap hover:underline">
            View all <ArrowRight className="w-[15px] h-[15px]" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {bsLoading
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : bsProducts.slice(0, 4).map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  slug={p.slug}
                  name={p.name}
                  brand={p.brand?.name ?? ""}
                  price={Number(p.price)}
                  comparePrice={p.compare_price ? Number(p.compare_price) : undefined}
                  image={p.images?.[0] ?? "/placeholder.svg"}
                  isNew={p.is_new}
                  isFeatured={p.is_featured}
                />
              ))
          }
        </div>
      </section>

      {/* New Arrivals */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[19px] sm:text-[20px] font-extrabold tracking-[-.01em]">NEW ARRIVALS</h2>
          <Link href="/new-arrivals" className="text-[13px] font-semibold text-[#2563eb] flex items-center gap-1 whitespace-nowrap hover:underline">
            View all <ArrowRight className="w-[15px] h-[15px]" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {naLoading
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : naProducts.slice(0, 4).map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  slug={p.slug}
                  name={p.name}
                  brand={p.brand?.name ?? ""}
                  price={Number(p.price)}
                  comparePrice={p.compare_price ? Number(p.compare_price) : undefined}
                  image={p.images?.[0] ?? "/placeholder.svg"}
                  isNew={p.is_new}
                  isFeatured={p.is_featured}
                />
              ))
          }
        </div>
      </section>
    </div>
  );
}
