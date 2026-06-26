"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/ui/product-card";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { getProductsByCategory, getCategories } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";

const categoryMeta: Record<string, { gradient: string; description: string }> = {
  men: { gradient: "linear-gradient(135deg, #dbe7fb 0%, #eef2fc 100%)", description: "Discover our latest men's sneakers, from classic silhouettes to cutting-edge designs." },
  women: { gradient: "linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)", description: "Explore the latest women's sneakers — bold styles, comfort, and performance." },
  kids: { gradient: "linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)", description: "Fun, durable sneakers for the little ones. Built to keep up with them." },
  sneakers: { gradient: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)", description: "Our full sneaker catalog — every brand, every style, every size." },
  running: { gradient: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)", description: "High-performance running shoes engineered for speed and comfort." },
  basketball: { gradient: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", description: "Court-ready basketball shoes from the top brands in the game." },
  lifestyle: { gradient: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)", description: "Everyday sneakers that blend comfort with style." },
};

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: products, loading } = useQuery(() => getProductsByCategory(slug), [slug]);
  const { data: categories } = useQuery(() => getCategories(), []);

  const currentCategory = categories?.find((c) => c.slug === slug);
  const meta = categoryMeta[slug] ?? { gradient: "linear-gradient(135deg, #dbe7fb 0%, #eef2fc 100%)", description: "Browse our collection." };
  const title = currentCategory?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 text-[13px] text-[#9aa3ad] mb-4">
        <Link href="/" className="hover:text-[#2563eb] transition-colors">Home</Link>
        <span>/</span>
        <span className="text-[#16181d] font-semibold">{title}</span>
      </div>

      <div className="rounded-[18px] px-8 py-10 sm:px-12 sm:py-14 relative overflow-hidden" style={{ background: meta.gradient }}>
        <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em]">{title}</h1>
        <p className="text-[14px] text-[#5b6472] mt-2 max-w-[480px] leading-[1.6]">{meta.description}</p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 mt-5 bg-[#2563eb] text-white font-bold text-[13px] py-[12px] px-6 rounded-[13px] shadow-[0_10px_22px_rgba(37,99,235,.3)] hover:brightness-105 active:scale-[.98] transition-all duration-150"
        >
          Shop Now <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[19px] font-extrabold text-[#16181d] tracking-[-.01em]">
            {loading ? "Loading..." : `${products?.length ?? 0} Products`}
          </h2>
          <Link href="/shop" className="text-[13px] font-bold text-[#2563eb] hover:underline flex items-center gap-1">
            View All <ArrowRight className="w-[14px] h-[14px]" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px]">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)
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
                  isFeatured={p.is_featured}
                />
              ))
          }
        </div>
        {!loading && products?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[14px] text-[#5b6472]">No products in this category yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
