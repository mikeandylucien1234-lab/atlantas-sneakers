// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { logAudit } from "@/lib/audit/log";

const DAY = 24 * 3600 * 1000;
function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }

function applyFilters(q, sp) {
  const module = sp.get("module"); if (module && module !== "all") q = q.eq("module", module);
  const level = sp.get("level"); if (level && level !== "all") q = q.eq("level", level);
  const result = sp.get("result"); if (result && result !== "all") q = q.eq("result", result);
  const risk = sp.get("risk"); if (risk && risk !== "all") q = q.eq("risk_level", risk);
  const source = sp.get("source"); if (source && source !== "all") q = q.eq("source", source);
  const country = sp.get("country"); if (country) q = q.ilike("country", `%${country}%`);
  const from = sp.get("from"); if (from) q = q.gte("created_at", from);
  const to = sp.get("to"); if (to) q = q.lte("created_at", to);
  const search = sp.get("q"); if (search) q = q.or(`actor_name.ilike.%${search}%,action.ilike.%${search}%,description.ilike.%${search}%,ip_address.ilike.%${search}%`);
  return q;
}

export async function GET(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("audit.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const sp = request.nextUrl.searchParams;

  try {
    if (action === "dashboard" || action === "statistics") {
      const now = Date.now();
      const monthAgo = new Date(now - 30 * DAY).toISOString();
      const { data } = await s.from("audit_stream").select("source, module, level, result, actor_id, risk_level, created_at").gte("created_at", monthAgo).limit(20000);
      const E = data || [];
      const since = (ms) => E.filter(x => x.created_at >= new Date(now - ms).toISOString());
      const cntModule = (m) => E.filter(x => x.module === m).length;
      const cntLevel = (l) => E.filter(x => x.level === l).length;
      // 14-day timeline + heatmap
      const days = {}; for (let i = 13; i >= 0; i--) { const d = new Date(now - i * DAY).toISOString().slice(0, 10); days[d] = { date: d, total: 0, errors: 0 }; }
      const heat = {}; for (let dd = 0; dd < 7; dd++) for (let h = 0; h < 24; h++) heat[`${dd}-${h}`] = 0;
      const bySource = {}; const byModule = {};
      E.forEach(x => {
        const d = (x.created_at || "").slice(0, 10); if (days[d]) { days[d].total++; if (x.level === "error" || x.level === "critical") days[d].errors++; }
        const dt = new Date(x.created_at); const hk = `${dt.getDay()}-${dt.getHours()}`; if (heat[hk] != null) heat[hk]++;
        bySource[x.source] = (bySource[x.source] || 0) + 1;
        byModule[x.module] = (byModule[x.module] || 0) + 1;
      });
      return Response.json({
        kpis: {
          today: since(DAY).length, week: since(7 * DAY).length, month: E.length,
          activeUsers: new Set(E.map(x => x.actor_id).filter(Boolean)).size,
          adminActions: E.filter(x => ["roles", "staff", "security", "settings", "payments"].includes(x.module)).length,
          failed: E.filter(x => ["error", "critical"].includes(x.level) || ["failed", "denied", "blocked"].includes(x.result)).length,
          security: cntModule("security") + E.filter(x => x.risk_level === "high" || x.risk_level === "critical").length,
          payments: cntModule("payments"), products: cntModule("products"), orders: cntModule("orders"),
          apiCalls: bySource["analytics"] || 0,
          critical: cntLevel("critical"), warning: cntLevel("warning"), info: cntLevel("information"), success: cntLevel("success"),
        },
        series: Object.values(days), heatmap: heat,
        bySource: Object.entries(bySource).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        byModule: Object.entries(byModule).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12),
        recent: E.slice(0, 12),
      });
    }

    if (action === "list" || action === "live") {
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
      const size = action === "live" ? 25 : Math.min(50, parseInt(sp.get("pageSize") || "30", 10));
      const from = (page - 1) * size;
      let q = s.from("audit_stream").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (action === "live") q = q.gte("created_at", sp.get("since") || new Date(Date.now() - 5 * 60000).toISOString());
      else q = applyFilters(q, sp).range(from, from + size - 1);
      const { data, count } = await q;
      return Response.json({ events: data || [], total: count || 0, page, pageSize: size });
    }

    if (action === "detail") {
      const id = sp.get("id");
      const { data } = await s.from("audit_stream").select("*").eq("id", id).maybeSingle();
      if (!data) return Response.json({ error: "Not found" }, { status: 404 });
      // sibling events for the same actor (context)
      const { data: context } = await s.from("audit_stream").select("id, action, module, level, result, created_at").eq("actor_id", data.actor_id).order("created_at", { ascending: false }).limit(10);
      return Response.json({ event: data, context: context || [] });
    }

    if (action === "export") {
      const fmt = sp.get("format") || "csv";
      let q = s.from("audit_stream").select("created_at, source, module, action, description, level, result, actor_name, ip_address, country, risk_level").order("created_at", { ascending: false }).limit(20000);
      q = applyFilters(q, sp);
      const { data } = await q; const rows = data || [];
      // mass-export alert
      if (rows.length > 1000) { await s.from("security_alerts").insert({ severity: "medium", type: "mass_export", title: "Large audit export", message: `${rows.length} audit rows exported`, actor_id: auth.profile.id }).then(() => {}, () => {}); await logAudit({ actor: auth.profile, module: "audit", action: "export", description: `${rows.length} rows`, level: "warning" }); }
      if (fmt === "json") return new Response(JSON.stringify(rows, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="audit.json"' } });
      const header = "Date,Source,Module,Action,Description,Level,Result,Actor,IP,Country,Risk\n";
      const body = rows.map(r => [r.created_at, r.source, r.module, r.action, r.description, r.level, r.result, r.actor_name, r.ip_address, r.country, r.risk_level].map(v => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
      return new Response(header + body, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="audit.csv"' } });
    }

    if (action === "settings") {
      const { data } = await s.from("audit_settings").select("*").eq("id", "global").single();
      return Response.json({ settings: data || { id: "global", retention_days: 365 } });
    }

    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }) {
  const { action } = await params;
  const auth = await requirePermission("audit.settings");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const b = await request.json().catch(() => ({}));

  try {
    if (action === "settings") {
      const patch = { updated_at: new Date().toISOString(), updated_by: auth.profile.id };
      if ("retention_days" in b) patch.retention_days = parseInt(b.retention_days) || 0;
      if ("auto_purge" in b) patch.auto_purge = !!b.auto_purge;
      await s.from("audit_settings").update(patch).eq("id", "global");
      await logAudit({ actor: auth.profile, module: "audit", submodule: "settings", action: "update_retention", description: `retention=${patch.retention_days}d auto_purge=${patch.auto_purge}`, level: "warning", ip: request.headers.get("x-forwarded-for")?.split(",")[0] });
      return Response.json({ ok: true });
    }
    if (action === "purge") {
      // Retention purge — the only path allowed to delete audit_logs (DB-guarded).
      const { data, error } = await s.rpc("purge_audit_logs");
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await logAudit({ actor: auth.profile, module: "audit", action: "purge", description: `${data} rows purged by retention policy`, level: "warning" });
      return Response.json({ ok: true, purged: data });
    }
    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
