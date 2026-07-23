"use client";

import Image from "next/image";
import { useState, useCallback } from "react";

export type PromoCard = {
  id: string;
  imageUrl: string;
  /** Used for the image alt text / accessible label (not rendered as overlay). */
  title: string;
  /** Accessible label for the whole-card action. Defaults to title. */
  ctaLabel?: string;
  onCtaClick: () => void;
};

type Props = {
  cards: PromoCard[];
  /** Called after a card is dismissed, with the dismissed card id. */
  onDismiss?: (id: string) => void;
  className?: string;
};

const EXIT_MS = 260;

/**
 * Option 2 — "full image" variant.
 * The promo artwork already contains its own title / CTA / X, so the whole
 * card is just the image (clickable → onCtaClick). A transparent hit-area is
 * placed over the painted X in the top-right corner so it becomes a real,
 * accessible dismiss button without visually duplicating anything.
 */
export function PromoSuggestionsCarousel({ cards, onDismiss, className }: Props) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
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
          <div
            key={card.id}
            className={`relative w-full overflow-hidden rounded-3xl shadow-lg shadow-black/10 will-change-transform transition-all duration-[260ms] ease-out ${
              isLeaving ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            {/* Whole card = the CTA */}
            <button
              type="button"
              onClick={card.onCtaClick}
              aria-label={card.ctaLabel ?? card.title}
              className="group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
            >
              <Image
                src={card.imageUrl}
                alt={card.title}
                width={1390}
                height={1130}
                sizes="(max-width: 768px) 100vw, 640px"
                className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.015]"
                priority={false}
              />
            </button>

            {/* Transparent dismiss hit-area over the artwork's painted X (top-right) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(card.id);
              }}
              aria-label="Cerrar sugerencia"
              className="absolute right-[3.5%] top-[3.5%] z-10 h-[11%] w-[11%] rounded-xl transition active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            />
          </div>
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
    ctaLabel: "Unirme al programa de puntos",
  },
  {
    id: "pay-one-place",
    imageUrl: "/images/promos/promo-2.png",
    title: "Paga todo en un solo lugar",
    ctaLabel: "Ir a pagos",
  },
  {
    id: "premium-upgrade",
    imageUrl: "/images/promos/promo-3.png",
    title: "Hazte Premium y gana más cada día",
    ctaLabel: "Descubrir Premium",
  },
];

export default PromoSuggestionsCarousel;
