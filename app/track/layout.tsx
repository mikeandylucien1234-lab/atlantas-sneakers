import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Track Order — Atlanta Sneakers",
  description: "Track your Atlanta Sneakers order in real-time. Enter your order number to see shipment progress.",
  openGraph: { title: "Track Order — Atlanta Sneakers", description: "Track your order in real-time." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
