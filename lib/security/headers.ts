// @ts-nocheck
// Real security headers applied to every response by proxy.ts. Defaults are
// production-safe; the Security module can toggle individual headers.
export function buildSecurityHeaders(cfg = {}) {
  const h = {};
  h["X-Content-Type-Options"] = "nosniff";
  h["X-Frame-Options"] = cfg.x_frame_options || "SAMEORIGIN";
  h["Referrer-Policy"] = cfg.referrer_policy || "strict-origin-when-cross-origin";
  h["X-XSS-Protection"] = "1; mode=block";
  if (cfg.permissions_policy !== false) h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self), payment=(self)";
  if (cfg.hsts !== false) h["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  if (cfg.csp !== false) {
    // Report-friendly CSP that still allows the app's inline analytics/GTM bootstrap.
    h["Content-Security-Policy"] = [
      "default-src 'self'",
      // Stripe.js + Stripe Checkout must be allowed to load, plus analytics/GTM.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.tiktok.com https://static.cloudflareinsights.com",
      "script-src-elem 'self' 'unsafe-inline' https://js.stripe.com https://*.stripe.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.tiktok.com https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Supabase (REST/realtime) + Stripe API are covered by https:/wss:, listed
      // explicitly for clarity and to satisfy stricter parsers.
      "connect-src 'self' https: wss: https://api.stripe.com https://*.stripe.com https://*.supabase.co wss://*.supabase.co",
      // Stripe renders its card fields inside iframes (js.stripe.com / hooks.stripe.com).
      "frame-src 'self' https: https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; ");
  }
  return h;
}

export function applySecurityHeaders(response, cfg = {}) {
  const headers = buildSecurityHeaders(cfg);
  for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
  return response;
}
