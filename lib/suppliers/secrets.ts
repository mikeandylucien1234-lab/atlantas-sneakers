// @ts-nocheck
// Secure supplier credential store. Credentials entered in the admin UI are
// AES-256-GCM encrypted with a server-only key and stored in
// supplier_credentials. They are NEVER returned to the browser in clear and
// NEVER logged. Adapters read them through the in-process cache hydrated by
// ensureCreds(). Environment variables always take precedence, so a value set
// on the host still wins over a UI-entered one.
import crypto from "crypto";
import { createClient as createAnon } from "@supabase/supabase-js";

function svc() {
  return createAnon(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

// 32-byte key derived from a server secret. Prefers a dedicated key; falls back
// to other server-only secrets so encryption still works out of the box.
function key() {
  const raw = process.env.SUPPLIER_SECRET_KEY || process.env.BACKUP_ENCRYPTION_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXTAUTH_SECRET || "atlanta-sneakers-supplier-fallback-key";
  return crypto.createHash("sha256").update(String(raw)).digest(); // 32 bytes
}

export function encryptJSON(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(obj), "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}
export function decryptJSON(b64) {
  try {
    const buf = Buffer.from(b64, "base64");
    const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), payload = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(payload), decipher.final()]);
    return JSON.parse(dec.toString("utf8"));
  } catch { return null; }
}

// in-process cache: supplierId -> { creds, exp }
const _cache = {};
const TTL = 60_000;

// Load & decrypt stored credentials into the cache (best-effort, cached 60s).
export async function ensureCreds(supplierId) {
  const c = _cache[supplierId];
  if (c && Date.now() < c.exp) return c.creds;
  let creds = {};
  try {
    const { data } = await svc().from("supplier_credentials").select("data").eq("supplier_id", supplierId).maybeSingle();
    if (data?.data) creds = decryptJSON(data.data) || {};
  } catch {}
  _cache[supplierId] = { creds, exp: Date.now() + TTL };
  return creds;
}

// Synchronous accessor — returns whatever ensureCreds last hydrated.
export function getCreds(supplierId) {
  return _cache[supplierId]?.creds || {};
}

// Encrypt & persist. Only non-empty fields overwrite existing ones.
export async function saveCreds(supplierId, fields, actor) {
  const existing = await ensureCreds(supplierId);
  const merged = { ...existing };
  for (const [k, v] of Object.entries(fields || {})) {
    if (v != null && String(v).trim() !== "") merged[k] = String(v).trim();
  }
  const hintSource = merged.email || merged.access_token || merged.api_key || "";
  const hint = hintSource ? hintSource.slice(0, 3) + "•••" + hintSource.slice(-2) : null;
  await svc().from("supplier_credentials").upsert({
    supplier_id: supplierId, data: encryptJSON(merged), hint, updated_at: new Date().toISOString(),
    updated_by: actor?.id || null,
  }, { onConflict: "supplier_id" });
  _cache[supplierId] = { creds: merged, exp: Date.now() + TTL };
  return { hint };
}

export async function clearCreds(supplierId) {
  try { await svc().from("supplier_credentials").delete().eq("supplier_id", supplierId); } catch {}
  delete _cache[supplierId];
}

// A non-secret status summary for the UI (which fields are set — never the values).
export async function credsStatus(supplierId) {
  const c = await ensureCreds(supplierId);
  return {
    stored: Object.keys(c).length > 0,
    fields: Object.keys(c),
    hint: c.email ? c.email.slice(0, 3) + "•••" + (c.email.split("@")[1] ? "@" + c.email.split("@")[1] : "") : null,
  };
}
