// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Users, LayoutDashboard, UserPlus, Loader2, Save, Search, Download, X, Eye,
  Edit3, Trash2, Power, KeyRound, ShieldCheck, Ban, CheckCircle2, XCircle,
  Building2, Briefcase, Phone, Mail, MapPin, Clock, Activity, Monitor, FileText,
  StickyNote, TrendingUp, Circle, AlertTriangle, LogOut, UserCog, Wifi,
} from "lucide-react";

type Props = { dark: boolean };

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "list", label: "Staff List", icon: Users },
];
const STATUSES = ["active", "inactive", "suspended", "pending", "blocked"];
const CONTRACTS = [["full_time", "Full-time"], ["part_time", "Part-time"], ["freelance", "Freelance"], ["internship", "Internship"]];
const STATUS_COLOR = { active: "#16a34a", inactive: "#8a929c", suspended: "#dc2626", pending: "#ea7317", blocked: "#dc2626" };
const DOC_TYPES = [["id_card", "ID Card"], ["passport", "Passport"], ["contract", "Contract"], ["cv", "CV"], ["certificate", "Certificate"], ["other", "Other"]];

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function fmtD(d) { return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }
function timeAgo(d) { if (!d) return "never"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }
function initials(n) { return (n || "?").split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase(); }

export function AdminStaff({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inpBg = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inpBg, "focus:border-[#2563eb]");
  const taCls = cn("w-full rounded-[11px] border-[1.5px] px-3 py-2.5 text-sm outline-none", inpBg, "focus:border-[#2563eb]");
  const labelCls = cn("text-[12px] font-semibold mb-1.5 block", txt);
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnGhost = cn("h-10 px-4 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2 disabled:opacity-50", brd, txt, hover);
  const btnPrimary = "h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2";
  const divide = dark ? "divide-[#252c36]" : "divide-[#eef0f3]";

  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const [dash, setDash] = useState(null);
  const [list, setList] = useState({ staff: [], total: 0, page: 1, pageSize: 20 });
  const [filters, setFilters] = useState({ q: "", status: "all", department: "all", contract: "all" });
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [profile, setProfile] = useState(null);   // detail drawer data
  const [profileTab, setProfileTab] = useState("info");
  const [createdInfo, setCreatedInfo] = useState(null);

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3500); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadDash = useCallback(async () => { try { setDash(await api("/staff?section=dashboard")); } catch {} }, [api]);
  const loadDepts = useCallback(async () => { try { const r = await api("/staff?section=departments"); setDepartments(r.departments || []); } catch {} }, [api]);
  const loadRoles = useCallback(async () => { try { const r = await api("/roles?section=list"); setRoles(r.roles || []); } catch {} }, [api]);
  const loadList = useCallback(async (page = 1) => {
    try { const qs = new URLSearchParams({ page, pageSize: 20, q: filters.q, status: filters.status, department: filters.department, contract: filters.contract });
      const r = await api(`/staff?${qs}`); setList({ ...r }); } catch (e) { showToast(e.message, "error"); }
  }, [api, filters, showToast]);

  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadDash(), loadDepts(), loadRoles()]); setLoading(false); })(); }, [loadDash, loadDepts, loadRoles]);
  useEffect(() => { if (tab === "dashboard") loadDash(); if (tab === "list") loadList(1); }, [tab]); // eslint-disable-line
  useEffect(() => { if (tab === "list") loadList(1); }, [filters]); // eslint-disable-line

  const openProfile = async (id) => {
    setProfile({ loading: true }); setProfileTab("info");
    try { const r = await api(`/staff/${id}`); setProfile(r); } catch (e) { showToast(e.message, "error"); setProfile(null); }
  };

  const act = async (path, body, okMsg, after, method = "POST") => {
    setBusy(path + JSON.stringify(body?.id || ""));
    try { const r = await api(path, { method, headers: { "Content-Type": "application/json" }, body: method === "DELETE" ? undefined : JSON.stringify(body) }); if (okMsg) showToast(typeof okMsg === "function" ? okMsg(r) : okMsg); if (after) await after(r); return r; }
    catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };

  const emptyForm = () => ({ first_name: "", last_name: "", email: "", phone: "", date_of_birth: "", gender: "", address: "", city: "", state: "", country: "", postal_code: "", department_id: "", job_title: "", manager_id: "", hire_date: "", contract_type: "full_time", salary: "", status: "active", role_id: "", two_factor_enabled: false, must_change_password: true, password: "" });

  const submitCreate = async () => {
    setBusy("create");
    try {
      const r = await api("/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setAddOpen(false); setForm(null);
      setCreatedInfo(r);
      showToast(r.emailed ? "Staff created — welcome email sent" : "Staff created" + (r.emailError ? " (email not sent)" : ""));
      loadList(1); loadDash();
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };

  const saveProfileEdit = async () => {
    const st = profile.staff; setBusy("save-profile");
    try {
      await api(`/staff/${st.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        department_id: st.department_id, job_title: st.job_title, contract_type: st.contract_type, hire_date: st.hire_date, salary: st.salary, status: st.status, notes: st.notes,
        first_name: st.staff_profiles?.first_name, last_name: st.staff_profiles?.last_name, phone: st.staff_profiles?.phone, address: st.staff_profiles?.address, city: st.staff_profiles?.city, state: st.staff_profiles?.state, country: st.staff_profiles?.country, postal_code: st.staff_profiles?.postal_code, gender: st.staff_profiles?.gender, date_of_birth: st.staff_profiles?.date_of_birth,
      }) });
      showToast("Saved"); openProfile(st.id); loadList(list.page);
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const kpis = [
    { label: "Total Staff", value: K.total || 0, icon: Users, color: "#2563eb" },
    { label: "Active", value: K.active || 0, icon: CheckCircle2, color: "#16a34a" },
    { label: "Suspended", value: K.suspended || 0, icon: Ban, color: "#dc2626" },
    { label: "Online Now", value: K.online || 0, icon: Wifi, color: "#16a34a" },
    { label: "Offline", value: K.offline || 0, icon: Circle, color: "#8a929c" },
    { label: "New This Month", value: K.newThisMonth || 0, icon: UserPlus, color: "#8b5cf6" },
  ];

  const statusPill = (s) => <span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ backgroundColor: `${STATUS_COLOR[s] || "#8a929c"}1a`, color: STATUS_COLOR[s] || "#8a929c" }}>{s}</span>;
  const Avatar = ({ url, name, size = 36 }) => url ? <img src={url} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} /> : <div className="rounded-full flex items-center justify-center font-bold text-white" style={{ width: size, height: size, fontSize: size / 2.8, background: "linear-gradient(135deg,#2563eb,#8b5cf6)" }}>{initials(name)}</div>;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Users className="w-5 h-5 text-[#2563eb]" /> Staff</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Enterprise Staff Management Center · {K.total || 0} employees</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/staff?section=export" className={btnGhost}><Download className="w-4 h-4" /> Export CSV</a>
          <button onClick={() => { setForm(emptyForm()); setAddOpen(true); }} className={btnPrimary}><UserPlus className="w-4 h-4" /> Add Staff</button>
        </div>
      </div>

      {/* TABS */}
      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === t.id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><t.icon className="w-3.5 h-3.5" /> {t.label}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{kpis.map(k => (
            <div key={k.label} className={cn(cardCls, "p-3.5")}><div className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-2" style={{ backgroundColor: `${k.color}1a` }}><k.icon className="w-4 h-4" style={{ color: k.color }} /></div><p className={cn("text-[18px] font-extrabold", txt)}>{k.value}</p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
          ))}</div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>By Department</p><BarList rows={dash.byDepartment} dark={dark} txt={txt} sub={sub} /></div>
            <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>By Role</p><BarList rows={dash.byRole} dark={dark} txt={txt} sub={sub} colored /></div>
            <div className={cn(cardCls, "overflow-hidden")}>
              <p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b", sub, brd)}>Recent Activity</p>
              <div className={cn("divide-y max-h-72 overflow-y-auto", divide)}>
                {(dash.activity || []).length === 0 ? <p className={cn("p-4 text-xs", sub)}>No activity yet.</p> :
                  dash.activity.map((a, i) => <div key={i} className="px-4 py-2.5 flex items-center gap-2"><span className={cn("w-1.5 h-1.5 rounded-full shrink-0", a.status === "error" ? "bg-red-500" : "bg-emerald-500")} /><span className={cn("text-xs font-semibold capitalize", txt)}>{(a.action || "").replace(/_/g, " ")}</span><span className={cn("text-[10px] truncate", sub)}>{a.detail}</span><span className={cn("text-[10px] ml-auto shrink-0", sub)}>{timeAgo(a.created_at)}</span></div>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIST */}
      {tab === "list" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap gap-2 items-center")}>
            <div className="relative flex-1 min-w-[180px]"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} className={cn(inpCls, "pl-9 h-9")} placeholder="Search name, email, ID…" /></div>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All status</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
            <select value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All departments</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <select value={filters.contract} onChange={e => setFilters(f => ({ ...f, contract: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All contracts</option>{CONTRACTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Employee", "Email", "Phone", "Department", "Role", "Status", "Last activity", ""].map(h => <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {list.staff.length === 0 ? <tr><td colSpan={8} className={cn("px-4 py-10 text-center", sub)}><Users className="w-8 h-8 mx-auto mb-2" /><p className="text-sm">No staff found.</p></td></tr> :
                  list.staff.map(st => (
                    <tr key={st.id} className={hover}>
                      <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><Avatar url={st.staff_profiles?.avatar_url || st.profiles?.avatar_url} name={st.profiles?.full_name} /><div><p className={cn("font-semibold", txt)}>{st.profiles?.full_name || "—"}</p><p className={cn("text-[10px]", sub)}>{st.employee_id} · {st.job_title || "—"}</p></div></div></td>
                      <td className={cn("px-4 py-2.5", sub)}>{st.profiles?.email}</td>
                      <td className={cn("px-4 py-2.5", sub)}>{st.staff_profiles?.phone || "—"}</td>
                      <td className={cn("px-4 py-2.5", txt)}>{st.staff_departments?.name || "—"}</td>
                      <td className="px-4 py-2.5"><div className="flex flex-wrap gap-1">{(st.roles || []).length ? st.roles.map((r, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${r.color}1a`, color: r.color }}>{r.name}</span>) : <span className={cn("text-[10px]", sub)}>—</span>}</div></td>
                      <td className="px-4 py-2.5">{statusPill(st.status)}</td>
                      <td className={cn("px-4 py-2.5 text-[11px]", sub)}>{fmtD(st.hire_date)}</td>
                      <td className="px-4 py-2.5"><div className="flex gap-1 justify-end">
                        <button onClick={() => openProfile(st.id)} className={cn("p-1.5 rounded-lg", hover, sub)} title="View"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => setConfirm({ title: "Reset password?", message: `A new temporary password will be emailed to ${st.profiles?.email}.`, confirmLabel: "Reset", onConfirm: () => act("/staff/reset-password", { id: st.id }, (r) => r.emailed ? "Password reset & emailed" : "Password reset") })} className={cn("p-1.5 rounded-lg", hover, sub)} title="Reset password"><KeyRound className="w-4 h-4" /></button>
                        {["suspended", "blocked", "inactive"].includes(st.status)
                          ? <button onClick={() => act("/staff/reactivate", { id: st.id }, "Reactivated", () => { loadList(list.page); loadDash(); })} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10" title="Reactivate"><Power className="w-4 h-4" /></button>
                          : <button onClick={() => setConfirm({ title: "Suspend staff?", message: `${st.profiles?.email} will lose access immediately and be notified.`, confirmLabel: "Suspend", danger: true, onConfirm: () => act("/staff/suspend", { id: st.id }, "Suspended", () => { loadList(list.page); loadDash(); }) })} className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-500/10" title="Suspend"><Ban className="w-4 h-4" /></button>}
                        <button onClick={() => setConfirm({ title: "Delete staff?", message: `${st.profiles?.email} and their account will be permanently removed.`, confirmLabel: "Delete", danger: true, onConfirm: () => act(`/staff/${st.id}`, {}, "Deleted", () => { loadList(1); loadDash(); }, "DELETE") })} className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div></td>
                    </tr>
                  ))}
              </tbody>
            </table></div>
          </div>
          {list.total > list.pageSize && <div className="flex items-center justify-between"><span className={cn("text-xs", sub)}>{list.total} staff · page {list.page}</span><div className="flex gap-1.5"><button disabled={list.page <= 1} onClick={() => loadList(list.page - 1)} className={cn(btnGhost, "h-8 disabled:opacity-40")}>Prev</button><button disabled={list.page * list.pageSize >= list.total} onClick={() => loadList(list.page + 1)} className={cn(btnGhost, "h-8 disabled:opacity-40")}>Next</button></div></div>}
        </div>
      )}

      {/* ADD STAFF MODAL */}
      {addOpen && form && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50" onClick={() => setAddOpen(false)}>
          <div className={cn("w-full max-w-2xl rounded-[18px] border p-5 space-y-4 max-h-[92vh] overflow-y-auto", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className={cn("text-base font-extrabold", txt)}>Add New Staff</p><button onClick={() => setAddOpen(false)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            <p className={cn("text-[11px] uppercase font-bold tracking-wider", sub)}>Personal Information</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><label className={labelCls}>First Name</label><input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Last Name</label><input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Full Name</label><input value={[form.first_name, form.last_name].filter(Boolean).join(" ")} disabled className={cn(inpCls, "opacity-60")} /></div>
              <div><label className={labelCls}>Email *</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Date of Birth</label><input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Gender</label><select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className={inpCls}><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></select></div>
              <div className="md:col-span-2"><label className={labelCls}>Address</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>City</label><input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>State</label><input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Country</label><input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Postal Code</label><input value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} className={inpCls} /></div>
            </div>
            <p className={cn("text-[11px] uppercase font-bold tracking-wider pt-1", sub)}>Professional Information</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><label className={labelCls}>Department</label><select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} className={inpCls}><option value="">—</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className={labelCls}>Job Title</label><input value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Hire Date</label><input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Contract Type</label><select value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))} className={inpCls}>{CONTRACTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><label className={labelCls}>Salary (optional)</label><input type="number" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inpCls}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <p className={cn("text-[11px] uppercase font-bold tracking-wider pt-1", sub)}>Authentication & Role</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><label className={labelCls}>Role</label><select value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))} className={inpCls}><option value="">— No role —</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              <div><label className={labelCls}>Temp Password (optional)</label><input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inpCls} placeholder="auto-generated" /></div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 cursor-pointer h-[42px]"><input type="checkbox" checked={form.must_change_password} onChange={e => setForm(f => ({ ...f, must_change_password: e.target.checked }))} className="rounded" /><span className={cn("text-xs font-semibold", txt)}>Force change</span></label>
                <label className="flex items-center gap-2 cursor-pointer h-[42px]"><input type="checkbox" checked={form.two_factor_enabled} onChange={e => setForm(f => ({ ...f, two_factor_enabled: e.target.checked }))} className="rounded" /><span className={cn("text-xs font-semibold", txt)}>2FA</span></label>
              </div>
            </div>
            <div className={cn("rounded-[10px] border p-2.5 text-[11px]", brd, sub)}>A real Supabase Auth account is created and a welcome email with login + temporary password is sent automatically. Secrets never touch the browser.</div>
            <button onClick={submitCreate} disabled={busy === "create" || !form.email} className={cn(btnPrimary, "w-full justify-center")}>{busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Create Staff & Send Invite</button>
          </div>
        </div>
      )}

      {/* CREATED INFO (temp password display) */}
      {createdInfo && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/50" onClick={() => setCreatedInfo(null)}>
          <div className={cn("w-full max-w-md rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Staff created</p>
            <p className={cn("text-sm", sub)}>Employee ID: <b className={txt}>{createdInfo.employee_id}</b></p>
            {createdInfo.tempPassword && <div className={cn("rounded-[10px] border p-3", brd)}><p className={cn("text-[11px]", sub)}>Temporary password (also emailed):</p><code className={cn("text-sm font-bold", txt)}>{createdInfo.tempPassword}</code></div>}
            <p className={cn("text-xs", createdInfo.emailed ? "text-emerald-600" : "text-amber-600")}>{createdInfo.emailed ? "✓ Welcome email sent" : `Email not sent${createdInfo.emailError ? `: ${createdInfo.emailError}` : " (configure RESEND_API_KEY)"}`}</p>
            <button onClick={() => setCreatedInfo(null)} className={cn(btnPrimary, "w-full justify-center")}>Done</button>
          </div>
        </div>
      )}

      {/* PROFILE DRAWER */}
      {profile && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setProfile(null)}>
          <div className={cn("w-full max-w-2xl h-full overflow-y-auto border-l", p, brd)} onClick={e => e.stopPropagation()}>
            {profile.loading ? <div className="p-10 flex justify-center"><Loader2 className={cn("w-6 h-6 animate-spin", sub)} /></div> : (() => { const st = profile.staff; const pr = st.profile || {}; const sp = st.staff_profiles || {}; return (
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3"><Avatar url={sp.avatar_url || pr.avatar_url} name={pr.full_name} size={56} /><div><p className={cn("text-lg font-extrabold", txt)}>{pr.full_name || "—"}</p><p className={cn("text-xs", sub)}>{st.employee_id} · {st.job_title || "—"}</p><div className="mt-1 flex gap-1.5">{statusPill(st.status)}{(st.roles || []).map((r, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${r.color}1a`, color: r.color }}>{r.name}</span>)}</div></div></div>
                  <button onClick={() => setProfile(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button>
                </div>
                <div className={cn("flex gap-1 border-b overflow-x-auto", brd)}>
                  {[["info", "Info"], ["permissions", "Roles"], ["activity", "Activity"], ["sessions", "Sessions"], ["documents", "Documents"], ["performance", "Performance"], ["notes", "Notes"]].map(([id, l]) => <button key={id} onClick={() => setProfileTab(id)} className={cn("px-3 py-2 text-xs font-bold whitespace-nowrap border-b-2 -mb-px", profileTab === id ? "border-[#2563eb] text-[#2563eb]" : cn("border-transparent", sub))}>{l}</button>)}
                </div>

                {profileTab === "info" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Email" icon={Mail} value={pr.email} txt={txt} sub={sub} />
                      <EditField label="Phone" value={sp.phone} onChange={v => setProfile(x => ({ ...x, staff: { ...x.staff, staff_profiles: { ...sp, phone: v } } }))} cls={inpCls} labelCls={labelCls} />
                      <EditSelect label="Department" value={st.department_id || ""} onChange={v => setProfile(x => ({ ...x, staff: { ...x.staff, department_id: v } }))} options={[["", "—"], ...departments.map(d => [d.id, d.name])]} cls={inpCls} labelCls={labelCls} />
                      <EditField label="Job Title" value={st.job_title} onChange={v => setProfile(x => ({ ...x, staff: { ...x.staff, job_title: v } }))} cls={inpCls} labelCls={labelCls} />
                      <EditSelect label="Contract" value={st.contract_type} onChange={v => setProfile(x => ({ ...x, staff: { ...x.staff, contract_type: v } }))} options={CONTRACTS} cls={inpCls} labelCls={labelCls} />
                      <EditSelect label="Status" value={st.status} onChange={v => setProfile(x => ({ ...x, staff: { ...x.staff, status: v } }))} options={STATUSES.map(s => [s, s])} cls={inpCls} labelCls={labelCls} />
                      <EditField label="City" value={sp.city} onChange={v => setProfile(x => ({ ...x, staff: { ...x.staff, staff_profiles: { ...sp, city: v } } }))} cls={inpCls} labelCls={labelCls} />
                      <EditField label="Country" value={sp.country} onChange={v => setProfile(x => ({ ...x, staff: { ...x.staff, staff_profiles: { ...sp, country: v } } }))} cls={inpCls} labelCls={labelCls} />
                      <Field label="Hire Date" icon={Clock} value={fmtD(st.hire_date)} txt={txt} sub={sub} />
                      <Field label="Joined" icon={Clock} value={fmtD(pr.created_at)} txt={txt} sub={sub} />
                    </div>
                    <button onClick={saveProfileEdit} disabled={busy === "save-profile"} className={btnPrimary}>{busy === "save-profile" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes</button>
                  </div>
                )}

                {profileTab === "permissions" && (
                  <div className="space-y-2">
                    <p className={cn("text-xs", sub)}>Assign or remove roles — permissions merge automatically.</p>
                    {roles.map(r => { const has = (st.roles || []).some(x => x?.name === r.name); return (
                      <div key={r.id} className={cn("flex items-center justify-between rounded-[10px] border p-2.5", brd)}>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${r.color}1a`, color: r.color }}>{r.name}</span>
                        <button onClick={() => act("/staff/assign-role", { user_id: st.id, role_id: r.id, op: has ? "unassign" : "assign" }, has ? "Removed" : "Assigned", () => openProfile(st.id))} className={cn("h-7 px-3 rounded-[8px] text-[11px] font-bold", has ? "bg-red-500/10 text-red-600" : "bg-[#2563eb] text-white")}>{has ? "Remove" : "Assign"}</button>
                      </div>
                    ); })}
                  </div>
                )}

                {profileTab === "activity" && (
                  <div className={cn("rounded-[12px] border divide-y", brd, divide)}>
                    {(profile.activity || []).length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No activity.</p> :
                      profile.activity.map(a => <div key={a.id} className="px-3 py-2.5 flex items-center gap-2"><span className={cn("w-1.5 h-1.5 rounded-full shrink-0", a.status === "error" ? "bg-red-500" : "bg-emerald-500")} /><span className={cn("text-xs font-semibold capitalize", txt)}>{(a.action || "").replace(/_/g, " ")}</span><span className={cn("text-[10px] truncate", sub)}>{a.detail}</span><span className={cn("text-[10px] ml-auto shrink-0", sub)}>{a.ip_address || ""} · {fmtDT(a.created_at)}</span></div>)}
                  </div>
                )}

                {profileTab === "sessions" && (
                  <div className="space-y-2">
                    {(profile.sessions || []).filter(x => !x.revoked).length > 0 && <button onClick={() => act("/staff/sessions", { staff_id: st.id, all: true }, "All sessions revoked", () => openProfile(st.id))} className="h-8 px-3 rounded-[9px] text-xs font-bold bg-red-500/10 text-red-600 flex items-center gap-1.5"><LogOut className="w-3.5 h-3.5" /> Sign out all sessions</button>}
                    <div className={cn("rounded-[12px] border divide-y", brd, divide)}>
                      {(profile.sessions || []).length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No sessions recorded.</p> :
                        profile.sessions.map(sess => <div key={sess.id} className="px-3 py-2.5 flex items-center gap-2"><Monitor className={cn("w-4 h-4 shrink-0", sess.revoked ? sub : "text-emerald-500")} /><div className="min-w-0 flex-1"><p className={cn("text-xs font-semibold truncate", txt)}>{sess.browser || "Unknown"} · {sess.os || ""}</p><p className={cn("text-[10px]", sub)}>{sess.ip_address || "—"} · {sess.city || ""} {sess.country || ""} · {timeAgo(sess.last_activity)}</p></div>{sess.revoked ? <span className={cn("text-[10px]", sub)}>revoked</span> : <button onClick={() => act("/staff/sessions", { session_id: sess.id }, "Session revoked", () => openProfile(st.id))} className="text-red-500 text-[11px] font-bold">Revoke</button>}</div>)}
                    </div>
                  </div>
                )}

                {profileTab === "documents" && (
                  <div className="space-y-3">
                    <DocAdd staffId={st.id} onAdd={() => openProfile(st.id)} api={api} showToast={showToast} inpCls={inpCls} labelCls={labelCls} btnPrimary={btnPrimary} brd={brd} txt={txt} />
                    <div className={cn("rounded-[12px] border divide-y", brd, divide)}>
                      {(profile.documents || []).length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No documents.</p> :
                        profile.documents.map(doc => <div key={doc.id} className="px-3 py-2.5 flex items-center gap-2"><FileText className={cn("w-4 h-4 shrink-0", sub)} /><a href={doc.url} target="_blank" rel="noreferrer" className={cn("text-xs font-semibold flex-1 truncate hover:underline", txt)}>{doc.name}</a><span className={cn("text-[10px]", sub)}>{doc.type}</span><button onClick={async () => { await api(`/staff/documents?id=${doc.id}`, { method: "DELETE" }); openProfile(st.id); }} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>)}
                    </div>
                  </div>
                )}

                {profileTab === "performance" && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[["Orders Processed", profile.performance?.orders_processed], ["Products Created", profile.performance?.products_created], ["Products Updated", profile.performance?.products_updated], ["Tickets Resolved", profile.performance?.tickets_resolved], ["Logins", profile.performance?.logins]].map(([l, v]) => <div key={l} className={cn(cardCls, "p-3.5")}><p className={cn("text-[19px] font-extrabold", txt)}>{v || 0}</p><p className={cn("text-[11px]", sub)}>{l}</p></div>)}
                    <div className={cn(cardCls, "p-3.5")}><p className={cn("text-xs font-bold", txt)}>{timeAgo(profile.performance?.last_activity)}</p><p className={cn("text-[11px]", sub)}>Last Activity</p></div>
                  </div>
                )}

                {profileTab === "notes" && (
                  <div className="space-y-2">
                    <p className={cn("text-[11px] flex items-center gap-1.5", sub)}><StickyNote className="w-3.5 h-3.5" /> Internal notes — admin only.</p>
                    <textarea rows={6} value={st.notes || ""} onChange={e => setProfile(x => ({ ...x, staff: { ...x.staff, notes: e.target.value } }))} className={taCls} placeholder="Add internal notes…" />
                    <button onClick={saveProfileEdit} disabled={busy === "save-profile"} className={btnPrimary}>{busy === "save-profile" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Notes</button>
                  </div>
                )}
              </div>
            ); })()}
          </div>
        </div>
      )}

      {/* CONFIRM */}
      {confirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirm(null)}>
          <div className={cn("w-full max-w-sm rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><AlertTriangle className={cn("w-5 h-5", confirm.danger ? "text-red-500" : "text-amber-500")} /> {confirm.title}</p>
            <p className={cn("text-sm", sub)}>{confirm.message}</p>
            <div className="flex gap-2 justify-end"><button onClick={() => setConfirm(null)} className={btnGhost}>Cancel</button><button onClick={() => { confirm.onConfirm(); setConfirm(null); }} className={cn("h-10 px-4 rounded-[11px] text-white text-sm font-bold", confirm.danger ? "bg-red-500 hover:bg-red-600" : "bg-[#2563eb] hover:bg-[#1d4ed8]")}>{confirm.confirmLabel || "Confirm"}</button></div>
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200 max-w-sm", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}

function Field({ label, icon: Icon, value, txt, sub }) {
  return <div><label className={cn("text-[11px] font-semibold flex items-center gap-1", sub)}><Icon className="w-3 h-3" /> {label}</label><p className={cn("text-sm font-semibold mt-0.5 truncate", txt)}>{value || "—"}</p></div>;
}
function EditField({ label, value, onChange, cls, labelCls }) {
  return <div><label className={labelCls}>{label}</label><input value={value || ""} onChange={e => onChange(e.target.value)} className={cls} /></div>;
}
function EditSelect({ label, value, onChange, options, cls, labelCls }) {
  return <div><label className={labelCls}>{label}</label><select value={value} onChange={e => onChange(e.target.value)} className={cls}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>;
}
function DocAdd({ staffId, onAdd, api, showToast, inpCls, labelCls, btnPrimary, brd, txt }) {
  const [d, setD] = useState({ type: "other", name: "", url: "" });
  const [busy, setBusy] = useState(false);
  return (
    <div className={cn("rounded-[12px] border p-3 grid grid-cols-2 gap-2 items-end", brd)}>
      <div><label className={labelCls}>Type</label><select value={d.type} onChange={e => setD(s => ({ ...s, type: e.target.value }))} className={inpCls}>{DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <div><label className={labelCls}>Name</label><input value={d.name} onChange={e => setD(s => ({ ...s, name: e.target.value }))} className={inpCls} /></div>
      <div className="col-span-2"><label className={labelCls}>Document URL</label><input value={d.url} onChange={e => setD(s => ({ ...s, url: e.target.value }))} className={inpCls} placeholder="https://…" /></div>
      <button disabled={busy || !d.url} onClick={async () => { setBusy(true); try { await api("/staff/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staff_id: staffId, ...d }) }); setD({ type: "other", name: "", url: "" }); onAdd(); } catch (e) { showToast(e.message, "error"); } finally { setBusy(false); } }} className={cn(btnPrimary, "col-span-2 justify-center")}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Add Document</button>
    </div>
  );
}
function BarList({ rows, dark, txt, sub, colored }) {
  const list = rows || []; const max = Math.max(...list.map(r => r.count), 1);
  return list.length === 0 ? <p className={cn("text-xs", sub)}>No data.</p> : (
    <div className="space-y-1.5">{list.map((r, i) => (
      <div key={i} className="flex items-center gap-2"><span className={cn("text-[11px] font-semibold w-28 truncate", txt)}>{r.name}</span><div className={cn("flex-1 h-4 rounded-[5px] overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}><div className="h-full rounded-[5px]" style={{ width: `${(r.count / max) * 100}%`, backgroundColor: colored && r.color ? r.color : "#2563eb" }} /></div><span className={cn("text-[11px] font-bold w-8 text-right", txt)}>{r.count}</span></div>
    ))}</div>
  );
}
