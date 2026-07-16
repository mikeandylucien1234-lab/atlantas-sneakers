"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { getFlashDeals, getProducts } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/types";

function pad(n: number) { return String(n).padStart(2, "0"); }

// FLASH SALE — the main promotional event section: its own countdown, its own
// discounted products. Fully independent from the Flash Deal banner module.
export function FlashSales() {
  const { data: flashDeals } = useQuery(() => getFlashDeals(), []);
  const { data: saleProducts } = useQuery(() => getProducts({ sort: "price_asc", limit: 6 }), []);

  // Main Flash Sale countdown — resets to tonight's midnight.
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const target = (() => { const m = new Date(); m.setHours(24, 0, 0, 0); return m; })();
    const tick = () => setTotal(Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

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
      <div className="flex items-center justify-between gap-4 mb-[18px] flex-wrap">
        <div className="flex items-center gap-[13px]">
          <Zap className="w-[30px] h-[30px] text-[#ffb020] fill-[#ffb020]" />
          <div>
            <div className="text-[21px] font-extrabold text-white tracking-[-.01em]">FLASH SALES</div>
            <div className="text-[13px] text-white/65">Limited time deals. Grab them before they&apos;re gone!</div>
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
        <Link href="/deals" className="flex items-center gap-2 bg-[#ef4444] text-white font-bold text-[13px] py-[13px] px-[22px] rounded-[999px] shadow-[0_8px_18px_rgba(239,68,68,.4)] hover:brightness-[1.06] active:scale-[.97] transition-[filter,transform] duration-150">
          SHOP ALL DEALS <ArrowRight className="w-[17px] h-[17px]" />
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
