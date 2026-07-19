"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BarChart3,
  ShoppingCart,
  Package,
  Grid3x3,
  Award,
  Warehouse,
  Tag,
  Ruler,
  ShieldCheck,
  Boxes,
  Zap,
  Users,
  Star,
  MessageSquare,
  Gift,
  Ticket,
  Image as ImageIcon,
  Home,
  FileText,
  ImageIcon as MediaIcon,
  HelpCircle,
  Mail,
  Truck,
  RotateCcw,
  CreditCard,
  DollarSign,
  Receipt,
  Search,
  BarChart2,
  Globe,
  Music,
  Bell,
  Shield,
  UserCog,
  Lock,
  Clock,
  ClipboardList,
  Activity,
  Plug,
  Key,
  HardDrive,
  HeartPulse,
  Settings,
  ExternalLink,
  Menu,
  Layout,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Catalog",
    items: [
      { id: "orders", label: "Orders", icon: ShoppingCart },
      { id: "products", label: "Products", icon: Package },
      { id: "categories", label: "Categories", icon: Grid3x3 },
      { id: "brands", label: "Brands", icon: Award },
      { id: "inventory", label: "Inventory", icon: Warehouse },
      { id: "flashdeals", label: "Flash Deals", icon: Zap },
    ],
  },
  {
    label: "Customers",
    items: [
      { id: "customers", label: "Customers", icon: Users },
      { id: "reviews", label: "Reviews", icon: Star },
      { id: "tickets", label: "Tickets", icon: MessageSquare },
      { id: "rewards", label: "Rewards", icon: Gift },
      { id: "coupons", label: "Coupons", icon: Ticket },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "banners", label: "Banners", icon: ImageIcon },
      { id: "homepage", label: "Homepage", icon: Home },
      { id: "homepagecategories", label: "Shop by Category", icon: Grid3x3 },
      { id: "navtabs", label: "Category Tabs", icon: Menu },
      { id: "blog", label: "Blog", icon: FileText },
      { id: "media", label: "Media", icon: MediaIcon },
      { id: "faq", label: "FAQ", icon: HelpCircle },
      { id: "emails", label: "Emails", icon: Mail },
    ],
  },
  {
    label: "Landing Pages",
    items: [
      { id: "menlanding", label: "Men", icon: Layout },
      { id: "womenlanding", label: "Women", icon: Layout },
    ],
  },
  {
    label: "Commerce",
    items: [
      { id: "shipping", label: "Shipping", icon: Truck },
      { id: "returns", label: "Returns", icon: RotateCcw },
      { id: "payments", label: "Payment Settings", icon: CreditCard },
      { id: "paymentsmgmt", label: "Payments", icon: DollarSign },
      { id: "paymentlogs", label: "Payment Logs", icon: ClipboardList },
      { id: "tax", label: "Tax", icon: Receipt },
    ],
  },
  {
    label: "Sourcing",
    items: [
      { id: "suppliers", label: "Supplier Center", icon: Warehouse },
      { id: "cjdropshipping", label: "CJ Dropshipping", icon: Boxes },
      { id: "attributes", label: "Attributes", icon: Tag },
      { id: "sizes", label: "Size Management", icon: Ruler },
      { id: "warranties", label: "Warranty", icon: ShieldCheck },
    ],
  },
  {
    label: "Marketing",
    items: [
      { id: "seo", label: "SEO", icon: Search },
      { id: "ganalytics", label: "Google Analytics", icon: BarChart2 },
      { id: "metapixel", label: "Meta Pixel", icon: Globe },
      { id: "tiktok", label: "TikTok", icon: Music },
      { id: "gsc", label: "Search Console", icon: Globe },
    ],
  },
  {
    label: "System",
    items: [
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "roles", label: "Roles", icon: Shield },
      { id: "staff", label: "Staff", icon: UserCog },
      { id: "security", label: "Security", icon: Lock },
      { id: "loginhistory", label: "Login History", icon: Clock },
      { id: "audit", label: "Audit Log", icon: ClipboardList },
      { id: "activity", label: "Activity", icon: Activity },
      { id: "integrations", label: "Integrations", icon: Plug },
      { id: "apikeys", label: "API Keys", icon: Key },
      { id: "backup", label: "Backup", icon: HardDrive },
      { id: "health", label: "Health", icon: HeartPulse },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

type AdminSidebarProps = {
  dark: boolean;
  activeModule: string;
  onNavigate: (moduleId: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export function AdminSidebar({
  dark,
  activeModule,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}: AdminSidebarProps) {
  const sidebarContent = (
    <div
      className={cn(
        "flex flex-col h-full w-[264px]",
        dark ? "bg-[#131820] text-[#e7ebf0]" : "bg-white text-[#16181d]"
      )}
    >
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-0.5 text-xl font-extrabold tracking-tight">
          <span className={dark ? "text-white" : "text-[#16181d]"}>ATLANTA</span>
          <span className="text-[#2f6bff]">SNEAKERS</span>
        </div>
        <p className={cn("text-xs mt-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>
          Admin Console
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wider px-3 mb-1",
                dark ? "text-[#8b95a3]" : "text-[#8a929c]"
              )}
            >
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onCloseMobile();
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#2563eb]/10 text-[#2563eb]"
                      : dark
                        ? "text-[#e7ebf0] hover:bg-white/5"
                        : "text-[#16181d] hover:bg-black/5"
                  )}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge != null && (
                    <span className="bg-[#2563eb] text-white text-[11px] font-semibold rounded-full px-2 py-0.5 leading-none">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* View Storefront */}
      <div className={cn("px-3 pb-4 border-t", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-2 px-3 py-2.5 mt-3 rounded-[10px] text-sm font-medium transition-colors",
            dark ? "text-[#8b95a3] hover:bg-white/5" : "text-[#8a929c] hover:bg-black/5"
          )}
        >
          <ExternalLink className="w-[18px] h-[18px]" />
          View Storefront
        </a>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 z-40 w-[264px]">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onCloseMobile}
          />
          <div className="absolute left-0 top-0 bottom-0 animate-in slide-in-from-left duration-200">
            <button
              onClick={onCloseMobile}
              className="absolute top-3 right-3 z-10 p-1 rounded-md text-[#8a929c] hover:text-[#16181d]"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

export { navGroups };
