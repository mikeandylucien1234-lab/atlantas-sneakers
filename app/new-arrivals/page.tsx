"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ProductCard } from "@/components/ui/product-card";
import { cn } from "@/lib/utils";

const timeFilters = ["This Week", "This Month", "All"];

const newProducts = [
  { id: "n1", slug: "nike-air-max-dn", name: "Nike Air Max Dn", brand: "Nike", price: 159.99, image: "/placeholder.svg", isNew: true },
  { id: "n2", slug: "adidas-ae1", name: "Adidas AE 1 Low", brand: "Adidas", price: 119.99, image: "/placeholder.svg", isNew: true },
  { id: "n3", slug: "jordan-1-low-se", name: "Jordan 1 Low SE", brand: "Jordan", price: 129.99, image: "/placeholder.svg", isNew: true },
  { id: "n4", slug: "nb-1906r", name: "New Balance 1906R", brand: "New Balance", price: 149.99, image: "/placeholder.svg", isNew: true },
  { id: "n5", slug: "puma-lamelo-mb04", name: "Puma LaMelo MB.04", brand: "Puma", price: 134.99, image: "/placeholder.svg", isNew: true },
  { id: "n6", slug: "nike-gt-hustle-3", name: "Nike GT Hustle 3", brand: "Nike", price: 189.99, image: "/placeholder.svg", isNew: true },
  { id: "n7", slug: "converse-weapon-cx", name: "Converse Weapon CX", brand: "Converse", price: 109.99, image: "/placeholder.svg", isNew: true },
  { id: "n8", slug: "adidas-campus-00s", name: "Adidas Campus 00s", brand: "Adidas", price: 99.99, image: "/placeholder.svg", isNew: true },
];

export default function NewArrivalsPage() {
  const [activeFilter, setActiveFilter] = useState("All");

  return (
    <div className="mt-4 mb-6">
      {/* Hero */}
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

      {/* Filters */}
      <div className="flex gap-2 mt-6 overflow-x-auto pb-1 scrollbar-hide">
        {timeFilters.map((f) => (
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
        {newProducts.map((p) => (
          <ProductCard key={p.id} {...p} />
        ))}
      </div>
    </div>
  );
}
