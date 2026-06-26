import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Best Sellers — Atlanta Sneakers",
  description: "Shop our most popular sneakers ranked by customer purchases. Nike, Jordan, Adidas and more top sellers.",
  openGraph: { title: "Best Sellers — Atlanta Sneakers", description: "Shop our most popular sneakers ranked by customer purchases." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
