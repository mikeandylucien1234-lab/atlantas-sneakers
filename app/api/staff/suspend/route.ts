// @ts-nocheck
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { setStatus } from "@/lib/staff/service";

export async function POST(request: NextRequest) {
  const auth = await requirePermission("users.edit");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const b = await request.json().catch(() => ({}));
  if (!b.id) return Response.json({ error: "id required" }, { status: 400 });
  const res = await setStatus(b.id, b.status || "suspended", auth.profile, request.headers.get("x-forwarded-for")?.split(",")[0]);
  return Response.json(res);
}
