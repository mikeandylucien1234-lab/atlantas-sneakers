"use client";

import Link from "next/link";
import { ArrowRight, Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import { getProducts } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";
import { Skeleton } from "@/components/ui/skeleton";

export function RecommendedForYou() {
  const toggleItem = useWishlistStore((s) => s.toggleItem);
  const isInWishlist = useWishlistStore((s) => s.isInWishlist);

  const { data: products, loading } = useQuery(() => getProducts({ limit: 6 }), []);

  if (!loading && (!products || products.length === 0)) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-[19px] sm:text-[20px] lg:text-[21px] font-extrabold tracking-[-.01em]">RECOMMENDED FOR YOU</h2>
        <Link href="/shop" className="text-[13px] font-semibold text-[#2563eb] flex items-center gap-1 whitespace-nowrap hover:underline">
          View all <ArrowRight className="w-[15px] h-[15px]" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#eef0f3] rounded-[14px] p-3">
                <Skeleton variant="image" className="rounded-[10px] mb-[11px]" />
                <Skeleton variant="text" className="w-4/5 h-3.5 mb-2" />
                <Skeleton variant="text" className="w-1/3 h-4" />
              </div>
            ))
          : products?.slice(0, 6).map((p) => {
              const wishlisted = isInWishlist(p.id);
              return (
                <Link
                  key={p.id}
                  href={`/product/${p.slug}`}
                  className="bg-white border border-[#eef0f3] rounded-[14px] p-3 cursor-pointer transition-[transform,box-shadow] duration-[180ms] ease-out hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,24,40,.12)]"
                >
                  <div className="relative mb-[11px]">
                    <div className="aspect-square rounded-[10px] overflow-hidden bg-[repeating-linear-gradient(135deg,#eef0f3_0,#eef0f3_9px,#e4e7eb_9px,#e4e7eb_18px)] flex items-center justify-center">
                      {p.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span className="font-mono text-[9px] tracking-[.08em] text-[#9aa3ad]">{p.brand?.name?.toUpperCase() ?? ""}</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleItem({ id: p.id, productId: p.id, name: p.name, image: p.images?.[0] ?? "", price: Number(p.price) }); }}
                      className="absolute top-2 right-2 w-[30px] h-[30px] rounded-full bg-white shadow-[0_3px_8px_rgba(16,24,40,.16)] flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                    >
                      <Heart className={cn("w-[18px] h-[18px]", wishlisted ? "fill-[#ef4444] text-[#ef4444]" : "text-[#9ca3af]")} />
                    </button>
                  </div>
                  <div className="text-[13px] font-semibold text-[#16181d] leading-[1.3] mb-[5px] min-h-[34px]">{p.name}</div>
                  <div className="text-[16px] font-extrabold text-[#16181d] mb-1.5">${Number(p.price).toFixed(2)}</div>
                  <div className="flex items-center gap-1 text-[12px] text-[#6b7280]">
                    <Star className="w-[14px] h-[14px] fill-[#f59e0b] text-[#f59e0b]" />
                    <span className="font-bold text-[#374151]">4.8</span>
                  </div>
                </Link>
              );
            })
        }
      </div>
    </div>
  );
}
