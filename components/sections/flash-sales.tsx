"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { getFlashDeals, getProducts, getBannersByLocation } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/types";

function pad(n: number) { return String(n).padStart(2, "0"); }

export function FlashSales() {
  const { data: flashDeals } = useQuery(() => getFlashDeals(), []);
  const { data: saleProducts } = useQuery(() => getProducts({ sort: "price_asc", limit: 6 }), []);
  const { data: stripBanners } = useQuery(() => getBannersByLocation("flash_deal_strip"), []);

  // Active banners are already filtered by schedule + ordered by priority.
  // Rotate through them (highest priority first) every 8s when there are several.
  const banners = stripBanners || [];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (banners.length <= 1) { setIdx(0); return; }
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 8000);
    return () => clearInterval(t);
  }, [banners.length]);
  const strip = banners[idx % Math.max(1, banners.length)] || banners[0];

  // Countdown target: the active banner's end date, else tonight's midnight.
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const target = strip?.ends_at ? new Date(strip.ends_at) : (() => { const m = new Date(); m.setHours(24, 0, 0, 0); return m; })();
    const tick = () => setTotal(Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [strip?.ends_at]);

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

  const accent = strip?.cta_color || "#ef4444";
  const title = strip?.name || "FLASH SALES";
  const subtitle = strip?.description || "Limited time deals. Grab them before they're gone!";
  const ctaLabel = strip?.cta_label || "SHOP ALL DEALS";
  const ctaHref = strip?.link_url || "/deals";
  const bannerImg = strip?.image_desktop || strip?.image_mobile || strip?.image_tablet;

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
      {/* Dynamic Flash Deal banner (image + link from the admin) — integrated
          inside the section, above the countdown. */}
      {bannerImg && (
        <Link href={ctaHref} className="block mb-5 rounded-[14px] overflow-hidden group relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bannerImg} alt={strip?.alt_text || title} className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          {banners.length > 1 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {banners.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />
              ))}
            </div>
          )}
        </Link>
      )}
      <div className="flex items-center justify-between gap-4 mb-[18px] flex-wrap">
        <div className="flex items-center gap-[13px]">
          <Zap className="w-[30px] h-[30px]" style={{ color: accent, fill: accent }} />
          <div>
            <div className="text-[21px] font-extrabold text-white tracking-[-.01em]">{title}</div>
            <div className="text-[13px] text-white/65">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-[9px]">
          {countdown.map((t) => (
            <div key={t.label} className="text-center">
              <div className="bg-[#0d0303] border border-white/[.12] rounded-[9px] min-w-[48px] py-2 px-1.5 text-[21px] font-extrabold text-white tabular-nums">{t.val}</div>
              <div className="text-[9px] font-bold tracking-[.12em] text-white/55 mt-[5px]">{t.label}</div>
            </div>
          ))}
        </div>
        <Link href={ctaHref} className="flex items-center gap-2 text-white font-bold text-[13px] py-[13px] px-[22px] rounded-[999px] shadow-[0_8px_18px_rgba(0,0,0,.3)] hover:brightness-[1.06] active:scale-[.97] transition-[filter,transform] duration-150" style={{ backgroundColor: accent }}>
          {ctaLabel} <ArrowRight className="w-[17px] h-[17px]" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
