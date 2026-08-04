import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getAuthContext } from "@/lib/rbac/server";

export const metadata: Metadata = {
  title: "Admin | Atlanta Sneakers",
  robots: { index: false, follow: false },
};

// Server-side gate for the entire /admin area. Runs on every request (including
// hard refreshes and direct URL access), before any admin UI is rendered:
//   - Not signed in            -> redirect to secure login, returning to /admin.
//   - Signed in but not admin  -> 403 (no admin UI is ever sent to the browser).
//   - Signed in admin          -> render the admin app (granular permissions are
//                                 still enforced per-module and per-API via RBAC).
// This mirrors the exact rule used by every admin API (profiles.role === "admin"),
// so Super Administrator / Administrator / authorised staff keep working unchanged.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getAuthContext();

  if (!user) {
    redirect("/auth/login?redirect=/admin");
  }

  if (!profile || profile.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6f9] px-4">
        <div className="max-w-[420px] w-full bg-white border border-[#eef0f3] rounded-[16px] p-8 text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7 text-[#ef4444]" />
          </div>
          <h1 className="text-[20px] font-extrabold text-[#16181d] mt-4">Access denied</h1>
          <p className="text-[14px] text-[#5b6472] mt-2 leading-[1.6]">
            You don&apos;t have permission to access the admin area. If you believe this is a
            mistake, contact a store administrator.
          </p>
          <Link
            href="/"
            className="inline-block mt-5 bg-[#2563eb] text-white font-bold text-[13px] py-[11px] px-6 rounded-[12px] hover:brightness-105 transition"
          >
            Back to store
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
