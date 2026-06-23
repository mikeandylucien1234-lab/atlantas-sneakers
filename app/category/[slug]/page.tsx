"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/ui/product-card";
import { cn } from "@/lib/utils";

const categoryData: Record<string, { title: string; description: string; gradient: string; subcategories: { name: string; color: string }[] }> = {
  men: {
    title: "Men's Collection",
    description: "Discover our latest men's sneakers, from classic silhouettes to cutting-edge designs.",
    gradient: "linear-gradient(135deg, #dbe7fb 0%, #eef2fc 100%)",
    subcategories: [
      { name: "Running", color: "#dbeafe" },
      { name: "Basketball", color: "#fce7f3" },
      { name: "Lifestyle", color: "#d1fae5" },
      { name: "Skateboarding", color: "#fef3c7" },
      { name: "Training", color: "#ede9fe" },
      { name: "Walking", color: "#ffe4e6" },
    ],
  },
  women: {
    title: "Women's Collection",
    description: "Explore the latest women's sneakers — bold styles, comfort, and performance.",
    gradient: "linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)",
    subcategories: [
      { name: "Running", color: "#dbeafe" },
      { name: "Lifestyle", color: "#d1fae5" },
      { name: "Training", color: "#ede9fe" },
      { name: "Walking", color: "#fef3c7" },
      { name: "Slip-Ons", color: "#ffe4e6" },
      { name: "Platform", color: "#fce7f3" },
    ],
  },
  kids: {
    title: "Kids Collection",
    description: "Fun, durable sneakers for the little ones. Built to keep up with them.",
    gradient: "linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)",
    subcategories: [
      { name: "Boys", color: "#dbeafe" },
      { name: "Girls", color: "#fce7f3" },
      { name: "Toddler", color: "#fef3c7" },
      { name: "School", color: "#d1fae5" },
    ],
  },
  sneakers: {
    title: "Sneakers",
    description: "Our full sneaker catalog — every brand, every style, every size.",
    gradient: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)",
    subcategories: [
      { name: "High Tops", color: "#dbeafe" },
      { name: "Low Tops", color: "#d1fae5" },
      { name: "Mid Tops", color: "#fef3c7" },
      { name: "Slip-Ons", color: "#ede9fe" },
      { name: "Retro", color: "#ffe4e6" },
      { name: "Limited Edition", color: "#fce7f3" },
    ],
  },
};

const mockProducts = [
  { id: "c1", slug: "nike-air-max-90", name: "Nike Air Max 90", brand: "Nike", price: 129.99, comparePrice: 159.99, image: "/placeholder.svg", isNew: true },
  { id: "c2", slug: "adidas-ultraboost-22", name: "Adidas Ultraboost 22", brand: "Adidas", price: 189.99, image: "/placeholder.svg", isFeatured: true },
  { id: "c3", slug: "jordan-retro-high", name: "Jordan 1 Retro High OG", brand: "Jordan", price: 159.99, image: "/placeholder.svg" },
  { id: "c4", slug: "new-balance-550", name: "New Balance 550", brand: "New Balance", price: 109.99, image: "/placeholder.svg", isNew: true },
  { id: "c5", slug: "puma-suede-classic", name: "Puma Suede Classic XXI", brand: "Puma", price: 74.99, comparePrice: 89.99, image: "/placeholder.svg" },
  { id: "c6", slug: "converse-chuck-70", name: "Converse Chuck 70 Hi", brand: "Converse", price: 89.99, image: "/placeholder.svg" },
];

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const category = categoryData[slug] ?? {
    title: slug.charAt(0).toUpperCase() + slug.slice(1),
    description: "Browse our collection.",
    gradient: "linear-gradient(135deg, #dbe7fb 0%, #eef2fc 100%)",
    subcategories: [],
  };

  return (
    <div className="mt-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px] text-[#9aa3ad] mb-4">
        <Link href="/" className="hover:text-[#2563eb] transition-colors">Home</Link>
        <span>/</span>
        <span className="text-[#16181d] font-semibold">{category.title}</span>
      </div>

      {/* Hero Banner */}
      <div
        className="rounded-[18px] px-8 py-10 sm:px-12 sm:py-14 relative overflow-hidden"
        style={{ background: category.gradient }}
      >
        <h1 className="text-[27px] font-extrabold text-[#16181d] tracking-[-.02em]">{category.title}</h1>
        <p className="text-[14px] text-[#5b6472] mt-2 max-w-[480px] leading-[1.6]">{category.description}</p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-1.5 mt-5 bg-[#2563eb] text-white font-bold text-[13px] py-[12px] px-6 rounded-[13px] shadow-[0_10px_22px_rgba(37,99,235,.3)] hover:brightness-105 active:scale-[.98] transition-all duration-150"
        >
          Shop Now <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Sub-categories */}
      {category.subcategories.length > 0 && (
        <div className="mt-8">
          <h2 className="text-[19px] font-extrabold text-[#16181d] tracking-[-.01em] mb-4">Shop by Style</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {category.subcategories.map((sub) => (
              <Link
                key={sub.name}
                href={`/shop?category=${slug}&style=${sub.name.toLowerCase()}`}
                className="flex flex-col items-center gap-2 shrink-0 group"
              >
                <div
                  className="w-[64px] h-[64px] rounded-full flex items-center justify-center transition-transform duration-150 group-hover:scale-105"
                  style={{ backgroundColor: sub.color }}
                >
                  <div className="w-[38px] h-[38px] rounded-[10px] bg-white/60 flex items-center justify-center">
                    <span className="text-[14px]">👟</span>
                  </div>
                </div>
                <span className="text-[12px] font-semibold text-[#5b6472] group-hover:text-[#2563eb] transition-colors">{sub.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[19px] font-extrabold text-[#16181d] tracking-[-.01em]">Popular in {category.title}</h2>
          <Link href="/shop" className="text-[13px] font-bold text-[#2563eb] hover:underline flex items-center gap-1">
            View All <ArrowRight className="w-[14px] h-[14px]" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px]">
          {mockProducts.map((p) => (
            <ProductCard key={p.id} {...p} />
          ))}
        </div>
      </div>
    </div>
  );
}
