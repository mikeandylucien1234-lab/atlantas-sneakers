import { Shield, Truck, RefreshCw, Lock } from "lucide-react";

const badges = [
  { icon: Shield, title: "100% Authentic", sub: "Guaranteed original products" },
  { icon: Truck, title: "Fast Shipping", sub: "Worldwide delivery" },
  { icon: RefreshCw, title: "Easy Returns", sub: "30-day return policy" },
  { icon: Lock, title: "Secure Payments", sub: "Safe & encrypted" },
];

export function TrustBadges() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 mt-8 bg-[#f7f8fa] border border-[#eef0f3] rounded-[14px] overflow-hidden">
      {badges.map(({ icon: Icon, title, sub }) => (
        <div key={title} className="flex items-center gap-[13px] py-[18px] px-5 border-b border-r border-[#eef0f3]">
          <Icon className="w-[26px] h-[26px] text-[#2563eb] shrink-0" />
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-[#16181d]">{title}</div>
            <div className="text-[12px] text-[#6b7280]">{sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
