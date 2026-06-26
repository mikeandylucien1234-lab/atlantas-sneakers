"use client";

import { useState, useEffect } from "react";
import { Flame, Clock } from "lucide-react";
import { ProductCard } from "@/components/ui/product-card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const filters = ["All", "Sneakers", "Clothing", "Tech"];

const dealProducts = [
  { id: "d1", slug: "nike-air-max-97", name: "Nike Air Max 97", brand: "Nike", price: 99.99, comparePrice: 179.99, image: "/placeholder.svg", category: "Sneakers" },
  { id: "d2", slug: "adidas-yeezy-350", name: "Adidas Yeezy Boost 350", brand: "Adidas", price: 149.99, comparePrice: 249.99, image: "/placeholder.svg", category: "Sneakers" },
  { id: "d3", slug: "jordan-11-retro", name: "Jordan 11 Retro", brand: "Jordan", price: 139.99, comparePrice: 219.99, image: "/placeholder.svg", category: "Sneakers" },
  { id: "d4", slug: "nike-tech-fleece", name: "Nike Tech Fleece Joggers", brand: "Nike", price: 59.99, comparePrice: 109.99, image: "/placeholder.svg", category: "Clothing" },
  { id: "d5", slug: "beats-studio", name: "Beats Studio Pro", brand: "Beats", price: 199.99, comparePrice: 349.99, image: "/placeholder.svg", category: "Tech" },
  { id: "d6", slug: "nb-990v6", name: "New Balance 990v6", brand: "New Balance", price: 129.99, comparePrice: 199.99, image: "/placeholder.svg", category: "Sneakers" },
  { id: "d7", slug: "adidas-track-jacket", name: "Adidas Originals Track Jacket", brand: "Adidas", price: 44.99, comparePrice: 79.99, image: "/placeholder.svg", category: "Clothing" },
  { id: "d8", slug: "apple-airpods", name: "Apple AirPods Pro 2", brand: "Apple", price: 179.99, comparePrice: 249.99, image: "/placeholder.svg", category: "Tech" },
];

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
  const [activeFilter, setActiveFilter] = useState("All");
  const { h, m, s } = useCountdown();

  const filtered = activeFilter === "All"
    ? dealProducts
    : dealProducts.filter((p) => p.category === activeFilter);

  return (
    <div className="mt-4 mb-6">
      {/* Hero Banner */}
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

      {/* Filters */}
      <div className="flex gap-2 mt-6 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFilter(f)}
            className={cn(
              "px-5 py-2.5 rounded-[999px] text-[13px] font-bold transition-colors cursor-pointer whitespace-nowrap",
              activeFilter === f
                ? "bg-[#2563eb] text-white"
                : "bg-white border border-[#e4e7eb] text-[#5b6472] hover:border-[#2563eb] hover:text-[#2563eb]"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Products */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px] mt-5">
        {filtered.map((p) => (
          <ProductCard key={p.id} {...p} />
        ))}
      </div>
    </div>
  );
}
