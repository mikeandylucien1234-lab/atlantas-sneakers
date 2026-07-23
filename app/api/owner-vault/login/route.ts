import { NextRequest, NextResponse } from "next/server";
import { checkOwnerCredentials, makeToken, OV_COOKIE, OV_COOKIE_OPTS } from "@/lib/owner-vault/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json().catch(() => ({}));
  if (!email || !password || !checkOwnerCredentials(String(email), String(password))) {
    // Generic message — never reveal which field is wrong.
    return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OV_COOKIE, makeToken(), OV_COOKIE_OPTS);
  return res;
}
