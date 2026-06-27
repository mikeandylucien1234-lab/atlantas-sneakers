"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { useAuthStore } from "@/lib/store/auth-store";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopbar } from "@/components/admin/topbar";
import AdminDashboard from "@/components/admin/modules/dashboard";
import { AdminOrders } from "@/components/admin/modules/orders";
import { AdminProducts } from "@/components/admin/modules/products";
import { AdminGenericTable } from "@/components/admin/modules/generic-table";
import { AdminBanners } from "@/components/admin/modules/banners";
import { AdminBackup } from "@/components/admin/modules/backup";
import { AdminSettings } from "@/components/admin/modules/settings";
import { AdminIntegrations } from "@/components/admin/modules/integrations";
import { Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups } from "@/components/admin/sidebar";

type Toast = { message: string; type: "success" | "info" | "warn" } | null;

type AdminCtx = {
  dark: boolean;
  toggleDark: () => void;
  activeModule: string;
  setActiveModule: (m: string) => void;
  showToast: (message: string, type?: "success" | "info" | "warn") => void;
};

export const AdminContext = createContext<AdminCtx>({
  dark: false,
  toggleDark: () => {},
  activeModule: "dashboard",
  setActiveModule: () => {},
  showToast: () => {},
});

export const useAdmin = () => useContext(AdminContext);

const moduleLabel = (id: string) => {
  for (const g of navGroups) {
    const item = g.items.find((i) => i.id === id);
    if (item) return item.label;
  }
  return id;
};

const settingsModules = new Set([
  "shipping", "returns", "payments", "tax", "seo", "ganalytics",
  "metapixel", "tiktok", "gsc", "notifications", "security",
  "health", "emails", "faq", "homepage", "blog", "media",
]);

const tableModules: Record<string, { table: string; columns: string[] }> = {
  categories: { table: "categories", columns: ["name", "slug", "is_active"] },
  brands: { table: "brands", columns: ["name", "slug", "is_active"] },
  customers: { table: "profiles", columns: ["full_name", "email", "role"] },
  reviews: { table: "reviews", columns: ["rating", "comment", "created_at"] },
  tickets: { table: "tickets", columns: ["subject", "status", "created_at"] },
  rewards: { table: "profiles", columns: ["full_name", "points", "role"] },
  coupons: { table: "coupons", columns: ["code", "type", "value", "is_active"] },
  inventory: { table: "product_variants", columns: ["sku", "size", "stock"] },
  flashdeals: { table: "flash_deals", columns: ["deal_price", "is_active", "ends_at"] },
  staff: { table: "profiles", columns: ["full_name", "email", "role"] },
  roles: { table: "profiles", columns: ["role"] },
  loginhistory: { table: "profiles", columns: ["email", "created_at"] },
  audit: { table: "profiles", columns: ["email", "created_at"] },
  activity: { table: "profiles", columns: ["email", "created_at"] },
  apikeys: { table: "profiles", columns: ["email", "created_at"] },
};

export default function AdminPage() {
  const { profile, isLoading } = useAuthStore();
  const [dark, setDark] = useState(false);
  const [activeModule, setActiveModule] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    const saved = localStorage.getItem("admin-dark");
    if (saved === "true") setDark(true);
  }, []);

  const toggleDark = useCallback(() => {
    setDark((d) => {
      localStorage.setItem("admin-dark", String(!d));
      return !d;
    });
  }, []);

  const showToast = useCallback((message: string, type: "success" | "info" | "warn" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6f9]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2563eb]" />
      </div>
    );
  }

  if (profile?.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f6f9] gap-4">
        <ShieldAlert className="w-16 h-16 text-[#ef4444]" />
        <h1 className="text-2xl font-extrabold text-[#16181d]">Access Denied</h1>
        <p className="text-[#8a929c]">You need admin privileges to access this page.</p>
        <a href="/" className="text-[#2563eb] font-semibold hover:underline">Return to Store</a>
      </div>
    );
  }

  const renderModule = () => {
    switch (activeModule) {
      case "dashboard":
        return <AdminDashboard dark={dark} onNavigate={setActiveModule} />;
      case "orders":
        return <AdminOrders dark={dark} />;
      case "products":
        return <AdminProducts dark={dark} />;
      case "banners":
        return <AdminBanners dark={dark} />;
      case "backup":
        return <AdminBackup dark={dark} />;
      case "settings":
        return <AdminSettings dark={dark} />;
      case "integrations":
        return <AdminIntegrations dark={dark} />;
      default:
        if (settingsModules.has(activeModule)) {
          return <AdminSettings dark={dark} moduleId={activeModule} />;
        }
        if (tableModules[activeModule]) {
          const cfg = tableModules[activeModule];
          return <AdminGenericTable dark={dark} moduleId={activeModule} tableName={cfg.table} columns={cfg.columns} />;
        }
        return (
          <div className={cn("rounded-[16px] border p-12 text-center", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
            <p className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{moduleLabel(activeModule)}</p>
            <p className={cn("text-sm mt-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>This module is coming soon.</p>
          </div>
        );
    }
  };

  return (
    <AdminContext value={{ dark, toggleDark, activeModule, setActiveModule, showToast }}>
      <div className={cn("min-h-screen", dark ? "bg-[#0f1318]" : "bg-[#f4f6f9]")}>
        <AdminSidebar
          dark={dark}
          activeModule={activeModule}
          onNavigate={setActiveModule}
          mobileOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
        />
        <div className="lg:ml-[264px]">
          <AdminTopbar
            dark={dark}
            onToggleDark={toggleDark}
            onToggleSidebar={() => setSidebarOpen(true)}
            breadcrumb={moduleLabel(activeModule)}
          />
          <main className="p-4 md:p-6">{renderModule()}</main>
        </div>

        {toast && (
          <div
            className={cn(
              "fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200",
              toast.type === "success" && "bg-[#16a34a]",
              toast.type === "info" && "bg-[#2563eb]",
              toast.type === "warn" && "bg-[#ea7317]"
            )}
          >
            {toast.message}
          </div>
        )}
      </div>
    </AdminContext>
  );
}
