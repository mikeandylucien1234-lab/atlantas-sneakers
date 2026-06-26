import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Account — Atlanta Sneakers",
  description: "Manage your profile, orders, addresses, payment methods and rewards.",
  openGraph: { title: "My Account — Atlanta Sneakers", description: "Manage your Atlanta Sneakers account." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
