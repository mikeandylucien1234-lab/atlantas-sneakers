"use client";

import Link from "next/link";
import { useQuery } from "@/lib/hooks/use-query";
import { getLandingShopCategories } from "@/lib/supabase/queries";

type Row = {
  id: string;
  name: string;
  image_url?: string | null;
  link_url?: string | null;
  alt_text?: string | null;
  category?: { slug?: string } | null;
};

// Premium, SHEIN-style Shop by Category for the Curve page: clean wrapping
// rows of circular cards (4 across on mobile), fully CMS-driven & editable.
export function CurveShopByCategory() {
  const { data } = useQuery(() => getLandingShopCategories("curve"), []);
  const rows = (data || []) as Row[];
  if (!rows.length) return null;

  return (
    <div>
      <h2 className="mb-4 text-[19px] sm:text-[20px] lg:text-[21px] font-extrabold tracking-[-.01em] text-[#16181d]">SHOP BY CATEGORY</h2>
      <div className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6 lg:grid-cols-9">
        {rows.map((r) => {
          const href = r.category?.slug ? `/category/${r.category.slug}` : (r.link_url || "/category/curve");
          return (
            <Link key={r.id} href={href} className="group flex flex-col items-center gap-2">
              <div className="aspect-square w-full overflow-hidden rounded-full bg-[#f4f5f7] ring-1 ring-black/[.04] shadow-[0_4px_14px_rgba(16,24,40,.08)] transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_14px_30px_rgba(16,24,40,.16)]">
                {r.image_url && /* eslint-disable-next-line @next/next/no-img-element */ (
                  <img src={r.image_url} alt={r.alt_text || r.name} loading="lazy" className="h-full w-full object-cover" />
                )}
              </div>
              <span className="w-full text-center text-[11px] sm:text-[12px] font-semibold leading-tight text-[#16181d] line-clamp-2 break-words">{r.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
