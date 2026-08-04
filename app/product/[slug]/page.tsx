import type { Metadata } from "next";
import { productMetadata } from "@/lib/seo/page-metadata";
import ProductClient from "./product-client";

// Server component: resolves real per-product metadata (title, description,
// canonical, Open Graph) into the initial HTML, then renders the existing
// client UI unchanged.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return productMetadata(slug);
}

export default function Page() {
  return <ProductClient />;
}
