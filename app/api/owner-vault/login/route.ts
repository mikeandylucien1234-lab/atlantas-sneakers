import { NextRequest, NextResponse } from "next/server";
import { checkOwnerCredentials, ownerConfigured, makeToken, OV_COOKIE, OV_COOKIE_OPTS, isLoginLocked, recordFailedLogin, clearLoginAttempts } from "@/lib/owner-vault/auth";

export const runtime = "nodejs";

function ipOf(r: NextRequest) { return r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"; }

export async function POST(request: NextRequest) {
  const ip = ipOf(request);

  // Brute-force guard — before touching credentials at all, so a locked-out
  // attacker never gets another timing/oracle signal either.
  const lock = isLoginLocked(ip);
  if (lock.locked) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(lock.retryAfterSec) } }
    );
  }

  // Distinguish "server not configured" from "wrong credentials" so the owner
  // can tell whether the env vars are missing. Neither reveals any secret.
  if (!ownerConfigured()) {
    return NextResponse.json(
      { error: "Owner Vault n'est pas configuré sur le serveur (variables OWNER_EMAIL / OWNER_PASSWORD manquantes)." },
      { status: 503 }
    );
  }

  const { email, password } = await request.json().catch(() => ({}));
  if (!email || !password || !checkOwnerCredentials(String(email), String(password))) {
    recordFailedLogin(ip);
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }

  clearLoginAttempts(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OV_COOKIE, makeToken(), OV_COOKIE_OPTS);
  return res;
}
