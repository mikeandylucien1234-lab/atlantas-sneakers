import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { MenLanding } from "@/components/men/men-landing";

async function getMenSeo() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { data } = await supabase.from("men_page_settings").select("*").eq("id", "men").maybeSingle();
    return data as any;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await getMenSeo();
  const title = s?.seo_title || "Men's Fashion & Sneakers | Atlanta Sneakers";
  const description = s?.seo_description || "Shop the latest men's streetwear, sneakers, denim and accessories at Atlanta Sneakers.";
  return {
    title,
    description,
    keywords: s?.seo_keywords || undefined,
    alternates: s?.canonical ? { canonical: s.canonical } : undefined,
    openGraph: {
      title,
      description,
      images: s?.og_image ? [{ url: s.og_image }] : undefined,
      type: "website",
    },
  };
}

export default function MenPage() {
  return <MenLanding />;
}
