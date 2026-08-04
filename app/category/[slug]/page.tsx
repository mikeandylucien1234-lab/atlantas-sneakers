import type { Metadata } from "next";
import { categoryMetadata } from "@/lib/seo/page-metadata";
import CategoryClient from "./category-client";

// Server component: resolves real per-category metadata (title, description,
// canonical, Open Graph) into the initial HTML, then renders the existing
// client UI unchanged.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return categoryMetadata(slug);
}

export default function Page() {
  return <CategoryClient />;
}
