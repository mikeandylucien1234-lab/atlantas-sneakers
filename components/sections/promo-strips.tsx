"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const strips = [
  {
    title: "Women's Collection",
    kicker: "UP TO 60% OFF",
    sub: "Exclusive styles for every occasion",
    cta: "SHOP WOMEN",
    image: "/images/strips/strip-1-women.jpg",
    gradient: "linear-gradient(115deg,#fbcfe8 0%,#f9a8d4 100%)",
    href: "/shop?category=women",
  },
  {
    title: "Kids Collection",
    kicker: "UP TO 50% OFF",
    sub: "Fun styles for little feet",
    cta: "SHOP KIDS",
    image: "/images/strips/strip-2-kids.jpg",
    gradient: "linear-gradient(115deg,#bfdbfe 0%,#93c5fd 100%)",
    href: "/shop?category=kids",
  },
  {
    title: "Mega Deals",
    kicker: "LAST CHANCE",
    sub: "Deals this good don't last",
    cta: "GRAB DEALS",
    image: "/images/strips/strip-3-mega.jpg",
    gradient: "linear-gradient(115deg,#1a0606 0%,#3b0d0d 100%)",
    href: "/deals",
  },
  {
    title: "Tech Flash",
    kicker: "SAVE BIG",
    sub: "Headphones, watches & more",
    cta: "SHOP TECH",
    image: "/images/strips/strip-4-tech.jpg",
    gradient: "linear-gradient(115deg,#0a1628 0%,#1a2744 100%)",
    href: "/shop?category=tech",
  },
  {
    title: "Weekend Sale",
    kicker: "LIMITED TIME",
    sub: "Premium lifestyle essentials",
    cta: "SHOP NOW",
    image: "/images/strips/strip-5-weekend.jpg",
    gradient: "linear-gradient(115deg,#2a0a0a 0%,#4a1010 100%)",
    href: "/deals",
  },
];

export function PromoStrips() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent((s) => (s + 1) % strips.length), []);
  const prev = useCallback(() => setCurrent((s) => (s + strips.length - 1) % strips.length), []);

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next]);

  const strip = strips[current];

  return (
    <div className="mt-10">
      <div
        className="relative rounded-[18px] overflow-hidden h-[180px] sm:h-[220px] lg:h-[260px] shadow-[0_12px_30px_rgba(16,24,40,.12)] transition-[background] duration-500 cursor-pointer"
        style={{ background: strip.gradient }}
      >
        {/* Strip image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
          style={{ backgroundImage: `url(${strip.image})` }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

        {/* Text */}
        <div className="relative z-[2] h-full flex flex-col justify-center px-[26px] sm:px-10 lg:px-14 max-w-[400px]">
          <div className="text-[11px] sm:text-[12px] font-bold tracking-[.12em] text-white/70 mb-1.5">{strip.kicker}</div>
          <div className="text-[26px] sm:text-[32px] lg:text-[36px] font-extrabold text-white leading-[1.05] tracking-[-.01em] mb-2 drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]">{strip.title}</div>
          <div className="text-[13px] sm:text-[14px] text-white/85 font-medium mb-4">{strip.sub}</div>
          <Link
            href={strip.href}
            className="self-start flex items-center gap-2 bg-white text-[#0a0b0d] font-bold text-[12px] sm:text-[13px] py-[11px] px-5 rounded-[999px] shadow-[0_6px_14px_rgba(0,0,0,.15)] hover:brightness-[1.06] active:scale-[.97] transition-[filter,transform] duration-150"
          >
            {strip.cta} <ArrowRight className="w-[16px] h-[16px]" />
          </Link>
        </div>

        {/* Arrows */}
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="hidden sm:flex absolute left-[10px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[rgba(10,11,13,.45)] text-white items-center justify-center backdrop-blur-[4px] cursor-pointer hover:bg-[rgba(10,11,13,.65)] transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="hidden sm:flex absolute right-[10px] top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[rgba(10,11,13,.45)] text-white items-center justify-center backdrop-blur-[4px] cursor-pointer hover:bg-[rgba(10,11,13,.65)] transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-[14px] left-0 right-0 flex justify-center gap-[6px]">
          {strips.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={cn(
                "h-[6px] rounded-[3px] transition-all duration-200 cursor-pointer",
                i === current ? "w-[22px] bg-white" : "w-[6px] bg-white/50"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
