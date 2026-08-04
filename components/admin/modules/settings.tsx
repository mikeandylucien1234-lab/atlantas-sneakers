"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Store, Mail, DollarSign, Globe, Clock, Bell, Shield, ChevronRight, Moon, Sun, Truck, RotateCcw, CreditCard, Receipt, Search, BarChart2, Music, HelpCircle, Home, FileText, Image as ImageIcon, HeartPulse } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type SettingItem = {
  icon: LucideIcon;
  label: string;
  value: string;
  type: "text" | "toggle" | "link";
};

const MODULES: Record<string, { title: string; description: string; items: SettingItem[] }> = {
  settings: {
    title: "Settings",
    description: "General store configuration",
    items: [
      { icon: Store, label: "Store Name", value: "Atlanta Sneakers", type: "text" },
      { icon: Mail, label: "Contact Email", value: "contact@atlantasneaker.com", type: "text" },
      { icon: DollarSign, label: "Currency", value: "USD ($)", type: "text" },
      { icon: Globe, label: "Language", value: "English", type: "text" },
      { icon: Clock, label: "Timezone", value: "America/New_York", type: "text" },
      { icon: Moon, label: "Dark Mode", value: "", type: "toggle" },
    ],
  },
  shipping: {
    title: "Shipping",
    description: "Shipping methods and rates",
    items: [
      { icon: Truck, label: "Free Shipping Threshold", value: "$75.00", type: "text" },
      { icon: Truck, label: "Standard Shipping Rate", value: "$9.99", type: "text" },
      { icon: Truck, label: "Express Shipping Rate", value: "$19.99", type: "text" },
      { icon: Globe, label: "International Shipping", value: "", type: "toggle" },
      { icon: Clock, label: "Processing Time", value: "1-2 business days", type: "text" },
    ],
  },
  returns: {
    title: "Returns & Refunds",
    description: "Return policy configuration",
    items: [
      { icon: RotateCcw, label: "Return Window", value: "30 days", type: "text" },
      { icon: RotateCcw, label: "Free Returns", value: "", type: "toggle" },
      { icon: DollarSign, label: "Restocking Fee", value: "0%", type: "text" },
      { icon: RotateCcw, label: "Auto-approve Returns", value: "", type: "toggle" },
    ],
  },
  payments: {
    title: "Payment Methods",
    description: "Payment gateway configuration",
    items: [
      { icon: CreditCard, label: "Stripe", value: "Connected", type: "link" },
      { icon: CreditCard, label: "Apple Pay", value: "", type: "toggle" },
      { icon: CreditCard, label: "Google Pay", value: "", type: "toggle" },
      { icon: CreditCard, label: "Cash on Delivery", value: "", type: "toggle" },
    ],
  },
  tax: {
    title: "Tax Settings",
    description: "Tax rates and rules",
    items: [
      { icon: Receipt, label: "Auto-calculate Tax", value: "", type: "toggle" },
      { icon: Receipt, label: "Default Tax Rate", value: "8.5%", type: "text" },
      { icon: Receipt, label: "Tax-inclusive Pricing", value: "", type: "toggle" },
      { icon: Globe, label: "Tax Region", value: "United States", type: "text" },
    ],
  },
  seo: {
    title: "SEO",
    description: "Search engine optimization settings",
    items: [
      { icon: Search, label: "Meta Title", value: "Atlanta Sneakers | Premium Sneakers", type: "text" },
      { icon: Search, label: "Meta Description", value: "Shop the latest sneakers...", type: "text" },
      { icon: Search, label: "Auto-generate Sitemap", value: "", type: "toggle" },
      { icon: Search, label: "Canonical URLs", value: "", type: "toggle" },
    ],
  },
  ganalytics: {
    title: "Google Analytics",
    description: "Track website analytics",
    items: [
      { icon: BarChart2, label: "Tracking ID", value: "G-XXXXXXXXXX", type: "text" },
      { icon: BarChart2, label: "Enhanced E-commerce", value: "", type: "toggle" },
      { icon: BarChart2, label: "Event Tracking", value: "", type: "toggle" },
    ],
  },
  metapixel: {
    title: "Meta Pixel",
    description: "Facebook/Instagram tracking",
    items: [
      { icon: Globe, label: "Pixel ID", value: "XXXXXXXXXXXXXXX", type: "text" },
      { icon: Globe, label: "Conversions API", value: "", type: "toggle" },
      { icon: Globe, label: "Advanced Matching", value: "", type: "toggle" },
    ],
  },
  tiktok: {
    title: "TikTok Pixel",
    description: "TikTok advertising tracking",
    items: [
      { icon: Music, label: "Pixel ID", value: "XXXXXXXXXXXXXXX", type: "text" },
      { icon: Music, label: "Auto Event Tracking", value: "", type: "toggle" },
    ],
  },
  gsc: {
    title: "Search Console",
    description: "Google Search Console integration",
    items: [
      { icon: Search, label: "Verification Code", value: "google-site-verification=...", type: "text" },
      { icon: Search, label: "Auto Submit Sitemap", value: "", type: "toggle" },
    ],
  },
  notifications: {
    title: "Notifications",
    description: "Notification preferences",
    items: [
      { icon: Bell, label: "Email on New Order", value: "", type: "toggle" },
      { icon: Bell, label: "Email on Low Stock", value: "", type: "toggle" },
      { icon: Bell, label: "Email on New Review", value: "", type: "toggle" },
      { icon: Bell, label: "Push Notifications", value: "", type: "toggle" },
      { icon: Mail, label: "Notification Email", value: "admin@atlantasneaker.com", type: "text" },
    ],
  },
  security: {
    title: "Security",
    description: "Security and access settings",
    items: [
      { icon: Shield, label: "Two-Factor Auth", value: "", type: "toggle" },
      { icon: Shield, label: "Login Alerts", value: "", type: "toggle" },
      { icon: Shield, label: "Session Timeout", value: "30 minutes", type: "text" },
      { icon: Shield, label: "Password Expiry", value: "90 days", type: "text" },
    ],
  },
  health: {
    title: "System Health",
    description: "Monitor system performance",
    items: [
      { icon: HeartPulse, label: "API Status", value: "Operational", type: "link" },
      { icon: HeartPulse, label: "Database", value: "Healthy", type: "link" },
      { icon: HeartPulse, label: "Storage Usage", value: "148 MB / 500 MB", type: "link" },
      { icon: HeartPulse, label: "Uptime", value: "99.97%", type: "link" },
    ],
  },
  emails: {
    title: "Email Templates",
    description: "Customize transactional emails",
    items: [
      { icon: Mail, label: "Order Confirmation", value: "Active", type: "link" },
      { icon: Mail, label: "Shipping Notification", value: "Active", type: "link" },
      { icon: Mail, label: "Welcome Email", value: "Active", type: "link" },
      { icon: Mail, label: "Password Reset", value: "Active", type: "link" },
    ],
  },
  faq: {
    title: "FAQ",
    description: "Manage frequently asked questions",
    items: [
      { icon: HelpCircle, label: "Total FAQs", value: "24", type: "link" },
      { icon: HelpCircle, label: "Categories", value: "6", type: "link" },
      { icon: HelpCircle, label: "Show on Homepage", value: "", type: "toggle" },
    ],
  },
  homepage: {
    title: "Homepage Sections",
    description: "Configure homepage layout",
    items: [
      { icon: Home, label: "Hero Banner", value: "", type: "toggle" },
      { icon: Home, label: "Flash Sales", value: "", type: "toggle" },
      { icon: Home, label: "Trending Now", value: "", type: "toggle" },
      { icon: Home, label: "Best Sellers", value: "", type: "toggle" },
      { icon: Home, label: "New Arrivals", value: "", type: "toggle" },
      { icon: Home, label: "Newsletter", value: "", type: "toggle" },
    ],
  },
  blog: {
    title: "Blog & Content",
    description: "Manage blog posts and content",
    items: [
      { icon: FileText, label: "Published Posts", value: "12", type: "link" },
      { icon: FileText, label: "Draft Posts", value: "3", type: "link" },
      { icon: FileText, label: "Comments", value: "", type: "toggle" },
      { icon: FileText, label: "RSS Feed", value: "", type: "toggle" },
    ],
  },
  media: {
    title: "Media Library",
    description: "Manage uploaded files and images",
    items: [
      { icon: ImageIcon, label: "Total Files", value: "847", type: "link" },
      { icon: ImageIcon, label: "Storage Used", value: "2.4 GB", type: "link" },
      { icon: ImageIcon, label: "Auto-optimize Images", value: "", type: "toggle" },
      { icon: ImageIcon, label: "Max Upload Size", value: "10 MB", type: "text" },
    ],
  },
};

type Props = { dark: boolean; moduleId?: string };

export function AdminSettings({ dark, moduleId = "settings" }: Props) {
  const config = MODULES[moduleId] ?? MODULES.settings;
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    config.items.forEach((item, i) => {
      if (item.type === "toggle") init[`${i}`] = i < 3;
    });
    return init;
  });
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    config.items.forEach((item, i) => { if (item.type === "text") init[`${i}`] = item.value; });
    return init;
  });
  const [editing, setEditing] = useState<string | null>(null);

  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";

  return (
    <div className="space-y-4">
      <div>
        <h2 className={cn("text-lg font-extrabold", txt)}>{config.title}</h2>
        <p className={cn("text-sm", sub)}>{config.description}</p>
      </div>

      <div className={cn("rounded-[16px] border divide-y", p, brd, dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
        {config.items.map((item, i) => {
          const Icon = item.icon;
          const key = `${i}`;
          return (
            <div key={key} className="flex items-center gap-4 px-5 py-4">
              <div className={cn("w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                <Icon className={cn("w-5 h-5", sub)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-semibold", txt)}>{item.label}</p>
              </div>
              {item.type === "toggle" && (
                <button onClick={() => setToggles({ ...toggles, [key]: !toggles[key] })} className={cn("w-10 h-6 rounded-full transition-colors relative shrink-0", toggles[key] ? "bg-[#2563eb]" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}>
                  <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-transform", toggles[key] ? "left-5" : "left-1")} />
                </button>
              )}
              {item.type === "text" && (
                editing === key ? (
                  <input
                    value={values[key] ?? item.value}
                    onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                    onBlur={() => setEditing(null)}
                    onKeyDown={(e) => e.key === "Enter" && setEditing(null)}
                    autoFocus
                    className={cn("h-8 rounded-lg border px-2 text-sm w-40", dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]")}
                  />
                ) : (
                  <button onClick={() => setEditing(key)} className={cn("text-sm font-medium", sub, "hover:text-[#2563eb]")}>{values[key] ?? item.value}</button>
                )
              )}
              {item.type === "link" && (
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-medium", item.value === "Connected" || item.value === "Operational" || item.value === "Healthy" || item.value === "Active" ? "text-[#16a34a]" : sub)}>{item.value}</span>
                  <ChevronRight className={cn("w-4 h-4", sub)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="h-[46px] px-6 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors">
        Save Changes
      </button>
    </div>
  );
}
