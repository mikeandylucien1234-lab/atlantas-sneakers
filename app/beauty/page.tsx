import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { buildLandingMetadata } from "@/lib/seo/landing-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildLandingMetadata("beauty", {
    title: "Beauty — Makeup, Skincare, Hair & Fragrance | Atlanta Sneakers",
    description: "Maquillage, soins, cheveux, parfums et bien-être. Découvrez les meilleures offres beauté chez Atlanta Sneakers.",
  });
}

export default function BeautyPage() {
  return <LandingPage page="beauty" />;
}
