// @ts-nocheck
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { svc, logActivity } from "@/lib/staff/service";

// GET /api/staff/sessions?staff_id= — active sessions
export async function GET(request: NextRequest) {
  const auth = await requirePermission("users.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const staffId = request.nextUrl.searchParams.get("staff_id");
  let q = s.from("staff_sessions").select("*").order("last_activity", { ascending: false }).limit(200);
  if (staffId) q = q.eq("staff_id", staffId);
  const { data } = await q;
  return Response.json({ sessions: data || [] });
}

// POST /api/staff/sessions — revoke one { session_id } or all for a staff { staff_id, all:true }
export async function POST(request: NextRequest) {
  const auth = await requirePermission("users.edit");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const b = await request.json().catch(() => ({}));
  if (b.all && b.staff_id) { await s.from("staff_sessions").update({ revoked: true }).eq("staff_id", b.staff_id); try { await s.auth.admin.signOut(b.staff_id, "global"); } catch {} }
  else if (b.session_id) await s.from("staff_sessions").update({ revoked: true }).eq("id", b.session_id);
  else return Response.json({ error: "session_id or staff_id+all required" }, { status: 400 });
  await logActivity(s, { staff_id: b.staff_id || null, actor: auth.profile, action: "logout", entity: "session", detail: b.all ? "all sessions" : b.session_id, ip: request.headers.get("x-forwarded-for")?.split(",")[0] });
  return Response.json({ ok: true });
}
