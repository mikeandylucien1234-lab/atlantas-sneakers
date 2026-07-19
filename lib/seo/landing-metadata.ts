import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

// Build per-landing-page metadata from the admin-managed men_page_settings row.
export async function buildLandingMetadata(
  page: string,
  fallback: { title: string; description: string }
): Promise<Metadata> {
  let s: any = null;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { data } = await supabase.from("men_page_settings").select("*").eq("id", page).maybeSingle();
    s = data;
  } catch { /* ignore */ }

  const title = s?.seo_title || fallback.title;
  const description = s?.seo_description || fallback.description;
  return {
    title,
    description,
    keywords: s?.seo_keywords || undefined,
    alternates: s?.canonical ? { canonical: s.canonical } : undefined,
    openGraph: { title, description, images: s?.og_image ? [{ url: s.og_image }] : undefined, type: "website" },
  };
}
