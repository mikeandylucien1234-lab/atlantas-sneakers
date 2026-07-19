"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@/lib/hooks/use-query";
import { ProductCard } from "@/components/ui/product-card";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import {
  getMenSettings, getMenHeroBanners, getMenCollections, getMenShopCategories,
  getMenBrands, getMenProducts, getMenFlashDeals,
} from "@/lib/supabase/queries";
import type { Product } from "@/types";

/* ---------------- Section header ---------------- */
function SectionHead({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[19px] sm:text-[21px] font-extrabold tracking-[-.01em]">{title}</h2>
      {href && (
        <Link href={href} className="text-[13px] font-semibold text-[#2563eb] flex items-center gap-1 whitespace-nowrap hover:underline">
          View all <ArrowRight className="w-[15px] h-[15px]" />
        </Link>
      )}
    </div>
  );
}

/* ---------------- Hero slider ---------------- */
function MenHero() {
  const { data: banners } = useQuery(() => getMenHeroBanners(), []);
  const slides = (banners && banners.length ? banners : [{
    name: "MEN'S COLLECTION", description: "Discover the latest styles for him",
    image_desktop: "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&w=1200&q=80",
    link_url: "/category/men", cta_label: "SHOP NOW",
  }]) as any[];

  const [i, setI] = useState(0);
  const count = slides.length;
  useEffect(() => { if (count <= 1) return; const t = setInterval(() => setI((x) => (x + 1) % count), 5000); return () => clearInterval(t); }, [count]);
  const s = slides[Math.min(i, count - 1)];
  const img = s.image_desktop || s.image_mobile || s.image_tablet;

  return (
    <div className="relative rounded-[18px] overflow-hidden h-[240px] sm:h-[360px] lg:h-[420px] shadow-[0_18px_40px_rgba(16,24,40,.16)] bg-[#0f172a]">
      {img && <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-500" style={{ backgroundImage: `url(${img})` }} />}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
      <div className="relative z-[2] h-full flex flex-col justify-center px-6 sm:px-10 lg:px-14 max-w-[85%] sm:max-w-[60%]">
        <div className="text-white text-[26px] sm:text-[42px] lg:text-[50px] leading-[1] font-extrabold tracking-[-.02em] drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]">{s.name}</div>
        {s.description && <div className="text-white/90 text-[13px] sm:text-[15px] font-medium mt-3 max-w-[360px] drop-shadow-[0_1px_4px_rgba(0,0,0,.3)]">{s.description}</div>}
        <Link href={s.link_url || "/category/men"} className="self-start mt-5 flex items-center gap-2 bg-white text-[#0a0b0d] font-bold text-[13px] py-[12px] px-6 rounded-full shadow-[0_8px_18px_rgba(0,0,0,.18)] hover:brightness-105 active:scale-[.97] transition">
          {s.cta_label || "SHOP NOW"} <ArrowRight className="w-[17px] h-[17px]" />
        </Link>
      </div>
      {count > 1 && (
        <>
          <button onClick={() => setI((x) => (x + count - 1) % count)} className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white items-center justify-center backdrop-blur hover:bg-black/70"><ChevronLeft className="w-6 h-6" /></button>
          <button onClick={() => setI((x) => (x + 1) % count)} className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white items-center justify-center backdrop-blur hover:bg-black/70"><ChevronRight className="w-6 h-6" /></button>
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-[7px]">
            {slides.map((_, k) => <button key={k} onClick={() => setI(k)} className={cn("h-2 rounded transition-all", k === i ? "w-6 bg-white" : "w-2 bg-white/50")} />)}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Collections (rectangular cards) ---------------- */
function MenCollections() {
  const { data } = useQuery(() => getMenCollections(), []);
  const items = data || [];
  if (!items.length) return null;
  return (
    <div>
      <SectionHead title="MEN'S COLLECTIONS" />
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((c: any) => (
          <Link key={c.id} href={c.link_url || "/category/men"} className="relative shrink-0 w-[45%] sm:w-[220px] aspect-[3/4] rounded-[14px] overflow-hidden snap-start group">
            {c.image_url && /* eslint-disable-next-line @next/next/no-img-element */ (
              <img src={c.image_url} alt={c.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2.5">
              <span className="text-white text-[14px] font-bold">{c.name}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Shop by Category (round) ---------------- */
function MenShopCategory() {
  const { data } = useQuery(() => getMenShopCategories(), []);
  const items = (data || []).map((c: any) => ({
    id: c.id, name: c.name, image_url: c.image_url,
    href: c.category?.slug ? `/category/${c.category.slug}` : (c.link_url || "/category/men"),
  }));
  if (!items.length) return null;
  return (
    <div>
      <SectionHead title="SHOP BY CATEGORY" />
      <div className="grid grid-rows-2 grid-flow-col auto-cols-[24%] gap-x-2 gap-y-5 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid-rows-none sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-5 lg:grid-cols-10 sm:gap-x-4 sm:gap-y-6 sm:overflow-visible">
        {items.map((t) => (
          <Link key={t.id} href={t.href} className="flex flex-col items-center gap-2 group snap-start w-[70px] sm:w-[92px] shrink-0">
            <div className="w-[70px] sm:w-[92px] aspect-square rounded-full overflow-hidden ring-1 ring-black/[.04] bg-[#f4f5f7] transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:shadow-[0_16px_34px_rgba(16,24,40,.16)]">
              {t.image_url && /* eslint-disable-next-line @next/next/no-img-element */ (
                <img src={t.image_url} alt={t.name} loading="lazy" className="w-full h-full object-cover" />
              )}
            </div>
            <span className="w-full text-[11px] sm:text-[12px] leading-tight font-semibold text-[#16181d] text-center line-clamp-2 break-words">{t.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Product grid section ---------------- */
function MenProductGrid({ title, href, variant, limit }: { title: string; href?: string; variant?: "new" | "best" | "recommended"; limit: number }) {
  const { data, loading } = useQuery(() => getMenProducts({ variant, limit }), [variant, limit]);
  const products = data || [];
  if (!loading && !products.length) return null;
  return (
    <div>
      <SectionHead title={title} href={href} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : products.map((p) => (
              <ProductCard key={p.id} id={p.id} slug={p.slug} name={p.name} brand={p.brand?.name ?? ""}
                price={Number(p.price)} comparePrice={p.compare_price ? Number(p.compare_price) : undefined}
                image={p.images?.[0] ?? "/placeholder.svg"} isNew={p.is_new} isFeatured={p.is_featured} />
            ))}
      </div>
    </div>
  );
}

/* ---------------- Flash Sale (men) ---------------- */
function MenFlashSale() {
  const { data: deals } = useQuery(() => getMenFlashDeals(), []);
  const { data: fallback } = useQuery(() => getMenProducts({ variant: "deals", limit: 6 }), []);

  const items: Array<{ name: string; price: string; old?: string; disc?: string; slug: string; image?: string }> = [];
  for (const d of (deals || [])) {
    const p = (d as any).product as Product | undefined;
    if (!p) continue;
    const orig = Number(p.price), dp = Number((d as any).deal_price);
    const pct = orig ? Math.round(((orig - dp) / orig) * 100) : 0;
    items.push({ name: p.name, price: `$${dp.toFixed(2)}`, old: `$${orig.toFixed(2)}`, disc: `-${pct}%`, slug: p.slug, image: p.images?.[0] });
  }
  for (const p of (fallback || [])) {
    if (items.length >= 6) break;
    if (items.find((x) => x.slug === p.slug)) continue;
    if (p.compare_price) {
      const pct = Math.round(((Number(p.compare_price) - Number(p.price)) / Number(p.compare_price)) * 100);
      items.push({ name: p.name, price: `$${Number(p.price).toFixed(2)}`, old: `$${Number(p.compare_price).toFixed(2)}`, disc: `-${pct}%`, slug: p.slug, image: p.images?.[0] });
    } else {
      items.push({ name: p.name, price: `$${Number(p.price).toFixed(2)}`, slug: p.slug, image: p.images?.[0] });
    }
  }
  if (!items.length) return null;

  return (
    <div className="rounded-[18px] overflow-hidden bg-[linear-gradient(120deg,#1a0606,#3b0d0d_45%,#561414)] px-[14px] sm:px-5 py-5">
      <div className="flex items-center gap-2.5 mb-4">
        <Zap className="w-7 h-7 text-[#ef4444]" style={{ fill: "#ef4444" }} />
        <div>
          <div className="text-[20px] sm:text-[24px] font-extrabold text-white tracking-[-.01em]">FLASH SALE</div>
          <div className="text-[12px] text-white/80">Men's deals — grab them before they're gone!</div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {items.map((p) => (
          <Link href={`/product/${p.slug}`} key={p.slug} className="bg-white rounded-[12px] p-[11px] hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,24,40,.12)] transition">
            <div className="relative mb-[10px]">
              <div className="aspect-square rounded-[9px] overflow-hidden bg-[#f4f5f7]">
                {p.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover" />}
              </div>
              {p.disc && <span className="absolute top-[7px] left-[7px] bg-[#ef4444] text-white text-[11px] font-extrabold py-[3px] px-[7px] rounded-[6px]">{p.disc}</span>}
            </div>
            <div className="text-[12px] font-semibold text-[#16181d] leading-[1.3] mb-[7px] min-h-[31px] line-clamp-2">{p.name}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-extrabold text-[#16181d]">{p.price}</span>
              {p.old && <span className="text-[12px] text-[#9aa3ad] line-through">{p.old}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Super Deals (men) ---------------- */
function MenSuperDeals({ limit }: { limit: number }) {
  const { data, loading } = useQuery(() => getMenProducts({ variant: "deals", limit }), [limit]);
  const items = data || [];
  if (!loading && !items.length) return null;
  return (
    <div className="rounded-[18px] bg-[linear-gradient(120deg,#fff7ed,#ffedd5)] p-4 sm:p-5">
      <SectionHead title="SUPER DEALS" href="/deals" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : items.map((p) => (
              <ProductCard key={p.id} id={p.id} slug={p.slug} name={p.name} brand={p.brand?.name ?? ""}
                price={Number(p.price)} comparePrice={p.compare_price ? Number(p.compare_price) : undefined}
                image={p.images?.[0] ?? "/placeholder.svg"} isNew={p.is_new} isFeatured={p.is_featured} />
            ))}
      </div>
    </div>
  );
}

/* ---------------- Brands ---------------- */
function MenBrands() {
  const { data } = useQuery(() => getMenBrands(), []);
  const items = data || [];
  if (!items.length) return null;
  return (
    <div>
      <SectionHead title="SHOP BY BRAND" />
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((b: any) => (
          <Link key={b.id} href={b.link_url || (b.brand?.slug ? `/shop?brand=${b.brand.slug}` : "/shop")}
            className="shrink-0 w-[120px] h-[72px] rounded-[12px] bg-white border border-[#eef0f3] flex items-center justify-center px-3 hover:shadow-[0_10px_24px_rgba(16,24,40,.1)] transition">
            {b.logo_url
              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={b.logo_url} alt={b.name} className="max-h-[44px] max-w-full object-contain" />
              : <span className="text-[14px] font-extrabold text-[#16181d]">{b.name}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Orchestrator ---------------- */
export function MenLanding() {
  const { data: settings } = useQuery(() => getMenSettings(), []);
  const s: any = settings || {};

  const naCount = s.new_arrivals_count ?? 8;
  const bsCount = s.best_sellers_count ?? 8;
  const recCount = s.recommended_count ?? 8;
  const sdCount = s.super_deals_count ?? 8;

  const defaultOrder = ["hero", "collections", "shop_category", "new_arrivals", "flash_sale", "super_deals", "best_sellers", "brands", "recommended"];
  const order: string[] = Array.isArray(s.section_order) && s.section_order.length ? s.section_order : defaultOrder;

  const vis = (key: string) => {
    // when settings not loaded yet, show everything
    if (!settings) return true;
    const map: Record<string, boolean> = {
      hero: s.show_hero, collections: s.show_collections, shop_category: s.show_shop_category,
      new_arrivals: s.show_new_arrivals, flash_sale: s.show_flash_sale, super_deals: s.show_super_deals,
      best_sellers: s.show_best_sellers, brands: s.show_brands, recommended: s.show_recommended,
    };
    return map[key] !== false;
  };

  const render = (key: string) => {
    switch (key) {
      case "hero": return <MenHero />;
      case "collections": return <MenCollections />;
      case "shop_category": return <MenShopCategory />;
      case "new_arrivals": return <MenProductGrid title="NEW ARRIVALS" href="/new-arrivals" variant="new" limit={naCount} />;
      case "flash_sale": return <MenFlashSale />;
      case "super_deals": return <MenSuperDeals limit={sdCount} />;
      case "best_sellers": return <MenProductGrid title="BEST SELLERS" href="/best-sellers" variant="best" limit={bsCount} />;
      case "brands": return <MenBrands />;
      case "recommended": return <MenProductGrid title="RECOMMENDED FOR YOU" variant="recommended" limit={recCount} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-10">
      {order.filter(vis).map((key) => <section key={key}>{render(key)}</section>)}
    </div>
  );
}
