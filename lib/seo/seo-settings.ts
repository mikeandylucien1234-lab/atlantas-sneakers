import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

export type SeoSettings = {
  site_name?: string;
  separator?: string;
  global_meta_title?: string;
  global_meta_description?: string;
  default_keywords?: string;
  canonical_base?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  twitter_card?: string;
  twitter_title?: string;
  twitter_description?: string;
  twitter_image?: string;
  favicon_url?: string;
  apple_touch_icon?: string;
  google_verification?: string;
  bing_verification?: string;
  google_analytics_id?: string;
  google_tag_manager_id?: string;
};

// Cached per request cycle by Next's fetch dedupe on the anon client call.
export async function getSeoSettings(): Promise<SeoSettings | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { data } = await supabase.from("seo_settings").select("*").eq("id", "global").single();
    return (data as SeoSettings) || null;
  } catch {
    return null;
  }
}

export function buildRootMetadata(seo: SeoSettings | null): Metadata {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://atlantassneakers.com").replace(/\/$/, "");
  const siteName = seo?.site_name || "Atlanta Sneakers";
  const sep = seo?.separator || "|";
  const title = seo?.global_meta_title || `${siteName} ${sep} Premium Sneaker Marketplace`;
  const description = seo?.global_meta_description || "Shop 100% authentic sneakers from Nike, Adidas, Jordan, New Balance and more. Free shipping over $100.";

  const meta: Metadata = {
    metadataBase: new URL(seo?.canonical_base || base),
    title: { default: title, template: `%s ${sep} ${siteName}` },
    description,
    keywords: seo?.default_keywords || undefined,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName,
      title: seo?.og_title || title,
      description: seo?.og_description || description,
      ...(seo?.og_image ? { images: [{ url: seo.og_image }] } : {}),
    },
    twitter: {
      card: (seo?.twitter_card as "summary_large_image") || "summary_large_image",
      title: seo?.twitter_title || seo?.og_title || title,
      description: seo?.twitter_description || seo?.og_description || description,
      ...(seo?.twitter_image || seo?.og_image ? { images: [seo?.twitter_image || seo?.og_image!] } : {}),
    },
  };

  if (seo?.favicon_url || seo?.apple_touch_icon) {
    meta.icons = {
      ...(seo?.favicon_url ? { icon: seo.favicon_url } : {}),
      ...(seo?.apple_touch_icon ? { apple: seo.apple_touch_icon } : {}),
    };
  }

  return meta;
}
