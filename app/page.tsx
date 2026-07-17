"use client";

import { HeroCarousel } from "@/components/sections/hero-carousel";
import { FeatureCards } from "@/components/sections/feature-cards";
import { ShopByCategory } from "@/components/sections/shop-by-category";
import { DealsRanking } from "@/components/sections/deals-ranking";
import { TrendingNow } from "@/components/sections/trending-now";
import { FlashSales } from "@/components/sections/flash-sales";
import { BestSellersNewArrivals } from "@/components/sections/best-sellers-new-arrivals";
import { SpecialOffers } from "@/components/sections/special-offers";
import { CollectionBanners } from "@/components/sections/collection-banners";
import { TrustBadges } from "@/components/sections/trust-badges";
import { NewsletterSection } from "@/components/sections/newsletter-section";

export default function HomePage() {
  return (
    <>
      <HeroCarousel />
      <FeatureCards />
      <ShopByCategory />
      <DealsRanking />
      <TrendingNow />
      <BestSellersNewArrivals />
      <SpecialOffers />
      <FlashSales />
      <CollectionBanners />
      <TrustBadges />
      <NewsletterSection />
    </>
  );
}
