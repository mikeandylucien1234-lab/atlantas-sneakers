// @ts-nocheck
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { svc, logActivity } from "@/lib/staff/service";

function ipOf(r) { return r.headers.get("x-forwarded-for")?.split(",")[0] || null; }

// GET /api/staff/:id — full profile (staff + personal + roles + activity + sessions + documents + performance)
export async function GET(request: NextRequest, { params }) {
  const auth = await requirePermission("users.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const { id } = await params;
  const [{ data: staff }, { data: profile }, { data: ur }, { data: activity }, { data: sessions }, { data: documents }, { data: dept }] = await Promise.all([
    s.from("staff").select("*, staff_profiles(*)").eq("id", id).single(),
    s.from("profiles").select("email, full_name, avatar_url, created_at").eq("id", id).single(),
    s.from("user_roles").select("role_id, roles(name,color,key)").eq("user_id", id),
    s.from("staff_activity_logs").select("*").eq("staff_id", id).order("created_at", { ascending: false }).limit(50),
    s.from("staff_sessions").select("*").eq("staff_id", id).order("last_activity", { ascending: false }).limit(50),
    s.from("staff_documents").select("*").eq("staff_id", id).order("created_at", { ascending: false }),
    Promise.resolve(null),
  ]);
  if (!staff) return Response.json({ error: "Not found" }, { status: 404 });
  const L = activity || [];
  const count = (a) => L.filter(x => x.action === a).length;
  return Response.json({
    staff: { ...staff, profile, roles: (ur || []).map(x => x.roles).filter(Boolean) },
    activity: L, sessions: sessions || [], documents: documents || [],
    performance: { orders_processed: count("order_process"), products_created: count("product_create"), products_updated: count("product_update"), tickets_resolved: count("ticket_resolve"), logins: count("login"), last_activity: L[0]?.created_at || null },
  });
}

// PUT /api/staff/:id — update employment + personal info
export async function PUT(request: NextRequest, { params }) {
  const auth = await requirePermission("users.edit");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const staffPatch = {}; ["department_id", "job_title", "manager_id", "hire_date", "contract_type", "salary", "status", "two_factor_enabled", "notes", "must_change_password"].forEach(k => { if (k in b) staffPatch[k] = b[k]; });
  if (Object.keys(staffPatch).length) { staffPatch.updated_at = new Date().toISOString(); await s.from("staff").update(staffPatch).eq("id", id); }
  const profPatch = {}; ["first_name", "last_name", "phone", "date_of_birth", "gender", "address", "city", "state", "country", "postal_code", "avatar_url"].forEach(k => { if (k in b) profPatch[k] = b[k]; });
  if (Object.keys(profPatch).length) { profPatch.updated_at = new Date().toISOString(); await s.from("staff_profiles").upsert({ staff_id: id, ...profPatch }, { onConflict: "staff_id" }); }
  if (b.full_name || b.first_name || b.last_name) { const fn = b.full_name || [b.first_name, b.last_name].filter(Boolean).join(" "); if (fn) await s.from("profiles").update({ full_name: fn }).eq("id", id); }
  await logActivity(s, { staff_id: id, actor: auth.profile, action: "update", entity: "staff", detail: JSON.stringify([...Object.keys(staffPatch), ...Object.keys(profPatch)]), ip: ipOf(request) });
  return Response.json({ ok: true });
}

// DELETE /api/staff/:id — remove staff record + auth user
export async function DELETE(request: NextRequest, { params }) {
  const auth = await requirePermission("users.delete");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc(); const { id } = await params;
  if (id === auth.profile.id) return Response.json({ error: "You cannot delete your own account" }, { status: 400 });
  await s.from("staff").delete().eq("id", id);
  await s.from("user_roles").delete().eq("user_id", id);
  try { await s.auth.admin.deleteUser(id); } catch {}
  await logActivity(s, { staff_id: null, actor: auth.profile, action: "delete", entity: "staff", detail: id, ip: ipOf(request) });
  return Response.json({ ok: true });
}
