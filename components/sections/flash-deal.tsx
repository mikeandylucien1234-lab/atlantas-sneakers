"use client";

// FLASH DEAL — a standalone dynamic promotional banner module. It is completely
// independent from the Flash Sale section: it has no countdown, no product list
// and no business logic beyond displaying an admin-configured banner and linking
// to its own target URL. Multiple active banners rotate automatically by
// priority. This never opens or renders the Flash Sale component.
import { useState, useEffect } from "react";
import Link from "next/link";
import { getBannersByLocation } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";

export function FlashDeal() {
  const { data } = useQuery(() => getBannersByLocation("flash_deal_strip"), []);
  const banners = data || [];
  const [idx, setIdx] = useState(0);

  // Auto-rotate between active banners (already priority-ordered & in-schedule).
  useEffect(() => {
    if (banners.length <= 1) { setIdx(0); return; }
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 7000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!banners.length) return null;
  const b = banners[idx % banners.length];
  const img = b.image_desktop || b.image_mobile || b.image_tablet;
  if (!img) return null;

  const hasTitle = b.name || b.description || b.cta_label;
  const accent = b.cta_color || "#ef4444";
  // Click follows ONLY the admin-configured target URL. No fallback to the
  // Flash Sale page — a deal with no URL is simply not clickable.
  const href = b.link_url || null;

  const inner = (
    <div className="relative rounded-[18px] overflow-hidden group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={b.alt_text || b.name || "Flash deal"} className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]" />

      {hasTitle && (
        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7 bg-gradient-to-t from-black/70 via-black/25 to-transparent">
          {b.name && <div className="text-white text-[22px] sm:text-[28px] font-extrabold leading-[1.1] drop-shadow-[0_2px_8px_rgba(0,0,0,.5)]">{b.name}</div>}
          {b.description && <div className="text-white/85 text-[13px] sm:text-[15px] mt-1 max-w-[520px] drop-shadow-[0_1px_4px_rgba(0,0,0,.5)]">{b.description}</div>}
          {b.cta_label && (
            <span className="self-start mt-3 inline-flex items-center gap-2 text-white font-bold text-[13px] py-[11px] px-[20px] rounded-[999px] shadow-[0_8px_18px_rgba(0,0,0,.3)]" style={{ backgroundColor: accent }}>
              {b.cta_label}
            </span>
          )}
        </div>
      )}

      {banners.length > 1 && (
        <div className="absolute top-3 right-3 flex gap-1.5">
          {banners.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-10">
      {href ? (
        <Link href={href} className="block">{inner}</Link>
      ) : (
        inner
      )}
    </div>
  );
}
