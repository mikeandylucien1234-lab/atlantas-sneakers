import "server-only";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

// Canonical site origin. Single source of truth for the whole app.
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://atlantasneaker.com").replace(/\/$/, "");
}

// Lightweight anon client for read-only metadata lookups during SSR.
// Mirrors the pattern used by the sitemap route; never throws to the caller.
function anon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

// Build a Metadata object with canonical + Open Graph + Twitter, from
// already-resolved title/description/url/image. Kept generic so product,
// category and brand pages share identical, consistent output.
function buildMeta(opts: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
}): Metadata {
  const base = siteOrigin();
  const url = `${base}${opts.path}`;
  const images = opts.image ? [{ url: opts.image }] : undefined;
  return {
    // `absolute` bypasses the root layout's "%s | Atlanta Sneakers" template,
    // since our titles already carry the brand suffix.
    title: { absolute: opts.title },
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: "Atlanta Sneakers",
      type: opts.type || "website",
      ...(images ? { images } : {}),
    },
    twitter: {
      card: opts.image ? "summary_large_image" : "summary",
      title: opts.title,
      description: opts.description,
      ...(opts.image ? { images: [opts.image] } : {}),
    },
  };
}

export async function productMetadata(slug: string): Promise<Metadata> {
  try {
    const { data } = await anon()
      .from("products")
      .select("name, slug, meta_title, meta_description, description, images")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return { title: { absolute: "Product Not Found | Atlanta Sneakers" } };
    const name = data.name as string;
    const title = (data.meta_title as string) || clip(`${name} | Atlanta Sneakers`, 60);
    const description =
      (data.meta_description as string) ||
      clip(data.description ? String(data.description) : `Shop ${name} at Atlanta Sneakers. Free shipping over $100 and easy 30-day returns.`, 160);
    const image = Array.isArray(data.images) && data.images.length ? data.images[0] : null;
    return buildMeta({ title, description, path: `/product/${data.slug}`, image, type: "article" });
  } catch {
    return { title: "Atlanta Sneakers" };
  }
}

export async function categoryMetadata(slug: string): Promise<Metadata> {
  try {
    const { data } = await anon()
      .from("categories")
      .select("name, slug, meta_title, meta_description")
      .eq("slug", slug)
      .maybeSingle();
    const name = (data?.name as string) || slug.charAt(0).toUpperCase() + slug.slice(1);
    const title = (data?.meta_title as string) || clip(`${name} | Atlanta Sneakers`, 60);
    const description =
      (data?.meta_description as string) ||
      clip(`Shop ${name} at Atlanta Sneakers. Discover top styles with free shipping over $100 and easy 30-day returns.`, 160);
    return buildMeta({ title, description, path: `/category/${slug}` });
  } catch {
    return { title: "Atlanta Sneakers" };
  }
}
