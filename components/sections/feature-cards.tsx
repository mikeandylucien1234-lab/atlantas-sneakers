import Link from "next/link";
import { Zap, Sparkles, Star, Gift } from "lucide-react";

const features = [
  { icon: Zap, color: "#f97316", title: "Flash Deals", href: "/deals" },
  { icon: Sparkles, color: "#2563eb", title: "New Arrivals", href: "/new-arrivals" },
  { icon: Star, color: "#7c3aed", title: "Best Sellers", href: "/best-sellers" },
  { icon: Gift, color: "#16a34a", title: "Rewards", href: "/account#rewards" },
];

export function FeatureCards() {
  return (
    // 4 items on a single horizontal row on every screen — icon above title,
    // centered, no cards/backgrounds/borders/descriptions.
    <div className="grid grid-cols-4 gap-2 mt-4">
      {features.map(({ icon: Icon, color, title, href }) => (
        <Link
          key={title}
          href={href}
          className="flex flex-col items-center text-center gap-2 py-2 cursor-pointer group"
        >
          <div
            className="w-[46px] h-[46px] rounded-full flex items-center justify-center shrink-0 text-white shadow-[0_6px_14px_rgba(16,24,40,.14)] transition-transform duration-150 group-hover:-translate-y-0.5"
            style={{ background: color }}
          >
            <Icon className="w-[23px] h-[23px]" />
          </div>
          <span className="text-[12px] sm:text-[13px] font-bold text-[#16181d] leading-tight">{title}</span>
        </Link>
      ))}
    </div>
  );
}
