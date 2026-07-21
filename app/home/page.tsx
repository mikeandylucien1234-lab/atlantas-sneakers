import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { buildLandingMetadata } from "@/lib/seo/landing-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildLandingMetadata("home", {
    title: "Home & Living — Décoration, Cuisine, Rangement | Atlanta Sneakers",
    description: "Meublez et décorez votre intérieur : décoration, cuisine, salle de bain, rangement, jardin. Meilleures offres maison chez Atlanta Sneakers.",
  });
}

export default function HomeLandingPage() {
  return <LandingPage page="home" />;
}
