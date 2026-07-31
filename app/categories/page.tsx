"use client";

import Link from "next/link";
import { getHomepageCategories, getCategories } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// All categories, driven entirely by the DB. New categories appear here
// automatically — each links to its real /category/<slug> page.
export default function CategoriesPage() {
  const { data: homepage } = useQuery(() => getHomepageCategories(), []);
  const { data: all } = useQuery(() => getCategories(), []);

  const tiles = (homepage && homepage.length)
    ? homepage.map((c: any) => ({
        id: c.id,
        name: c.name,
        image_url: c.image_url,
        href: `/category/${c.category?.slug || slugify(c.name)}`,
      }))
    : (all || []).map((c: any) => ({ id: c.id, name: c.name, image_url: c.image_url, href: `/category/${c.slug}` }));

  return (
    <div className="mt-4 mb-8">
      <div className="flex items-center gap-1.5 text-[13px] text-[#9aa3ad] mb-4">
        <Link href="/" className="hover:text-[#2563eb] transition-colors">Home</Link>
        <span>/</span>
        <span className="text-[#16181d] font-semibold">Categories</span>
      </div>

      <h1 className="text-[24px] sm:text-[28px] font-extrabold tracking-[-.02em] text-[#16181d] mb-5">All Categories</h1>

      {!tiles.length ? (
        <p className="text-[14px] text-[#6b7280]">No categories yet.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-6">
          {tiles.map((t) => (
            <Link key={t.id} href={t.href} className="group flex flex-col items-center gap-2">
              <div className="w-full aspect-square rounded-full overflow-hidden bg-[#f4f5f7] ring-1 ring-black/[.04] shadow-[0_4px_14px_rgba(16,24,40,.08)] transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_14px_30px_rgba(16,24,40,.16)]">
                {t.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.image_url} alt={t.name} loading="lazy" className="w-full h-full object-cover" />
                )}
              </div>
              <span className="w-full text-center text-[12px] sm:text-[13px] font-semibold text-[#16181d] leading-tight line-clamp-2 break-words">{t.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
