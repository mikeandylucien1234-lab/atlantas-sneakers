// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { recordLogin } from "@/lib/login-history/record";
import { clientIp } from "@/lib/security/guard";

// Public ingestion endpoint — called by the client on sign-in / failed sign-in.
// Success events resolve identity from the authenticated session; failures may
// pass an email. Rate-limited per IP to prevent log flooding.
const rl = new Map();
function limited(ip) { const now = Date.now(); const e = rl.get(ip) || { c: 0, t: now }; if (now - e.t > 60000) { e.c = 0; e.t = now; } e.c++; rl.set(ip, e); return e.c > 30; }

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (limited(ip || "unknown")) return Response.json({ ok: false }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const ua = request.headers.get("user-agent") || "";

  // For success, bind to the authenticated user (never trust a client-supplied id).
  let user_id = null;
  try { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); user_id = user?.id || null; } catch {}

  const status = ["success", "failed", "password_incorrect", "2fa_failed", "otp_failed", "blocked", "locked", "expired", "session_expired"].includes(b.status) ? b.status : "success";
  if (status === "success" && !user_id) return Response.json({ ok: false, error: "No session" }, { status: 401 });

  try {
    const res = await recordLogin({
      ip, ua, status, method: b.method || "email", email: b.email || null, user_id,
      screen_resolution: b.screen_resolution, language: b.language, timezone: b.timezone,
    });
    return Response.json(res);
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
