"use client";

import { useState } from "react";

export function NewsletterSection() {
  const [email, setEmail] = useState("");

  return (
    <div className="mt-6">
      {/* Newsletter */}
      <div className="bg-[linear-gradient(120deg,#1d4ed8,#2563eb)] rounded-[16px] py-7 px-6 sm:px-[30px] lg:px-[34px] text-white">
        <div className="text-[23px] font-extrabold tracking-[-.01em]">GET $10 OFF YOUR FIRST ORDER</div>
        <div className="text-[14px] text-white/85 mt-[9px] leading-[1.5]">
          Join our newsletter to be the first to know about exclusive deals, new arrivals &amp; more!
        </div>
        <div className="flex flex-wrap gap-[10px] mt-5 max-w-[460px]">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="flex-[1_1_180px] min-w-0 rounded-[10px] border-none py-[14px] px-4 text-[14px] text-[#16181d] bg-white outline-none"
          />
          <button className="flex-none bg-[#0a0b0d] text-white font-bold text-[14px] py-[14px] px-[26px] rounded-[10px] cursor-pointer hover:brightness-[1.06] active:scale-[.97] transition-[filter,transform] duration-150">
            SUBSCRIBE
          </button>
        </div>
      </div>
    </div>
  );
}
