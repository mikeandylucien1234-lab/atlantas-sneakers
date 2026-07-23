"use client";

import { useRouter } from "next/navigation";
import { PromoSuggestionsCarousel, SAMPLE_PROMO_CARDS } from "@/components/promo/promo-suggestions-carousel";

// Maps each sample promo to where its card should take the user.
const LINKS: Record<string, string> = {
  "loyalty-points": "/rewards",
  "pay-one-place": "/pay",
  "premium-upgrade": "/premium",
};

export function PromoSuggestions() {
  const router = useRouter();

  const cards = SAMPLE_PROMO_CARDS.map((c) => ({
    ...c,
    onCtaClick: () => router.push(LINKS[c.id] ?? "/shop"),
  }));

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-[19px] font-extrabold tracking-[-0.01em] text-[#16181d]">Sugerencias</h2>
      <div className="mx-auto max-w-[560px]">
        <PromoSuggestionsCarousel cards={cards} />
      </div>
    </section>
  );
}
