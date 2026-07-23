import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isOwner } from "@/lib/owner-vault/auth";
import { OwnerVaultDashboard } from "@/components/owner-vault/dashboard";

// Never index / follow this private area.
export const metadata: Metadata = { robots: { index: false, follow: false }, title: "Owner Vault" };
export const dynamic = "force-dynamic";

export default async function OwnerVaultPage() {
  if (!(await isOwner())) redirect("/owner-vault/login");
  return <OwnerVaultDashboard />;
}
