import Link from "next/link";
import { ArrowRight } from "lucide-react";

const categories = [
  { name: "Men", slug: "men", color: "#2563eb" },
  { name: "Women", slug: "women", color: "#ec4899" },
  { name: "Kids", slug: "kids", color: "#f97316" },
  { name: "Sneakers", slug: "sneakers", color: "#7c3aed" },
  { name: "Running", slug: "running", color: "#16a34a" },
  { name: "Basketball", slug: "basketball", color: "#ef4444" },
  { name: "Lifestyle", slug: "lifestyle", color: "#eab308" },
  { name: "New Arrivals", slug: "new-arrivals", color: "#06b6d4" },
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
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-[10px]">
        {categories.map(({ name, slug, color }) => (
          <Link key={slug} href={`/category/${slug}`} className="flex flex-col items-center gap-[9px]">
            <div
              className="w-16 sm:w-[72px] lg:w-[78px] aspect-square rounded-full border border-[#eef0f3] flex items-center justify-center transition-[transform,box-shadow] duration-[180ms] hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,24,40,.12)]"
              style={{ background: `${color}15` }}
            >
              <span className="text-[20px] sm:text-[24px] font-extrabold" style={{ color }}>{name[0]}</span>
            </div>
            <span className="text-[12px] font-semibold text-[#374151] text-center">{name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
