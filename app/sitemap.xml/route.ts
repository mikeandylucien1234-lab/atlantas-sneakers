import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const revalidate = 3600;

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://atlantasneaker.com").replace(/\/$/, "");
}

type Entry = { url: string; lastmod: Date; changefreq: string; priority: number };

// Escape XML-special characters in URLs (e.g. & → &amp;).
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Same data & logic as before — only the output format is a real XML sitemap.
async function collect(): Promise<Entry[]> {
  const base = baseUrl();
  const now = new Date();

  const staticPages: Entry[] = [
    { url: `${base}/`, lastmod: now, changefreq: "daily", priority: 1 },
    { url: `${base}/shop`, lastmod: now, changefreq: "daily", priority: 0.9 },
    { url: `${base}/new-arrivals`, lastmod: now, changefreq: "daily", priority: 0.8 },
    { url: `${base}/best-sellers`, lastmod: now, changefreq: "daily", priority: 0.8 },
    { url: `${base}/deals`, lastmod: now, changefreq: "daily", priority: 0.8 },
    { url: `${base}/track`, lastmod: now, changefreq: "monthly", priority: 0.3 },
  ];

  const dyn: Entry[] = [];
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const safe = async (fn: () => Promise<void>) => { try { await fn(); } catch { /* skip */ } };
    await Promise.all([
      safe(async () => {
        const { data } = await supabase.from("products").select("slug, created_at").eq("status", "active").limit(5000);
        (data || []).forEach((p) => p.slug && dyn.push({ url: `${base}/product/${p.slug}`, lastmod: new Date(p.created_at || now), changefreq: "weekly", priority: 0.7 }));
      }),
      safe(async () => {
        const { data } = await supabase.from("categories").select("slug").eq("is_active", true).limit(1000);
        (data || []).forEach((c) => c.slug && dyn.push({ url: `${base}/category/${c.slug}`, lastmod: now, changefreq: "weekly", priority: 0.6 }));
      }),
      safe(async () => {
        const { data } = await supabase.from("brands").select("slug").eq("is_active", true).limit(1000);
        (data || []).forEach((b) => b.slug && dyn.push({ url: `${base}/brand/${b.slug}`, lastmod: now, changefreq: "weekly", priority: 0.6 }));
      }),
    ]);
  } catch { /* static only */ }

  return [...staticPages, ...dyn];
}

export async function GET() {
  const entries = await collect();
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.map((e) =>
      `  <url>\n` +
      `    <loc>${esc(e.url)}</loc>\n` +
      `    <lastmod>${e.lastmod.toISOString()}</lastmod>\n` +
      `    <changefreq>${e.changefreq}</changefreq>\n` +
      `    <priority>${e.priority.toFixed(1)}</priority>\n` +
      `  </url>`
    ).join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
