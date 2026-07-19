import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { buildLandingMetadata } from "@/lib/seo/landing-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildLandingMetadata("women", {
    title: "Women's Fashion, Dresses & Sneakers | Atlanta Sneakers",
    description: "Discover women's dresses, tops, denim, heels, bags and the latest trends at Atlanta Sneakers.",
  });
}

export default function WomenPage() {
  return <LandingPage page="women" />;
}
