// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { runBackup, runRestore, validateBackup, previewBackup, tablesFor, BACKUP_GROUPS } from "@/lib/backup/engine";
import { logAudit } from "@/lib/audit/log";
import { logActivity } from "@/lib/activity/log";

const DAY = 24 * 3600 * 1000;
function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
function ipOf(r) { return r.headers.get("x-forwarded-for")?.split(",")[0] || null; }
function fmtBytes(n) { n = Number(n) || 0; const u = ["B", "KB", "MB", "GB"]; let i = 0; while (n >= 1024 && i < 3) { n /= 1024; i++; } return `${n.toFixed(1)} ${u[i]}`; }
async function notify(s, title, message, priority = "normal") { try { await s.from("security_alerts").insert({ severity: priority === "high" ? "medium" : "low", type: "backup", title, message }); } catch {} }

export async function GET(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("backup.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const sp = request.nextUrl.searchParams;

  try {
    if (action === "dashboard") {
      const [{ data: backups }, { data: restores }, { data: jobs }, { data: ret }] = await Promise.all([
        s.from("backups").select("status, backup_type, size_bytes, uncompressed_bytes, row_count, duration_ms, valid, created_at, finished_at").order("created_at", { ascending: false }).limit(2000),
        s.from("backup_restores").select("status, duration_ms, created_at").order("created_at", { ascending: false }).limit(500),
        s.from("backup_jobs").select("id, enabled"),
        s.from("backup_retention").select("*").eq("id", "global").single(),
      ]);
      const B = backups || [], R = restores || [];
      const ok = B.filter(b => b.status === "success");
      const storageUsed = ok.reduce((a, b) => a + (b.size_bytes || 0), 0);
      const avg = (arr, k) => arr.length ? Math.round(arr.reduce((a, x) => a + (x[k] || 0), 0) / arr.length) : 0;
      const quota = 5 * 1024 * 1024 * 1024; // 5GB soft display quota
      const validCount = ok.filter(b => b.valid).length;
      const health = ok.length ? Math.round((validCount / ok.length) * 100 * (B.filter(b => b.status === "failed").length === 0 ? 1 : 0.85)) : 100;
      const days = {}; for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10); days[d] = { date: d, success: 0, failed: 0, bytes: 0 }; }
      B.forEach(b => { const d = (b.created_at || "").slice(0, 10); if (days[d]) { if (b.status === "success") { days[d].success++; days[d].bytes += b.size_bytes || 0; } else if (b.status === "failed") days[d].failed++; } });
      return Response.json({
        kpis: {
          total: B.length, successful: ok.length, failed: B.filter(b => b.status === "failed").length,
          scheduled: (jobs || []).filter(j => j.enabled).length, running: B.filter(b => b.status === "running").length,
          storageUsed, storageUsedH: fmtBytes(storageUsed), storageRemaining: Math.max(0, quota - storageUsed), storageRemainingH: fmtBytes(Math.max(0, quota - storageUsed)),
          lastBackup: B.find(b => b.status === "success")?.finished_at || null, lastRestore: R.find(r => r.status === "success")?.created_at || null,
          avgBackupMs: avg(ok, "duration_ms"), avgRestoreMs: avg(R.filter(r => r.status === "success"), "duration_ms"),
          databaseSize: ok.reduce((a, b) => a + (b.uncompressed_bytes || 0), 0), databaseSizeH: fmtBytes(ok.reduce((a, b) => a + (b.uncompressed_bytes || 0), 0)),
          totalRows: ok.reduce((a, b) => a + (b.row_count || 0), 0), healthScore: health,
          retentionDays: ret?.retention_days || 90,
        },
        series: Object.values(days),
      });
    }

    if (action === "history" || action === "list") {
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10)); const size = 25; const from = (page - 1) * size;
      let q = s.from("backups").select("*", { count: "exact" }).order("created_at", { ascending: false });
      const type = sp.get("type"); if (type && type !== "all") q = q.eq("backup_type", type);
      const status = sp.get("status"); if (status && status !== "all") q = q.eq("status", status);
      const search = sp.get("q"); if (search) q = q.ilike("name", `%${search}%`);
      const { data, count } = await q.range(from, from + size - 1);
      return Response.json({ backups: (data || []).map(b => ({ ...b, size_h: fmtBytes(b.size_bytes) })), total: count || 0, page, pageSize: size });
    }

    if (action === "detail") {
      const id = sp.get("id");
      const { data: backup } = await s.from("backups").select("*").eq("id", id).single();
      if (!backup) return Response.json({ error: "Not found" }, { status: 404 });
      const { data: logs } = await s.from("backup_logs").select("*").eq("backup_id", id).order("created_at", { ascending: false });
      return Response.json({ backup: { ...backup, size_h: fmtBytes(backup.size_bytes) }, logs: logs || [] });
    }

    if (action === "preview") return Response.json(await previewBackup(sp.get("id")));

    if (action === "download") {
      const id = sp.get("id"); const { data: backup } = await s.from("backups").select("storage_path").eq("id", id).single();
      if (!backup?.storage_path) return Response.json({ error: "No artifact" }, { status: 404 });
      const { data, error } = await s.storage.from("backups").createSignedUrl(backup.storage_path, 300);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await logAudit({ actor: auth.profile, module: "backup", action: "download", description: id, level: "warning", ip: ipOf(request) });
      return Response.json({ url: data.signedUrl });
    }

    if (action === "settings") {
      const [{ data: ret }, { data: dests }, { data: jobs }] = await Promise.all([
        s.from("backup_retention").select("*").eq("id", "global").single(),
        s.from("backup_destinations").select("*").order("created_at"),
        s.from("backup_jobs").select("*").order("created_at", { ascending: false }),
      ]);
      const destsWithEnv = (dests || []).map(d => ({ ...d, configured: (d.env_keys || []).length === 0 || (d.env_keys || []).every(k => !!process.env[k]) }));
      return Response.json({ retention: ret, destinations: destsWithEnv, jobs: jobs || [], groups: Object.keys(BACKUP_GROUPS), encryption_configured: !!process.env.BACKUP_ENCRYPTION_KEY });
    }

    if (action === "restores") {
      const { data } = await s.from("backup_restores").select("*").order("created_at", { ascending: false }).limit(100);
      const ok = (data || []).filter(r => r.status === "success").length;
      return Response.json({ restores: data || [], successRate: (data || []).length ? Math.round(ok / data.length * 100) : 100 });
    }

    if (action === "export") {
      const { data } = await s.from("backups").select("name, backup_type, status, size_bytes, checksum, encrypted, created_at, created_by_name").order("created_at", { ascending: false });
      const rows = data || [];
      if (sp.get("format") === "json") return new Response(JSON.stringify(rows, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="backups.json"' } });
      const header = "Name,Type,Status,Size,Checksum,Encrypted,Created,By\n";
      const body = rows.map(r => `"${r.name}","${r.backup_type}","${r.status}","${fmtBytes(r.size_bytes)}","${r.checksum || ""}","${r.encrypted}","${r.created_at}","${r.created_by_name || ""}"`).join("\n");
      return new Response(header + body, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="backups.csv"' } });
    }

    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }) {
  const { action } = await params;
  const permMap = { create: "backup.create", restore: "backup.manage", delete: "backup.delete", settings: "backup.settings", validate: "backup.view", cleanup: "backup.delete" };
  const auth = await requirePermission(permMap[action] || "backup.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const actor = auth.profile; const b = await request.json().catch(() => ({})); const ip = ipOf(request);

  try {
    if (action === "create") {
      const type = b.backup_type || "database";
      const tables = tablesFor(type, b.scope);
      const name = b.name || `${type}-${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
      const { data: rec } = await s.from("backups").insert({ name, backup_type: type, status: "running", destination: b.destination || "supabase_storage", encrypted: !!b.encrypt, compressed: b.compress !== false, created_by: actor.id, created_by_name: actor.full_name || actor.email }).select("id").single();
      const res = await runBackup({ id: rec.id, type, scope: b.scope, compress: b.compress !== false, encrypt: !!b.encrypt && !!process.env.BACKUP_ENCRYPTION_KEY });
      await logAudit({ actor, module: "backup", action: "backup_create", description: `${name} (${res.ok ? "success" : "failed"})`, entity_id: rec.id, level: res.ok ? "information" : "error", ip });
      await logActivity({ actor, module: "settings", activity_type: "system", action: "backup_created", description: `Backup "${name}" ${res.ok ? "completed" : "failed"}`, status: res.ok ? "success" : "failed", priority: res.ok ? "low" : "high" });
      await notify(s, res.ok ? "Backup successful" : "Backup failed", `${name}: ${res.ok ? `${res.tableCount} tables, ${res.rowCount} rows` : res.error}`, res.ok ? "normal" : "high");
      return Response.json({ ok: res.ok, id: rec.id, ...res });
    }

    if (action === "validate") {
      const res = await validateBackup(b.id);
      await logAudit({ actor, module: "backup", action: "backup_validate", description: `${b.id}: ${res.message}`, entity_id: b.id, ip });
      if (!res.ok) await notify(s, "Corrupted backup detected", `${b.id}: ${res.message}`, "high");
      return Response.json(res);
    }

    if (action === "restore") {
      if (!b.backup_id) return Response.json({ error: "backup_id required" }, { status: 400 });
      const { data: rec } = await s.from("backup_restores").insert({ backup_id: b.backup_id, mode: b.mode || "merge", scope: b.scope || [], status: "running", created_by: actor.id, created_by_name: actor.full_name || actor.email }).select("id").single();
      const res = await runRestore({ restoreId: rec.id, backupId: b.backup_id, mode: b.mode || "merge", scope: b.scope });
      await logAudit({ actor, module: "backup", action: "backup_restore", description: `backup ${b.backup_id} mode=${b.mode || "merge"} (${res.ok ? "success" : "failed"})`, entity_id: b.backup_id, level: "critical", ip });
      await logActivity({ actor, module: "settings", activity_type: "system", action: "backup_restored", description: res.ok ? `Restored ${res.tables} tables, ${res.rows} rows` : `Restore failed: ${res.error}`, status: res.ok ? "success" : "failed", priority: "high" });
      await notify(s, res.ok ? "Restore successful" : "Restore failed", res.ok ? `${res.tables} tables, ${res.rows} rows restored` : res.error, "high");
      return Response.json({ ok: res.ok, restore_id: rec.id, ...res });
    }

    if (action === "delete") {
      const { data: backup } = await s.from("backups").select("storage_path").eq("id", b.id).single();
      if (backup?.storage_path) await s.storage.from("backups").remove([backup.storage_path]);
      await s.from("backups").delete().eq("id", b.id);
      await logAudit({ actor, module: "backup", action: "backup_delete", description: b.id, entity_id: b.id, level: "critical", ip });
      return Response.json({ ok: true });
    }

    if (action === "settings") {
      if (b.retention) { await s.from("backup_retention").update({ retention_days: b.retention.retention_days, auto_cleanup: b.retention.auto_cleanup, keep_min: b.retention.keep_min ?? 5, updated_at: new Date().toISOString(), updated_by: actor.id }).eq("id", "global"); }
      if (b.job) {
        if (b.job.id) await s.from("backup_jobs").update({ name: b.job.name, backup_type: b.job.backup_type, schedule: b.job.schedule, cron_expression: b.job.cron_expression, enabled: b.job.enabled, encrypt: b.job.encrypt, compress: b.job.compress }).eq("id", b.job.id);
        else await s.from("backup_jobs").insert({ ...b.job, created_by: actor.id });
      }
      if (b.deleteJob) await s.from("backup_jobs").delete().eq("id", b.deleteJob);
      await logAudit({ actor, module: "backup", action: "backup_settings", description: "updated", ip });
      return Response.json({ ok: true });
    }

    if (action === "cleanup") {
      // Retention cleanup — deletes success backups older than retention (keeps keep_min newest).
      const { data: ret } = await s.from("backup_retention").select("*").eq("id", "global").single();
      if (!ret || ret.retention_days === 0) return Response.json({ ok: true, removed: 0 });
      const cutoff = new Date(Date.now() - ret.retention_days * DAY).toISOString();
      const { data: old } = await s.from("backups").select("id, storage_path, created_at").lt("created_at", cutoff).order("created_at", { ascending: false });
      const { data: keep } = await s.from("backups").select("id").order("created_at", { ascending: false }).limit(ret.keep_min || 5);
      const keepIds = new Set((keep || []).map(k => k.id));
      let removed = 0;
      for (const bk of (old || [])) { if (keepIds.has(bk.id)) continue; if (bk.storage_path) await s.storage.from("backups").remove([bk.storage_path]); await s.from("backups").delete().eq("id", bk.id); removed++; }
      await logAudit({ actor, module: "backup", action: "backup_cleanup", description: `${removed} removed`, level: "warning", ip });
      return Response.json({ ok: true, removed });
    }

    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
