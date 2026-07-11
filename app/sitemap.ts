import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

// Dynamic sitemap — always reflects current DB content, so it is effectively
// regenerated whenever products/categories/brands change.
export const revalidate = 3600;

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://atlantassneakers.com").replace(/\/$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/new-arrivals`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/best-sellers`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/deals`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/track`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const dyn: MetadataRoute.Sitemap = [];
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const safe = async (fn: () => Promise<void>) => { try { await fn(); } catch { /* skip */ } };

    await Promise.all([
      safe(async () => {
        const { data } = await supabase.from("products").select("slug, created_at").eq("status", "active").limit(5000);
        (data || []).forEach((p) => p.slug && dyn.push({ url: `${base}/product/${p.slug}`, lastModified: new Date(p.created_at || now), changeFrequency: "weekly", priority: 0.7 }));
      }),
      safe(async () => {
        const { data } = await supabase.from("categories").select("slug").eq("is_active", true).limit(1000);
        (data || []).forEach((c) => c.slug && dyn.push({ url: `${base}/category/${c.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.6 }));
      }),
      safe(async () => {
        const { data } = await supabase.from("brands").select("slug").eq("is_active", true).limit(1000);
        (data || []).forEach((b) => b.slug && dyn.push({ url: `${base}/brand/${b.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.6 }));
      }),
    ]);
  } catch { /* return static only */ }

  return [...staticPages, ...dyn];
}
