"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@/lib/hooks/use-query";
import { getShopCategoryTabs } from "@/lib/supabase/queries";

// Preferred order + labels for known tabs; unknown tabs are appended, humanized.
const TAB_META: [string, string][] = [
  ["category", "Category"], ["makeup", "Makeup"], ["tools", "Tools"],
  ["nails", "Nails"], ["hair", "Hair"], ["personalCare", "Personal Care"],
];
const humanize = (t: string) => t.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();

type Row = { id: string; tab: string | null; name: string; image_url?: string | null; link_url?: string | null; category?: { slug?: string } | null };

function CategoryTile({ row }: { row: Row }) {
  const href = row.category?.slug ? `/category/${row.category.slug}` : (row.link_url || "/category/beauty");
  return (
    <Link href={href} className="group flex flex-col items-center gap-2">
      <div className="aspect-square w-full overflow-hidden rounded-full bg-[#f4f5f7] ring-1 ring-black/[.04] shadow-[0_4px_14px_rgba(16,24,40,.08)] transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_14px_30px_rgba(16,24,40,.16)]">
        {row.image_url && /* eslint-disable-next-line @next/next/no-img-element */ (
          <img src={row.image_url} alt={row.name} loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>
      <span className="w-full text-center text-[11px] sm:text-[12px] font-semibold leading-tight text-[#16181d] line-clamp-2 break-words">{row.name}</span>
    </Link>
  );
}

function ViewAllTile() {
  return (
    <Link href="/category/beauty" className="group flex flex-col items-center gap-2">
      <div className="grid aspect-square w-full place-items-center rounded-full bg-[#2563eb]/10 ring-1 ring-[#2563eb]/15 transition-transform duration-200 group-hover:-translate-y-1">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#2563eb]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </div>
      <span className="w-full text-center text-[11px] sm:text-[12px] font-bold leading-tight text-[#2563eb]">View All</span>
    </Link>
  );
}

export function BeautyShopByCategory() {
  const { data } = useQuery(() => getShopCategoryTabs("beauty"), []);
  const rows = (data || []) as Row[];

  // Group rows by tab, preserving the preferred tab order.
  const { tabs, byTab } = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.tab || "category";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    const known = TAB_META.filter(([k]) => groups.has(k));
    const extra = [...groups.keys()].filter((k) => !TAB_META.some(([kk]) => kk === k)).map((k) => [k, humanize(k)] as [string, string]);
    return { tabs: [...known, ...extra], byTab: groups };
  }, [rows]);

  const [active, setActive] = useState<string>("category");
  const activeKey = tabs.some(([k]) => k === active) ? active : tabs[0]?.[0] ?? "category";
  const items = byTab.get(activeKey) || [];

  if (!rows.length) return null;

  return (
    <div>
      <h2 className="mb-3 text-[19px] sm:text-[20px] lg:text-[21px] font-extrabold tracking-[-.01em] text-[#16181d]">SHOP BY CATEGORY</h2>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-5 overflow-x-auto border-b border-[#eef0f3] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(([key, label]) => {
          const on = activeKey === key;
          return (
            <button key={key} onClick={() => setActive(key)} className={`relative shrink-0 pb-2.5 text-[14px] font-bold transition-colors ${on ? "text-[#16181d]" : "text-[#8a929c] hover:text-[#4b5563]"}`}>
              {label}
              <span className={`absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-[#2563eb] transition-opacity duration-200 ${on ? "opacity-100" : "opacity-0"}`} />
            </button>
          );
        })}
      </div>

      {/* Grid — remounts per tab for a smooth fade/slide transition */}
      <div key={activeKey} className="ovcat-grid grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
        {items.map((row) => <CategoryTile key={row.id} row={row} />)}
        <ViewAllTile />
      </div>

      <style>{`.ovcat-grid{animation:ovcatfade .25s ease}@keyframes ovcatfade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
