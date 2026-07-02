import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ToastProvider } from "@/components/ui/toast";
import { AuthListener } from "@/components/auth-listener";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Atlanta Sneakers — Your #1 Sneaker Destination",
  description: "Shop 100% authentic sneakers from Nike, Adidas, Jordan, New Balance and more. Free shipping over $100.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans bg-[#f4f5f7] text-[#16181d] antialiased">
        <ToastProvider>
          <AuthListener />
          <AnnouncementBar />
          <Header />
          <main className="flex-1">
            <div className="max-w-[1240px] mx-auto px-4 py-5">
              {children}
            </div>
          </main>
          <Footer />
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
