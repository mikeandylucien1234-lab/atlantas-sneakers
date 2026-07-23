import { NextRequest, NextResponse } from "next/server";
import { checkOwnerCredentials, ownerConfigured, makeToken, OV_COOKIE, OV_COOKIE_OPTS } from "@/lib/owner-vault/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OV_COOKIE, makeToken(), OV_COOKIE_OPTS);
  return res;
}
