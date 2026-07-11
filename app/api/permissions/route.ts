// @ts-nocheck
import { NextRequest } from "next/server";
import { requirePermission, logPermission, getMyPermissions } from "@/lib/rbac/server";

// GET /api/permissions — full catalog (+ ?mine=1 for current user's merged keys)
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("mine")) {
    const auth = await requirePermission(null);
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    return Response.json({ permissions: await getMyPermissions(auth.sb) });
  }
  const auth = await requirePermission("roles.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const { data } = await auth.sb.from("permissions").select("*").order("module").order("action");
  return Response.json({ permissions: data || [] });
}

// PUT /api/permissions — set a role's permission set { role_id, permission_ids }
export async function PUT(request: NextRequest) {
  const auth = await requirePermission("roles.manage");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const { sb, profile } = auth;
  const b = await request.json().catch(() => ({}));
  if (!b.role_id) return Response.json({ error: "role_id required" }, { status: 400 });
  const { data: role } = await sb.from("roles").select("is_super").eq("id", b.role_id).single();
  if (role?.is_super) return Response.json({ error: "Super Administrator always has all permissions" }, { status: 403 });
  const ids = Array.isArray(b.permission_ids) ? b.permission_ids : [];
  await sb.from("role_permissions").delete().eq("role_id", b.role_id);
  if (ids.length) { const { error } = await sb.from("role_permissions").insert(ids.map(pid => ({ role_id: b.role_id, permission_id: pid }))); if (error) return Response.json({ error: error.message }, { status: 500 }); }
  await logPermission(sb, { event: "perm_change", actor: profile, request, role_id: b.role_id, detail: `${ids.length} permissions` });
  return Response.json({ ok: true, count: ids.length });
}
