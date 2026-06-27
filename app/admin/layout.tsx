import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | Atlanta Sneakers",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
