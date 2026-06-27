"use client";

import { cn } from "@/lib/utils";
import { CreditCard, Mail, BarChart2, Globe, Music, Package, Truck, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Integration = {
  icon: LucideIcon;
  name: string;
  description: string;
  status: "connected" | "disconnected";
  color: string;
};

const INTEGRATIONS: Integration[] = [
  { icon: CreditCard, name: "Stripe", description: "Payment processing and billing", status: "connected", color: "#6366f1" },
  { icon: Mail, name: "Resend", description: "Transactional email delivery", status: "connected", color: "#16a34a" },
  { icon: BarChart2, name: "Google Analytics", description: "Website traffic and behavior analytics", status: "connected", color: "#ea7317" },
  { icon: Globe, name: "Meta Pixel", description: "Facebook & Instagram ad tracking", status: "disconnected", color: "#2563eb" },
  { icon: Music, name: "TikTok Pixel", description: "TikTok advertising attribution", status: "disconnected", color: "#16181d" },
  { icon: MessageSquare, name: "Mailchimp", description: "Email marketing campaigns", status: "disconnected", color: "#ea7317" },
  { icon: Truck, name: "ShipStation", description: "Shipping & fulfillment automation", status: "disconnected", color: "#16a34a" },
  { icon: Package, name: "Shippo", description: "Multi-carrier shipping labels", status: "disconnected", color: "#2563eb" },
];

type Props = { dark: boolean };

export function AdminIntegrations({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";

  return (
    <div className="space-y-4">
      <div>
        <h2 className={cn("text-lg font-extrabold", txt)}>Integrations</h2>
        <p className={cn("text-sm", sub)}>Connect third-party services to your store</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTEGRATIONS.map((intg) => {
          const Icon = intg.icon;
          return (
            <div key={intg.name} className={cn("rounded-[16px] border p-5 flex flex-col", p, brd)}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: `${intg.color}15` }}>
                  <Icon className="w-5 h-5" style={{ color: intg.color }} />
                </div>
                <div className="min-w-0">
                  <p className={cn("text-sm font-bold", txt)}>{intg.name}</p>
                  <p className={cn("text-xs mt-0.5 line-clamp-2", sub)}>{intg.description}</p>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between">
                <span className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold capitalize", intg.status === "connected" ? "bg-[#e8f7ee] text-[#16a34a]" : "bg-[#eef1f5] text-[#6b7280]")}>{intg.status}</span>
                <button className={cn("text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors", intg.status === "connected" ? "text-[#ef4444] hover:bg-[#ef4444]/10" : "text-[#2563eb] hover:bg-[#2563eb]/10")}>
                  {intg.status === "connected" ? "Disconnect" : "Connect"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
