import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop All Sneakers — Atlanta Sneakers",
  description: "Browse our full collection of authentic sneakers. Filter by brand, size, price and more.",
  openGraph: { title: "Shop All Sneakers — Atlanta Sneakers", description: "Browse our full collection of authentic sneakers." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
