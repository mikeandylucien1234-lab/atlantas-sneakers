"use client";

import Image from "next/image";
import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";

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
  /** Extra sticky offset (px) added per card index for the stacked peek. */
  stackOffset?: number;
  /** Max height of the internal scroll container. */
  maxHeight?: string;
};

const EXIT_MS = 260;
const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Card-stack carousel (option 2 — full image cards).
 *
 * Each card is `sticky` with a slightly larger `top` per index and an
 * increasing z-index, so as you scroll, the current card sticks to the top
 * while the next one slides up and covers it — leaving a small peek of the
 * previous card's top edge. Covered cards shrink (scale) and dim slightly.
 * The whole card is the CTA; a transparent hit-area over the artwork's
 * painted X handles dismiss (fade/scale exit).
 */
export function PromoSuggestionsCarousel({
  cards,
  onDismiss,
  className,
  stackOffset = 12,
  maxHeight = "min(78vh, 620px)",
}: Props) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  // per-card derived stack styling { scale, dim } keyed by id
  const [stack, setStack] = useState<Record<string, { scale: number; dim: number }>>({});

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const rafRef = useRef<number | null>(null);

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
        cardRefs.current.delete(id);
        onDismiss?.(id);
      }, EXIT_MS);
    },
    [onDismiss]
  );

  const visible = cards.filter((c) => !removed.has(c.id));

  // Recompute how much each card is covered by the next one → scale + dim.
  const recompute = useCallback(() => {
    const ids = visible.map((c) => c.id);
    const next: Record<string, { scale: number; dim: number }> = {};
    for (let i = 0; i < ids.length; i++) {
      const el = cardRefs.current.get(ids[i]);
      const over = i + 1 < ids.length ? cardRefs.current.get(ids[i + 1]) : null;
      if (!el || !over) {
        next[ids[i]] = { scale: 1, dim: 0 };
        continue;
      }
      const r = el.getBoundingClientRect();
      const rn = over.getBoundingClientRect();
      // fraction of this card currently hidden under the next card
      const covered = clamp((r.bottom - rn.top) / Math.max(r.height, 1), 0, 1);
      next[ids[i]] = { scale: 1 - covered * 0.05, dim: covered * 0.4 };
    }
    setStack(next);
  }, [visible]);

  const schedule = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      recompute();
    });
  }, [recompute]);

  useIso(() => {
    schedule();
    const el = scrollRef.current;
    el?.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      el?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, visible.length]);

  if (visible.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className={`snap-y snap-proximity overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className ?? ""}`}
      style={{ maxHeight }}
    >
      <div className="flex flex-col">
        {visible.map((card, i) => {
          const isLeaving = leaving.has(card.id);
          const st = stack[card.id] ?? { scale: 1, dim: 0 };
          const scale = isLeaving ? 0.95 : st.scale;
          return (
            <div
              key={card.id}
              ref={(el) => {
                if (el) cardRefs.current.set(card.id, el);
                else cardRefs.current.delete(card.id);
              }}
              className="sticky snap-start pb-4"
              style={{ top: `${i * stackOffset}px`, zIndex: i + 1 }}
            >
              <div
                className="relative overflow-hidden rounded-3xl shadow-xl shadow-black/20 will-change-transform transition-[transform,opacity] duration-[260ms] ease-out"
                style={{ transform: `scale(${scale})`, opacity: isLeaving ? 0 : 1 }}
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
                    priority={i === 0}
                  />
                </button>

                {/* Dim overlay for cards being covered (pointer-events pass through) */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-200"
                  style={{ opacity: st.dim }}
                />

                {/* Transparent dismiss hit-area over the artwork's painted X */}
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
            </div>
          );
        })}
        {/* Spacer so the last card can scroll up and stick at the top */}
        <div aria-hidden className="h-[60vh] shrink-0" />
      </div>
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
