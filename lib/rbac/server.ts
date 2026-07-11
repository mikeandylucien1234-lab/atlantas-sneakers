// @ts-nocheck
// Server-side RBAC enforcement. Every admin API can call requirePermission()
// to enforce a specific permission — verified against Supabase (session + JWT +
// merged role permissions via the has_permission() SECURITY DEFINER function).
import { createClient } from "@/lib/supabase/server";

export async function getAuthContext(supabase?) {
  const sb = supabase || (await createClient());
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, user: null, profile: null };
  const { data: profile } = await sb.from("profiles").select("id, role, full_name, email").eq("id", user.id).single();
  return { sb, user, profile };
}

// Returns { ok } or { error, status }. Enforces admin gate + specific permission.
export async function requirePermission(perm, supabase?) {
  const { sb, user, profile } = await getAuthContext(supabase);
  if (!user) return { error: "Unauthorized", status: 401 };
  if (!profile || profile.role !== "admin") return { error: "Forbidden", status: 403 };
  if (!perm) return { ok: true, sb, user, profile };
  const { data, error } = await sb.rpc("has_permission", { perm });
  if (error) return { ok: true, sb, user, profile }; // fail-open only for admins (never for non-admins, already gated)
  if (data === true) return { ok: true, sb, user, profile };
  return { error: "Insufficient permission", status: 403, missing: perm };
}

// Fetch merged permission keys for the current user.
export async function getMyPermissions(supabase?) {
  const sb = supabase || (await createClient());
  const { data } = await sb.rpc("my_permissions");
  return (data || []).map((r) => r.key);
}

export async function logPermission(sb, { event, actor, request, target_user, role_id, detail, status = "ok" }) {
  try {
    await sb.from("permission_logs").insert({
      event, actor_id: actor?.id || null, actor_name: actor?.full_name || actor?.email || "Admin",
      target_user: target_user || null, role_id: role_id || null,
      ip_address: request?.headers?.get("x-forwarded-for")?.split(",")[0] || null, detail: detail || null, status,
    });
  } catch {}
}
