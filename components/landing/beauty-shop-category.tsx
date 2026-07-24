"use client";

import { useState } from "react";
import Link from "next/link";

/* Curated beauty image pool (Unsplash) — cycled so every tile has quality art. */
const IMG = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=200&h=200&q=70`;
const POOL = [
  "1522335789203-aabd1fc54bc9", "1596462502278-27bfdc403348", "1512496015851-a90fb38ba796",
  "1583001931096-959e9a1a6223", "1604654894610-df63bc536371", "1595475207225-428b62bda831",
  "1522338242992-e1a54906a8da", "1556228578-8c89e6adf883", "1570172619644-dfd03ed5d881",
  "1541643600914-78b084683601", "1596704017254-9b121068fb31", "1584308666744-24d5c474f2ae",
  "1512207736890-6ffed8a84e8d", "1608248543803-ba4f8c70ae0b", "1487412947147-5cebf100ffc2",
];
const pic = (i: number) => IMG(POOL[i % POOL.length]);

type Cat = { name: string; img: string; href: string };
const make = (names: string[]): Cat[] =>
  names.map((name, i) => ({ name, img: pic(i), href: "/category/beauty" }));

// One reusable data structure — add/adjust categories here, the UI adapts.
const beautyCategories: Record<string, { label: string; items: Cat[] }> = {
  category: {
    label: "Category",
    items: make([
      "Makeup", "Beauty Tools", "Nail, Hand & Foot Care", "Eyelashes", "Press on Nails",
      "Wigs & Accessories", "Personal Care", "Fragrances & Aromatherapy",
      "Personal Care Appliance", "Health Care", "Dietary Supplements",
    ]),
  },
  makeup: {
    label: "Makeup",
    items: make([
      "Face Make Up", "Eye Make Up", "Lips", "Eyelashes", "Blush & Contour", "Eyebrows",
      "Body Make Up", "Makeup Brushes", "Makeup Puffs & Sponges", "Makeup Bag & Storage", "Makeup Remover",
    ]),
  },
  tools: {
    label: "Tools",
    items: make([
      "Makeup Tools", "Nail Art Tools", "Hair Tools", "Skin Care Tools", "Eye Tools",
      "Body Care Tools", "Oral & Nose Tools", "Eyelashes Tools", "Tattoos & Body Art",
      "Refillable Containers", "Mirrors",
    ]),
  },
  nails: {
    label: "Nails",
    items: make([
      "Press on Nails", "Gel Nail Polish", "Nail Art Accessories", "Rhinestones & Decorations",
      "Nail Art Equipments", "Nail Art Salon Sets", "Nail Art Stickers & Decals",
      "Hand, Foot & Nail Tools", "Nail Glue & Adhesive", "Nail Powder & Liquids", "Nail Polish Removers",
    ]),
  },
  hair: {
    label: "Hair",
    items: make([
      "Synthetic Hair Wigs", "Human Hair Wigs", "Wig Caps & Tools", "Hair Care & Styling",
      "Hair Styling Care Appliances", "Combs", "Styling Tools", "Hair Tools",
      "Hair Treatment", "Hair Removal Tools", "Hair Cap",
    ]),
  },
  personalCare: {
    label: "Personal Care",
    items: make([
      "Skin Care", "Body Care", "Lip Care", "Personal Care Appliance", "Oral & Nose Care",
      "Massage & Relaxation", "Health Care", "Facial Masks", "Bath & Shower",
      "Men Grooming", "Shaving & Hair Removal",
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
