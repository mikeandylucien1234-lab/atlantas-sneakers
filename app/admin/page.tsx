"use client";

import { useState, useEffect, createContext, useCallback } from "react";
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
import { AdminPayments } from "@/components/admin/modules/payments-admin";
import { AdminPaymentLogs } from "@/components/admin/modules/payment-logs";
import { AdminReports } from "@/components/admin/modules/reports";
import { AdminCategories } from "@/components/admin/modules/categories";
import { AdminBrands } from "@/components/admin/modules/brands";
import { AdminInventory } from "@/components/admin/modules/inventory";
import { AdminFlashDeals } from "@/components/admin/modules/flash-deals";
import { AdminCustomers } from "@/components/admin/modules/customers";
import { ProductCreate } from "@/components/admin/modules/product-create";
import { AdminReviews } from "@/components/admin/modules/reviews";
import { AdminTickets } from "@/components/admin/modules/tickets";
import { AdminRewards } from "@/components/admin/modules/rewards";
import { AdminCoupons } from "@/components/admin/modules/coupons";
import { AdminHomepage } from "@/components/admin/modules/homepage";
import { AdminBlog } from "@/components/admin/modules/blog";
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

const AdminContext = createContext<AdminCtx>({
  dark: false,
  toggleDark: () => {},
  activeModule: "dashboard",
  setActiveModule: () => {},
  showToast: () => {},
});

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
  "health", "emails", "faq", "media",
]);

const tableModules: Record<string, { table: string; columns: string[] }> = {
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
  const [editProductId, setEditProductId] = useState<string | null>(null);

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


  const renderModule = () => {
    switch (activeModule) {
      case "dashboard":
        return <AdminDashboard dark={dark} onNavigate={setActiveModule} />;
      case "orders":
        return <AdminOrders dark={dark} />;
      case "products":
        return <AdminProducts dark={dark} onNavigate={setActiveModule} />;
      case "banners":
        return <AdminBanners dark={dark} />;
      case "backup":
        return <AdminBackup dark={dark} />;
      case "settings":
        return <AdminSettings dark={dark} />;
      case "integrations":
        return <AdminIntegrations dark={dark} />;
      case "paymentsmgmt":
        return <AdminPayments dark={dark} />;
      case "paymentlogs":
        return <AdminPaymentLogs dark={dark} />;
      case "reports":
        return <AdminReports dark={dark} />;
      case "categories":
        return <AdminCategories dark={dark} />;
      case "brands":
        return <AdminBrands dark={dark} />;
      case "inventory":
        return <AdminInventory dark={dark} />;
      case "flashdeals":
        return <AdminFlashDeals dark={dark} />;
      case "customers":
        return <AdminCustomers dark={dark} />;
      case "reviews":
        return <AdminReviews dark={dark} />;
      case "tickets":
        return <AdminTickets dark={dark} />;
      case "rewards":
        return <AdminRewards dark={dark} />;
      case "coupons":
        return <AdminCoupons dark={dark} />;
      case "homepage":
        return <AdminHomepage dark={dark} />;
      case "blog":
        return <AdminBlog dark={dark} />;
      case "addproduct":
        return <ProductCreate dark={dark} onBack={() => setActiveModule("products")} />;
      case "editproduct":
        return <ProductCreate dark={dark} onBack={() => setActiveModule("products")} editProductId={editProductId} />;
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
