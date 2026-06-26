import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flash Deals — Atlanta Sneakers",
  description: "Up to 60% off sneakers, clothing and tech. Limited time flash deals that end at midnight.",
  openGraph: { title: "Flash Deals — Atlanta Sneakers", description: "Up to 60% off sneakers, clothing and tech." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
