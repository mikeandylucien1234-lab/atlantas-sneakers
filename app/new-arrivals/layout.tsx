import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Arrivals — Atlanta Sneakers",
  description: "Be the first to shop the latest sneaker drops from Nike, Adidas, Jordan, New Balance and more.",
  openGraph: { title: "New Arrivals — Atlanta Sneakers", description: "Be the first to shop the latest sneaker drops." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
