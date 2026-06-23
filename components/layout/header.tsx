"use client";

import Link from "next/link";
import { Search, Heart, ShoppingCart, User, Menu } from "lucide-react";
import { Navbar } from "./navbar";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#eef0f3]">
      <div className="max-w-[1240px] mx-auto px-4 py-[14px] flex items-center gap-4 lg:gap-6">
        {/* Logo */}
        <Link href="/" className="shrink-0 leading-[.92] tracking-[-.02em]">
          <div className="text-[18px] font-extrabold text-[#0a0b0d]">ATLANTA</div>
          <div className="text-[18px] font-extrabold text-[#2563eb]">SNEAKERS</div>
        </Link>

        {/* Search — hidden on mobile */}
        <div className="hidden md:flex flex-1 max-w-[560px] items-center border-[1.5px] border-[#e4e7eb] rounded-[999px] pl-[18px] pr-[5px] py-[5px] bg-[#fbfbfc]">
          <input
            placeholder="Search for sneakers, clothes, tech, and more..."
            className="flex-1 min-w-0 border-none bg-transparent text-[14px] text-[#16181d] placeholder:text-[#9aa3ad] outline-none py-2"
          />
          <button className="w-[44px] h-[36px] shrink-0 rounded-[999px] bg-[#2563eb] text-white flex items-center justify-center hover:brightness-[1.06] transition-[filter] duration-150 cursor-pointer">
            <Search className="w-[19px] h-[19px]" />
          </button>
        </div>

        {/* Icons */}
        <div className="flex items-center gap-5 lg:gap-6 shrink-0 ml-auto">
          <Link href="/wishlist" className="hidden sm:flex flex-col items-center gap-[3px] text-[#16181d] hover:text-[#2563eb] transition-colors">
            <Heart className="w-[23px] h-[23px]" />
            <span className="text-[11px] font-semibold text-[#4b5563] hidden lg:block">Wishlist</span>
          </Link>

          <Link href="/cart" className="flex flex-col items-center gap-[3px] text-[#16181d] hover:text-[#2563eb] transition-colors">
            <span className="relative">
              <ShoppingCart className="w-[23px] h-[23px]" />
              <span className="absolute -top-[6px] -right-[9px] min-w-[17px] h-[17px] rounded-[999px] bg-[#2563eb] text-white text-[10px] font-bold flex items-center justify-center px-1 border-2 border-white">
                0
              </span>
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
        <div className="flex items-center border-[1.5px] border-[#e4e7eb] rounded-[999px] pl-[14px] pr-[5px] py-[4px] bg-[#fbfbfc]">
          <input
            placeholder="Search sneakers..."
            className="flex-1 min-w-0 border-none bg-transparent text-[14px] text-[#16181d] placeholder:text-[#9aa3ad] outline-none py-1.5"
          />
          <button className="w-[36px] h-[32px] shrink-0 rounded-[999px] bg-[#2563eb] text-white flex items-center justify-center cursor-pointer">
            <Search className="w-[17px] h-[17px]" />
          </button>
        </div>
      </div>

      <Navbar />
    </header>
  );
}
