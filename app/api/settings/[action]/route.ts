// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { REGISTRY, defaultFor } from "@/lib/settings/registry";
import { invalidateSettingsCache } from "@/lib/settings/get";
import { logAudit } from "@/lib/audit/log";
import { logActivity } from "@/lib/activity/log";

function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
function ipOf(r) { return r.headers.get("x-forwarded-for")?.split(",")[0] || null; }

export async function GET(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("settings.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const sp = request.nextUrl.searchParams;

  try {
    if (action === "groups" || action === "all") {
      const [{ data: groups }, { data: values }, { data: flags }] = await Promise.all([
        s.from("setting_groups").select("*").order("sort_order"),
        s.from("system_settings").select("key, value, updated_at"),
        s.from("feature_flags").select("*").order("label"),
      ]);
      const byKey = Object.fromEntries((values || []).map(v => [v.key, v.value]));
      // merge registry with stored values (defaults fill gaps)
      const model = (groups || []).map(g => ({
        ...g,
        fields: (REGISTRY[g.id] || []).map(([key, label, type, def, options]) => ({
          key, label, type, options: options || null,
          value: byKey[`${g.id}.${key}`] !== undefined ? byKey[`${g.id}.${key}`] : def,
        })),
      }));
      return Response.json({ groups: model, flags: flags || [] });
    }

    if (action === "history") {
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10)); const size = 40; const from = (page - 1) * size;
      const { data, count } = await s.from("setting_history").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + size - 1);
      return Response.json({ history: data || [], total: count || 0, page, pageSize: size });
    }

    if (action === "versions") { const { data } = await s.from("setting_versions").select("id, label, created_by_name, created_at").order("created_at", { ascending: false }).limit(50); return Response.json({ versions: data || [] }); }

    if (action === "dashboard") {
      const [{ count: settingCount }, { data: flags }, { data: lastHist }, { data: lastBackup }, { data: health }, { data: groups }] = await Promise.all([
        s.from("system_settings").select("key", { count: "exact", head: true }),
        s.from("feature_flags").select("enabled"),
        s.from("setting_history").select("created_at, actor_name").order("created_at", { ascending: false }).limit(1),
        s.from("backups").select("created_at, status").eq("status", "success").order("created_at", { ascending: false }).limit(1),
        s.from("system_health").select("service, status"),
        s.from("setting_groups").select("id"),
      ]);
      const H = health || []; const SCORE = { healthy: 100, warning: 60, critical: 10, down: 0, unknown: 70 };
      const healthScore = H.length ? Math.round(H.reduce((a, h) => a + (SCORE[h.status] ?? 70), 0) / H.length) : 100;
      const { data: secAlerts } = await s.from("security_alerts").select("id", { count: "exact", head: true }).eq("status", "open");
      return Response.json({
        kpis: {
          version: (await getVal(s, "system.version")) || "1.0.0",
          environment: (await getVal(s, "system.environment")) || "production",
          storeMode: (await getVal(s, "store.store_mode")) || "production",
          maintenance: !!(await getVal(s, "system.maintenance")),
          totalSettings: settingCount || 0, activeGroups: (groups || []).length,
          enabledFeatures: (flags || []).filter(f => f.enabled).length, totalFeatures: (flags || []).length,
          lastUpdate: lastHist?.[0]?.created_at || null, lastUpdateBy: lastHist?.[0]?.actor_name || null,
          lastBackup: lastBackup?.[0]?.created_at || null,
          healthScore, configWarnings: (secAlerts?.count) || 0,
        },
      });
    }

    if (action === "export") {
      const { data: values } = await s.from("system_settings").select("key, value");
      const { data: flags } = await s.from("feature_flags").select("key, enabled");
      const snapshot = { exported_at: new Date().toISOString(), settings: Object.fromEntries((values || []).map(v => [v.key, v.value])), feature_flags: Object.fromEntries((flags || []).map(f => [f.key, f.enabled])) };
      if (sp.get("format") === "csv") {
        const header = "Key,Value\n";
        const body = Object.entries(snapshot.settings).map(([k, v]) => `"${k}","${JSON.stringify(v).replace(/"/g, '""')}"`).join("\n");
        return new Response(header + body, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="settings.csv"' } });
      }
      await logAudit({ actor: auth.profile, module: "settings", action: "settings_export", ip: ipOf(request) });
      return new Response(JSON.stringify(snapshot, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="settings.json"' } });
    }

    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

async function getVal(s, key) { const { data } = await s.from("system_settings").select("value").eq("key", key).maybeSingle(); return data?.value; }

export async function POST(request: NextRequest, { params }) {
  const { action } = await params;
  const permMap = { update: "settings.edit", "feature-flag": "settings.manage", reset: "settings.manage", restore: "settings.manage", "import": "settings.manage", backup: "settings.manage", version: "settings.manage" };
  const auth = await requirePermission(permMap[action] || "settings.edit");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const actor = auth.profile; const b = await request.json().catch(() => ({})); const ip = ipOf(request);

  try {
    if (action === "update") {
      // b.changes = { "general.store_name": "New", "checkout.min_order": 10 }
      const changes = b.changes || {}; const keys = Object.keys(changes);
      if (!keys.length) return Response.json({ ok: true, updated: 0 });
      // fetch current values for history
      const { data: current } = await s.from("system_settings").select("key, value").in("key", keys);
      const curMap = Object.fromEntries((current || []).map(c => [c.key, c.value]));
      const rows = keys.map(k => ({ key: k, group_id: k.split(".")[0], value: changes[k], updated_at: new Date().toISOString(), updated_by: actor.id }));
      const { error } = await s.from("system_settings").upsert(rows, { onConflict: "key" });
      if (error) return Response.json({ error: error.message }, { status: 500 });
      // history rows
      const hist = keys.map(k => ({ key: k, group_id: k.split(".")[0], old_value: curMap[k] ?? null, new_value: changes[k], actor_id: actor.id, actor_name: actor.full_name || actor.email, ip_address: ip }));
      await s.from("setting_history").insert(hist);
      invalidateSettingsCache();
      await logAudit({ actor, module: "settings", action: "settings_update", description: keys.join(", ").slice(0, 200), level: "information", ip });
      await logActivity({ actor, module: "settings", activity_type: "system", action: "settings_updated", description: `${keys.length} setting(s) updated`, status: "success" });
      return Response.json({ ok: true, updated: keys.length });
    }

    if (action === "feature-flag") {
      const { data: cur } = await s.from("feature_flags").select("enabled").eq("key", b.key).single();
      await s.from("feature_flags").update({ enabled: !!b.enabled, rollout: b.rollout ?? 100, updated_at: new Date().toISOString(), updated_by: actor.id }).eq("key", b.key);
      await s.from("setting_history").insert({ key: `feature.${b.key}`, group_id: "features", old_value: cur?.enabled, new_value: b.enabled, actor_id: actor.id, actor_name: actor.full_name || actor.email, ip_address: ip });
      invalidateSettingsCache();
      await logAudit({ actor, module: "settings", submodule: "feature_flags", action: "feature_flag_toggle", description: `${b.key} → ${b.enabled}`, level: "warning", ip });
      return Response.json({ ok: true });
    }

    if (action === "reset") {
      // reset a whole group to registry defaults
      const group = b.group; if (!group || !REGISTRY[group]) return Response.json({ error: "Unknown group" }, { status: 400 });
      const rows = REGISTRY[group].map(([key, , , def]) => ({ key: `${group}.${key}`, group_id: group, value: def, updated_at: new Date().toISOString(), updated_by: actor.id }));
      await s.from("system_settings").upsert(rows, { onConflict: "key" });
      invalidateSettingsCache();
      await logAudit({ actor, module: "settings", action: "settings_reset", description: group, level: "warning", ip });
      return Response.json({ ok: true, reset: rows.length });
    }

    if (action === "backup" || action === "version") {
      const { data: values } = await s.from("system_settings").select("key, value");
      const { data: flags } = await s.from("feature_flags").select("key, enabled");
      const snapshot = { settings: Object.fromEntries((values || []).map(v => [v.key, v.value])), feature_flags: Object.fromEntries((flags || []).map(f => [f.key, f.enabled])) };
      await s.from("setting_versions").insert({ label: b.label || `Snapshot ${new Date().toISOString().slice(0, 16)}`, snapshot, created_by: actor.id, created_by_name: actor.full_name || actor.email });
      await logAudit({ actor, module: "settings", action: "settings_backup", ip });
      return Response.json({ ok: true });
    }

    if (action === "restore" || action === "import") {
      const snapshot = b.snapshot || (b.version_id ? (await s.from("setting_versions").select("snapshot").eq("id", b.version_id).single()).data?.snapshot : null);
      if (!snapshot?.settings) return Response.json({ error: "No snapshot provided" }, { status: 400 });
      const rows = Object.entries(snapshot.settings).map(([key, value]) => ({ key, group_id: key.split(".")[0], value, updated_at: new Date().toISOString(), updated_by: actor.id }));
      if (rows.length) await s.from("system_settings").upsert(rows, { onConflict: "key" });
      if (snapshot.feature_flags) for (const [key, enabled] of Object.entries(snapshot.feature_flags)) await s.from("feature_flags").update({ enabled: !!enabled }).eq("key", key);
      invalidateSettingsCache();
      await logAudit({ actor, module: "settings", action: action === "import" ? "settings_import" : "settings_restore", description: `${rows.length} settings`, level: "warning", ip });
      await logActivity({ actor, module: "settings", activity_type: "system", action: action === "import" ? "settings_imported" : "settings_restored", description: `${rows.length} settings applied`, status: "success", priority: "medium" });
      return Response.json({ ok: true, applied: rows.length });
    }

    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
