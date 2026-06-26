import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout — Atlanta Sneakers",
  description: "Complete your purchase securely with multiple payment options.",
  openGraph: { title: "Checkout — Atlanta Sneakers", description: "Complete your purchase securely." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
