"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getNavTabs } from "@/lib/supabase/queries";
import { useQuery } from "@/lib/hooks/use-query";
import {
  LayoutGrid, User, Baby, Sparkles, Star, Tag, Flame, ShoppingBag, Heart,
  Zap, Gift, Percent, Shirt, Watch, Headphones, Package, type LucideIcon,
} from "lucide-react";

// Icon name → component. Extend freely; unknown names simply render no icon.
const ICONS: Record<string, LucideIcon> = {
  LayoutGrid, User, Baby, Sparkles, Star, Tag, Flame, ShoppingBag, Heart,
  Zap, Gift, Percent, Shirt, Watch, Headphones, Package,
};

// Used only when the CMS table is empty / unreachable.
const fallback = [
  { id: "all", label: "All", href: "/shop", icon: "", newTab: false },
  { id: "men", label: "Men", href: "/category/men", icon: "", newTab: false },
  { id: "women", label: "Women", href: "/category/women", icon: "", newTab: false },
  { id: "kids", label: "Kids", href: "/category/kids", icon: "", newTab: false },
  { id: "new", label: "New Arrivals", href: "/new-arrivals", icon: "", newTab: false },
  { id: "best", label: "Best Sellers", href: "/best-sellers", icon: "", newTab: false },
  { id: "deals", label: "Deals", href: "/deals", icon: "", newTab: false },
];

export function Navbar() {
  const pathname = usePathname();
  const { data } = useQuery(() => getNavTabs(), []);

  const links = (data && data.length)
    ? data.map((t: any) => ({
        id: t.id,
        label: t.label,
        href: t.category?.slug ? `/category/${t.category.slug}` : (t.href || "/shop"),
        icon: t.icon || "",
        newTab: !!t.open_new_tab,
      }))
    : fallback;

  if (!links.length) return null;

  return (
    <div className="max-w-[1240px] mx-auto px-4">
      <nav className="flex items-center gap-[26px] pb-[13px] overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map(({ id, label, href, icon, newTab }) => {
          const isActive = pathname === href || (href !== "/shop" && pathname.startsWith(href));
          const Icon = icon ? ICONS[icon] : undefined;
          return (
            <Link
              key={id}
              href={href}
              target={newTab ? "_blank" : undefined}
              rel={newTab ? "noopener noreferrer" : undefined}
              className={cn(
                "shrink-0 flex items-center gap-1.5 text-[14px] font-semibold transition-colors hover:text-[#2563eb]",
                isActive
                  ? "text-[#2563eb] relative pb-[11px] -mb-[15px] border-b-2 border-[#2563eb]"
                  : "text-[#4b5563]"
              )}
            >
              {Icon && <Icon className="w-[15px] h-[15px]" />}
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
