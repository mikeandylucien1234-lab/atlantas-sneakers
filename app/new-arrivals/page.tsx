"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ProductCard } from "@/components/ui/product-card";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { getNewArrivals } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";

export default function NewArrivalsPage() {
  const { data: products, loading } = useQuery(() => getNewArrivals(), []);

  return (
    <div className="mt-4 mb-6">
      <div className="bg-[linear-gradient(135deg,#0a0b0d,#1a1d24)] rounded-[18px] px-6 sm:px-10 py-10 text-white relative overflow-hidden">
        <div className="absolute top-4 right-6 opacity-10">
          <Sparkles className="w-[120px] h-[120px]" />
        </div>
        <p className="text-[13px] font-bold text-white/50 uppercase tracking-[.06em]">Just Dropped</p>
        <h1 className="text-[32px] sm:text-[40px] font-extrabold tracking-[-.02em] mt-1">NEW ARRIVALS</h1>
        <p className="text-[14px] text-white/60 mt-2 max-w-[400px]">Be the first to rock the latest drops from your favorite brands.</p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 mt-5 bg-white text-[#16181d] font-bold text-[13px] py-[12px] px-6 rounded-[13px] hover:bg-[#f7f8fa] active:scale-[.98] transition-all duration-150"
        >
          Shop All <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px] mt-6">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : products?.map((p) => (
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
              />
            ))
        }
      </div>
    </div>
  );
}
