"use client";

import { useState, useEffect, createContext, useCallback, Component } from "react";
import { useAuthStore } from "@/lib/store/auth-store";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopbar } from "@/components/admin/topbar";
import dynamic from "next/dynamic";
import AdminDashboard from "@/components/admin/modules/dashboard";
import { PermissionProvider } from "@/lib/rbac/client";
import { Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups } from "@/components/admin/sidebar";

// Lightweight fallback shown while a module chunk is being fetched. Hoisted
// function declaration so it can be referenced by the dynamic() calls below.
function ModuleLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-7 h-7 animate-spin text-[#2563eb]" />
    </div>
  );
}

// Safety net for lazy-loaded modules: if a module's chunk fails to load
// (network blip, a mismatched/missing file after a deploy) or the module
// throws while rendering, React unmounts the whole page with NO fallback by
// default — which is exactly what showed up as Safari's native "This page
// couldn't load" crash screen instead of a clear, recoverable message. This
// boundary catches it, shows the real error, and offers Retry without a full
// page reload, so a single broken module never takes down the whole admin.
type ModuleErrorBoundaryProps = { children: React.ReactNode };
type ModuleErrorBoundaryState = { error: unknown };
class ModuleErrorBoundary extends Component<ModuleErrorBoundaryProps, ModuleErrorBoundaryState> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidCatch(error: unknown) {
    console.error("[admin module crashed]", error);
  }
  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-8 text-center">
          <ShieldAlert className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-[15px] font-bold text-[#16181d]">This section failed to load</p>
          <p className="text-[12px] text-[#8a929c] mt-1 mb-4 break-all">{String((error as Error)?.message || error)}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="bg-[#2563eb] text-white font-bold text-[13px] py-2 px-5 rounded-[10px] hover:brightness-105 transition"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Code-splitting: every admin module is loaded lazily so the initial /admin
// bundle stays tiny (only the shell + the default Dashboard). Each module's
// code is fetched on demand the first time its section is opened. Same module
// names, same props, same navigation — only the loading strategy changes.
// (ssr:false: these are client-only admin screens; nothing is rendered until
// the authenticated admin has already passed the server-side gate in layout.tsx.)
const AdminOrders = dynamic(() => import("@/components/admin/modules/orders").then((m) => m.AdminOrders), { loading: ModuleLoader, ssr: false });
const AdminProducts = dynamic(() => import("@/components/admin/modules/products").then((m) => m.AdminProducts), { loading: ModuleLoader, ssr: false });
const AdminGenericTable = dynamic(() => import("@/components/admin/modules/generic-table").then((m) => m.AdminGenericTable), { loading: ModuleLoader, ssr: false });
const AdminBanners = dynamic(() => import("@/components/admin/modules/banners").then((m) => m.AdminBanners), { loading: ModuleLoader, ssr: false });
const AdminBackup = dynamic(() => import("@/components/admin/modules/backup").then((m) => m.AdminBackup), { loading: ModuleLoader, ssr: false });
const AdminSettings = dynamic(() => import("@/components/admin/modules/settings").then((m) => m.AdminSettings), { loading: ModuleLoader, ssr: false });
const AdminIntegrations = dynamic(() => import("@/components/admin/modules/integrations").then((m) => m.AdminIntegrations), { loading: ModuleLoader, ssr: false });
const AdminPayments = dynamic(() => import("@/components/admin/modules/payments-admin").then((m) => m.AdminPayments), { loading: ModuleLoader, ssr: false });
const AdminPaymentLogs = dynamic(() => import("@/components/admin/modules/payment-logs").then((m) => m.AdminPaymentLogs), { loading: ModuleLoader, ssr: false });
const AdminReports = dynamic(() => import("@/components/admin/modules/reports").then((m) => m.AdminReports), { loading: ModuleLoader, ssr: false });
const AdminCategories = dynamic(() => import("@/components/admin/modules/categories").then((m) => m.AdminCategories), { loading: ModuleLoader, ssr: false });
const AdminBrands = dynamic(() => import("@/components/admin/modules/brands").then((m) => m.AdminBrands), { loading: ModuleLoader, ssr: false });
const AdminInventory = dynamic(() => import("@/components/admin/modules/inventory").then((m) => m.AdminInventory), { loading: ModuleLoader, ssr: false });
const AdminFlashDeals = dynamic(() => import("@/components/admin/modules/flash-deals").then((m) => m.AdminFlashDeals), { loading: ModuleLoader, ssr: false });
const AdminCustomers = dynamic(() => import("@/components/admin/modules/customers").then((m) => m.AdminCustomers), { loading: ModuleLoader, ssr: false });
const ProductCreate = dynamic(() => import("@/components/admin/modules/product-create").then((m) => m.ProductCreate), { loading: ModuleLoader, ssr: false });
const AdminReviews = dynamic(() => import("@/components/admin/modules/reviews").then((m) => m.AdminReviews), { loading: ModuleLoader, ssr: false });
const AdminTickets = dynamic(() => import("@/components/admin/modules/tickets").then((m) => m.AdminTickets), { loading: ModuleLoader, ssr: false });
const AdminRewards = dynamic(() => import("@/components/admin/modules/rewards").then((m) => m.AdminRewards), { loading: ModuleLoader, ssr: false });
const AdminCoupons = dynamic(() => import("@/components/admin/modules/coupons").then((m) => m.AdminCoupons), { loading: ModuleLoader, ssr: false });
const AdminHomepage = dynamic(() => import("@/components/admin/modules/homepage").then((m) => m.AdminHomepage), { loading: ModuleLoader, ssr: false });
const AdminBlog = dynamic(() => import("@/components/admin/modules/blog").then((m) => m.AdminBlog), { loading: ModuleLoader, ssr: false });
const AdminMedia = dynamic(() => import("@/components/admin/modules/media").then((m) => m.AdminMedia), { loading: ModuleLoader, ssr: false });
const AdminFaq = dynamic(() => import("@/components/admin/modules/faq").then((m) => m.AdminFaq), { loading: ModuleLoader, ssr: false });
const AdminShipping = dynamic(() => import("@/components/admin/modules/shipping").then((m) => m.AdminShipping), { loading: ModuleLoader, ssr: false });
const AdminReturns = dynamic(() => import("@/components/admin/modules/returns").then((m) => m.AdminReturns), { loading: ModuleLoader, ssr: false });
const AdminPaymentSettings = dynamic(() => import("@/components/admin/modules/payment-settings").then((m) => m.AdminPaymentSettings), { loading: ModuleLoader, ssr: false });
const AdminTax = dynamic(() => import("@/components/admin/modules/tax").then((m) => m.AdminTax), { loading: ModuleLoader, ssr: false });
const AdminSeo = dynamic(() => import("@/components/admin/modules/seo").then((m) => m.AdminSeo), { loading: ModuleLoader, ssr: false });
const AdminAnalytics = dynamic(() => import("@/components/admin/modules/ganalytics").then((m) => m.AdminAnalytics), { loading: ModuleLoader, ssr: false });
const AdminTikTok = dynamic(() => import("@/components/admin/modules/tiktok").then((m) => m.AdminTikTok), { loading: ModuleLoader, ssr: false });
const AdminSearchConsole = dynamic(() => import("@/components/admin/modules/search-console").then((m) => m.AdminSearchConsole), { loading: ModuleLoader, ssr: false });
const AdminNotifications = dynamic(() => import("@/components/admin/modules/notifications").then((m) => m.AdminNotifications), { loading: ModuleLoader, ssr: false });
const AdminRoles = dynamic(() => import("@/components/admin/modules/roles").then((m) => m.AdminRoles), { loading: ModuleLoader, ssr: false });
const AdminStaff = dynamic(() => import("@/components/admin/modules/staff").then((m) => m.AdminStaff), { loading: ModuleLoader, ssr: false });
const AdminSecurity = dynamic(() => import("@/components/admin/modules/security").then((m) => m.AdminSecurity), { loading: ModuleLoader, ssr: false });
const AdminLoginHistory = dynamic(() => import("@/components/admin/modules/login-history").then((m) => m.AdminLoginHistory), { loading: ModuleLoader, ssr: false });
const AdminAudit = dynamic(() => import("@/components/admin/modules/audit").then((m) => m.AdminAudit), { loading: ModuleLoader, ssr: false });
const AdminActivity = dynamic(() => import("@/components/admin/modules/activity").then((m) => m.AdminActivity), { loading: ModuleLoader, ssr: false });
const AdminApiKeys = dynamic(() => import("@/components/admin/modules/api-keys").then((m) => m.AdminApiKeys), { loading: ModuleLoader, ssr: false });
const AdminHealth = dynamic(() => import("@/components/admin/modules/health").then((m) => m.AdminHealth), { loading: ModuleLoader, ssr: false });
const AdminSettingsCenter = dynamic(() => import("@/components/admin/modules/settings-center").then((m) => m.AdminSettingsCenter), { loading: ModuleLoader, ssr: false });
const AdminSuppliers = dynamic(() => import("@/components/admin/modules/suppliers").then((m) => m.AdminSuppliers), { loading: ModuleLoader, ssr: false });
const AdminAttributes = dynamic(() => import("@/components/admin/modules/attributes").then((m) => m.AdminAttributes), { loading: ModuleLoader, ssr: false });
const AdminSizes = dynamic(() => import("@/components/admin/modules/sizes").then((m) => m.AdminSizes), { loading: ModuleLoader, ssr: false });
const AdminWarranties = dynamic(() => import("@/components/admin/modules/warranties").then((m) => m.AdminWarranties), { loading: ModuleLoader, ssr: false });
const AdminHomepageCategories = dynamic(() => import("@/components/admin/modules/homepage-categories").then((m) => m.AdminHomepageCategories), { loading: ModuleLoader, ssr: false });
const AdminHomepageNavTabs = dynamic(() => import("@/components/admin/modules/homepage-nav-tabs").then((m) => m.AdminHomepageNavTabs), { loading: ModuleLoader, ssr: false });
const AdminMenLanding = dynamic(() => import("@/components/admin/modules/men-landing").then((m) => m.AdminMenLanding), { loading: ModuleLoader, ssr: false });
const AdminAnnouncementBar = dynamic(() => import("@/components/admin/modules/announcement-bar").then((m) => m.AdminAnnouncementBar), { loading: ModuleLoader, ssr: false });

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
  "metapixel",
  "emails",
]);

const tableModules: Record<string, { table: string; columns: string[] }> = {
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
      case "announcementbar":
        return <AdminAnnouncementBar dark={dark} />;
      case "banners":
        return <AdminBanners dark={dark} />;
      case "backup":
        return <AdminBackup dark={dark} />;
      case "settings":
        return <AdminSettingsCenter dark={dark} />;
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
      case "media":
        return <AdminMedia dark={dark} />;
      case "faq":
        return <AdminFaq dark={dark} />;
      case "shipping":
        return <AdminShipping dark={dark} />;
      case "returns":
        return <AdminReturns dark={dark} />;
      case "payments":
        return <AdminPaymentSettings dark={dark} />;
      case "tax":
        return <AdminTax dark={dark} />;
      case "seo":
        return <AdminSeo dark={dark} />;
      case "ganalytics":
        return <AdminAnalytics dark={dark} />;
      case "tiktok":
        return <AdminTikTok dark={dark} />;
      case "gsc":
        return <AdminSearchConsole dark={dark} />;
      case "notifications":
        return <AdminNotifications dark={dark} />;
      case "roles":
        return <AdminRoles dark={dark} />;
      case "staff":
        return <AdminStaff dark={dark} />;
      case "security":
        return <AdminSecurity dark={dark} />;
      case "loginhistory":
        return <AdminLoginHistory dark={dark} />;
      case "audit":
        return <AdminAudit dark={dark} />;
      case "activity":
        return <AdminActivity dark={dark} />;
      case "apikeys":
        return <AdminApiKeys dark={dark} />;
      case "health":
        return <AdminHealth dark={dark} />;
      case "suppliers":
        return <AdminSuppliers dark={dark} />;
      case "cjdropshipping":
        return <AdminSuppliers dark={dark} initialView="supplier" focusSupplier="cj" />;
      case "attributes":
        return <AdminAttributes dark={dark} />;
      case "sizes":
        return <AdminSizes dark={dark} />;
      case "warranties":
        return <AdminWarranties dark={dark} />;
      case "homepagecategories":
        return <AdminHomepageCategories dark={dark} />;
      case "navtabs":
        return <AdminHomepageNavTabs dark={dark} />;
      case "menlanding":
        return <AdminMenLanding dark={dark} page="men" />;
      case "womenlanding":
        return <AdminMenLanding dark={dark} page="women" />;
      case "curvelanding":
        return <AdminMenLanding dark={dark} page="curve" />;
      case "kidslanding":
        return <AdminMenLanding dark={dark} page="kids" />;
      case "quickshiplanding":
        return <AdminMenLanding dark={dark} page="quickship" />;
      case "beautylanding":
        return <AdminMenLanding dark={dark} page="beauty" />;
      case "homelanding":
        return <AdminMenLanding dark={dark} page="home" />;
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
    <PermissionProvider>
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
          <main className="p-4 md:p-6"><ModuleErrorBoundary key={activeModule}>{renderModule()}</ModuleErrorBoundary></main>
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
    </PermissionProvider>
  );
}
