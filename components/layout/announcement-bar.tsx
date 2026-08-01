"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Truck, Zap, Gift, Tag, Percent, Star, Flame, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const ICONS: Record<string, any> = { gift: Gift, flash: Zap, truck: Truck, promotion: Tag, percent: Percent, star: Star, fire: Flame, coupon: Ticket };
const SPEED_MS: Record<string, number> = { very_slow: 7000, slow: 5500, normal: 4000, fast: 2500, very_fast: 1500 };
const MARQUEE_S: Record<string, number> = { very_slow: 40, slow: 28, normal: 20, fast: 13, very_fast: 8 };

type Ann = { id: string; text: string; icon: string | null; link_url: string | null };
type Settings = { enabled: boolean; animation: string; speed: string; bg_color: string; text_color: string; icon_color: string; link_color: string };

// Sanitize admin HTML to a safe subset (b, strong, i, em, u, span[style], a[href]).
function sanitize(html: string): string {
  let s = String(html || "");
  s = s.replace(/<\s*(script|style|iframe|img|svg|link|meta)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "");
  s = s.replace(/<\s*(script|style|iframe|img|svg|link|meta)[^>]*\/?>/gi, "");
  s = s.replace(/ on\w+="[^"]*"/gi, "").replace(/ on\w+='[^']*'/gi, "");
  s = s.replace(/javascript:/gi, "");
  return s;
}

export function AnnouncementBar() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [items, setItems] = useState<Ann[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const sb = createClient();
    (async () => {
      const [{ data: s }, { data: a }] = await Promise.all([
        sb.from("announcement_settings").select("*").eq("id", "global").maybeSingle(),
        sb.from("announcements").select("id, text, icon, link_url").eq("is_active", true).order("sort_order"),
      ]);
      if (s) setSettings(s as Settings);
      setItems((a || []) as Ann[]);
    })();
  }, []);

  const isMarquee = settings?.animation?.startsWith("marquee");
  const rotateMs = SPEED_MS[settings?.speed || "normal"] || 4000;

  useEffect(() => {
    if (!settings || isMarquee || items.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), rotateMs);
    return () => clearInterval(t);
  }, [settings, isMarquee, items.length, rotateMs]);

  if (!settings || !settings.enabled || items.length === 0) return null;

  const { bg_color, text_color, icon_color, link_color, animation, speed } = settings;

  const renderItem = (a: Ann, key?: string | number) => {
    const Icon = a.icon && a.icon !== "none" ? ICONS[a.icon] : null;
    const inner = (
      <span className="inline-flex items-center gap-[7px]">
        {Icon && <Icon className="shrink-0" style={{ color: icon_color, width: 15, height: 15 }} />}
        <span className="whitespace-nowrap" dangerouslySetInnerHTML={{ __html: sanitize(a.text) }} />
      </span>
    );
    return a.link_url
      ? <Link key={key} href={a.link_url} className="hover:opacity-80 transition-opacity" style={{ color: text_color }}>{inner}</Link>
      : <span key={key} style={{ color: text_color }}>{inner}</span>;
  };

  return (
    <div style={{ background: bg_color, ["--ann-link" as any]: link_color }}>
      <style>{`
        .ann-link a span[style]{}
        .ann-link a{color:var(--ann-link) !important;text-decoration:underline}
        @keyframes ann-fade{0%,100%{opacity:0}10%,90%{opacity:1}}
        @keyframes ann-slide{0%{opacity:0;transform:translateY(-100%)}12%,88%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(100%)}}
        @keyframes ann-bounce{0%{opacity:0;transform:translateY(-60%)}15%{opacity:1;transform:translateY(12%)}30%{transform:translateY(-6%)}45%{transform:translateY(0)}100%{opacity:1;transform:translateY(0)}}
        @keyframes ann-zoom{0%{opacity:0;transform:scale(.7)}12%,88%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.1)}}
        @keyframes ann-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        @keyframes ann-marquee-left{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes ann-marquee-right{from{transform:translateX(-50%)}to{transform:translateX(0)}}
        .ann-marquee{display:inline-flex;white-space:nowrap;will-change:transform}
      `}</style>

      {isMarquee ? (
        <div className="ann-link overflow-hidden h-[40px] flex items-center text-[12.5px] font-semibold tracking-[.03em]">
          <div className="ann-marquee" style={{ animation: `${animation === "marquee_right" ? "ann-marquee-right" : "ann-marquee-left"} ${MARQUEE_S[speed] || 20}s linear infinite` }}>
            {[...items, ...items].map((a, i) => (
              <span key={i} className="mx-6 inline-flex items-center">{renderItem(a, i)}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="ann-link max-w-[1240px] mx-auto flex items-center justify-center h-[40px] px-4 text-[12.5px] font-semibold tracking-[.03em] overflow-hidden">
          <span
            key={index}
            style={{
              animation:
                animation === "pulse" ? `ann-pulse ${Math.max(1200, Math.round(rotateMs / 2))}ms ease-in-out infinite`
                  : `ann-${["fade", "slide", "bounce", "zoom"].includes(animation) ? animation : "fade"} ${rotateMs}ms ease both`,
            }}
          >
            {renderItem(items[index])}
          </span>
        </div>
      )}
    </div>
  );
}
