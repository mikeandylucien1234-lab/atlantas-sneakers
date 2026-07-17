"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Check } from "lucide-react";
import { getActiveCoupons } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";

type Coupon = { code: string; type: string; value: number; min_order: number };

export function SpecialOffers() {
  const { data } = useQuery(() => getActiveCoupons(), []);
  const coupons = (data as Coupon[]) || [];
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState(false);

  if (!coupons.length) return null;

  const claim = (code: string) => {
    try { navigator.clipboard?.writeText(code); } catch {}
    setCopied(code);
    setToast(true);
    setTimeout(() => setToast(false), 2000);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
  };

  return (
    <div className="mt-9">
      <div className="flex items-center justify-between gap-3 mb-[14px]">
        <h2 className="text-[19px] sm:text-[20px] lg:text-[21px] font-extrabold tracking-[-.01em]">Special Offers</h2>
        <Link href="/shop" className="text-[13px] font-semibold text-[#8b95a3] flex items-center gap-1 whitespace-nowrap hover:text-[#7c3aed]">
          More <ChevronRight className="w-[15px] h-[15px]" />
        </Link>
      </div>

      {/* Horizontal scroll with peek of the next card */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {coupons.map((c) => {
          const off = c.type === "percentage" ? `${Math.round(Number(c.value))}%` : `$${Number(c.value).toFixed(0)}`;
          const saveTxt = c.type === "percentage" ? `Save ${Math.round(Number(c.value))}% off` : `Save up to $${Number(c.value).toFixed(0)}`;
          const isCopied = copied === c.code;
          return (
            <div
              key={c.code}
              className="shrink-0 snap-start w-[86%] sm:w-[46%] lg:w-[31%] xl:w-[24%] bg-[#f6f4ff] rounded-[14px] p-3.5 flex items-center gap-3"
            >
              <div className="shrink-0 text-[#7c3aed] leading-none">
                <span className="text-[22px] font-extrabold">{off}</span>
                <span className="text-[13px] font-extrabold"> off</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-[#16181d] truncate">{c.code}</div>
                <div className="text-[12px] text-[#8b95a3] truncate">{saveTxt} · min ${Number(c.min_order).toFixed(0)}</div>
              </div>
              <button
                onClick={() => claim(c.code)}
                className="shrink-0 inline-flex items-center gap-1.5 bg-[#7c3aed] text-white text-[13px] font-bold py-2 px-4 rounded-full hover:bg-[#6d28d9] active:scale-[.97] transition-[transform,background] duration-150"
              >
                {isCopied ? <><Check className="w-3.5 h-3.5" /> Copied</> : "Claim"}
              </button>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white bg-[#16a34a] shadow-lg animate-in slide-in-from-bottom-2 duration-200">
          Code copié !
        </div>
      )}
    </div>
  );
}
