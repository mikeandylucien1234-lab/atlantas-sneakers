"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Zap, Clock, Truck, ShieldCheck, RotateCcw, MapPin, Package, Lock, Heart, BadgeCheck, Gift, Ticket, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@/lib/hooks/use-query";
import { useRecentlyViewed } from "@/lib/hooks/use-recently-viewed";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import { ProductCard } from "@/components/ui/product-card";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { NewsletterSection } from "@/components/sections/newsletter-section";
import {
  getLandingSettings, getLandingHeroBanners, getLandingCollections, getLandingShopCategories,
  getLandingBrands, getLandingStyleLooks, getLandingProducts, getLandingFlashDeals, getProductsByIds,
  getKidsAgeRanges, type LandingProductVariant,
} from "@/lib/supabase/queries";
import type { Product } from "@/types";

function pad(n: number) { return String(n).padStart(2, "0"); }

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
function Hero({ page }: { page: string }) {
  const { data: banners } = useQuery(() => getLandingHeroBanners(page), [page]);
  const slides = (banners && banners.length ? banners : [{
    name: page === "women" ? "WOMEN'S COLLECTION" : "NEW COLLECTION", description: "Discover the latest styles",
    image_desktop: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80",
    link_url: `/category/${page}`, cta_label: "SHOP NOW",
  }]) as any[];

  const [i, setI] = useState(0);
  const count = slides.length;
  useEffect(() => { if (count <= 1) return; const t = setInterval(() => setI((x) => (x + 1) % count), 5000); return () => clearInterval(t); }, [count]);
  const s = slides[Math.min(i, count - 1)];
  const img = s.image_desktop || s.image_mobile || s.image_tablet;
  const pos = s.text_position || "left";
  const alignCls = pos === "center" ? "items-center text-center" : pos === "right" ? "items-end text-right" : "items-start text-left";
  const textColor = s.text_color || "#ffffff";

  return (
    <div className="relative rounded-[18px] overflow-hidden h-[240px] sm:h-[360px] lg:h-[420px] shadow-[0_18px_40px_rgba(16,24,40,.16)] bg-[#0f172a]">
      {img && <div className="absolute inset-0 bg-cover bg-center transition-opacity duration-500" style={{ backgroundImage: `url(${img})` }} />}
      <div className={cn("absolute inset-0", pos === "right" ? "bg-gradient-to-l from-black/70 via-black/40 to-transparent" : "bg-gradient-to-r from-black/70 via-black/40 to-transparent")} />
      <div className={cn("relative z-[2] h-full flex flex-col justify-center px-6 sm:px-10 lg:px-14 max-w-[85%] sm:max-w-[62%]", alignCls, pos === "right" && "ml-auto", pos === "center" && "mx-auto")}>
        <div className="text-[26px] sm:text-[42px] lg:text-[50px] leading-[1] font-extrabold tracking-[-.02em] drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]" style={{ color: textColor }}>{s.name}</div>
        {s.description && <div className="text-[13px] sm:text-[15px] font-medium mt-3 max-w-[360px] drop-shadow-[0_1px_4px_rgba(0,0,0,.3)]" style={{ color: textColor, opacity: 0.9 }}>{s.description}</div>}
        <Link href={s.link_url || `/category/${page}`} className="self-start mt-5 flex items-center gap-2 bg-white text-[#0a0b0d] font-bold text-[13px] py-[12px] px-6 rounded-full shadow-[0_8px_18px_rgba(0,0,0,.18)] hover:brightness-105 active:scale-[.97] transition">
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

/* ---------------- Collections ---------------- */
function Collections({ page }: { page: string }) {
  const { data } = useQuery(() => getLandingCollections(page), [page]);
  const items = data || [];
  if (!items.length) return null;
  return (
    <div>
      <SectionHead title={page === "women" ? "WOMEN'S COLLECTIONS" : "COLLECTIONS"} />
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((c: any) => (
          <Link key={c.id} href={c.link_url || `/category/${page}`} className="relative shrink-0 w-[45%] sm:w-[220px] aspect-[3/4] rounded-[14px] overflow-hidden snap-start group">
            {c.image_url && /* eslint-disable-next-line @next/next/no-img-element */ (
              <img src={c.image_url} alt={c.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2.5"><span className="text-white text-[14px] font-bold">{c.name}</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Shop by Category (round) ---------------- */
function ShopCategory({ page }: { page: string }) {
  const { data } = useQuery(() => getLandingShopCategories(page), [page]);
  const items = (data || []).map((c: any) => ({
    id: c.id, name: c.name, image_url: c.image_url,
    href: c.category?.slug ? `/category/${c.category.slug}` : (c.link_url || `/category/${page}`),
  }));
  if (!items.length) return null;
  return (
    <div>
      <SectionHead title="SHOP BY CATEGORY" />
      <div className="grid grid-rows-2 grid-flow-col auto-cols-[24%] gap-x-2 gap-y-5 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid-rows-none sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-6 lg:grid-cols-10 sm:gap-x-4 sm:gap-y-6 sm:overflow-visible">
        {items.map((t) => (
          <Link key={t.id} href={t.href} className="flex flex-col items-center gap-2 group snap-start w-[70px] sm:w-[88px] shrink-0">
            <div className="w-[70px] sm:w-[88px] aspect-square rounded-full overflow-hidden ring-1 ring-black/[.04] bg-[#f4f5f7] transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:shadow-[0_16px_34px_rgba(16,24,40,.16)]">
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

/* ---------------- Age navigation ---------------- */
function AgeNav({ page, ageId, onSelect }: { page: string; ageId: string | null; onSelect: (catId: string | null, id: string | null) => void }) {
  const { data } = useQuery(() => getKidsAgeRanges(page), [page]);
  const items = data || [];
  if (!items.length) return null;
  return (
    <div className="flex items-center gap-5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button onClick={() => onSelect(null, null)} className={cn("shrink-0 text-[15px] font-bold pb-1.5 border-b-2 transition-colors", ageId === null ? "text-[#2563eb] border-[#2563eb]" : "text-[#4b5563] border-transparent")}>Category</button>
      {items.map((a: any) => (
        <button key={a.id} onClick={() => onSelect(a.linked_category_id || null, a.id)} className={cn("shrink-0 text-[15px] font-bold pb-1.5 border-b-2 transition-colors whitespace-nowrap", ageId === a.id ? "text-[#2563eb] border-[#2563eb]" : "text-[#4b5563] border-transparent")}>{a.label}</button>
      ))}
    </div>
  );
}

/* ---------------- Product grid ---------------- */
function ProductGrid({ page, title, href, variant, limit, ageCategoryId }: { page: string; title: string; href?: string; variant?: LandingProductVariant; limit: number; ageCategoryId?: string | null }) {
  const { data, loading } = useQuery(() => getLandingProducts(page, { variant, limit, ageCategoryId: ageCategoryId || undefined }), [page, variant, limit, ageCategoryId]);
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

/* ---------------- Flash Sale ---------------- */
function FlashSale({ page, accent }: { page: string; accent: string }) {
  const { data: deals } = useQuery(() => getLandingFlashDeals(page), [page]);
  const { data: fallback } = useQuery(() => getLandingProducts(page, { variant: "deals", limit: 6 }), [page]);

  // countdown to tonight's midnight (or a deal end when present)
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const end = (deals || []).map((d: any) => d.ends_at).filter(Boolean).sort()[0];
    const target = end ? new Date(end) : (() => { const m = new Date(); m.setHours(24, 0, 0, 0); return m; })();
    const tick = () => setTotal(Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000)));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, [deals]);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;

  const items: Array<{ name: string; price: string; old?: string; disc?: string; slug: string; image?: string }> = [];
  for (const d of (deals || [])) {
    const p = (d as any).product as Product | undefined; if (!p) continue;
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
    } else items.push({ name: p.name, price: `$${Number(p.price).toFixed(2)}`, slug: p.slug, image: p.images?.[0] });
  }
  if (!items.length) return null;

  return (
    <div className="rounded-[18px] overflow-hidden px-[14px] sm:px-5 py-5" style={{ background: `linear-gradient(120deg, ${accent}22, ${accent}44 45%, ${accent}66)` }}>
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Zap className="w-7 h-7" style={{ color: accent, fill: accent }} />
          <div>
            <div className="text-[20px] sm:text-[24px] font-extrabold text-[#16181d] tracking-[-.01em]">FLASH SALE</div>
            <div className="text-[12px] text-[#16181d]/70">Limited-time deals — grab them before they're gone!</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#16181d]/70" />
          {[["H", h], ["M", m], ["S", s]].map(([lab, v]) => (
            <div key={lab as string} className="text-center"><div className="rounded-[8px] min-w-[38px] py-1.5 text-[16px] font-extrabold text-white tabular-nums" style={{ background: accent }}>{pad(v as number)}</div></div>
          ))}
          <Link href="/deals" className="ml-1 text-[12px] font-bold text-[#2563eb] hover:underline flex items-center gap-1">View all <ArrowRight className="w-3.5 h-3.5" /></Link>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {items.map((p) => (
          <Link href={`/product/${p.slug}`} key={p.slug} className="bg-white rounded-[12px] p-[11px] hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,24,40,.12)] transition">
            <div className="relative mb-[10px]">
              <div className="aspect-square rounded-[9px] overflow-hidden bg-[#f4f5f7]">{p.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover" />}</div>
              {p.disc && <span className="absolute top-[7px] left-[7px] text-white text-[11px] font-extrabold py-[3px] px-[7px] rounded-[6px]" style={{ background: accent }}>{p.disc}</span>}
            </div>
            <div className="text-[12px] font-semibold text-[#16181d] leading-[1.3] mb-[7px] min-h-[31px] line-clamp-2">{p.name}</div>
            <div className="flex items-baseline gap-1.5"><span className="text-[15px] font-extrabold text-[#16181d]">{p.price}</span>{p.old && <span className="text-[12px] text-[#9aa3ad] line-through">{p.old}</span>}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Super Deals ---------------- */
function SuperDeals({ page, limit, ageCategoryId }: { page: string; limit: number; ageCategoryId?: string | null }) {
  const { data, loading } = useQuery(() => getLandingProducts(page, { variant: "deals", limit, ageCategoryId: ageCategoryId || undefined }), [page, limit, ageCategoryId]);
  const items = data || [];
  if (!loading && !items.length) return null;
  return (
    <div className="rounded-[18px] p-4 sm:p-5 bg-[linear-gradient(120deg,#eef4ff,#dbe7ff)]">
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
function Brands({ page }: { page: string }) {
  const { data } = useQuery(() => getLandingBrands(page), [page]);
  const items = data || [];
  if (!items.length) return null;
  return (
    <div>
      <SectionHead title="FEATURED BRANDS" />
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((b: any) => (
          <Link key={b.id} href={b.link_url || (b.brand?.slug ? `/shop?brand=${b.brand.slug}` : "/shop")}
            className="shrink-0 w-[120px] h-[72px] rounded-[12px] bg-white border border-[#eef0f3] flex items-center justify-center px-3 hover:shadow-[0_10px_24px_rgba(16,24,40,.1)] transition">
            {b.logo_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={b.logo_url} alt={b.name} className="max-h-[44px] max-w-full object-contain" /> : <span className="text-[14px] font-extrabold text-[#16181d]">{b.name}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Style Inspiration ---------------- */
function StyleInspiration({ page, title = "STYLE INSPIRATION", section = "style" }: { page: string; title?: string; section?: string }) {
  const { data } = useQuery(() => getLandingStyleLooks(page, section), [page, section]);
  const items = data || [];
  if (!items.length) return null;
  return (
    <div>
      <SectionHead title={title} />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((l: any, idx: number) => (
          <Link key={l.id} href={l.link_url || `/category/${page}`} className={cn("relative rounded-[16px] overflow-hidden group aspect-[4/5]", idx === 0 && "col-span-2 lg:col-span-1")}>
            {l.image_url && /* eslint-disable-next-line @next/next/no-img-element */ (
              <img src={l.image_url} alt={l.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="text-white text-[17px] font-extrabold drop-shadow">{l.name}</div>
              {l.subtitle && <div className="text-white/85 text-[12px] mt-0.5">{l.subtitle}</div>}
              <span className="inline-flex items-center gap-1 mt-2 text-white text-[12px] font-bold">Shop the look <ArrowRight className="w-3.5 h-3.5" /></span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Recently Viewed ---------------- */
function RecentlyViewed() {
  const ids = useRecentlyViewed();
  const { data } = useQuery(() => getProductsByIds(ids), [ids.join(",")]);
  const products = data || [];
  if (!products.length) return null;
  return (
    <div>
      <SectionHead title="RECENTLY VIEWED" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {products.slice(0, 8).map((p) => (
          <ProductCard key={p.id} id={p.id} slug={p.slug} name={p.name} brand={p.brand?.name ?? ""}
            price={Number(p.price)} comparePrice={p.compare_price ? Number(p.compare_price) : undefined}
            image={p.images?.[0] ?? "/placeholder.svg"} isNew={p.is_new} isFeatured={p.is_featured} />
        ))}
      </div>
    </div>
  );
}

/* ================= QUICKSHIP ================= */

// Premium QuickShip product card: express badge, discount, delivery + stock.
function QuickShipCard({ p }: { p: any }) {
  const toggle = useWishlistStore((s) => s.toggleItem);
  const wished = useWishlistStore((s) => s.isInWishlist(p.id));
  const price = Number(p.price);
  const old = p.compare_price ? Number(p.compare_price) : undefined;
  const disc = old ? Math.round(((old - price) / old) * 100) : 0;
  const hrs = p.delivery_hours || 72;
  const stock = p.local_stock;
  const low = stock != null && stock <= 5;
  return (
    <div className="group relative bg-white rounded-[14px] border border-[#eef0f3] overflow-hidden transition-[transform,box-shadow] duration-[160ms] hover:-translate-y-[3px] hover:shadow-[0_12px_26px_rgba(16,24,40,.12)]">
      <Link href={`/product/${p.slug}`} className="block">
        <div className="relative aspect-square bg-[#f4f5f7] overflow-hidden">
          {p.images?.[0] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.images[0]} alt={p.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-[160ms] group-hover:scale-105" />}
          <div className="absolute top-2 left-2 flex flex-col gap-1.5 items-start">
            <span className="inline-flex items-center gap-1 bg-[#2563eb] text-white text-[10px] font-extrabold py-[3px] px-[7px] rounded-[6px] shadow"><Zap className="w-3 h-3" fill="#fff" /> EXPRESS</span>
            {disc > 0 && <span className="bg-[#ef4444] text-white text-[10px] font-extrabold py-[3px] px-[7px] rounded-[6px]">-{disc}%</span>}
            {p.is_new && <span className="bg-[#16181d] text-white text-[10px] font-extrabold py-[3px] px-[7px] rounded-[6px]">NEW</span>}
          </div>
        </div>
      </Link>
      <button onClick={() => toggle({ id: p.id, productId: p.id, name: p.name, image: p.images?.[0], price })} className="absolute top-2 right-2 h-[30px] w-[30px] flex items-center justify-center rounded-full bg-white/[.92] shadow hover:bg-white transition">
        <Heart className={cn("h-[15px] w-[15px]", wished ? "fill-[#ef4444] text-[#ef4444]" : "text-[#9aa3ad]")} />
      </button>
      <div className="px-[13px] pt-[11px] pb-[13px]">
        <Link href={`/product/${p.slug}`}><h3 className="text-[13px] font-bold text-[#16181d] line-clamp-2 leading-snug hover:text-[#2563eb]">{p.name}</h3></Link>
        <div className="flex items-baseline gap-1.5 mt-1.5">
          <span className="text-[15px] font-extrabold text-[#16181d]">${price.toFixed(2)}</span>
          {old && <span className="text-[12px] text-[#9aa3ad] line-through">${old.toFixed(2)}</span>}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#059669]"><Truck className="w-3.5 h-3.5" /> Livraison {hrs}h</div>
        {stock != null && (
          <div className={cn("mt-1 flex items-center gap-1.5 text-[11px] font-semibold", low ? "text-[#ef4444]" : "text-[#4b5563]")}>
            <Package className="w-3.5 h-3.5" /> {low ? `Plus que ${stock} !` : "En stock local"}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickShipGrid({ title, href, variant, limit, maxHours }: { title: string; href?: string; variant?: LandingProductVariant; limit: number; maxHours?: number }) {
  const { data, loading } = useQuery(() => getLandingProducts("quickship", { variant, limit, maxHours }), [variant, limit, maxHours]);
  const items = data || [];
  if (!loading && !items.length) return null;
  return (
    <div>
      <SectionHead title={title} href={href} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {loading ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />) : items.map((p: any) => <QuickShipCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}

function GuaranteeBar() {
  const items = [
    { icon: Truck, label: "Livraison Express" },
    { icon: MapPin, label: "Entrepôt Local" },
    { icon: Zap, label: "Expédition 24h" },
    { icon: Lock, label: "Paiement sécurisé" },
    { icon: RotateCcw, label: "Retour facile" },
  ];
  return (
    <div className="rounded-[16px] border border-[#eef0f3] bg-white px-3 py-3 sm:px-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex items-center gap-5 sm:gap-8 min-w-max sm:min-w-0 sm:justify-between">
        {items.map((it) => { const I = it.icon; return (
          <div key={it.label} className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#2563eb]/10 flex items-center justify-center"><I className="w-[17px] h-[17px] text-[#2563eb]" /></div>
            <span className="text-[12px] font-bold text-[#16181d] whitespace-nowrap">{it.label}</span>
          </div>
        ); })}
      </div>
    </div>
  );
}

const QUICK_FILTERS = [
  { key: 0, label: "Disponible maintenant" },
  { key: 24, label: "Livraison 24h" },
  { key: 48, label: "Livraison 48h" },
  { key: 72, label: "Livraison 72h" },
];
function QuickFilters({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {QUICK_FILTERS.map((f) => (
        <button key={f.key} onClick={() => onChange(f.key)} className={cn("shrink-0 h-9 px-4 rounded-full text-[13px] font-bold border transition-colors", value === f.key ? "bg-[#2563eb] text-white border-[#2563eb]" : "bg-white text-[#4b5563] border-[#eef0f3] hover:border-[#2563eb]")}>{f.label}</button>
      ))}
    </div>
  );
}

function WhyQuickShip() {
  const items = [
    { icon: Zap, t: "Livraison rapide", d: "Reçu en 24-72h" },
    { icon: BadgeCheck, t: "Aucun délai fournisseur", d: "Déjà en entrepôt local" },
    { icon: RotateCcw, t: "Retour facile", d: "Sous 30 jours" },
    { icon: Lock, t: "Paiement sécurisé", d: "Transactions protégées" },
    { icon: ShieldCheck, t: "Produits vérifiés", d: "Qualité contrôlée" },
  ];
  return (
    <div className="rounded-[18px] bg-[linear-gradient(120deg,#0f172a,#1e293b)] text-white p-5 sm:p-7">
      <h2 className="text-[19px] sm:text-[22px] font-extrabold tracking-[-.01em] mb-4">POURQUOI QUICKSHIP ?</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map((it) => { const I = it.icon; return (
          <div key={it.t} className="bg-white/[.06] rounded-[14px] p-3.5">
            <div className="w-9 h-9 rounded-full bg-[#2563eb] flex items-center justify-center mb-2"><I className="w-[18px] h-[18px] text-white" /></div>
            <div className="text-[13px] font-extrabold">{it.t}</div>
            <div className="text-[11px] text-white/70 mt-0.5">{it.d}</div>
          </div>
        ); })}
      </div>
    </div>
  );
}

/* ---------------- Kids Essentials (tiles from style looks) ---------------- */
function KidsEssentials({ page }: { page: string }) {
  const { data } = useQuery(() => getLandingStyleLooks(page, "essentials"), [page]);
  const items = data || [];
  if (!items.length) return null;
  return (
    <div>
      <SectionHead title="KIDS ESSENTIALS" />
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {items.map((e: any) => (
          <Link key={e.id} href={e.link_url || `/category/${page}`} className="group">
            <div className="aspect-square rounded-[16px] overflow-hidden bg-[#f4f5f7] ring-1 ring-black/[.04] transition-transform duration-200 group-hover:-translate-y-1">
              {e.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.image_url} alt={e.name} loading="lazy" className="w-full h-full object-cover" />}
            </div>
            <div className="text-[12px] sm:text-[13px] font-semibold text-[#16181d] text-center mt-2 line-clamp-1">{e.name}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Loyalty (static) ---------------- */
function Loyalty() {
  const perks = [
    { icon: BadgeCheck, t: "Points fidélité", d: "Gagnez à chaque achat" },
    { icon: Gift, t: "Récompenses", d: "Échangez vos points" },
    { icon: Ticket, t: "Coupons exclusifs", d: "Offres réservées aux membres" },
    { icon: Wallet, t: "Cashback", d: "Remboursement sur vos achats" },
  ];
  return (
    <div className="rounded-[18px] bg-[linear-gradient(120deg,#1d4ed8,#2563eb)] text-white p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-[19px] sm:text-[22px] font-extrabold tracking-[-.01em]">PROGRAMME FIDÉLITÉ</h2>
        <Link href="/account#rewards" className="bg-white text-[#1d4ed8] font-bold text-[13px] py-2.5 px-5 rounded-full hover:brightness-105 active:scale-[.97] transition">Rejoindre</Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {perks.map((p) => { const I = p.icon; return (
          <div key={p.t} className="bg-white/[.08] rounded-[14px] p-3.5">
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center mb-2"><I className="w-[18px] h-[18px] text-white" /></div>
            <div className="text-[13px] font-extrabold">{p.t}</div>
            <div className="text-[11px] text-white/75 mt-0.5">{p.d}</div>
          </div>
        ); })}
      </div>
    </div>
  );
}

/* ---------------- Orchestrator ---------------- */
export function LandingPage({ page }: { page: string }) {
  const { data: settings } = useQuery(() => getLandingSettings(page), [page]);
  const s: any = settings || {};

  // Kids age-range filter (null = all ages). `ageCat` scopes product sections.
  const [age, setAge] = useState<{ catId: string | null; id: string | null }>({ catId: null, id: null });
  const ageCat = age.catId;
  const isQuick = page === "quickship";
  // QuickShip delivery filter (0 = all / available now). Applies to product grids.
  const [maxHours, setMaxHours] = useState(0);
  const qh = maxHours || undefined;

  const naCount = s.new_arrivals_count ?? 8;
  const bsCount = s.best_sellers_count ?? 8;
  const recCount = s.recommended_count ?? 8;
  const sdCount = s.super_deals_count ?? 8;
  const trCount = s.trending_count ?? 8;
  const hsCount = s.hot_sellers_count ?? 4;
  const wsCount = s.weekly_special_count ?? 4;
  const bbCount = s.budget_buys_count ?? 4;
  const hcCount = s.high_cotton_count ?? 4;
  const fmCount = s.family_matching_count ?? 4;
  const accent = s.flash_accent || "#2563eb";

  const defaultOrder = ["hero", "collections", "shop_category", "new_arrivals", "flash_sale", "super_deals", "best_sellers", "brands", "recommended"];
  const order: string[] = Array.isArray(s.section_order) && s.section_order.length ? s.section_order : defaultOrder;

  const vis = (key: string) => {
    if (!settings) return true;
    const map: Record<string, boolean> = {
      hero: s.show_hero, collections: s.show_collections, shop_category: s.show_shop_category,
      new_arrivals: s.show_new_arrivals, flash_sale: s.show_flash_sale, super_deals: s.show_super_deals,
      best_sellers: s.show_best_sellers, trending: s.show_trending, recommended: s.show_recommended,
      brands: s.show_brands, style_inspiration: s.show_style_inspiration, recently_viewed: s.show_recently_viewed,
      hot_sellers: s.show_hot_sellers, seasonal: s.show_seasonal, newsletter: s.show_newsletter,
      age_nav: s.show_age_nav, weekly_special: s.show_weekly_special, budget_buys: s.show_budget_buys,
      high_cotton: s.show_high_cotton, family_matching: s.show_family_matching, kids_essentials: s.show_kids_essentials,
      guarantee: s.show_guarantee, quick_filters: s.show_quick_filters, hot_sales: s.show_hot_sales,
      local_stock: s.show_local_stock, ship_today: s.show_ship_today, why_quickship: s.show_why,
      bundles: s.show_bundles, loyalty: s.show_loyalty,
    };
    return map[key] !== false;
  };

  const render = (key: string) => {
    switch (key) {
      case "hero": return <Hero page={page} />;
      case "age_nav": return <AgeNav page={page} ageId={age.id} onSelect={(catId, id) => setAge({ catId, id })} />;
      case "guarantee": return <GuaranteeBar />;
      case "quick_filters": return <QuickFilters value={maxHours} onChange={setMaxHours} />;
      case "hot_sales": return <QuickShipGrid title="HOT SALES" href="/shop" variant="deals" limit={s.hot_sales_count ?? 8} maxHours={qh} />;
      case "local_stock": return <QuickShipGrid title="DISPONIBLE DANS VOTRE RÉGION" variant="best" limit={8} maxHours={qh} />;
      case "ship_today": return <QuickShipGrid title="EXPÉDIÉ AUJOURD'HUI" variant="new" limit={8} maxHours={24} />;
      case "why_quickship": return <WhyQuickShip />;
      case "collections": return <Collections page={page} />;
      case "shop_category": return <ShopCategory page={page} />;
      case "new_arrivals": return isQuick
        ? <QuickShipGrid title="NEW ARRIVALS" variant="new" limit={naCount} maxHours={qh} />
        : <ProductGrid page={page} title="NEW ARRIVALS" href="/new-arrivals" variant="new" limit={naCount} ageCategoryId={ageCat} />;
      case "flash_sale": return <FlashSale page={page} accent={accent} />;
      case "super_deals": return <SuperDeals page={page} limit={sdCount} ageCategoryId={ageCat} />;
      case "weekly_special": return <ProductGrid page={page} title="WEEKLY SPECIAL" href="/deals" variant="deals" limit={wsCount} ageCategoryId={ageCat} />;
      case "budget_buys": return <ProductGrid page={page} title="BUDGET BUYS" variant="budget" limit={bbCount} ageCategoryId={ageCat} />;
      case "high_cotton": return <ProductGrid page={page} title="HIGH COTTON" variant="best" limit={hcCount} ageCategoryId={ageCat} />;
      case "family_matching": return <ProductGrid page={page} title="FAMILY MATCHING" variant="trending" limit={fmCount} ageCategoryId={ageCat} />;
      case "best_sellers": return isQuick
        ? <QuickShipGrid title="BEST SELLERS" variant="best" limit={bsCount} maxHours={qh} />
        : <ProductGrid page={page} title="BEST SELLERS" href="/best-sellers" variant="best" limit={bsCount} ageCategoryId={ageCat} />;
      case "trending": return <ProductGrid page={page} title="TRENDING NOW" variant="trending" limit={trCount} ageCategoryId={ageCat} />;
      case "recommended": return isQuick
        ? <QuickShipGrid title="FOR YOU" variant="recommended" limit={recCount} maxHours={qh} />
        : <ProductGrid page={page} title="RECOMMENDED FOR YOU" variant="recommended" limit={recCount} ageCategoryId={ageCat} />;
      case "brands": return <Brands page={page} />;
      case "style_inspiration": return <StyleInspiration page={page} />;
      case "seasonal": return <StyleInspiration page={page} title="SEASONAL COLLECTIONS" section={page === "kids" ? "seasonal" : "style"} />;
      case "bundles": return <StyleInspiration page={page} title="ACHETEZ ENSEMBLE" section="bundle" />;
      case "loyalty": return <Loyalty />;
      case "kids_essentials": return <KidsEssentials page={page} />;
      case "hot_sellers": return <ProductGrid page={page} title="HOT SELLERS" variant="best" limit={hsCount} ageCategoryId={ageCat} />;
      case "recently_viewed": return <RecentlyViewed />;
      case "newsletter": return <NewsletterSection />;
      default: return null;
    }
  };

  return (
    <div className="space-y-10">
      {order.filter(vis).map((key) => <section key={key}>{render(key)}</section>)}
    </div>
  );
}
