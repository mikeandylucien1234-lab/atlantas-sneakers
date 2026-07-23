"use client";

import Image from "next/image";
import { useState, useCallback } from "react";

export type PromoCard = {
  id: string;
  imageUrl: string;
  title: string;
  ctaLabel: string;
  onCtaClick: () => void;
};

type Props = {
  cards: PromoCard[];
  /** Called after a card is dismissed, with the dismissed card id. */
  onDismiss?: (id: string) => void;
  className?: string;
};

const EXIT_MS = 260;

export function PromoSuggestionsCarousel({ cards, onDismiss, className }: Props) {
  // ids removed from the DOM after their exit animation finishes
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  // ids currently playing the exit (fade/scale) animation
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  const dismiss = useCallback(
    (id: string) => {
      setLeaving((prev) => new Set(prev).add(id));
      window.setTimeout(() => {
        setRemoved((prev) => new Set(prev).add(id));
        setLeaving((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        onDismiss?.(id);
      }, EXIT_MS);
    },
    [onDismiss]
  );

  const visible = cards.filter((c) => !removed.has(c.id));
  if (visible.length === 0) return null;

  return (
    <div className={`flex flex-col gap-4 ${className ?? ""}`}>
      {visible.map((card) => {
        const isLeaving = leaving.has(card.id);
        return (
          <article
            key={card.id}
            className={`relative w-full h-[400px] overflow-hidden rounded-3xl shadow-lg shadow-black/10 will-change-transform transition-all duration-[260ms] ease-out ${
              isLeaving ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            {/* Background image */}
            <Image
              src={card.imageUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-cover"
              priority={false}
            />

            {/* Legibility gradient (diagonal from bottom-left) */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-tr from-black/75 via-black/30 to-transparent"
            />

            {/* Dismiss button */}
            <button
              type="button"
              onClick={() => dismiss(card.id)}
              aria-label="Cerrar sugerencia"
              className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-xl bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55 active:scale-90"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            {/* Title (top-left) */}
            <h3 className="absolute left-5 right-16 top-5 z-10 text-[26px] font-extrabold leading-[1.12] tracking-[-0.02em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
              {card.title}
            </h3>

            {/* CTA (bottom-left) */}
            <button
              type="button"
              onClick={card.onCtaClick}
              className="group absolute bottom-5 left-5 z-10 inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-bold text-[#0b1020] shadow-md transition hover:bg-white active:scale-95"
            >
              {card.ctaLabel}
              <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </button>
          </article>
        );
      })}
    </div>
  );
}

// Sample data adapted to Atlanta Sneakers (uses the 3 provided images).
export const SAMPLE_PROMO_CARDS: Omit<PromoCard, "onCtaClick">[] = [
  {
    id: "loyalty-points",
    imageUrl: "/images/promos/promo-1.png",
    title: "Gana puntos con cada compra",
    ctaLabel: "Unirme ahora",
  },
  {
    id: "pay-one-place",
    imageUrl: "/images/promos/promo-2.png",
    title: "Paga todo en un solo lugar",
    ctaLabel: "Pagar ahora",
  },
  {
    id: "premium-upgrade",
    imageUrl: "/images/promos/promo-3.png",
    title: "Hazte Premium y gana más cada día",
    ctaLabel: "Descubrir",
  },
];

export default PromoSuggestionsCarousel;
