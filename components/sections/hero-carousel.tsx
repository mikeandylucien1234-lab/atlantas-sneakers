"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const slides = [
  { t1: "SUMMER", t2: "COLLECTION", kicker: "UP TO", percent: "70% OFF", sub: "Fresh styles. Hot deals. Limited time only!", gradient: "linear-gradient(115deg,#1e40af 0%,#2563eb 55%,#1d4ed8 100%)", label: "SNEAKER SHOT" },
  { t1: "NEW", t2: "ARRIVALS", kicker: "JUST", percent: "DROPPED", sub: "The freshest styles landed today. Be first in line.", gradient: "linear-gradient(115deg,#0f172a 0%,#334155 60%,#475569 100%)", label: "NEW DROP" },
  { t1: "TECH", t2: "WEEK", kicker: "SAVE UP TO", percent: "50% OFF", sub: "Headphones, watches & more at unbeatable prices.", gradient: "linear-gradient(115deg,#4c1d95 0%,#7c3aed 60%,#6d28d9 100%)", label: "TECH SHOT" },
  { t1: "FLASH", t2: "DEALS", kicker: "EXTRA", percent: "30% OFF", sub: "Grab them before they are gone. Today only.", gradient: "linear-gradient(115deg,#7f1d1d 0%,#dc2626 60%,#b91c1c 100%)", label: "DEAL SHOT" },
];

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent((s) => (s + 1) % slides.length), []);
  const prev = useCallback(() => setCurrent((s) => (s + slides.length - 1) % slides.length), []);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const slide = slides[current];

  return (
    <div
      className="relative rounded-[18px] overflow-hidden h-[330px] sm:h-[390px] lg:h-[430px] shadow-[0_18px_40px_rgba(16,24,40,.16)] transition-[background] duration-500"
      style={{ background: slide.gradient }}
    >
      {/* Light overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_85%_10%,rgba(255,255,255,.18),transparent_45%)]" />

      {/* Product image placeholder */}
      <div className="hidden md:flex absolute right-[5%] top-1/2 -translate-y-1/2 -rotate-[8deg] w-[260px] lg:w-[330px] h-[240px] lg:h-[300px] rounded-[18px] items-center justify-center shadow-[0_30px_60px_rgba(0,0,0,.3)] opacity-[.96] bg-[repeating-linear-gradient(135deg,#eef0f3_0,#eef0f3_9px,#e4e7eb_9px,#e4e7eb_18px)]">
        <span className="font-mono text-[11px] tracking-[.1em] text-[#8a929c]">{slide.label}</span>
      </div>

      {/* Text */}
      <div className="relative z-[2] h-full flex flex-col justify-center px-[26px] sm:px-10 lg:px-14 max-w-none sm:max-w-[70%] lg:max-w-[560px]">
        <div className="text-[40px] sm:text-[48px] lg:text-[54px] leading-[.96] font-extrabold text-white tracking-[-.02em]">{slide.t1}</div>
        <div className="text-[40px] sm:text-[48px] lg:text-[54px] leading-[1] font-extrabold text-white tracking-[-.02em] mb-1.5">{slide.t2}</div>
        <div className="text-[20px] sm:text-[24px] lg:text-[27px] font-bold text-white mb-3.5">
          {slide.kicker} <span className="text-[#bcd4ff]">{slide.percent}</span>
        </div>
        <div className="text-[14px] text-white/90 font-medium mb-[22px] max-w-[330px] leading-[1.5]">{slide.sub}</div>
        <Link
          href="/shop"
          className="self-start flex items-center gap-[9px] bg-white text-[#0a0b0d] font-bold text-[14px] py-[13px] px-6 rounded-[999px] shadow-[0_8px_18px_rgba(0,0,0,.18)] hover:brightness-[1.06] active:scale-[.97] transition-[filter,transform] duration-150"
        >
          SHOP NOW <ArrowRight className="w-[18px] h-[18px]" />
        </Link>
      </div>

      {/* Arrows */}
      <button
        onClick={prev}
        className="hidden md:flex absolute left-[14px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[rgba(10,11,13,.5)] text-white items-center justify-center backdrop-blur-[4px] cursor-pointer hover:bg-[rgba(10,11,13,.7)] transition-colors"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={next}
        className="hidden md:flex absolute right-[14px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[rgba(10,11,13,.5)] text-white items-center justify-center backdrop-blur-[4px] cursor-pointer hover:bg-[rgba(10,11,13,.7)] transition-colors"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-[18px] left-0 right-0 flex justify-center gap-[7px]">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={cn(
              "h-2 rounded-[4px] transition-all duration-200 cursor-pointer",
              i === current ? "w-[26px] bg-white" : "w-2 bg-white/50"
            )}
          />
        ))}
      </div>
    </div>
  );
}
