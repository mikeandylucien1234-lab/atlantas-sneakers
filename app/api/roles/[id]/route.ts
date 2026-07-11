// @ts-nocheck
import { NextRequest } from "next/server";
import { requirePermission, logPermission } from "@/lib/rbac/server";

// GET /api/roles/:id — role detail + its permission ids
export async function GET(request: NextRequest, { params }) {
  const auth = await requirePermission("roles.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const { sb } = auth; const { id } = await params;
  const { data: role } = await sb.from("roles").select("*").eq("id", id).single();
  if (!role) return Response.json({ error: "Not found" }, { status: 404 });
  const { data: rp } = await sb.from("role_permissions").select("permission_id").eq("role_id", id);
  return Response.json({ role, permission_ids: (rp || []).map(r => r.permission_id) });
}

// PUT /api/roles/:id — update
export async function PUT(request: NextRequest, { params }) {
  const auth = await requirePermission("roles.edit");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const { sb, profile } = auth; const { id } = await params;
  const { data: role } = await sb.from("roles").select("is_super").eq("id", id).single();
  if (role?.is_super) return Response.json({ error: "Super Administrator cannot be modified" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const patch = { updated_at: new Date().toISOString() };
  ["name", "description", "color", "icon", "priority", "status", "notes"].forEach(k => { if (k in b) patch[k] = b[k]; });
  const { error } = await sb.from("roles").update(patch).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await logPermission(sb, { event: "role_update", actor: profile, request, role_id: id });
  return Response.json({ ok: true });
}

// DELETE /api/roles/:id
export async function DELETE(request: NextRequest, { params }) {
  const auth = await requirePermission("roles.delete");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const { sb, profile } = auth; const { id } = await params;
  const { data: role } = await sb.from("roles").select("is_system, is_super, name").eq("id", id).single();
  if (role?.is_super || role?.is_system) return Response.json({ error: "System roles cannot be deleted" }, { status: 403 });
  const { error } = await sb.from("roles").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await logPermission(sb, { event: "role_delete", actor: profile, request, detail: role?.name });
  return Response.json({ ok: true });
}
