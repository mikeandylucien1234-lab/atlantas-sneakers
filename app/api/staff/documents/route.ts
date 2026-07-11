// @ts-nocheck
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { svc, logActivity } from "@/lib/staff/service";

// POST /api/staff/documents { staff_id, type, name, url }
export async function POST(request: NextRequest) {
  const auth = await requirePermission("users.edit");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const b = await request.json().catch(() => ({}));
  if (!b.staff_id || !b.url) return Response.json({ error: "staff_id and url required" }, { status: 400 });
  const { data, error } = await s.from("staff_documents").insert({ staff_id: b.staff_id, type: b.type || "other", name: b.name || "Document", url: b.url, uploaded_by: auth.profile.id }).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await logActivity(s, { staff_id: b.staff_id, actor: auth.profile, action: "document_add", entity: "document", detail: b.name, ip: request.headers.get("x-forwarded-for")?.split(",")[0] });
  return Response.json({ document: data });
}

// DELETE /api/staff/documents?id=
export async function DELETE(request: NextRequest) {
  const auth = await requirePermission("users.edit");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const id = request.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  await s.from("staff_documents").delete().eq("id", id);
  return Response.json({ ok: true });
}
