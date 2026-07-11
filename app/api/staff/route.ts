// @ts-nocheck
import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/rbac/server";
import { svc, createStaff } from "@/lib/staff/service";

const rl = new Map();
function limited(key, max = 20, win = 60000) { const now = Date.now(); const e = rl.get(key) || { c: 0, t: now }; if (now - e.t > win) { e.c = 0; e.t = now; } e.c++; rl.set(key, e); return e.c > max; }
function ipOf(request) { return request.headers.get("x-forwarded-for")?.split(",")[0] || null; }

// GET /api/staff  (?section=dashboard|departments|activity|sessions|performance|export | default list)
export async function GET(request: NextRequest) {
  const auth = await requirePermission("users.view");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const s = svc();
  const sp = request.nextUrl.searchParams;
  const section = sp.get("section") || "list";

  try {
    if (section === "dashboard") {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [{ data: staff }, { data: depts }, { data: sessions }, { data: logs }, { data: ur }] = await Promise.all([
        s.from("staff").select("id, status, department_id, created_at"),
        s.from("staff_departments").select("id, name"),
        s.from("staff_sessions").select("staff_id, last_activity, revoked").eq("revoked", false),
        s.from("staff_activity_logs").select("action, actor_name, detail, status, created_at").order("created_at", { ascending: false }).limit(15),
        s.from("user_roles").select("user_id, roles(name,color)"),
      ]);
      const St = staff || [];
      const online = new Set((sessions || []).filter(x => x.last_activity > new Date(Date.now() - 15 * 60000).toISOString()).map(x => x.staff_id));
      const deptName = Object.fromEntries((depts || []).map(d => [d.id, d.name]));
      const byDept = {}; St.forEach(x => { const n = deptName[x.department_id] || "Unassigned"; byDept[n] = (byDept[n] || 0) + 1; });
      const rolesByUser = {}; (ur || []).forEach(x => { if (x.roles) (rolesByUser[x.user_id] = rolesByUser[x.user_id] || []).push(x.roles); });
      const byRole = {}; St.forEach(x => { (rolesByUser[x.id] || [{ name: "Unassigned", color: "#8a929c" }]).forEach(r => { byRole[r.name] = byRole[r.name] || { name: r.name, color: r.color, count: 0 }; byRole[r.name].count++; }); });
      const lastLogin = (logs || []).find(l => l.action === "login");
      return Response.json({
        kpis: {
          total: St.length,
          active: St.filter(x => x.status === "active").length,
          suspended: St.filter(x => ["suspended", "blocked"].includes(x.status)).length,
          offline: St.length - online.size,
          online: online.size,
          newThisMonth: St.filter(x => x.created_at >= monthStart).length,
          lastLogin: lastLogin?.created_at || null,
        },
        byDepartment: Object.entries(byDept).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        byRole: Object.values(byRole).sort((a, b) => b.count - a.count),
        activity: logs || [],
      });
    }

    if (section === "departments") {
      const { data } = await s.from("staff_departments").select("*").order("name");
      const { data: counts } = await s.from("staff").select("department_id");
      const c = {}; (counts || []).forEach(x => { if (x.department_id) c[x.department_id] = (c[x.department_id] || 0) + 1; });
      return Response.json({ departments: (data || []).map(d => ({ ...d, staff_count: c[d.id] || 0 })) });
    }

    if (section === "activity") {
      const staffId = sp.get("staff_id");
      let q = s.from("staff_activity_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (staffId) q = q.eq("staff_id", staffId);
      const { data } = await q;
      return Response.json({ activity: data || [] });
    }

    if (section === "sessions") {
      const staffId = sp.get("staff_id");
      let q = s.from("staff_sessions").select("*").order("last_activity", { ascending: false }).limit(200);
      if (staffId) q = q.eq("staff_id", staffId);
      const { data } = await q;
      return Response.json({ sessions: data || [] });
    }

    if (section === "performance") {
      const staffId = sp.get("staff_id");
      const { data: logs } = await s.from("staff_activity_logs").select("action, created_at").eq("staff_id", staffId);
      const L = logs || [];
      const count = (a) => L.filter(x => x.action === a).length;
      return Response.json({ performance: {
        orders_processed: count("order_process"), products_created: count("product_create"), products_updated: count("product_update"),
        tickets_resolved: count("ticket_resolve"), coupons_created: count("coupon_create"), blogs_published: count("blog_publish"),
        customers_updated: count("customer_update"), payments_validated: count("payment_validate"),
        logins: count("login"), last_activity: L.map(x => x.created_at).sort().reverse()[0] || null,
      } });
    }

    if (section === "export") {
      const { data } = await s.from("staff").select("employee_id, job_title, status, contract_type, hire_date, profiles:id(email, full_name)");
      const rows = data || [];
      const header = "Employee ID,Name,Email,Title,Status,Contract,Hire Date\n";
      const body = rows.map(r => `"${r.employee_id}","${r.profiles?.full_name || ""}","${r.profiles?.email || ""}","${r.job_title || ""}","${r.status}","${r.contract_type}","${r.hire_date || ""}"`).join("\n");
      return new Response(header + body, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="staff.csv"' } });
    }

    // default: paginated, filtered list
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const pageSize = Math.min(50, parseInt(sp.get("pageSize") || "20", 10));
    const from = (page - 1) * pageSize;
    let q = s.from("staff").select("*, profiles:id(email, full_name, avatar_url), staff_profiles(*), staff_departments(name)", { count: "exact" });
    const status = sp.get("status"); if (status && status !== "all") q = q.eq("status", status);
    const dept = sp.get("department"); if (dept && dept !== "all") q = q.eq("department_id", dept);
    const contract = sp.get("contract"); if (contract && contract !== "all") q = q.eq("contract_type", contract);
    q = q.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
    let { data, count } = await q;
    let staff = data || [];
    // role hydration
    const ids = staff.map(x => x.id);
    if (ids.length) {
      const { data: ur } = await s.from("user_roles").select("user_id, roles(name,color,key)").in("user_id", ids);
      const byUser = {}; (ur || []).forEach(x => { if (x.roles) (byUser[x.user_id] = byUser[x.user_id] || []).push(x.roles); });
      staff = staff.map(x => ({ ...x, roles: byUser[x.id] || [] }));
    }
    const search = (sp.get("q") || "").toLowerCase();
    if (search) staff = staff.filter(x => (x.profiles?.full_name || "").toLowerCase().includes(search) || (x.profiles?.email || "").toLowerCase().includes(search) || (x.employee_id || "").toLowerCase().includes(search));
    return Response.json({ staff, total: count || 0, page, pageSize });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/staff — create a staff member (real auth account + welcome email)
export async function POST(request: NextRequest) {
  const auth = await requirePermission("users.create");
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  if (limited(`staff-create:${auth.profile.id}`, 10, 60000)) return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  const b = await request.json().catch(() => ({}));
  const res = await createStaff(b, auth.profile, ipOf(request));
  if (res.error) return Response.json({ error: res.error }, { status: res.status || 500 });
  return Response.json(res);
}
