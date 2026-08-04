// @ts-nocheck
// Staff service — real account provisioning (Supabase Auth admin), employment
// records, sessions, activity and performance. Service-role client bypasses RLS
// for admin operations; every call is gated by requirePermission upstream.
import { createClient as createAnon } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/notifications/senders";

export function svc() {
  return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
}
function siteUrl() { return (process.env.NEXT_PUBLIC_SITE_URL || "https://atlantasneaker.com").replace(/\/$/, ""); }

export async function logActivity(s, { staff_id, actor, action, entity, detail, ip, status = "ok" }) {
  try { await s.from("staff_activity_logs").insert({ staff_id: staff_id || null, actor_id: actor?.id || null, actor_name: actor?.full_name || actor?.email || "Admin", action, entity: entity || null, detail: detail || null, ip_address: ip || null, status }); } catch {}
}

function genPassword() {
  const c = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return "Atl!" + Array.from({ length: 10 }, () => c[Math.floor(Math.random() * c.length)]).join("");
}

// Create a real staff member: auth user + profile + staff + staff_profile + role.
export async function createStaff(b, actor, ip) {
  const s = svc();
  const email = (b.email || "").trim().toLowerCase();
  if (!email) return { error: "Email required", status: 400 };
  const password = b.password || genPassword();
  const fullName = [b.first_name, b.last_name].filter(Boolean).join(" ").trim() || b.full_name || email.split("@")[0];

  // 1) create auth user (real)
  const { data: created, error: authErr } = await s.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (authErr) return { error: authErr.message, status: 400 };
  const uid = created.user.id;

  // 2) profile (role=admin so they can reach the admin; scoped by RBAC role below)
  await s.from("profiles").upsert({ id: uid, email, full_name: fullName, avatar_url: b.avatar_url || null, role: "admin" }, { onConflict: "id" });

  // 3) staff record
  const { data: empRow } = await s.rpc("next_employee_id");
  const employee_id = empRow || `ATL-${Date.now().toString().slice(-4)}`;
  await s.from("staff").upsert({
    id: uid, employee_id, department_id: b.department_id || null, job_title: b.job_title || null,
    manager_id: b.manager_id || null, hire_date: b.hire_date || null, contract_type: b.contract_type || "full_time",
    salary: b.salary != null ? Number(b.salary) : null, status: b.status || "active", must_change_password: b.must_change_password !== false,
    two_factor_enabled: !!b.two_factor_enabled, notes: b.notes || null,
  }, { onConflict: "id" });

  // 4) personal profile
  await s.from("staff_profiles").upsert({
    staff_id: uid, first_name: b.first_name || null, last_name: b.last_name || null, phone: b.phone || null,
    date_of_birth: b.date_of_birth || null, gender: b.gender || null, address: b.address || null, city: b.city || null,
    state: b.state || null, country: b.country || null, postal_code: b.postal_code || null, avatar_url: b.avatar_url || null,
  }, { onConflict: "staff_id" });

  // 5) RBAC role assignment (so permissions are scoped, not legacy-super)
  if (b.role_id) { await s.from("user_roles").insert({ user_id: uid, role_id: b.role_id, assigned_by: actor?.id || null }).then(() => {}, () => {}); }

  await logActivity(s, { staff_id: uid, actor, action: "create", entity: "staff", detail: `${fullName} (${employee_id})`, ip });

  // 6) welcome email (real, via Resend) with credentials + login + must-change note
  let emailed = false, emailError = null;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#16181d">
    <h2>Welcome to Atlanta Sneakers, ${fullName}!</h2>
    <p>Your staff account has been created. Employee ID: <b>${employee_id}</b>.</p>
    <p><b>Login:</b> <a href="${siteUrl()}/auth/login">${siteUrl()}/auth/login</a></p>
    <p><b>Email:</b> ${email}<br/><b>Temporary password:</b> <code>${password}</code></p>
    <p>For security, you will be required to change your password on first login.</p>
  </div>`;
  const res = await sendEmail({ to: email, subject: "Your Atlanta Sneakers staff account", html });
  emailed = res.ok; emailError = res.error || null;

  return { ok: true, id: uid, employee_id, tempPassword: b.password ? undefined : password, emailed, emailError };
}

export async function resetPassword(uid, actor, ip, opts = {}) {
  const s = svc();
  const password = opts.password || genPassword();
  const { error } = await s.auth.admin.updateUserById(uid, { password });
  if (error) return { error: error.message, status: 400 };
  await s.from("staff").update({ must_change_password: true, updated_at: new Date().toISOString() }).eq("id", uid);
  const { data: prof } = await s.from("profiles").select("email, full_name").eq("id", uid).single();
  let emailed = false;
  if (prof?.email) {
    const html = `<div style="font-family:system-ui,sans-serif"><p>Hi ${prof.full_name || "there"}, your Atlanta Sneakers password was reset.</p><p><b>Temporary password:</b> <code>${password}</code></p><p>You will be asked to change it on next login: <a href="${siteUrl()}/auth/login">${siteUrl()}/auth/login</a></p></div>`;
    const r = await sendEmail({ to: prof.email, subject: "Your Atlanta Sneakers password was reset", html }); emailed = r.ok;
  }
  await logActivity(s, { staff_id: uid, actor, action: "reset_password", entity: "staff", ip });
  return { ok: true, tempPassword: opts.password ? undefined : password, emailed };
}

export async function setStatus(uid, status, actor, ip) {
  const s = svc();
  await s.from("staff").update({ status, updated_at: new Date().toISOString() }).eq("id", uid);
  // suspended/blocked/inactive => remove admin access at the gate; active => restore
  const profileRole = (status === "active" || status === "pending") ? "admin" : "suspended";
  await s.from("profiles").update({ role: profileRole }).eq("id", uid);
  if (status === "suspended" || status === "blocked") {
    await s.from("staff_sessions").update({ revoked: true }).eq("staff_id", uid);
    const { data: prof } = await s.from("profiles").select("email, full_name").eq("id", uid).single();
    if (prof?.email) await sendEmail({ to: prof.email, subject: "Your Atlanta Sneakers account status changed", html: `<div style="font-family:system-ui,sans-serif"><p>Hi ${prof.full_name || "there"}, your staff account has been <b>${status}</b>. Contact an administrator for details.</p></div>` });
  }
  await logActivity(s, { staff_id: uid, actor, action: status === "active" ? "reactivate" : "suspend", entity: "staff", detail: status, ip });
  return { ok: true };
}
