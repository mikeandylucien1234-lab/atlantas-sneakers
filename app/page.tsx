"use client";

import { HeroCarousel } from "@/components/sections/hero-carousel";
import { FeatureCards } from "@/components/sections/feature-cards";
import { ShopByCategory } from "@/components/sections/shop-by-category";
import { DealsRanking } from "@/components/sections/deals-ranking";
import { TrendingNow } from "@/components/sections/trending-now";
import { RecommendedForYou } from "@/components/sections/recommended-for-you";
import { BestSellersNewArrivals } from "@/components/sections/best-sellers-new-arrivals";
import { SpecialOffers } from "@/components/sections/special-offers";
import { InfoDisclosure } from "@/components/sections/info-disclosure";
import { PromoSuggestions } from "@/components/sections/promo-suggestions";

export default function HomePage() {
  return (
    <>
      <HeroCarousel />
      <FeatureCards />
      <ShopByCategory />
      <DealsRanking />
      <TrendingNow />
      <BestSellersNewArrivals middle={<SpecialOffers />} />
      <RecommendedForYou />
      <PromoSuggestions />
      <InfoDisclosure />
    </>
  );
}
