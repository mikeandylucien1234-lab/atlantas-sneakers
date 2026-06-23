import Link from "next/link";
import { Star } from "lucide-react";

const bestSellers = [
  { name: "Jordan 1 Mid", label: "JORDAN 1", price: "$149.99", rating: "4.8", reviews: "1.1k" },
  { name: "Nike Air Max 90", label: "AM 90", price: "$129.99", rating: "4.7", reviews: "850" },
  { name: "Adidas Ultraboost 23", label: "ULTRABOOST", price: "$189.99", rating: "4.9", reviews: "1.3k" },
  { name: "New Balance 574", label: "NB 574", price: "$99.99", rating: "4.8", reviews: "690" },
];

const newArrivals = [
  { name: "New Balance 530", label: "NB 530", price: "$129.99" },
  { name: "Nike Vomero 18", label: "VOMERO", price: "$159.99" },
  { name: "Adidas Gazelle Bold", label: "GAZELLE", price: "$119.99" },
  { name: "Puma Speedcat OG", label: "SPEEDCAT", price: "$109.99" },
];

export function BestSellersNewArrivals() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-9 mt-10">
      {/* Best Sellers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-extrabold">BEST SELLERS</h2>
          <Link href="/best-sellers" className="text-[13px] font-semibold text-[#2563eb] hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
          {bestSellers.map((p) => (
            <div key={p.name} className="cursor-pointer transition-[transform,box-shadow] duration-[180ms] hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,24,40,.12)]">
              <div className="aspect-square rounded-[11px] border border-[#eef0f3] bg-[repeating-linear-gradient(135deg,#eef0f3_0,#eef0f3_9px,#e4e7eb_9px,#e4e7eb_18px)] flex items-center justify-center mb-[9px]">
                <span className="font-mono text-[8px] tracking-[.08em] text-[#9aa3ad]">{p.label}</span>
              </div>
              <div className="text-[12px] font-semibold text-[#16181d] leading-[1.3] mb-1">{p.name}</div>
              <div className="text-[14px] font-extrabold text-[#16181d] mb-1">{p.price}</div>
              <div className="flex items-center gap-[3px] text-[11px] text-[#6b7280]">
                <Star className="w-[13px] h-[13px] fill-[#f59e0b] text-[#f59e0b]" />
                <span className="font-bold text-[#374151]">{p.rating}</span>
                <span>({p.reviews})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Arrivals */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-extrabold">NEW ARRIVALS</h2>
          <Link href="/new-arrivals" className="text-[13px] font-semibold text-[#2563eb] hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
          {newArrivals.map((p) => (
            <div key={p.name} className="cursor-pointer transition-[transform,box-shadow] duration-[180ms] hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,24,40,.12)]">
              <div className="aspect-square rounded-[11px] border border-[#eef0f3] bg-[repeating-linear-gradient(135deg,#eef0f3_0,#eef0f3_9px,#e4e7eb_9px,#e4e7eb_18px)] flex items-center justify-center mb-[9px]">
                <span className="font-mono text-[8px] tracking-[.08em] text-[#9aa3ad]">{p.label}</span>
              </div>
              <div className="text-[12px] font-semibold text-[#16181d] leading-[1.3] mb-1">{p.name}</div>
              <div className="text-[14px] font-extrabold text-[#16181d]">{p.price}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
