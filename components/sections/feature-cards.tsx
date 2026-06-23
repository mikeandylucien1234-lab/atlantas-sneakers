import { Zap, Sparkles, Star, Gift } from "lucide-react";

const features = [
  { icon: Zap, color: "#f97316", title: "Flash Deals", desc: "Limited time offers. Don't miss out!" },
  { icon: Sparkles, color: "#2563eb", title: "New Arrivals", desc: "Check out the latest trends" },
  { icon: Star, color: "#7c3aed", title: "Best Sellers", desc: "Shop our most popular items" },
  { icon: Gift, color: "#16a34a", title: "Rewards", desc: "Earn points & get exclusive rewards" },
];

export function FeatureCards() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
      {features.map(({ icon: Icon, color, title, desc }) => (
        <div
          key={title}
          className="flex items-center gap-[13px] bg-white border border-[#eef0f3] rounded-[14px] py-[15px] px-4 cursor-pointer transition-[transform,box-shadow] duration-[180ms] ease-out hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(16,24,40,.12)]"
        >
          <div
            className="w-[44px] h-[44px] rounded-full flex items-center justify-center shrink-0 text-white shadow-[0_6px_14px_rgba(16,24,40,.14)]"
            style={{ background: color }}
          >
            <Icon className="w-[23px] h-[23px]" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-[#16181d]">{title}</div>
            <div className="text-[12px] text-[#6b7280] leading-[1.35]">{desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
