"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Heart, ShoppingCart, User, Menu } from "lucide-react";
import { Navbar } from "./navbar";
import { useCartStore } from "@/lib/store/cart-store";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import { searchProducts } from "@/lib/supabase/queries";
import type { Product } from "@/types";

function SearchBar({ className, inputClassName }: { className?: string; inputClassName?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); setOpen(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchProducts(query);
        setSuggestions(results.slice(0, 5));
        setOpen(results.length > 0);
      } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) { router.push(`/shop?q=${encodeURIComponent(query.trim())}`); setOpen(false); }
  };

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <form onSubmit={handleSubmit} className={`flex items-center border-[1.5px] border-[#e4e7eb] rounded-[999px] bg-[#fbfbfc] ${inputClassName ?? "pl-[18px] pr-[5px] py-[5px]"}`}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search for sneakers, clothes, tech, and more..."
          className="flex-1 min-w-0 border-none bg-transparent text-[14px] text-[#16181d] placeholder:text-[#9aa3ad] outline-none py-2"
        />
        <button type="submit" className="w-[44px] h-[36px] shrink-0 rounded-[999px] bg-[#2563eb] text-white flex items-center justify-center hover:brightness-[1.06] transition-[filter] duration-150 cursor-pointer">
          <Search className="w-[19px] h-[19px]" />
        </button>
      </form>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#eef0f3] rounded-[14px] shadow-[0_12px_26px_rgba(16,24,40,.12)] z-50 overflow-hidden">
          {suggestions.map((p) => (
            <Link
              key={p.id}
              href={`/product/${p.slug}`}
              onClick={() => { setOpen(false); setQuery(""); }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#f7f8fa] transition-colors"
            >
              <div className="w-[40px] h-[40px] rounded-[8px] bg-[#f4f5f7] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#16181d] truncate">{p.name}</p>
                <p className="text-[12px] text-[#9aa3ad]">{p.brand?.name} · ${Number(p.price).toFixed(2)}</p>
              </div>
            </Link>
          ))}
          <Link
            href={`/shop?q=${encodeURIComponent(query)}`}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-[13px] font-bold text-[#2563eb] text-center border-t border-[#eef0f3] hover:bg-[#f7f8fa]"
          >
            View all results for &quot;{query}&quot;
          </Link>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const cartCount = useCartStore((s) => s.count);
  const wishlistCount = useWishlistStore((s) => s.count);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#eef0f3]">
      <div className="max-w-[1240px] mx-auto px-4 py-[14px] flex items-center gap-4 lg:gap-6">
        {/* Logo */}
        <Link href="/" className="shrink-0 leading-[.92] tracking-[-.02em]">
          <div className="text-[18px] font-extrabold text-[#0a0b0d]">ATLANTA</div>
          <div className="text-[18px] font-extrabold text-[#2563eb]">SNEAKERS</div>
        </Link>

        {/* Search — hidden on mobile */}
        <SearchBar className="hidden md:block flex-1 max-w-[560px]" />

        {/* Icons */}
        <div className="flex items-center gap-5 lg:gap-6 shrink-0 ml-auto">
          <Link href="/wishlist" className="hidden sm:flex flex-col items-center gap-[3px] text-[#16181d] hover:text-[#2563eb] transition-colors">
            <span className="relative">
              <Heart className="w-[23px] h-[23px]" />
              {wishlistCount > 0 && (
                <span className="absolute -top-[6px] -right-[9px] min-w-[17px] h-[17px] rounded-[999px] bg-[#ef4444] text-white text-[10px] font-bold flex items-center justify-center px-1 border-2 border-white">
                  {wishlistCount}
                </span>
              )}
            </span>
            <span className="text-[11px] font-semibold text-[#4b5563] hidden lg:block">Wishlist</span>
          </Link>

          <Link href="/cart" className="flex flex-col items-center gap-[3px] text-[#16181d] hover:text-[#2563eb] transition-colors">
            <span className="relative">
              <ShoppingCart className="w-[23px] h-[23px]" />
              {cartCount > 0 && (
                <span className="absolute -top-[6px] -right-[9px] min-w-[17px] h-[17px] rounded-[999px] bg-[#2563eb] text-white text-[10px] font-bold flex items-center justify-center px-1 border-2 border-white">
                  {cartCount}
                </span>
              )}
            </span>
            <span className="text-[11px] font-semibold text-[#4b5563] hidden lg:block">Cart</span>
          </Link>

          <Link href="/account" className="hidden sm:flex flex-col items-center gap-[3px] text-[#16181d] hover:text-[#2563eb] transition-colors">
            <User className="w-[23px] h-[23px]" />
            <span className="text-[11px] font-semibold text-[#4b5563] hidden lg:block">Account</span>
          </Link>

          <button className="flex md:hidden flex-col items-center gap-[3px] text-[#16181d] cursor-pointer">
            <Menu className="w-[23px] h-[23px]" />
          </button>
        </div>
      </div>

      {/* Search mobile */}
      <div className="md:hidden px-4 pb-3">
        <SearchBar inputClassName="pl-[14px] pr-[5px] py-[4px]" />
      </div>

      <Navbar />
    </header>
  );
}
