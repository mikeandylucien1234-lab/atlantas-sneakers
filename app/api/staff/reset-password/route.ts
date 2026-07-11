// @ts-nocheck
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { resetPassword } from "@/lib/staff/service";

export async function POST(request: NextRequest) {
  const auth = await requirePermission("users.edit");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const b = await request.json().catch(() => ({}));
  if (!b.id) return Response.json({ error: "id required" }, { status: 400 });
  const res = await resetPassword(b.id, auth.profile, request.headers.get("x-forwarded-for")?.split(",")[0], { password: b.password });
  if (res.error) return Response.json({ error: res.error }, { status: res.status || 500 });
  return Response.json(res);
}
