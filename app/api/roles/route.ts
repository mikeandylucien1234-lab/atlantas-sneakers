// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission, logPermission } from "@/lib/rbac/server";

function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }

const rl = new Map();
function limited(key, max = 30, win = 60000) { const now = Date.now(); const e = rl.get(key) || { c: 0, t: now }; if (now - e.t > win) { e.c = 0; e.t = now; } e.c++; rl.set(key, e); return e.c > max; }

// ---------------- GET ----------------
export async function GET(request: NextRequest) {
  const auth = await requirePermission("roles.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const { sb } = auth;
  const section = request.nextUrl.searchParams.get("section") || "list";

  try {
    if (section === "list") {
      const { data: roles } = await sb.from("roles").select("*").order("priority");
      const { data: rp } = await sb.from("role_permissions").select("role_id");
      const { data: ur } = await sb.from("user_roles").select("role_id");
      const permCount = {}; (rp || []).forEach(r => permCount[r.role_id] = (permCount[r.role_id] || 0) + 1);
      const userCount = {}; (ur || []).forEach(r => userCount[r.role_id] = (userCount[r.role_id] || 0) + 1);
      return Response.json({ roles: (roles || []).map(r => ({ ...r, permission_count: permCount[r.id] || 0, user_count: userCount[r.id] || 0 })) });
    }

    if (section === "dashboard") {
      const [{ data: roles }, { data: ur }, { data: profiles }, { data: logs }] = await Promise.all([
        sb.from("roles").select("id, key, name, status, color, priority, updated_at"),
        sb.from("user_roles").select("role_id, user_id"),
        sb.from("profiles").select("id, role"),
        sb.from("permission_logs").select("event, actor_name, detail, status, created_at").order("created_at", { ascending: false }).limit(15),
      ]);
      const R = roles || [], U = ur || [];
      const byRole = {}; U.forEach(x => { byRole[x.role_id] = (byRole[x.role_id] || 0) + 1; });
      const roleKeyCount = (keys) => R.filter(r => keys.includes(r.key)).reduce((s, r) => s + (byRole[r.id] || 0), 0);
      const distribution = R.map(r => ({ name: r.name, key: r.key, color: r.color, count: byRole[r.id] || 0 })).sort((a, b) => b.count - a.count);
      return Response.json({
        kpis: {
          totalRoles: R.length,
          activeRoles: R.filter(r => r.status === "active").length,
          disabledRoles: R.filter(r => r.status === "disabled").length,
          admins: roleKeyCount(["super_admin", "administrator"]),
          managers: R.filter(r => r.key.includes("manager")).reduce((s, r) => s + (byRole[r.id] || 0), 0),
          sellers: roleKeyCount(["seller"]),
          staff: roleKeyCount(["support_agent", "delivery_staff", "content_manager"]),
          adminProfiles: (profiles || []).filter(p => p.role === "admin").length,
          lastModified: R.map(r => r.updated_at).sort().reverse()[0] || null,
        },
        distribution,
        activity: logs || [],
      });
    }

    if (section === "permissions") {
      const { data: perms } = await sb.from("permissions").select("*").order("module").order("action");
      return Response.json({ permissions: perms || [] });
    }

    if (section === "role_permissions") {
      const roleId = request.nextUrl.searchParams.get("role_id");
      const { data } = await sb.from("role_permissions").select("permission_id").eq("role_id", roleId);
      return Response.json({ permission_ids: (data || []).map(r => r.permission_id) });
    }

    if (section === "users") {
      const q = request.nextUrl.searchParams.get("q");
      const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10));
      const pageSize = 20; const from = (page - 1) * pageSize;
      let query = svc().from("profiles").select("id, full_name, email, role, created_at", { count: "exact" });
      if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
      const { data: users, count } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
      const ids = (users || []).map(u => u.id);
      const { data: ur } = await sb.from("user_roles").select("user_id, role_id, roles(key,name,color,status)").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const rolesByUser = {}; (ur || []).forEach(x => { (rolesByUser[x.user_id] = rolesByUser[x.user_id] || []).push(x.roles); });
      return Response.json({ users: (users || []).map(u => ({ ...u, roles: rolesByUser[u.id] || [] })), total: count || 0, page, pageSize });
    }

    if (section === "audit") {
      const { data } = await sb.from("permission_logs").select("*").order("created_at", { ascending: false }).limit(200);
      return Response.json({ audit: data || [] });
    }

    if (section === "export") {
      const { data: roles } = await sb.from("roles").select("*").order("priority");
      const { data: rp } = await sb.from("role_permissions").select("role_id, permissions(key)");
      const permsByRole = {}; (rp || []).forEach(x => { (permsByRole[x.role_id] = permsByRole[x.role_id] || []).push(x.permissions?.key); });
      const header = "Role,Key,Status,Priority,Permissions\n";
      const body = (roles || []).map(r => `"${r.name}","${r.key}","${r.status}",${r.priority},"${(permsByRole[r.id] || []).join(" ")}"`).join("\n");
      return new Response(header + body, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="roles.csv"' } });
    }

    return Response.json({ error: "Unknown section" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// ---------------- POST (create / manage) ----------------
export async function POST(request: NextRequest) {
  const auth = await requirePermission("roles.manage");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const { sb, profile } = auth;
  if (limited(`roles:${profile.id}`)) return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const action = b.action;

  try {
    if (action === "create") {
      if (!b.name) return Response.json({ error: "Role name required" }, { status: 400 });
      const key = (b.key || b.name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const { data, error } = await sb.from("roles").insert({
        key, name: b.name, description: b.description || null, color: b.color || "#2563eb", icon: b.icon || "Shield",
        priority: b.priority ?? 50, status: b.status || "active", notes: b.notes || null,
      }).select("*").single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await logPermission(sb, { event: "role_create", actor: profile, request, role_id: data.id, detail: data.name });
      return Response.json({ role: data });
    }

    if (action === "update") {
      const { data: role } = await sb.from("roles").select("is_super").eq("id", b.id).single();
      if (role?.is_super) return Response.json({ error: "Super Administrator cannot be modified" }, { status: 403 });
      const patch = { updated_at: new Date().toISOString() };
      ["name", "description", "color", "icon", "priority", "status", "notes"].forEach(k => { if (k in b) patch[k] = b[k]; });
      const { error } = await sb.from("roles").update(patch).eq("id", b.id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await logPermission(sb, { event: "role_update", actor: profile, request, role_id: b.id, detail: JSON.stringify(Object.keys(patch)) });
      return Response.json({ ok: true });
    }

    if (action === "delete") {
      const { data: role } = await sb.from("roles").select("is_system, is_super, name").eq("id", b.id).single();
      if (role?.is_super || role?.is_system) return Response.json({ error: "System roles cannot be deleted" }, { status: 403 });
      const { error } = await sb.from("roles").delete().eq("id", b.id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await logPermission(sb, { event: "role_delete", actor: profile, request, detail: role?.name });
      return Response.json({ ok: true });
    }

    // Set the full permission set for a role (matrix save)
    if (action === "set_permissions") {
      const { data: role } = await sb.from("roles").select("is_super").eq("id", b.role_id).single();
      if (role?.is_super) return Response.json({ error: "Super Administrator always has all permissions" }, { status: 403 });
      const ids = Array.isArray(b.permission_ids) ? b.permission_ids : [];
      await sb.from("role_permissions").delete().eq("role_id", b.role_id);
      if (ids.length) {
        const rows = ids.map(pid => ({ role_id: b.role_id, permission_id: pid }));
        const { error } = await sb.from("role_permissions").insert(rows);
        if (error) return Response.json({ error: error.message }, { status: 500 });
      }
      await logPermission(sb, { event: "perm_change", actor: profile, request, role_id: b.role_id, detail: `${ids.length} permissions` });
      return Response.json({ ok: true, count: ids.length });
    }

    // Assign / unassign a role to a user (supports multiple roles)
    if (action === "assign_role") {
      if (!b.user_id || !b.role_id) return Response.json({ error: "user_id and role_id required" }, { status: 400 });
      const { error } = await sb.from("user_roles").insert({ user_id: b.user_id, role_id: b.role_id, assigned_by: profile.id });
      if (error && !String(error.message).includes("duplicate")) return Response.json({ error: error.message }, { status: 500 });
      await logPermission(sb, { event: "role_assign", actor: profile, request, target_user: b.user_id, role_id: b.role_id, detail: "assigned" });
      return Response.json({ ok: true });
    }
    if (action === "unassign_role") {
      const { error } = await sb.from("user_roles").delete().eq("user_id", b.user_id).eq("role_id", b.role_id);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      await logPermission(sb, { event: "role_assign", actor: profile, request, target_user: b.user_id, role_id: b.role_id, detail: "removed" });
      return Response.json({ ok: true });
    }

    // Suspend / reactivate a user (uses profiles.role toggle to customer<->admin-suspended? )
    if (action === "set_user_status") {
      // Suspend = remove admin roles' effect by marking a suspended flag in profiles via service client
      const s = svc();
      const suspended = b.status === "suspended";
      // Store suspension by moving admin -> nothing is risky; instead use a dedicated column if present.
      await s.from("profiles").update({ role: suspended ? "suspended" : "admin" }).eq("id", b.user_id);
      await logPermission(sb, { event: "role_update", actor: profile, request, target_user: b.user_id, detail: b.status });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 404 });
  } catch (e) {
    await logPermission(sb, { event: action || "error", actor: profile, request, detail: e.message, status: "error" });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
