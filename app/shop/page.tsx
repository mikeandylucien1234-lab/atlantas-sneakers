"use client";

import { useState } from "react";
import { SlidersHorizontal, Grid3X3, LayoutList, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/ui/product-card";
import { FiltersSidebar } from "@/components/layout/filters-sidebar";
import { cn } from "@/lib/utils";

const sortOptions = [
  { label: "Featured", value: "featured" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Newest", value: "newest" },
  { label: "Best Selling", value: "best_selling" },
];

const mockProducts = [
  { id: "s1", slug: "nike-air-max-90", name: "Nike Air Max 90", brand: "Nike", price: 129.99, comparePrice: 159.99, image: "/placeholder.svg", isNew: true },
  { id: "s2", slug: "adidas-ultraboost-22", name: "Adidas Ultraboost 22", brand: "Adidas", price: 189.99, image: "/placeholder.svg", isFeatured: true },
  { id: "s3", slug: "jordan-retro-high", name: "Jordan 1 Retro High OG", brand: "Jordan", price: 159.99, comparePrice: 189.99, image: "/placeholder.svg" },
  { id: "s4", slug: "new-balance-550", name: "New Balance 550", brand: "New Balance", price: 109.99, image: "/placeholder.svg", isNew: true },
  { id: "s5", slug: "puma-suede-classic", name: "Puma Suede Classic XXI", brand: "Puma", price: 74.99, comparePrice: 89.99, image: "/placeholder.svg" },
  { id: "s6", slug: "converse-chuck-70", name: "Converse Chuck 70 Hi", brand: "Converse", price: 89.99, image: "/placeholder.svg" },
  { id: "s7", slug: "nike-dunk-low", name: "Nike Dunk Low Retro", brand: "Nike", price: 109.99, image: "/placeholder.svg", isFeatured: true },
  { id: "s8", slug: "adidas-forum-low", name: "Adidas Forum Low", brand: "Adidas", price: 99.99, comparePrice: 119.99, image: "/placeholder.svg" },
  { id: "s9", slug: "jordan-4-retro", name: "Jordan 4 Retro", brand: "Jordan", price: 199.99, image: "/placeholder.svg", isNew: true },
  { id: "s10", slug: "nike-air-force-1", name: "Nike Air Force 1 '07", brand: "Nike", price: 109.99, image: "/placeholder.svg" },
  { id: "s11", slug: "nb-2002r", name: "New Balance 2002R", brand: "New Balance", price: 139.99, comparePrice: 159.99, image: "/placeholder.svg" },
  { id: "s12", slug: "puma-rs-x", name: "Puma RS-X Reinvention", brand: "Puma", price: 119.99, image: "/placeholder.svg", isFeatured: true },
];

export default function ShopPage() {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState("featured");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 5;

  return (
    <div className="mt-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px] text-[#9aa3ad] mb-4">
        <span className="hover:text-[#2563eb] cursor-pointer transition-colors">Home</span>
        <span>/</span>
        <span className="text-[#16181d] font-semibold">Shop All</span>
      </div>

      <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em]">Shop All</h1>
      <p className="text-[14px] text-[#5b6472] mt-1">Showing 1-12 of 571 results</p>

      <div className="flex gap-5 mt-5">
        <FiltersSidebar mobileOpen={mobileFiltersOpen} onMobileClose={() => setMobileFiltersOpen(false)} />

        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between bg-white border border-[#eef0f3] rounded-[14px] px-4 py-3 mb-4">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden flex items-center gap-2 text-[13px] font-bold text-[#16181d] cursor-pointer"
            >
              <SlidersHorizontal className="w-[18px] h-[18px]" />
              Filters
            </button>

            <div className="hidden lg:flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-colors cursor-pointer",
                  viewMode === "grid" ? "bg-[#2563eb] text-white" : "text-[#9aa3ad] hover:bg-[#f7f8fa]"
                )}
              >
                <Grid3X3 className="w-[18px] h-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "w-[36px] h-[36px] flex items-center justify-center rounded-[8px] transition-colors cursor-pointer",
                  viewMode === "list" ? "bg-[#2563eb] text-white" : "text-[#9aa3ad] hover:bg-[#f7f8fa]"
                )}
              >
                <LayoutList className="w-[18px] h-[18px]" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#9aa3ad] hidden sm:inline">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-[11px] border border-[#e4e7eb] bg-white px-3 py-2 text-[13px] font-semibold text-[#16181d] cursor-pointer outline-none"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Grid */}
          <div className={cn(
            "grid gap-[14px]",
            viewMode === "grid" ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
          )}>
            {mockProducts.map((p) => (
              <ProductCard key={p.id} {...p} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2 mt-8 mb-4">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="w-[42px] h-[42px] flex items-center justify-center rounded-[11px] border border-[#e4e7eb] text-[#5b6472] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-[18px] h-[18px]" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={cn(
                  "w-[42px] h-[42px] flex items-center justify-center rounded-[11px] text-[14px] font-bold transition-colors cursor-pointer",
                  page === currentPage
                    ? "bg-[#2563eb] text-white"
                    : "border border-[#e4e7eb] text-[#5b6472] hover:border-[#2563eb] hover:text-[#2563eb]"
                )}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="w-[42px] h-[42px] flex items-center justify-center rounded-[11px] border border-[#e4e7eb] text-[#5b6472] hover:border-[#2563eb] hover:text-[#2563eb] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
