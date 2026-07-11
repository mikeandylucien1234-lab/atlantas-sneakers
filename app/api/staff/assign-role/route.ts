// @ts-nocheck
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { svc, logActivity } from "@/lib/staff/service";

// POST /api/staff/assign-role { user_id, role_id, op:'assign'|'unassign' }
export async function POST(request: NextRequest) {
  const auth = await requirePermission("users.edit");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const b = await request.json().catch(() => ({}));
  if (!b.user_id || !b.role_id) return Response.json({ error: "user_id and role_id required" }, { status: 400 });
  if (b.op === "unassign") await s.from("user_roles").delete().eq("user_id", b.user_id).eq("role_id", b.role_id);
  else { const { error } = await s.from("user_roles").insert({ user_id: b.user_id, role_id: b.role_id, assigned_by: auth.profile.id }); if (error && !String(error.message).includes("duplicate")) return Response.json({ error: error.message }, { status: 500 }); }
  await logActivity(s, { staff_id: b.user_id, actor: auth.profile, action: "role_change", entity: "role", detail: b.op || "assign", ip: request.headers.get("x-forwarded-for")?.split(",")[0] });
  return Response.json({ ok: true });
}
