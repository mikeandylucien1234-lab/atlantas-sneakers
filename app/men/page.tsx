import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { buildLandingMetadata } from "@/lib/seo/landing-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildLandingMetadata("men", {
    title: "Men's Fashion & Sneakers | Atlanta Sneakers",
    description: "Shop the latest men's streetwear, sneakers, denim and accessories at Atlanta Sneakers.",
  });
}

export default function MenPage() {
  return <LandingPage page="men" />;
}
