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
};

const EXIT_MS = 260;
const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Card-stack carousel (full-image cards) driven by the PAGE scroll.
 *
 * Each card is `sticky`, offset a few px more per index, with an increasing
 * z-index — so as the page scrolls, the current card sticks just below the
 * site header while the next one slides up and covers it, leaving a small
 * peek of the previous card's top edge. Covered cards shrink + dim slightly.
 * No inner scroll container (nothing traps the page scroll) and no trailing
 * spacer, so scrolling on to the next section stays smooth.
 */
export function PromoSuggestionsCarousel({ cards, onDismiss, className, stackOffset = 10 }: Props) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [stack, setStack] = useState<Record<string, { scale: number; dim: number }>>({});
  const [baseTop, setBaseTop] = useState(16);

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

  // Stick just below the site's sticky header (measured at runtime).
  useIso(() => {
    const measure = () => {
      const header = document.querySelector("header");
      const h = header ? Math.round(header.getBoundingClientRect().height) : 0;
      setBaseTop((h || 8) + 8);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // How much each card is covered by the next one → scale + dim.
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
      const covered = clamp((r.bottom - rn.top) / Math.max(r.height, 1), 0, 1);
      next[ids[i]] = { scale: 1 - covered * 0.04, dim: covered * 0.32 };
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
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, visible.length, baseTop]);

  if (visible.length === 0) return null;

  return (
    <div className={`flex flex-col ${className ?? ""}`}>
      {visible.map((card, i) => {
        const isLeaving = leaving.has(card.id);
        const st = stack[card.id] ?? { scale: 1, dim: 0 };
        const scale = isLeaving ? 0.95 : st.scale;
        const isLast = i === visible.length - 1;
        return (
          <div
            key={card.id}
            ref={(el) => {
              if (el) cardRefs.current.set(card.id, el);
              else cardRefs.current.delete(card.id);
            }}
            className={isLast ? "sticky" : "sticky pb-4"}
            style={{ top: `${baseTop + i * stackOffset}px`, zIndex: i + 1 }}
          >
            <div
              className="relative overflow-hidden rounded-3xl shadow-xl shadow-black/15 will-change-transform transition-[transform,opacity] duration-[260ms] ease-out"
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

              {/* Dim overlay for cards being covered (clicks pass through) */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-150"
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
    </div>
  );
}

// Sample data adapted to Atlanta Sneakers (uses the 3 provided images).
export const SAMPLE_PROMO_CARDS: Omit<PromoCard, "onCtaClick">[] = [
  {
    id: "loyalty-points",
    imageUrl: "/images/promos/promo-1.png",
    title: "Earn points every time you shop",
    ctaLabel: "Join Rewards",
  },
  {
    id: "pay-one-place",
    imageUrl: "/images/promos/promo-2.png",
    title: "Pay all your accounts in one place",
    ctaLabel: "Go to Payments",
  },
  {
    id: "premium-upgrade",
    imageUrl: "/images/promos/promo-3.png",
    title: "Upgrade to Premium",
    ctaLabel: "Go Premium",
  },
];

export default PromoSuggestionsCarousel;
