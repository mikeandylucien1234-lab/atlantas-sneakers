import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

// Dynamic robots.txt — served from the admin-editable seo_settings.robots_txt.
export const revalidate = 3600;

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://atlantassneakers.com").replace(/\/$/, "");
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = baseUrl();
  const fallback: MetadataRoute.Robots = {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/checkout", "/cart"] },
    sitemap: `${base}/sitemap.xml`,
  };

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { data } = await supabase.from("seo_settings").select("robots_txt").eq("id", "global").single();
    const txt = data?.robots_txt as string | undefined;
    if (txt && txt.trim()) {
      // Parse the admin-edited robots.txt into structured rules
      const allow: string[] = [];
      const disallow: string[] = [];
      let userAgent = "*";
      for (const line of txt.split(/\r?\n/)) {
        const [rawKey, ...rest] = line.split(":");
        const key = (rawKey || "").trim().toLowerCase();
        const val = rest.join(":").trim();
        if (key === "user-agent" && val) userAgent = val;
        else if (key === "allow" && val) allow.push(val);
        else if (key === "disallow" && val) disallow.push(val);
      }
      return {
        rules: { userAgent, ...(allow.length ? { allow } : {}), ...(disallow.length ? { disallow } : {}) },
        sitemap: `${base}/sitemap.xml`,
      };
    }
  } catch { /* fall through */ }

  return fallback;
}
