"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Sends first-party page_view events to the analytics beacon on every route
// change. Also exposes window.atlTrack(name, data) for ecommerce events
// (add_to_cart, begin_checkout, purchase...) used across the storefront.
function getSession(): string {
  if (typeof window === "undefined") return "";
  try {
    let s = sessionStorage.getItem("atl_sid");
    if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("atl_sid", s); }
    return s;
  } catch { return ""; }
}

function send(event_name: string, extra: Record<string, unknown> = {}) {
  try {
    const body = JSON.stringify({
      event_name,
      path: typeof window !== "undefined" ? window.location.pathname : undefined,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
      session_id: getSession(),
      ...extra,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/track", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/analytics/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* silent */ }
}

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Expose a global tracker for storefront ecommerce events
    (window as unknown as { atlTrack?: typeof send }).atlTrack = send;
  }, []);

  useEffect(() => {
    if (!pathname) return;
    // Do not track admin pages
    if (pathname.startsWith("/admin")) return;
    let name = "page_view";
    if (pathname.startsWith("/product/")) name = "product_view";
    else if (pathname.startsWith("/category/")) name = "category_view";
    else if (pathname.startsWith("/brand/")) name = "view_brand";
    else if (pathname === "/checkout") name = "begin_checkout";
    send(name);
  }, [pathname]);

  return null;
}
