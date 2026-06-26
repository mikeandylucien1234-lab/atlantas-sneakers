"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, Grid3X3, LayoutList, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/ui/product-card";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { FiltersSidebar } from "@/components/layout/filters-sidebar";
import { cn } from "@/lib/utils";
import { getProducts, type ProductFilters } from "@/lib/supabase/queries";
import type { Product } from "@/types";

const sortOptions = [
  { label: "Featured", value: "featured" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Newest", value: "newest" },
];

const PAGE_SIZE = 12;

export default function ShopPage() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState("featured");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const filters: ProductFilters = {
        sort: sortBy as ProductFilters["sort"],
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
      };
      if (searchQuery) filters.search = searchQuery;
      const data = await getProducts(filters);
      setProducts(data);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [sortBy, currentPage, searchQuery]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const totalPages = Math.max(1, Math.ceil(products.length < PAGE_SIZE ? currentPage : currentPage + 1));

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 text-[13px] text-[#9aa3ad] mb-4">
        <span className="hover:text-[#2563eb] cursor-pointer transition-colors">Home</span>
        <span>/</span>
        <span className="text-[#16181d] font-semibold">{searchQuery ? `Search: "${searchQuery}"` : "Shop All"}</span>
      </div>

      <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em]">
        {searchQuery ? `Results for "${searchQuery}"` : "Shop All"}
      </h1>
      <p className="text-[14px] text-[#5b6472] mt-1">
        {loading ? "Loading..." : `Showing ${products.length} results`}
      </p>

      <div className="flex gap-5 mt-5">
        <FiltersSidebar mobileOpen={mobileFiltersOpen} onMobileClose={() => setMobileFiltersOpen(false)} />

        <div className="flex-1 min-w-0">
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
                onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                className="rounded-[11px] border border-[#e4e7eb] bg-white px-3 py-2 text-[13px] font-semibold text-[#16181d] cursor-pointer outline-none"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={cn("grid gap-[14px]", viewMode === "grid" ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-1")}>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : products.map((p) => (
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

          {!loading && products.length === 0 && (
            <div className="text-center py-16">
              <p className="text-[16px] font-bold text-[#16181d]">No products found</p>
              <p className="text-[14px] text-[#5b6472] mt-1">Try adjusting your filters or search term.</p>
            </div>
          )}

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
              disabled={products.length < PAGE_SIZE}
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
