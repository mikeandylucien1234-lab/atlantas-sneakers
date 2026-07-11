// @ts-nocheck
// Real backup engine: exports selected Supabase tables to a single JSON manifest,
// gzip-compresses it, computes a SHA-256 checksum, optionally AES-256-GCM encrypts
// it (key from BACKUP_ENCRYPTION_KEY env — never stored), and uploads the artifact
// to the private `backups` storage bucket. Restore reverses the pipeline and
// re-applies rows (upsert = merge, or truncate+insert = replace).
import { createClient as createAnon } from "@supabase/supabase-js";
import crypto from "crypto";
import zlib from "zlib";
import { promisify } from "util";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }

// Curated set of tables that are safe to back up / restore, grouped by domain.
export const BACKUP_GROUPS = {
  products: ["products", "categories", "brands"],
  orders: ["orders", "payments"],
  customers: ["profiles"],
  inventory: ["products"],
  categories: ["categories"],
  brands: ["brands"],
  coupons: ["coupons"],
  reviews: ["reviews"],
  roles: ["roles", "permissions", "role_permissions", "user_roles"],
  settings: ["seo_settings", "security_settings", "notification_settings", "audit_settings", "backup_retention"],
  seo: ["seo_settings", "seo_redirects"],
  payment_settings: ["payment_gateways", "payment_config"],
  api_keys: ["api_keys", "api_applications"],
  notifications: ["notification_templates", "notification_channels"],
  media: ["media", "banners"],
  configuration: ["seo_settings", "security_settings", "notification_settings", "integration_settings"],
};
// "full" / "database" = the union of everything above (deduped)
export function tablesFor(type, scope) {
  if (scope && scope.length) return [...new Set(scope.flatMap(x => BACKUP_GROUPS[x] || [x]))];
  if (type === "full" || type === "database" || type === "system") return [...new Set(Object.values(BACKUP_GROUPS).flat())];
  return BACKUP_GROUPS[type] || ["products"];
}

function encKey() {
  const raw = process.env.BACKUP_ENCRYPTION_KEY;
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest(); // 32 bytes
}
function encrypt(buf) {
  const key = encKey(); if (!key) return { data: buf, encrypted: false };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { data: Buffer.concat([iv, tag, enc]), encrypted: true }; // iv(12)+tag(16)+payload
}
function decrypt(buf, wasEncrypted) {
  if (!wasEncrypted) return buf;
  const key = encKey(); if (!key) throw new Error("BACKUP_ENCRYPTION_KEY missing — cannot decrypt");
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), payload = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]);
}

async function log(s, row) { try { await s.from("backup_logs").insert(row); } catch {} }

export async function runBackup({ id, type, scope, compress = true, encrypt: doEncrypt = false }) {
  const s = svc();
  const started = Date.now();
  const tables = tablesFor(type, scope);
  const manifest = { version: 1, created_at: new Date().toISOString(), type, tables: {} };
  let rowCount = 0, tableCount = 0;
  for (const t of tables) {
    try {
      const { data, error } = await s.from(t).select("*").limit(100000);
      if (error) continue;
      manifest.tables[t] = data || [];
      rowCount += (data || []).length; tableCount++;
    } catch { /* skip missing table */ }
  }
  const json = Buffer.from(JSON.stringify(manifest));
  const uncompressed = json.length;
  let artifact = compress ? await gzip(json) : json;
  const enc = doEncrypt ? encrypt(artifact) : { data: artifact, encrypted: false };
  artifact = enc.data;
  const checksum = crypto.createHash("sha256").update(artifact).digest("hex");
  const path = `${new Date().toISOString().slice(0, 10)}/${id}.bak${compress ? ".gz" : ""}${enc.encrypted ? ".enc" : ""}`;

  const up = await s.storage.from("backups").upload(path, artifact, { contentType: "application/octet-stream", upsert: true });
  const duration = Date.now() - started;
  if (up.error) {
    await s.from("backups").update({ status: "failed", error: up.error.message, finished_at: new Date().toISOString(), duration_ms: duration }).eq("id", id);
    await log(s, { backup_id: id, event: "backup", status: "error", detail: up.error.message });
    return { ok: false, error: up.error.message };
  }
  await s.from("backups").update({
    status: "success", storage_path: path, size_bytes: artifact.length, uncompressed_bytes: uncompressed,
    compression_ratio: uncompressed ? +(artifact.length / uncompressed).toFixed(3) : 1,
    row_count: rowCount, table_count: tableCount, checksum, encrypted: enc.encrypted, compressed: compress,
    valid: true, validation_message: "Checksum computed", scope: tables,
    finished_at: new Date().toISOString(), duration_ms: duration,
  }).eq("id", id);
  await log(s, { backup_id: id, event: "backup", status: "ok", detail: `${tableCount} tables, ${rowCount} rows, ${artifact.length} bytes` });
  return { ok: true, checksum, size: artifact.length, tableCount, rowCount };
}

async function fetchArtifact(s, backup) {
  const { data, error } = await s.storage.from("backups").download(backup.storage_path);
  if (error) throw new Error(error.message);
  return Buffer.from(await data.arrayBuffer());
}

export async function validateBackup(backupId) {
  const s = svc();
  const { data: backup } = await s.from("backups").select("*").eq("id", backupId).single();
  if (!backup?.storage_path) return { ok: false, message: "No stored artifact" };
  try {
    const buf = await fetchArtifact(s, backup);
    const checksum = crypto.createHash("sha256").update(buf).digest("hex");
    const valid = checksum === backup.checksum;
    // deep integrity: try to decrypt+decompress+parse
    let parseOk = false, tableCount = 0;
    try { const dec = decrypt(buf, backup.encrypted); const json = backup.compressed ? await gunzip(dec) : dec; const m = JSON.parse(json.toString()); parseOk = true; tableCount = Object.keys(m.tables || {}).length; } catch {}
    const message = valid && parseOk ? `Valid · ${tableCount} tables readable` : !valid ? "Checksum mismatch — artifact corrupted" : "Checksum ok but artifact unreadable";
    await s.from("backups").update({ valid: valid && parseOk, validation_message: message }).eq("id", backupId);
    await log(s, { backup_id: backupId, event: "validate", status: valid && parseOk ? "ok" : "error", detail: message });
    return { ok: valid && parseOk, checksumValid: valid, parseOk, message };
  } catch (e) { return { ok: false, message: e.message }; }
}

export async function runRestore({ restoreId, backupId, mode = "merge", scope }) {
  const s = svc();
  const started = Date.now();
  const { data: backup } = await s.from("backups").select("*").eq("id", backupId).single();
  if (!backup?.storage_path) { await s.from("backup_restores").update({ status: "failed", error: "No artifact" }).eq("id", restoreId); return { ok: false, error: "No artifact" }; }
  try {
    const buf = await fetchArtifact(s, backup);
    const checksum = crypto.createHash("sha256").update(buf).digest("hex");
    if (backup.checksum && checksum !== backup.checksum) throw new Error("Checksum mismatch — refusing to restore corrupted backup");
    const dec = decrypt(buf, backup.encrypted);
    const json = backup.compressed ? await gunzip(dec) : dec;
    const manifest = JSON.parse(json.toString());
    const wanted = scope && scope.length ? [...new Set(scope.flatMap(x => BACKUP_GROUPS[x] || [x]))].filter(t => manifest.tables[t]) : Object.keys(manifest.tables);
    let rows = 0, tables = 0;
    for (const t of wanted) {
      const data = manifest.tables[t]; if (!data || !data.length) continue;
      if (mode === "replace") { try { await s.from(t).delete().not("id", "is", null); } catch {} }
      // chunked upsert on primary key id
      for (let i = 0; i < data.length; i += 500) {
        const chunk = data.slice(i, i + 500);
        const { error } = await s.from(t).upsert(chunk, { onConflict: "id" });
        if (!error) rows += chunk.length;
      }
      tables++;
    }
    const duration = Date.now() - started;
    await s.from("backup_restores").update({ status: "success", rows_restored: rows, tables_restored: tables, finished_at: new Date().toISOString(), duration_ms: duration }).eq("id", restoreId);
    await log(s, { restore_id: restoreId, backup_id: backupId, event: "restore", status: "ok", detail: `${tables} tables, ${rows} rows, mode=${mode}` });
    return { ok: true, rows, tables };
  } catch (e) {
    await s.from("backup_restores").update({ status: "failed", error: e.message, finished_at: new Date().toISOString(), duration_ms: Date.now() - started }).eq("id", restoreId);
    await log(s, { restore_id: restoreId, backup_id: backupId, event: "restore", status: "error", detail: e.message });
    return { ok: false, error: e.message };
  }
}

// Preview: read the manifest and report what a restore would touch.
export async function previewBackup(backupId) {
  const s = svc();
  const { data: backup } = await s.from("backups").select("*").eq("id", backupId).single();
  if (!backup?.storage_path) return { error: "No artifact" };
  try {
    const buf = await fetchArtifact(s, backup);
    const dec = decrypt(buf, backup.encrypted);
    const json = backup.compressed ? await gunzip(dec) : dec;
    const manifest = JSON.parse(json.toString());
    const tables = Object.entries(manifest.tables).map(([name, rows]) => ({ name, rows: rows.length }));
    return { backup_date: backup.created_at, table_count: tables.length, row_count: tables.reduce((a, t) => a + t.rows, 0), tables };
  } catch (e) { return { error: e.message }; }
}
