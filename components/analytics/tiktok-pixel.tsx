"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Injects the official TikTok Pixel and fires PageView + ViewContent on route
// changes. Also mirrors events first-party to /api/tiktok/track so the admin
// dashboard shows "events received". Exposes window.ttqTrack for ecommerce
// events (AddToCart, InitiateCheckout, CompletePayment...).
function mirror(event_name: string, extra: Record<string, unknown> = {}) {
  try {
    const body = JSON.stringify({ event_name, path: window.location.pathname, ...extra });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/tiktok/track", new Blob([body], { type: "application/json" }));
    else fetch("/api/tiktok/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* silent */ }
}

export function TikTokPixel({ pixelId, events }: { pixelId: string; events?: Record<string, boolean> }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pixelId) return;
    // Official TikTok pixel bootstrap
    (function (w: any, d: Document, t: string) {
      w.TiktokAnalyticsObject = t;
      const ttq = (w[t] = w[t] || []);
      ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
      ttq.setAndDefer = function (target: any, method: string) { target[method] = function () { target.push([method].concat(Array.prototype.slice.call(arguments, 0))); }; };
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (id: string) { const inst = ttq._i[id] || []; for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(inst, ttq.methods[n]); return inst; };
      ttq.load = function (id: string, opts?: any) {
        const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {}; ttq._i[id] = []; ttq._i[id]._u = url;
        ttq._t = ttq._t || {}; ttq._t[id] = +new Date(); ttq._o = ttq._o || {}; ttq._o[id] = opts || {};
        const script = d.createElement("script"); script.type = "text/javascript"; script.async = true; script.src = url + "?sdkid=" + id + "&lib=" + t;
        const first = d.getElementsByTagName("script")[0]; first.parentNode?.insertBefore(script, first);
      };
      if (!w[t]._loaded) { ttq.load(pixelId); w[t]._loaded = true; }
      ttq.page();
    })(window, document, "ttq");

    (window as any).ttqTrack = (name: string, data: Record<string, unknown> = {}) => {
      try { (window as any).ttq?.track?.(name, data); } catch {}
      mirror(name, data);
    };
  }, [pixelId]);

  // Fire per-route events
  useEffect(() => {
    if (!pixelId || !pathname || pathname.startsWith("/admin")) return;
    try { (window as any).ttq?.page?.(); } catch {}
    if (events?.page_view !== false) mirror("PageView");
    if (pathname.startsWith("/product/") && events?.view_content !== false) {
      try { (window as any).ttq?.track?.("ViewContent"); } catch {}
      mirror("ViewContent");
    }
  }, [pathname, pixelId, events]);

  return null;
}
