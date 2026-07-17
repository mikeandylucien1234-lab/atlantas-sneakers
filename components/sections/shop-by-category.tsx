import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Categories that are NOT already in the navbar. Each has its own relevant photo.
const IMG = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=240&h=240&q=80`;

const categories = [
  { name: "Hoodies", slug: "hoodies", img: IMG("1556821840-3a63f95609a7"), tint: "#7c3aed" },
  { name: "Jackets", slug: "jackets", img: IMG("1551028719-00167b16eac5"), tint: "#2563eb" },
  { name: "Tops", slug: "tops", img: IMG("1521572163474-6864f9cf17ab"), tint: "#ec4899" },
  { name: "Bottoms", slug: "bottoms", img: IMG("1541099649105-f69ad21f3246"), tint: "#0ea5e9" },
  { name: "Accessories", slug: "accessories", img: IMG("1611591437281-460bfbe1220a"), tint: "#f59e0b" },
  { name: "Electronics", slug: "electronics", img: IMG("1498049794561-7780e7231661"), tint: "#16a34a" },
  { name: "Headphones", slug: "headphones", img: IMG("1505740420928-5e560c06d30e"), tint: "#ef4444" },
  { name: "Watches", slug: "watches", img: IMG("1523275335684-37898b6baf30"), tint: "#0d9488" },
  { name: "Bags", slug: "bags", img: IMG("1553062407-98eeb64c6a62"), tint: "#d946ef" },
  { name: "Sunglasses", slug: "sunglasses", img: IMG("1572635196237-14b3f281503f"), tint: "#eab308" },
];

export function ShopByCategory() {
  return (
    <div className="mt-9">
      <div className="flex items-center justify-between gap-3 mb-[18px]">
        <h2 className="text-[19px] sm:text-[20px] lg:text-[21px] font-extrabold tracking-[-.01em]">SHOP BY CATEGORY</h2>
        <Link href="/categories" className="text-[13px] font-semibold text-[#2563eb] flex items-center gap-1 whitespace-nowrap hover:underline">
          View all <ArrowRight className="w-[15px] h-[15px]" />
        </Link>
      </div>
      {/* 2 cols mobile · 3 cols tablet · 5 cols desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-6">
        {categories.map(({ name, slug, img, tint }) => (
          <Link key={slug} href={`/category/${slug}`} className="flex flex-col items-center gap-3 group">
            <div
              className="w-[104px] sm:w-[116px] aspect-square rounded-full overflow-hidden ring-1 ring-black/[.04] transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:shadow-[0_16px_34px_rgba(16,24,40,.16)]"
              style={{ background: `${tint}18` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={name} loading="lazy" className="w-full h-full object-cover" />
            </div>
            <span className="text-[14px] font-semibold text-[#16181d] text-center">{name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
