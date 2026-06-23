import Link from "next/link";
import { Lock } from "lucide-react";

const shopLinks = [
  { label: "New Arrivals", href: "/new-arrivals" },
  { label: "Best Sellers", href: "/best-sellers" },
  { label: "Featured Collections", href: "/collections" },
  { label: "Shop All", href: "/shop" },
  { label: "Deals", href: "/deals" },
];

const helpLinks = [
  { label: "Help Center", href: "/help" },
  { label: "Track Order", href: "/order-tracking" },
  { label: "Shipping Policy", href: "/shipping" },
  { label: "Returns & Refunds", href: "/returns" },
  { label: "Contact Us", href: "/contact" },
  { label: "FAQ", href: "/faq" },
];

const companyLinks = [
  { label: "About Atlanta Sneakers", href: "/about" },
  { label: "Referral Program", href: "/referral" },
  { label: "Blog", href: "/blog" },
  { label: "Careers", href: "/careers" },
  { label: "Press", href: "/press" },
];

const socials = ["IG", "TT", "YT", "FB", "X"];
const payments = ["VISA", "MC", "AMEX", "PayPal", "Pay", "GPay"];

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="text-[13px] font-extrabold tracking-[.04em] text-[#16181d] mb-[15px]">{title}</div>
      <div className="flex flex-col gap-[10px]">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-[13px] text-[#6b7280] hover:text-[#2563eb] transition-colors">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-12 border-t border-[#eef0f3] bg-white">
      <div className="max-w-[1240px] mx-auto px-4 pt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1.2fr_1.1fr_1.25fr] gap-[30px]">
        {/* Brand */}
        <div>
          <div className="font-extrabold text-[18px] tracking-[-.01em] mb-[14px]">
            <span className="text-[#0a0b0d]">ATLANTA</span>
            <span className="text-[#2563eb]">SNEAKERS</span>
          </div>
          <p className="text-[13px] text-[#6b7280] leading-[1.6] max-w-[280px]">
            Your #1 destination for sneakers, clothing, electronics, and more. 100% authentic, premium quality, fast worldwide shipping.
          </p>
          <div className="flex gap-[10px] mt-[18px]">
            {socials.map((s) => (
              <a
                key={s}
                href="#"
                className="w-[34px] h-[34px] rounded-full bg-[#f3f4f6] flex items-center justify-center text-[11px] font-extrabold text-[#4b5563] hover:bg-[#2563eb] hover:text-white transition-colors"
              >
                {s}
              </a>
            ))}
          </div>
        </div>

        <FooterColumn title="SHOP" links={shopLinks} />
        <FooterColumn title="HELP" links={helpLinks} />
        <FooterColumn title="ABOUT US" links={companyLinks} />

        {/* Payment */}
        <div>
          <div className="text-[13px] font-extrabold tracking-[.04em] text-[#16181d] mb-[15px]">PAYMENT METHODS</div>
          <div className="grid grid-cols-4 gap-[7px] max-w-[200px]">
            {payments.map((p) => (
              <div
                key={p}
                className="h-[30px] bg-white border border-[#e4e7eb] rounded-[6px] flex items-center justify-center text-[9px] font-extrabold text-[#374151] tracking-[.02em] shadow-[0_1px_2px_rgba(16,24,40,.05)]"
              >
                {p}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-[9px] mt-[18px]">
            <div className="w-[38px] h-[38px] rounded-full border-[1.5px] border-[#d1d5db] flex items-center justify-center shrink-0">
              <Lock className="w-[18px] h-[18px] text-[#16a34a]" />
            </div>
            <div className="text-[10px] font-bold text-[#4b5563] leading-[1.3]">
              SSL SECURE<br />
              <span className="text-[#9aa3ad]">256-BIT ENCRYPTION</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-[1240px] mx-auto mt-[30px] px-4 py-[22px] pb-[30px] border-t border-[#eef0f3] flex items-center justify-between gap-4 flex-wrap">
        <div className="text-[12px] text-[#9aa3ad]">© 2026 Atlanta Sneakers. All rights reserved.</div>
        <div className="flex items-center gap-[6px] text-[12px] text-[#6b7280] font-semibold">
          🌐 English
        </div>
      </div>
    </footer>
  );
}
