"use client";

import { useState } from "react";

export function NewsletterSection() {
  const [email, setEmail] = useState("");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 mt-6">
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

      {/* Download App */}
      <div className="bg-[#eaf1fb] border border-[#dbe6f7] rounded-[16px] py-7 px-6 sm:px-[30px] lg:px-[34px] relative overflow-hidden">
        <div className="max-w-[300px] relative z-[2]">
          <div className="text-[21px] font-extrabold text-[#16181d] tracking-[-.01em]">DOWNLOAD THE APP</div>
          <div className="text-[14px] text-[#5b6472] mt-[9px] leading-[1.5]">Shop on the go &amp; get exclusive app-only deals!</div>
          <div className="flex flex-wrap gap-[11px] mt-5">
            <button className="flex items-center gap-[9px] bg-[#0a0b0d] text-white py-[9px] px-4 rounded-[10px] text-left cursor-pointer hover:brightness-[1.06] transition-[filter] duration-150">
              <span className="text-[24px]">📱</span>
              <span className="leading-[1.1]">
                <span className="text-[9px] block text-[#c7ccd4]">Download on the</span>
                <span className="text-[14px] font-bold">App Store</span>
              </span>
            </button>
            <button className="flex items-center gap-[9px] bg-[#0a0b0d] text-white py-[9px] px-4 rounded-[10px] text-left cursor-pointer hover:brightness-[1.06] transition-[filter] duration-150">
              <span className="text-[24px]">🤖</span>
              <span className="leading-[1.1]">
                <span className="text-[9px] block text-[#c7ccd4]">GET IT ON</span>
                <span className="text-[14px] font-bold">Google Play</span>
              </span>
            </button>
          </div>
        </div>
        {/* Phone mockup */}
        <div className="hidden md:flex absolute right-[26px] -bottom-[30px] w-[120px] h-[200px] rounded-[22px] border-[6px] border-[#0a0b0d] items-start justify-center pt-[14px] shadow-[0_14px_30px_rgba(16,24,40,.2)] bg-[repeating-linear-gradient(135deg,#eef0f3_0,#eef0f3_9px,#e4e7eb_9px,#e4e7eb_18px)]">
          <span className="font-mono text-[8px] text-[#9aa3ad]">APP UI</span>
        </div>
      </div>
    </div>
  );
}
