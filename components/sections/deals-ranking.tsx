"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getFlashDeals, getBestSellers, getProducts } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";
import type { Product } from "@/types";

type Item = { slug: string; name: string; image?: string; price: number; badge: string };

function toItems(products: Product[], flash = false): Item[] {
  return (products || []).slice(0, 2).map((p) => {
    const price = Number(p.price);
    const compare = p.compare_price ? Number(p.compare_price) : 0;
    const pct = compare > price ? Math.round(((compare - price) / compare) * 100) : 0;
    return {
      slug: p.slug,
      name: p.name,
      image: p.images?.[0],
      price,
      badge: flash ? (pct > 0 ? `${pct}% OFF` : "Flash Sale") : (pct > 0 ? `${pct}% OFF` : "Hot"),
    };
  });
}

function Column({ title, href, items }: { title: string; href: string; items: Item[] }) {
  return (
    <div className="bg-white rounded-[14px] border border-[#eef0f3] p-3">
      <Link href={href} className="flex items-center justify-between mb-2.5 group">
        <h3 className="text-[15px] sm:text-[17px] font-extrabold italic text-[#16181d] tracking-[-.01em]">{title}</h3>
        <ChevronRight className="w-5 h-5 text-[#16181d] group-hover:translate-x-0.5 transition-transform" />
      </Link>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <Link key={it.slug} href={`/product/${it.slug}`} className="group">
            <div className="aspect-square rounded-[10px] overflow-hidden bg-[#f4f5f7]">
              {it.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image} alt={it.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
              ) : null}
            </div>
            <div className="mt-1.5">
              <div className="text-[15px] sm:text-[16px] font-extrabold text-[#e0301e] leading-none">${it.price.toFixed(2)}</div>
              <div className="text-[11px] font-semibold text-[#e0301e]/80 mt-0.5">{it.badge}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function DealsRanking() {
  const { data: flashDeals } = useQuery(() => getFlashDeals(), []);
  const { data: bestSellers } = useQuery(() => getBestSellers(), []);
  const { data: fallback } = useQuery(() => getProducts({ limit: 20 }), []);

  const fb: Product[] = (fallback as Product[]) || [];

  // Super Deals ← flash_deals (with embedded product), else fallback products.
  const flashProducts: Product[] = (flashDeals || [])
    .map((d: any) => d.product)
    .filter(Boolean);
  const superItems = toItems(flashProducts.length ? flashProducts : fb.slice(0, 2), true);

  // Top Ranking ← best sellers, else remaining fallback products.
  const ranking: Product[] = (bestSellers as Product[])?.length ? (bestSellers as Product[]) : fb.slice(2, 4);
  const rankingItems = toItems(ranking, false);

  if (superItems.length === 0 && rankingItems.length === 0) return null;

  return (
    <div className="mt-9 grid grid-cols-2 gap-3">
      <Column title="Super Deals" href="/super-deals" items={superItems} />
      <Column title="Top Ranking Items" href="/best-sellers" items={rankingItems} />
    </div>
  );
}
