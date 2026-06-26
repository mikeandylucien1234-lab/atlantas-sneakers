import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Wishlist — Atlanta Sneakers",
  description: "Your saved sneakers and items. Move them to cart before they sell out.",
  openGraph: { title: "My Wishlist — Atlanta Sneakers", description: "Your saved sneakers and items." },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
