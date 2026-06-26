"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, Clock } from "lucide-react";
import { ProductCard } from "@/components/ui/product-card";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { getFlashDeals, getProducts } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";
import type { Product } from "@/types";

function useCountdown() {
  const [time, setTime] = useState({ h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const diff = Math.max(0, end.getTime() - now.getTime());
      setTime({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-[52px] h-[48px] bg-white/10 rounded-[10px] flex items-center justify-center text-[22px] font-extrabold text-white tabular-nums">
        {String(value).padStart(2, "0")}
      </div>
      <span className="text-[10px] text-white/60 mt-1 uppercase tracking-[.06em]">{label}</span>
    </div>
  );
}

export default function DealsPage() {
  const { h, m, s } = useCountdown();

  const { data: flashDeals, loading: dealsLoading } = useQuery(() => getFlashDeals(), []);
  const { data: saleProducts, loading: productsLoading } = useQuery(
    () => getProducts({ sort: "price_asc", limit: 8 }),
    []
  );

  const loading = dealsLoading || productsLoading;

  const dealProducts: Array<Product & { dealPrice?: number }> = [];
  if (flashDeals) {
    for (const deal of flashDeals) {
      if (deal.product) {
        dealProducts.push({ ...deal.product as Product, dealPrice: Number(deal.deal_price) });
      }
    }
  }
  if (saleProducts) {
    for (const p of saleProducts) {
      if (p.compare_price && !dealProducts.find((d) => d.id === p.id)) {
        dealProducts.push(p);
      }
    }
  }

  return (
    <div className="mt-4 mb-6">
      <div className="bg-[linear-gradient(135deg,#1a0606,#561414)] rounded-[18px] px-6 sm:px-10 py-8 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Flame className="w-[24px] h-[24px] text-[#f97316]" />
          <span className="text-[13px] font-bold text-white/70 uppercase tracking-[.06em]">Limited Time Only</span>
        </div>
        <h1 className="text-[30px] sm:text-[36px] font-extrabold tracking-[-.02em]">FLASH DEALS</h1>
        <p className="text-[14px] text-white/70 mt-1">Up to 60% off — hurry, deals end at midnight!</p>

        <div className="flex items-center gap-3 mt-5">
          <Clock className="w-[18px] h-[18px] text-[#f97316]" />
          <span className="text-[13px] font-bold text-white/70 mr-1">Ends in:</span>
          <CountdownBox value={h} label="Hours" />
          <span className="text-[20px] font-bold text-white/40">:</span>
          <CountdownBox value={m} label="Mins" />
          <span className="text-[20px] font-bold text-white/40">:</span>
          <CountdownBox value={s} label="Secs" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px] mt-6">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : dealProducts.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                slug={p.slug}
                name={p.name}
                brand={p.brand?.name ?? ""}
                price={p.dealPrice ?? Number(p.price)}
                comparePrice={p.dealPrice ? Number(p.price) : p.compare_price ? Number(p.compare_price) : undefined}
                image={p.images?.[0] ?? "/placeholder.svg"}
              />
            ))
        }
        {!loading && dealProducts.length === 0 && (
          <div className="col-span-full text-center py-12">
            <p className="text-[14px] text-[#5b6472]">No active deals right now. Check back soon!</p>
            <Link href="/shop" className="text-[14px] font-bold text-[#2563eb] hover:underline mt-2 inline-block">Shop All</Link>
          </div>
        )}
      </div>
    </div>
  );
}
