// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function checkAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: "Forbidden", status: 403 };
  return { user, profile };
}
async function log(supabase, auth, request, event, extra = {}) {
  try { await supabase.from("notification_logs").insert({ event, status: extra.status || "ok", actor_id: auth?.user?.id || null, actor_name: auth?.profile?.full_name || auth?.profile?.email || "Admin", ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null, ...extra }); } catch {}
}

// GET /api/notifications — list (in-app + all channels) with filters & pagination
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const pageSize = Math.min(100, parseInt(sp.get("pageSize") || "25", 10));
  const from = (page - 1) * pageSize;

  let q = supabase.from("notifications").select("*", { count: "exact" });
  const channel = sp.get("channel"); if (channel && channel !== "all") q = q.eq("channel", channel);
  const status = sp.get("status"); if (status && status !== "all") q = q.eq("status", status);
  const priority = sp.get("priority"); if (priority && priority !== "all") q = q.eq("priority", priority);
  const search = sp.get("q"); if (search) q = q.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
  q = q.order("created_at", { ascending: false }).range(from, from + pageSize - 1);

  const { data, count, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ notifications: data || [], total: count || 0, page, pageSize });
}

// POST /api/notifications — create an in-app notification (persisted immediately)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const b = await request.json().catch(() => ({}));
  if (!b.title && !b.message) return Response.json({ error: "Title or message required" }, { status: 400 });
  const { data, error } = await supabase.from("notifications").insert({
    user_id: b.user_id || null, recipient: b.recipient || b.user_id || null, channel: b.channel || "in_app",
    type: b.type || "general", category: b.category || null, title: b.title || null, message: b.message || null,
    priority: b.priority || "normal", status: b.status || "unread", data: b.data || {},
  }).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await log(supabase, auth, request, "create", { notification_id: data.id, channel: data.channel, detail: data.title });
  return Response.json({ notification: data });
}

// PUT /api/notifications — update (mark read / archive / edit)
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const b = await request.json().catch(() => ({}));
  const ids = b.ids || (b.id ? [b.id] : []);
  if (!ids.length) return Response.json({ error: "id(s) required" }, { status: 400 });
  const patch = {};
  if (b.action === "read") { patch.status = "read"; patch.read_at = new Date().toISOString(); }
  else if (b.action === "unread") { patch.status = "unread"; patch.read_at = null; }
  else if (b.action === "archive") { patch.status = "archived"; patch.archived = true; }
  else { ["title", "message", "priority", "status", "category"].forEach(k => { if (k in b) patch[k] = b[k]; }); }
  const { error } = await supabase.from("notifications").update(patch).in("id", ids);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await log(supabase, auth, request, b.action === "read" ? "read" : "update", { detail: `${ids.length} item(s)` });
  return Response.json({ ok: true, updated: ids.length });
}

// DELETE /api/notifications?id=... (or body { ids })
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const b = await request.json().catch(() => ({}));
  const ids = b.ids || (request.nextUrl.searchParams.get("id") ? [request.nextUrl.searchParams.get("id")] : []);
  if (!ids.length) return Response.json({ error: "id(s) required" }, { status: 400 });
  const { error } = await supabase.from("notifications").delete().in("id", ids);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await log(supabase, auth, request, "delete", { detail: `${ids.length} item(s)` });
  return Response.json({ ok: true, deleted: ids.length });
}
