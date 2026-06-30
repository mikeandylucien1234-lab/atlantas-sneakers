"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const slides = [
  {
    t1: "SUMMER", t2: "COLLECTION", kicker: "UP TO", percent: "70% OFF",
    sub: "Fresh styles. Hot deals. Limited time only!",
    gradient: "linear-gradient(115deg,#1e40af 0%,#2563eb 55%,#1d4ed8 100%)",
    image: "/images/banners/banner-1-summer.jpg",
  },
  {
    t1: "NEW", t2: "ARRIVALS", kicker: "JUST", percent: "DROPPED",
    sub: "The freshest styles landed today. Be first in line.",
    gradient: "linear-gradient(115deg,#0f172a 0%,#334155 60%,#475569 100%)",
    image: "/images/banners/banner-2-arrivals.jpg",
  },
  {
    t1: "TECH", t2: "WEEK", kicker: "SAVE UP TO", percent: "50% OFF",
    sub: "Headphones, watches & more at unbeatable prices.",
    gradient: "linear-gradient(115deg,#4c1d95 0%,#7c3aed 60%,#6d28d9 100%)",
    image: "/images/banners/banner-3-tech.jpg",
  },
  {
    t1: "FLASH", t2: "DEALS", kicker: "EXTRA", percent: "30% OFF",
    sub: "Grab them before they are gone. Today only.",
    gradient: "linear-gradient(115deg,#7f1d1d 0%,#dc2626 60%,#b91c1c 100%)",
    image: "/images/banners/banner-4-flash.jpg",
  },
  {
    t1: "ELEVATE", t2: "YOUR STYLE", kicker: "SHOP THE", percent: "EDIT",
    sub: "Sneakers, apparel, tech & more — curated for you.",
    gradient: "linear-gradient(115deg,#bfdbfe 0%,#93c5fd 55%,#60a5fa 100%)",
    image: "/images/banners/banner-5-lifestyle.jpg",
    lightText: false,
  },
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
  const isLight = slide.lightText === false;
  const textColor = isLight ? "text-[#16181d]" : "text-white";
  const kickerAccent = isLight ? "text-[#2563eb]" : "text-[#bcd4ff]";
  const subColor = isLight ? "text-[#16181d]/80" : "text-white/90";
  const btnClass = isLight
    ? "bg-[#2563eb] text-white"
    : "bg-white text-[#0a0b0d]";

  return (
    <div
      className="relative rounded-[18px] overflow-hidden h-[330px] sm:h-[390px] lg:h-[430px] shadow-[0_18px_40px_rgba(16,24,40,.16)] transition-[background] duration-500"
      style={{ background: slide.gradient }}
    >
      {/* Banner image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
        style={{ backgroundImage: `url(${slide.image})` }}
      />

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/25 to-transparent" />

      {/* Text */}
      <div className="relative z-[2] h-full flex flex-col justify-center px-[26px] sm:px-10 lg:px-14 max-w-none sm:max-w-[70%] lg:max-w-[560px]">
        <div className={cn("text-[40px] sm:text-[48px] lg:text-[54px] leading-[.96] font-extrabold tracking-[-.02em] drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]", textColor)}>{slide.t1}</div>
        <div className={cn("text-[40px] sm:text-[48px] lg:text-[54px] leading-[1] font-extrabold tracking-[-.02em] mb-1.5 drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]", textColor)}>{slide.t2}</div>
        <div className={cn("text-[20px] sm:text-[24px] lg:text-[27px] font-bold mb-3.5 drop-shadow-[0_2px_6px_rgba(0,0,0,.3)]", textColor)}>
          {slide.kicker} <span className={kickerAccent}>{slide.percent}</span>
        </div>
        <div className={cn("text-[14px] font-medium mb-[22px] max-w-[330px] leading-[1.5] drop-shadow-[0_1px_4px_rgba(0,0,0,.3)]", subColor)}>{slide.sub}</div>
        <Link
          href="/shop"
          className={cn(
            "self-start flex items-center gap-[9px] font-bold text-[14px] py-[13px] px-6 rounded-[999px] shadow-[0_8px_18px_rgba(0,0,0,.18)] hover:brightness-[1.06] active:scale-[.97] transition-[filter,transform] duration-150",
            btnClass
          )}
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
