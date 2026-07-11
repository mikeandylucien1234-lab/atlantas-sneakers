// @ts-nocheck
"use client";
// Fire-and-forget login event beacon. Device/screen/timezone are collected in the
// browser; IP, geolocation and risk scoring are computed server-side.
export function recordLoginEvent(status = "success", method = "email", email?: string) {
  try {
    const payload = {
      status, method, email: email || undefined,
      screen_resolution: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : undefined,
      language: typeof navigator !== "undefined" ? navigator.language : undefined,
      timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; } })(),
    };
    fetch("/api/login-history/record", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
  } catch {}
}
