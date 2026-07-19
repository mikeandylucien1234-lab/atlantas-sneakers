import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { buildLandingMetadata } from "@/lib/seo/landing-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildLandingMetadata("curve", {
    title: "Curve & Plus Size Fashion | Atlanta Sneakers",
    description: "Confort, élégance et grandes tailles — robes, tops, denim et plus pour toutes les morphologies.",
  });
}

export default function CurvePage() {
  return <LandingPage page="curve" />;
}
