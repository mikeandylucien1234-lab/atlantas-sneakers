import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { buildLandingMetadata } from "@/lib/seo/landing-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildLandingMetadata("quickship", {
    title: "QuickShip — Livraison Express | Atlanta Sneakers",
    description: "Produits déjà en stock local, expédiés sous 24-72h. Achetez maintenant et recevez rapidement.",
  });
}

export default function QuickShipPage() {
  return <LandingPage page="quickship" />;
}
