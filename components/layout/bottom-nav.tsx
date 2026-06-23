"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { icon: Home, label: "Home", href: "/" },
  { icon: LayoutGrid, label: "Categories", href: "/categories" },
  { icon: Heart, label: "Wishlist", href: "/wishlist", badge: 0 },
  { icon: User, label: "Account", href: "/account" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#eef0f3] shadow-[0_-4px_20px_rgba(16,24,40,.08)] md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4 max-w-[480px] mx-auto px-2 py-2">
        {items.map(({ icon: Icon, label, href, badge }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center gap-1 py-[5px] transition-colors",
                isActive ? "text-[#2563eb]" : "text-[#9aa3ad]"
              )}
            >
              <span className="relative">
                <Icon
                  className="w-6 h-6"
                  fill={isActive ? "currentColor" : "none"}
                />
                {badge !== undefined && badge > 0 && (
                  <span className="absolute -top-[6px] -right-[10px] min-w-[16px] h-[16px] rounded-[999px] bg-[#2563eb] text-white text-[9px] font-bold flex items-center justify-center px-[3px] border-2 border-white">
                    {badge}
                  </span>
                )}
              </span>
              <span className={cn("text-[11px]", isActive ? "font-bold" : "font-semibold")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
