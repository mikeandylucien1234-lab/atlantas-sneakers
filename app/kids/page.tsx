import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { buildLandingMetadata } from "@/lib/seo/landing-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildLandingMetadata("kids", {
    title: "Kids & Baby Fashion — 0-16 Yrs | Atlanta Sneakers",
    description: "Back-to-school, everyday & seasonal styles for babies, kids and teens. Shop by age at Atlanta Sneakers.",
  });
}

export default function KidsPage() {
  return <LandingPage page="kids" />;
}
