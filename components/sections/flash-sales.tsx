"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { getFlashDeals, getProducts, getBannersByLocation } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/types";

function pad(n: number) { return String(n).padStart(2, "0"); }

// Categories shown inside the "Explore Your Interests" card (photo + name).
const IIMG = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=120&h=120&q=70`;
const INTERESTS = [
  { name: "Men's Jewelry", slug: "accessories", img: IIMG("1611591437281-460bfbe1220a") },
  { name: "Sunglasses", slug: "sunglasses", img: IIMG("1572635196237-14b3f281503f") },
  { name: "Headphones", slug: "headphones", img: IIMG("1505740420928-5e560c06d30e") },
  { name: "Watches", slug: "watches", img: IIMG("1523275335684-37898b6baf30") },
  { name: "Hoodies", slug: "hoodies", img: IIMG("1556821840-3a63f95609a7") },
  { name: "Bags", slug: "bags", img: IIMG("1553062407-98eeb64c6a62") },
];

// FLASH SALE — the main promotional event section. Its header (image, title,
// subtitle, CTA, colors, link and countdown target) is driven by the
// flash_deal_strip banner in the admin, fully editable without code changes.
// The discounted products render directly under this integrated header.
export function FlashSales() {
  const { data: flashDeals } = useQuery(() => getFlashDeals(), []);
  const { data: saleProducts } = useQuery(() => getProducts({ sort: "price_asc", limit: 6 }), []);
  const { data: bannerData } = useQuery(() => getBannersByLocation("flash_deal_strip"), []);

  // Rotate between active banners (already priority-ordered & in-schedule).
  const banners = bannerData || [];
  const [bIdx, setBIdx] = useState(0);
  useEffect(() => {
    if (banners.length <= 1) { setBIdx(0); return; }
    const t = setInterval(() => setBIdx((i) => (i + 1) % banners.length), 8000);
    return () => clearInterval(t);
  }, [banners.length]);
  const banner = banners[bIdx % Math.max(1, banners.length)] || banners[0];

  // Dynamic header fields (fall back to sensible defaults when no banner).
  const bgImage = banner?.image_desktop || banner?.image_mobile || banner?.image_tablet;
  const title = banner?.name || "FLASH SALES";
  const subtitle = banner?.description || "Limited time deals. Grab them before they're gone!";
  const ctaLabel = banner?.cta_label || "SHOP ALL DEALS";
  const ctaHref = banner?.link_url || "/deals";
  const accent = banner?.cta_color || "#ef4444";

  // Countdown target = banner end date, else tonight's midnight.
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const target = banner?.ends_at ? new Date(banner.ends_at) : (() => { const m = new Date(); m.setHours(24, 0, 0, 0); return m; })();
    const tick = () => setTotal(Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [banner?.ends_at]);

  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const countdown = [
    { val: pad(d), label: "DAYS" },
    { val: pad(h), label: "HRS" },
    { val: pad(m), label: "MINS" },
    { val: pad(s), label: "SECS" },
  ];

  const items: Array<{ name: string; label: string; price: string; old?: string; disc?: string; slug: string; image?: string }> = [];

  if (flashDeals) {
    for (const deal of flashDeals) {
      const p = deal.product as Product | undefined;
      if (!p) continue;
      const origPrice = Number(p.price);
      const dealPrice = Number(deal.deal_price);
      const pct = Math.round(((origPrice - dealPrice) / origPrice) * 100);
      items.push({ name: p.name, label: p.brand?.name?.toUpperCase() ?? "", price: `$${dealPrice.toFixed(2)}`, old: `$${origPrice.toFixed(2)}`, disc: `-${pct}%`, slug: p.slug, image: p.images?.[0] });
    }
  }

  if (saleProducts) {
    for (const p of saleProducts) {
      if (items.length >= 6) break;
      if (items.find((i) => i.slug === p.slug)) continue;
      if (p.compare_price) {
        const pct = Math.round(((Number(p.compare_price) - Number(p.price)) / Number(p.compare_price)) * 100);
        items.push({ name: p.name, label: p.brand?.name?.toUpperCase() ?? "", price: `$${Number(p.price).toFixed(2)}`, old: `$${Number(p.compare_price).toFixed(2)}`, disc: `-${pct}%`, slug: p.slug, image: p.images?.[0] });
      } else {
        items.push({ name: p.name, label: p.brand?.name?.toUpperCase() ?? "", price: `$${Number(p.price).toFixed(2)}`, slug: p.slug, image: p.images?.[0] });
      }
    }
  }

  return (
    <div className="mt-10 rounded-[18px] overflow-hidden bg-[linear-gradient(120deg,#1a0606_0%,#3b0d0d_45%,#561414_100%)] px-[14px] sm:px-5 lg:px-[22px] py-5">
      {/* Integrated Flash Deal banner header — image as background (right-anchored),
          title/subtitle/countdown/CTA overlaid. All fields dynamic from admin. */}
      <div className="relative rounded-[14px] overflow-hidden mb-[18px] -mx-[14px] sm:-mx-5 lg:-mx-[22px] -mt-5">
        {bgImage && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgImage} alt={banner?.alt_text || title} className="absolute inset-0 w-full h-full object-cover object-right" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/10" />
          </>
        )}
        <div className="relative z-[1] px-[14px] sm:px-5 lg:px-[22px] py-6">
          <div className="flex items-center gap-[13px] mb-4">
            <Zap className="w-[30px] h-[30px] shrink-0" style={{ color: accent, fill: accent }} />
            <div>
              <div className="text-[22px] sm:text-[26px] font-extrabold text-white tracking-[-.01em] drop-shadow-[0_2px_6px_rgba(0,0,0,.5)]">{title}</div>
              <div className="text-[13px] text-white/80 max-w-[520px] drop-shadow-[0_1px_3px_rgba(0,0,0,.5)]">{subtitle}</div>
            </div>
          </div>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex items-center gap-[9px]">
              {countdown.map((t) => (
                <div key={t.label} className="text-center">
                  <div className="bg-black/60 border border-white/[.15] rounded-[9px] min-w-[48px] py-2 px-1.5 text-[21px] font-extrabold text-white tabular-nums">{t.val}</div>
                  <div className="text-[9px] font-bold tracking-[.12em] text-white/70 mt-[5px]">{t.label}</div>
                </div>
              ))}
            </div>
            <Link href={ctaHref} className="flex items-center gap-2 text-white font-bold text-[13px] py-[13px] px-[22px] rounded-[999px] shadow-[0_8px_18px_rgba(0,0,0,.35)] hover:brightness-[1.06] active:scale-[.97] transition-[filter,transform] duration-150" style={{ backgroundColor: accent }}>
              {ctaLabel} <ArrowRight className="w-[17px] h-[17px]" />
            </Link>
          </div>
          {banners.length > 1 && (
            <div className="flex gap-1.5 mt-4">
              {banners.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === bIdx ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 [grid-auto-flow:dense]">
        {/* Explore Your Interests — one grid cell, spans 2 rows, scrollable list */}
        <div className="row-span-2 bg-white rounded-[12px] p-3 flex flex-col min-h-0">
          <p className="text-[13px] font-extrabold text-[#16181d] mb-2 shrink-0">Explore Your Interests</p>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 [scrollbar-width:thin]">
            {INTERESTS.map((it) => (
              <Link key={it.slug} href={`/category/${it.slug}`} className="flex items-center gap-2.5 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.img} alt={it.name} loading="lazy" className="w-11 h-11 rounded-[9px] object-cover shrink-0 bg-[#f4f5f7]" />
                <span className="text-[12px] font-semibold text-[#16181d] leading-tight line-clamp-2 group-hover:text-[#2563eb]">{it.name}</span>
              </Link>
            ))}
          </div>
        </div>
        {items.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-[12px] p-[11px]">
                <Skeleton variant="image" className="rounded-[9px] mb-[10px]" />
                <Skeleton variant="text" className="w-4/5 h-3 mb-2" />
                <Skeleton variant="text" className="w-1/3 h-4" />
              </div>
            ))
          : items.map((p) => (
              <Link href={`/product/${p.slug}`} key={p.slug} className="bg-white rounded-[12px] p-[11px] cursor-pointer transition-[transform,box-shadow] duration-[180ms] hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,24,40,.12)]">
                <div className="relative mb-[10px]">
                  <div className="aspect-square rounded-[9px] overflow-hidden bg-[repeating-linear-gradient(135deg,#eef0f3_0,#eef0f3_9px,#e4e7eb_9px,#e4e7eb_18px)] flex items-center justify-center">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="font-mono text-[9px] tracking-[.08em] text-[#9aa3ad]">{p.label}</span>
                    )}
                  </div>
                  {p.disc && <span className="absolute top-[7px] left-[7px] bg-[#ef4444] text-white text-[11px] font-extrabold py-[3px] px-[7px] rounded-[6px]">{p.disc}</span>}
                </div>
                <div className="text-[12px] font-semibold text-[#16181d] leading-[1.3] mb-[7px] min-h-[31px]">{p.name}</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[15px] font-extrabold text-[#16181d]">{p.price}</span>
                  {p.old && <span className="text-[12px] text-[#9aa3ad] line-through">{p.old}</span>}
                </div>
              </Link>
            ))
        }
      </div>
    </div>
  );
}
