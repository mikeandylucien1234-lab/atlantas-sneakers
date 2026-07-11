// @ts-nocheck
import { createClient as createAnon } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { requirePermission, logPermission } from "@/lib/rbac/server";

function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }

// GET /api/user-roles — users with their assigned roles
export async function GET(request: NextRequest) {
  const auth = await requirePermission("users.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const { sb } = auth;
  const { data: users } = await svc().from("profiles").select("id, full_name, email, role, created_at").order("created_at", { ascending: false }).limit(500);
  const ids = (users || []).map(u => u.id);
  const { data: ur } = await sb.from("user_roles").select("user_id, role_id, roles(key,name,color,status)").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const byUser = {}; (ur || []).forEach(x => { (byUser[x.user_id] = byUser[x.user_id] || []).push(x.roles); });
  return Response.json({ users: (users || []).map(u => ({ ...u, roles: byUser[u.id] || [] })) });
}

// PUT /api/user-roles — assign/unassign { user_id, role_id, op: 'assign'|'unassign' }
export async function PUT(request: NextRequest) {
  const auth = await requirePermission("users.edit");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const { sb, profile } = auth;
  const b = await request.json().catch(() => ({}));
  if (!b.user_id || !b.role_id) return Response.json({ error: "user_id and role_id required" }, { status: 400 });
  if (b.op === "unassign") { await sb.from("user_roles").delete().eq("user_id", b.user_id).eq("role_id", b.role_id); }
  else { const { error } = await sb.from("user_roles").insert({ user_id: b.user_id, role_id: b.role_id, assigned_by: profile.id }); if (error && !String(error.message).includes("duplicate")) return Response.json({ error: error.message }, { status: 500 }); }
  await logPermission(sb, { event: "role_assign", actor: profile, request, target_user: b.user_id, role_id: b.role_id, detail: b.op || "assign" });
  return Response.json({ ok: true });
}
