"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getHomepageCategories } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";

// Fallback tiles used only when the CMS table is empty.
const FIMG = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=240&h=240&q=80`;
const fallback = [
  { id: "f1", name: "Hoodies", image_url: FIMG("1556821840-3a63f95609a7"), href: "/category/hoodies", radius: "circle", bg_color: "#7c3aed18", alt: "Hoodies", newTab: false },
  { id: "f2", name: "Tops", image_url: FIMG("1521572163474-6864f9cf17ab"), href: "/category/tops", radius: "circle", bg_color: "#ec489918", alt: "Tops", newTab: false },
  { id: "f3", name: "Accessories", image_url: FIMG("1611591437281-460bfbe1220a"), href: "/category/accessories", radius: "circle", bg_color: "#f59e0b18", alt: "Accessories", newTab: false },
  { id: "f4", name: "Headphones", image_url: FIMG("1505740420928-5e560c06d30e"), href: "/category/headphones", radius: "circle", bg_color: "#ef444418", alt: "Headphones", newTab: false },
];

const radiusCls = (r: string) => (r === "square" ? "rounded-[14px]" : r === "rounded" ? "rounded-[24px]" : "rounded-full");
// Fallback slug from a category name so a tile always resolves to a real
// /category/<slug> page (never the non-existent /categories route).
const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function ShopByCategory() {
  const { data } = useQuery(() => getHomepageCategories(), []);

  const tiles = (data && data.length)
    ? data.map((c: any) => ({
        id: c.id,
        name: c.name,
        image_url: c.image_url,
        alt: c.alt_text || c.name,
        radius: c.border_radius || "circle",
        bg_color: c.bg_color || "#eef0f3",
        newTab: !!c.open_new_tab,
        href: `/category/${c.category?.slug || slugify(c.name)}`,
      }))
    : fallback;

  if (!tiles.length) return null;

  return (
    <div className="mt-9">
      <div className="flex items-center justify-between gap-3 mb-[18px]">
        <h2 className="text-[19px] sm:text-[20px] lg:text-[21px] font-extrabold tracking-[-.01em]">SHOP BY CATEGORY</h2>
        <Link href="/categories" className="text-[13px] font-semibold text-[#2563eb] flex items-center gap-1 whitespace-nowrap hover:underline">
          View all <ArrowRight className="w-[15px] h-[15px]" />
        </Link>
      </div>
      {/* Mobile: 2 rows of 4, horizontal scroll · tablet 4 cols · desktop 8 cols */}
      <div className="grid grid-rows-2 grid-flow-col auto-cols-[24%] gap-x-2 gap-y-5 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid-rows-none sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-4 lg:grid-cols-8 sm:gap-x-4 sm:gap-y-6 sm:overflow-visible sm:pb-0">
        {tiles.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            target={t.newTab ? "_blank" : undefined}
            rel={t.newTab ? "noopener noreferrer" : undefined}
            className="flex flex-col items-center gap-2 group snap-start min-w-0 w-[70px] sm:w-[104px] mx-auto"
          >
            <div
              className={`w-[70px] sm:w-[104px] aspect-square overflow-hidden ring-1 ring-black/[.04] transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:shadow-[0_16px_34px_rgba(16,24,40,.16)] ${radiusCls(t.radius)}`}
              style={{ background: t.bg_color }}
            >
              {t.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.image_url} alt={t.alt} loading="lazy" className="w-full h-full object-cover" />
              )}
            </div>
            <span className="w-full text-[12px] sm:text-[13px] leading-tight font-semibold text-[#16181d] text-center line-clamp-2 break-words">{t.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
