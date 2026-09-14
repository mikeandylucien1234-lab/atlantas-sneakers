import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { ownerConfig } from "./config";

export const OV_COOKIE = "ov_session";
const MAX_AGE = 60 * 60 * 8; // 8h

function secret(): string {
  // Derive a signing secret from config; never hardcode credentials.
  const cfg = ownerConfig();
  return (
    cfg.sessionSecret ||
    (cfg.password ? crypto.createHash("sha256").update("ov|" + cfg.password).digest("hex") : "")
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

// Strip a single pair of surrounding quotes some env systems keep (e.g. "~pw").
function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && ((t[0] === '"' && t.at(-1) === '"') || (t[0] === "'" && t.at(-1) === "'"))) {
    return t.slice(1, -1);
  }
  return v;
}

// True when the owner credentials are present (env or config file).
export function ownerConfigured(): boolean {
  const cfg = ownerConfig();
  return !!(cfg.email && cfg.password);
}

// Validate the owner credentials (never hardcoded — env or config file).
// Evaluates BOTH comparisons unconditionally (no &&-shortcircuit) so a wrong
// email doesn't return measurably faster than a wrong password — a small but
// real timing side-channel otherwise, given this gate has no other 2FA.
export function checkOwnerCredentials(email: string, password: string): boolean {
  const cfg = ownerConfig();
  const OE = cfg.email;
  const OP = cfg.password;
  if (!OE || !OP) return false;
  const emailOk = safeEqual(email.trim().toLowerCase(), unquote(OE).trim().toLowerCase());
  const passwordOk = safeEqual(password.trim(), unquote(OP).trim());
  return emailOk && passwordOk;
}

// Minimal in-process brute-force guard for the login endpoint: 5 failed
// attempts per IP locks that IP out for 15 minutes. o2switch runs one
// long-lived Node process, so this in-memory map is effective there (resets
// only on a process restart, which is rare and fine — a genuine attacker
// restarting the server to reset their own lockout isn't a realistic threat
// model for this single-owner login).
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; firstAt: number }>();

export function isLoginLocked(ip: string): { locked: boolean; retryAfterSec: number } {
  const rec = loginAttempts.get(ip);
  if (!rec) return { locked: false, retryAfterSec: 0 };
  const elapsed = Date.now() - rec.firstAt;
  if (elapsed > LOGIN_WINDOW_MS) { loginAttempts.delete(ip); return { locked: false, retryAfterSec: 0 }; }
  if (rec.count >= LOGIN_MAX_ATTEMPTS) return { locked: true, retryAfterSec: Math.ceil((LOGIN_WINDOW_MS - elapsed) / 1000) };
  return { locked: false, retryAfterSec: 0 };
}

export function recordFailedLogin(ip: string): void {
  const rec = loginAttempts.get(ip);
  if (!rec || Date.now() - rec.firstAt > LOGIN_WINDOW_MS) { loginAttempts.set(ip, { count: 1, firstAt: Date.now() }); return; }
  rec.count += 1;
}

export function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
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
