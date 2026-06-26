import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shopping Cart — Atlanta Sneakers",
  description: "Review your cart and checkout. Free shipping on orders over $100.",
  openGraph: { title: "Shopping Cart — Atlanta Sneakers", description: "Review your cart and checkout." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
