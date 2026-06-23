"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";

const flashProducts = [
  { name: "Nike Dunk Low Panda", label: "DUNK LOW", price: "$89.99", old: "$149.99", disc: "-40%" },
  { name: "Puma RS-X Reinvention", label: "RS-X", price: "$64.99", old: "$109.99", disc: "-41%" },
  { name: "Reebok Classic Leather", label: "CLASSIC", price: "$54.99", old: "$89.99", disc: "-39%" },
  { name: "Converse Chuck 70 Low", label: "CHUCK 70", price: "$69.99", old: "$99.99", disc: "-30%" },
  { name: "Adidas Essentials Hoodie", label: "HOODIE", price: "$29.99", old: "$109.99", disc: "-73%" },
  { name: "Nike Air Max 270", label: "AIR MAX", price: "$119.99", old: "$169.99", disc: "-29%" },
];

function pad(n: number) { return String(n).padStart(2, "0"); }

export function FlashSales() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    setTotal(Math.floor((midnight.getTime() - now.getTime()) / 1000));
    const timer = setInterval(() => setTotal((t) => (t > 0 ? t - 1 : 0)), 1000);
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

  return (
    <div className="mt-10 rounded-[18px] overflow-hidden bg-[linear-gradient(120deg,#1a0606_0%,#3b0d0d_45%,#561414_100%)] px-[14px] sm:px-5 lg:px-[22px] py-5">
      {/* Header */}
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

      {/* Products */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {flashProducts.map((p) => (
          <div key={p.name} className="bg-white rounded-[12px] p-[11px] cursor-pointer transition-[transform,box-shadow] duration-[180ms] hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,24,40,.12)]">
            <div className="relative mb-[10px]">
              <div className="aspect-square rounded-[9px] bg-[repeating-linear-gradient(135deg,#eef0f3_0,#eef0f3_9px,#e4e7eb_9px,#e4e7eb_18px)] flex items-center justify-center">
                <span className="font-mono text-[9px] tracking-[.08em] text-[#9aa3ad]">{p.label}</span>
              </div>
              <span className="absolute top-[7px] left-[7px] bg-[#ef4444] text-white text-[11px] font-extrabold py-[3px] px-[7px] rounded-[6px]">{p.disc}</span>
            </div>
            <div className="text-[12px] font-semibold text-[#16181d] leading-[1.3] mb-[7px] min-h-[31px]">{p.name}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-extrabold text-[#16181d]">{p.price}</span>
              <span className="text-[12px] text-[#9aa3ad] line-through">{p.old}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
