"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { getBestSellers, getNewArrivals } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";
import { Skeleton } from "@/components/ui/skeleton";

export function BestSellersNewArrivals() {
  const { data: bestSellers, loading: bsLoading } = useQuery(() => getBestSellers(), []);
  const { data: newArrivals, loading: naLoading } = useQuery(() => getNewArrivals(), []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-9 mt-10">
      {/* Best Sellers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-extrabold">BEST SELLERS</h2>
          <Link href="/best-sellers" className="text-[13px] font-semibold text-[#2563eb] hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
          {bsLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton variant="image" className="rounded-[11px] mb-[9px]" />
                  <Skeleton variant="text" className="w-4/5 h-3 mb-1" />
                  <Skeleton variant="text" className="w-1/3 h-4" />
                </div>
              ))
            : bestSellers?.slice(0, 4).map((p) => (
                <Link key={p.id} href={`/product/${p.slug}`} className="cursor-pointer transition-[transform,box-shadow] duration-[180ms] hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,24,40,.12)]">
                  <div className="aspect-square rounded-[11px] border border-[#eef0f3] bg-[repeating-linear-gradient(135deg,#eef0f3_0,#eef0f3_9px,#e4e7eb_9px,#e4e7eb_18px)] flex items-center justify-center mb-[9px]">
                    <span className="font-mono text-[8px] tracking-[.08em] text-[#9aa3ad]">{p.brand?.name?.toUpperCase() ?? ""}</span>
                  </div>
                  <div className="text-[12px] font-semibold text-[#16181d] leading-[1.3] mb-1">{p.name}</div>
                  <div className="text-[14px] font-extrabold text-[#16181d] mb-1">${Number(p.price).toFixed(2)}</div>
                  <div className="flex items-center gap-[3px] text-[11px] text-[#6b7280]">
                    <Star className="w-[13px] h-[13px] fill-[#f59e0b] text-[#f59e0b]" />
                    <span className="font-bold text-[#374151]">4.8</span>
                  </div>
                </Link>
              ))
          }
        </div>
      </div>

      {/* New Arrivals */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-extrabold">NEW ARRIVALS</h2>
          <Link href="/new-arrivals" className="text-[13px] font-semibold text-[#2563eb] hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
          {naLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton variant="image" className="rounded-[11px] mb-[9px]" />
                  <Skeleton variant="text" className="w-4/5 h-3 mb-1" />
                  <Skeleton variant="text" className="w-1/3 h-4" />
                </div>
              ))
            : newArrivals?.slice(0, 4).map((p) => (
                <Link key={p.id} href={`/product/${p.slug}`} className="cursor-pointer transition-[transform,box-shadow] duration-[180ms] hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,24,40,.12)]">
                  <div className="aspect-square rounded-[11px] border border-[#eef0f3] bg-[repeating-linear-gradient(135deg,#eef0f3_0,#eef0f3_9px,#e4e7eb_9px,#e4e7eb_18px)] flex items-center justify-center mb-[9px]">
                    <span className="font-mono text-[8px] tracking-[.08em] text-[#9aa3ad]">{p.brand?.name?.toUpperCase() ?? ""}</span>
                  </div>
                  <div className="text-[12px] font-semibold text-[#16181d] leading-[1.3] mb-1">{p.name}</div>
                  <div className="text-[14px] font-extrabold text-[#16181d]">${Number(p.price).toFixed(2)}</div>
                </Link>
              ))
          }
        </div>
      </div>
    </div>
  );
}
