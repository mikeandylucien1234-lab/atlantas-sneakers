"use client";

import { useState } from "react";
import Link from "next/link";

/* Topical beauty images (Unsplash IDs already used across the site → known to
   load) mapped per sub-category so each tile is relevant, SHEIN-style. */
const IMG = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=200&h=200&q=70`;
const I = {
  makeup: "1522335789203-aabd1fc54bc9", makeup2: "1596462502278-27bfdc403348", makeup3: "1512496015851-a90fb38ba796",
  face: "1570172619644-dfd03ed5d881", lashes: "1583001931096-959e9a1a6223", lips: "1586495777744-4413f21062fa",
  brushes: "1596704017254-9b121068fb31", tools: "1512207736890-6ffed8a84e8d",
  nails: "1604654894610-df63bc536371", nails2: "1519014816548-bf5fe059798b",
  wig: "1595475207225-428b62bda831", hair: "1522338242992-e1a54906a8da", hair2: "1560869713-7d0a29430803",
  skincare: "1556228578-8c89e6adf883", body: "1608248543803-ba4f8c70ae0b", spa: "1600334129128-685c5582fd35",
  perfume: "1541643600914-78b084683601", oils: "1608571423902-eed4a5ad8108",
  supplements: "1584308666744-24d5c474f2ae", gift: "1549465220-1a8b9238cd48",
  accessories: "1611591437281-460bfbe1220a", men: "1621607512214-68297480165e",
};

type Cat = { name: string; img: string; href: string };
const make = (pairs: [string, string][]): Cat[] =>
  pairs.map(([name, id]) => ({ name, img: IMG(id), href: "/category/beauty" }));

// One reusable data structure — add/adjust categories here, the UI adapts.
const beautyCategories: Record<string, { label: string; items: Cat[] }> = {
  category: {
    label: "Category",
    items: make([
      ["Makeup", I.makeup], ["Beauty Tools", I.brushes], ["Nail, Hand & Foot Care", I.nails],
      ["Eyelashes", I.lashes], ["Press on Nails", I.nails2], ["Wigs & Accessories", I.wig],
      ["Personal Care", I.skincare], ["Fragrances & Aromatherapy", I.perfume],
      ["Personal Care Appliance", I.tools], ["Health Care", I.supplements], ["Dietary Supplements", I.supplements],
    ]),
  },
  makeup: {
    label: "Makeup",
    items: make([
      ["Face Make Up", I.makeup], ["Eye Make Up", I.face], ["Lips", I.lips], ["Eyelashes", I.lashes],
      ["Blush & Contour", I.makeup2], ["Eyebrows", I.face], ["Body Make Up", I.makeup3],
      ["Makeup Brushes", I.brushes], ["Makeup Puffs & Sponges", I.makeup2], ["Makeup Bag & Storage", I.gift],
      ["Makeup Remover", I.skincare],
    ]),
  },
  tools: {
    label: "Tools",
    items: make([
      ["Makeup Tools", I.brushes], ["Nail Art Tools", I.nails2], ["Hair Tools", I.hair],
      ["Skin Care Tools", I.skincare], ["Eye Tools", I.face], ["Body Care Tools", I.body],
      ["Oral & Nose Tools", I.tools], ["Eyelashes Tools", I.lashes], ["Tattoos & Body Art", I.accessories],
      ["Refillable Containers", I.oils], ["Mirrors", I.gift],
    ]),
  },
  nails: {
    label: "Nails",
    items: make([
      ["Press on Nails", I.nails2], ["Gel Nail Polish", I.nails], ["Nail Art Accessories", I.nails2],
      ["Rhinestones & Decorations", I.accessories], ["Nail Art Equipments", I.tools], ["Nail Art Salon Sets", I.nails],
      ["Nail Art Stickers & Decals", I.nails2], ["Hand, Foot & Nail Tools", I.brushes],
      ["Nail Glue & Adhesive", I.nails], ["Nail Powder & Liquids", I.nails2], ["Nail Polish Removers", I.skincare],
    ]),
  },
  hair: {
    label: "Hair",
    items: make([
      ["Synthetic Hair Wigs", I.wig], ["Human Hair Wigs", I.hair2], ["Wig Caps & Tools", I.wig],
      ["Hair Care & Styling", I.hair], ["Hair Styling Care Appliances", I.tools], ["Combs", I.brushes],
      ["Styling Tools", I.tools], ["Hair Tools", I.hair], ["Hair Treatment", I.oils],
      ["Hair Removal Tools", I.tools], ["Hair Cap", I.wig],
    ]),
  },
  personalCare: {
    label: "Personal Care",
    items: make([
      ["Skin Care", I.skincare], ["Body Care", I.body], ["Lip Care", I.lips], ["Personal Care Appliance", I.tools],
      ["Oral & Nose Care", I.spa], ["Massage & Relaxation", I.spa], ["Health Care", I.supplements],
      ["Facial Masks", I.face], ["Bath & Shower", I.body], ["Men Grooming", I.men], ["Shaving & Hair Removal", I.men],
    ]),
  },
};

const TAB_ORDER = ["category", "makeup", "tools", "nails", "hair", "personalCare"] as const;
type TabKey = (typeof TAB_ORDER)[number];

/* One reusable tile. */
function CategoryTile({ cat }: { cat: Cat }) {
  return (
    <Link href={cat.href} className="group flex flex-col items-center gap-2">
      <div className="aspect-square w-full overflow-hidden rounded-full bg-[#f4f5f7] ring-1 ring-black/[.04] shadow-[0_4px_14px_rgba(16,24,40,.08)] transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_14px_30px_rgba(16,24,40,.16)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cat.img} alt={cat.name} loading="lazy" className="h-full w-full object-cover" />
      </div>
      <span className="w-full text-center text-[11px] sm:text-[12px] font-semibold leading-tight text-[#16181d] line-clamp-2 break-words">
        {cat.name}
      </span>
    </Link>
  );
}

/* "View All" tile — always last. */
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
  const [active, setActive] = useState<TabKey>("category");
  const items = beautyCategories[active].items;

  return (
    <div>
      <h2 className="mb-3 text-[19px] sm:text-[21px] font-extrabold tracking-[-.01em] text-[#16181d]">SHOP BY CATEGORY</h2>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-5 overflow-x-auto border-b border-[#eef0f3] pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TAB_ORDER.map((key) => {
          const on = active === key;
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`relative shrink-0 pb-2.5 text-[14px] font-bold transition-colors ${on ? "text-[#16181d]" : "text-[#8a929c] hover:text-[#4b5563]"}`}
            >
              {beautyCategories[key].label}
              <span className={`absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-[#2563eb] transition-opacity duration-200 ${on ? "opacity-100" : "opacity-0"}`} />
            </button>
          );
        })}
      </div>

      {/* Grid — remounts per tab for a smooth fade/slide transition */}
      <div key={active} className="ovcat-grid grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
        {items.map((cat) => <CategoryTile key={cat.name} cat={cat} />)}
        <ViewAllTile />
      </div>

      <style>{`.ovcat-grid{animation:ovcatfade .25s ease}@keyframes ovcatfade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
