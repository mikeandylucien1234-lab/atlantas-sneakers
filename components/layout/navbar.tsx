"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { label: "All", href: "/shop" },
  { label: "Men", href: "/category/men" },
  { label: "Women", href: "/category/women" },
  { label: "Kids", href: "/category/kids" },
  { label: "New Arrivals", href: "/new-arrivals" },
  { label: "Best Sellers", href: "/best-sellers" },
  { label: "Deals", href: "/deals" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <div className="max-w-[1240px] mx-auto px-4">
      <nav className="flex items-center gap-[26px] pb-[13px] overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map(({ label, href }) => {
          const isActive = pathname === href || (href !== "/shop" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "shrink-0 text-[14px] font-semibold transition-colors hover:text-[#2563eb]",
                isActive
                  ? "text-[#2563eb] relative pb-[11px] -mb-[15px] border-b-2 border-[#2563eb]"
                  : "text-[#4b5563]"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
