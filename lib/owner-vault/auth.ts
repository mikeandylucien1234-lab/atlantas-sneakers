import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";

export const OV_COOKIE = "ov_session";
const MAX_AGE = 60 * 60 * 8; // 8h

function secret(): string {
  // Derive a signing secret from env; never hardcode credentials.
  return (
    process.env.OWNER_SESSION_SECRET ||
    (process.env.OWNER_PASSWORD ? crypto.createHash("sha256").update("ov|" + process.env.OWNER_PASSWORD).digest("hex") : "")
  );
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

// Constant-time string compare.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Validate the owner credentials against the environment (never hardcoded).
export function checkOwnerCredentials(email: string, password: string): boolean {
  const OE = process.env.OWNER_EMAIL;
  const OP = process.env.OWNER_PASSWORD;
  if (!OE || !OP) return false;
  return (
    safeEqual(email.trim().toLowerCase(), OE.trim().toLowerCase()) &&
    safeEqual(password, OP)
  );
}

// Build a signed session token: "<expiry>.<hmac>".
export function makeToken(): string {
  const exp = String(Date.now() + MAX_AGE * 1000);
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token || !secret()) return false;
  const [exp, mac] = token.split(".");
  if (!exp || !mac) return false;
  if (Number(exp) < Date.now()) return false;
  return safeEqual(mac, sign(exp));
}

export const OV_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/", // must cover both /owner-vault pages and /api/owner-vault routes
  maxAge: MAX_AGE,
};

// Server-side gate for pages & API routes. Returns true if the caller holds a
// valid Owner Vault session. This is fully independent of the admin/Supabase
// auth — an admin session grants nothing here.
export async function isOwner(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(OV_COOKIE)?.value);
}
