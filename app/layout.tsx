import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { FloatingOfferButton } from "@/components/promo/floating-offer-button";
import { ToastProvider } from "@/components/ui/toast";
import { AuthListener } from "@/components/auth-listener";
import { AnalyticsTracker } from "@/components/analytics/analytics-tracker";
import { TikTokPixel } from "@/components/analytics/tiktok-pixel";
import { getSeoSettings, buildRootMetadata } from "@/lib/seo/seo-settings";
import { getTikTokSettings } from "@/lib/tiktok/settings";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Global metadata is generated from the admin-managed SEO settings.
export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  return buildRootMetadata(seo);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const seo = await getSeoSettings();
  const tiktok = await getTikTokSettings();
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://atlantassneakers.com").replace(/\/$/, "");
  const siteName = seo?.site_name || "Atlanta Sneakers";

  // Organization + WebSite structured data (schema.org) — real, injected globally
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteName,
      url: base,
      ...(seo?.og_image ? { logo: seo.og_image } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteName,
      url: base,
      potentialAction: {
        "@type": "SearchAction",
        target: `${base}/shop?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];

  return (
    <html lang="en" className={`${plusJakarta.variable} h-full`}>
      <head>
        {seo?.google_verification && <meta name="google-site-verification" content={seo.google_verification} />}
        {seo?.bing_verification && <meta name="msvalidate.01" content={seo.bing_verification} />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {seo?.google_tag_manager_id && (
          <script dangerouslySetInnerHTML={{ __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${seo.google_tag_manager_id}');` }} />
        )}
        {seo?.google_analytics_id && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${seo.google_analytics_id}`} />
            <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${seo.google_analytics_id}');` }} />
          </>
        )}
      </head>
      <body className="min-h-full flex flex-col font-sans bg-[#f4f5f7] text-[#16181d] antialiased">
        {seo?.google_tag_manager_id && (
          <noscript><iframe src={`https://www.googletagmanager.com/ns.html?id=${seo.google_tag_manager_id}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} /></noscript>
        )}
        <ToastProvider>
          <AuthListener />
          <AnalyticsTracker />
          {tiktok?.pixel_id && <TikTokPixel pixelId={tiktok.pixel_id} events={tiktok.pixel_events} />}
          <AnnouncementBar />
          <Header />
          <main className="flex-1">
            <div className="max-w-[1240px] mx-auto px-4 py-5">
              {children}
            </div>
          </main>
          <Footer />
          <BottomNav />
          <FloatingOfferButton />
        </ToastProvider>
      </body>
    </html>
  );
}
