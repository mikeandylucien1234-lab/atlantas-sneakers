// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Shield, LayoutDashboard, Users, Grid3x3, History, Plus, Loader2, Save, Trash2,
  X, Search, Download, Crown, Lock, Check, AlertTriangle, Power, Edit3, ChevronRight,
  UserCog, CheckCircle2, XCircle, Filter,
} from "lucide-react";

type Props = { dark: boolean };

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "roles", label: "Roles", icon: Shield },
  { id: "matrix", label: "Permission Matrix", icon: Grid3x3 },
  { id: "users", label: "User Assignment", icon: Users },
  { id: "audit", label: "Audit Log", icon: History },
];
const ACTIONS = ["view", "create", "edit", "delete", "export", "import", "approve", "publish", "manage", "settings"];
const COLORS = ["#dc2626", "#2563eb", "#7c3aed", "#0891b2", "#ea7317", "#16a34a", "#ca8a04", "#db2777", "#059669", "#6366f1", "#0d9488", "#8b5cf6"];
const ICONS = ["Shield", "Crown", "Store", "Package", "ShoppingCart", "Users", "Boxes", "Megaphone", "DollarSign", "Headphones", "FileText", "Tag", "Truck", "Eye", "Code"];

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return "never"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

export function AdminRoles({ dark }: Props) {
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
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [audit, setAudit] = useState([]);
  const [users, setUsers] = useState({ users: [], total: 0, page: 1 });
  const [userSearch, setUserSearch] = useState("");

  const [editRole, setEditRole] = useState(null);
  const [roleSearch, setRoleSearch] = useState("");

  // matrix state
  const [matrixRole, setMatrixRole] = useState(null);
  const [matrixPerms, setMatrixPerms] = useState(new Set());
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [assignUser, setAssignUser] = useState(null);

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3000); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadRoles = useCallback(async () => { try { const r = await api("/roles?section=list"); setRoles(r.roles || []); } catch (e) { showToast(e.message, "error"); } }, [api, showToast]);
  const loadDash = useCallback(async () => { try { setDash(await api("/roles?section=dashboard")); } catch {} }, [api]);
  const loadPerms = useCallback(async () => { try { const r = await api("/roles?section=permissions"); setPermissions(r.permissions || []); } catch {} }, [api]);
  const loadAudit = useCallback(async () => { try { const r = await api("/roles?section=audit"); setAudit(r.audit || []); } catch {} }, [api]);
  const loadUsers = useCallback(async (page = 1, q = "") => { try { const r = await api(`/roles?section=users&page=${page}&q=${encodeURIComponent(q)}`); setUsers({ users: r.users, total: r.total, page }); } catch {} }, [api]);

  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadDash(), loadRoles(), loadPerms()]); setLoading(false); })(); }, [loadDash, loadRoles, loadPerms]);
  useEffect(() => {
    if (tab === "dashboard") loadDash();
    if (tab === "roles") loadRoles();
    if (tab === "audit") loadAudit();
    if (tab === "users") loadUsers(1, userSearch);
  }, [tab]); // eslint-disable-line

  // Load matrix perms when role selected
  const selectMatrixRole = async (role) => {
    setMatrixRole(role); setMatrixDirty(false);
    if (role.is_super) { setMatrixPerms(new Set(permissions.map(p => p.id))); return; }
    try { const r = await api(`/roles?section=role_permissions&role_id=${role.id}`); setMatrixPerms(new Set(r.permission_ids || [])); } catch {}
  };
  useEffect(() => { if (tab === "matrix" && !matrixRole && roles.length) selectMatrixRole(roles.find(r => !r.is_super) || roles[0]); }, [tab, roles]); // eslint-disable-line

  const post = async (body, okMsg, after) => {
    setBusy(body.action);
    try { const r = await api("/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (okMsg) showToast(typeof okMsg === "function" ? okMsg(r) : okMsg); if (after) await after(r); return r; }
    catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };

  const permByModule = useMemo(() => {
    const map = {};
    permissions.filter(p => !p.is_special).forEach(p => { (map[p.module] = map[p.module] || {})[p.action] = p; });
    return map;
  }, [permissions]);
  const specialPerms = useMemo(() => permissions.filter(p => p.is_special), [permissions]);
  const modules = useMemo(() => Object.keys(permByModule).sort(), [permByModule]);

  const toggleMatrix = (permId) => { if (matrixRole?.is_super) return; setMatrixPerms(s => { const n = new Set(s); n.has(permId) ? n.delete(permId) : n.add(permId); return n; }); setMatrixDirty(true); };
  const toggleModuleRow = (mod, on) => { if (matrixRole?.is_super) return; setMatrixPerms(s => { const n = new Set(s); Object.values(permByModule[mod]).forEach(pm => on ? n.add(pm.id) : n.delete(pm.id)); return n; }); setMatrixDirty(true); };
  const saveMatrix = () => post({ action: "set_permissions", role_id: matrixRole.id, permission_ids: [...matrixPerms] }, "Permissions saved", () => { setMatrixDirty(false); loadRoles(); });

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const kpis = [
    { label: "Total Roles", value: K.totalRoles || 0, icon: Shield, color: "#2563eb" },
    { label: "Active Roles", value: K.activeRoles || 0, icon: CheckCircle2, color: "#16a34a" },
    { label: "Disabled Roles", value: K.disabledRoles || 0, icon: XCircle, color: "#8a929c" },
    { label: "Administrators", value: K.admins || 0, icon: Crown, color: "#dc2626" },
    { label: "Managers", value: K.managers || 0, icon: UserCog, color: "#7c3aed" },
    { label: "Sellers", value: K.sellers || 0, icon: Users, color: "#ea7317" },
    { label: "Staff", value: K.staff || 0, icon: Users, color: "#0891b2" },
    { label: "Admin Profiles", value: K.adminProfiles || 0, icon: Shield, color: "#16a34a" },
  ];

  const RoleBadge = ({ role, small }) => <span className={cn("inline-flex items-center gap-1 rounded-full font-bold", small ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1")} style={{ backgroundColor: `${role.color}1a`, color: role.color }}>{role.is_super && <Crown className="w-3 h-3" />}{role.name}</span>;
  const statusPill = (s) => <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold capitalize", s === "active" ? "bg-emerald-500/15 text-emerald-600" : s === "suspended" ? "bg-red-500/15 text-red-600" : "bg-gray-500/15 text-gray-500")}>{s}</span>;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Shield className="w-5 h-5 text-[#2563eb]" /> Roles & Permissions</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Enterprise RBAC · {roles.length} roles · {permissions.length} permissions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/roles?section=export" className={btnGhost}><Download className="w-4 h-4" /> Export CSV</a>
          <button onClick={() => setEditRole({ name: "", description: "", color: "#2563eb", icon: "Shield", priority: 50, status: "active", notes: "" })} className={btnPrimary}><Plus className="w-4 h-4" /> Add Role</button>
        </div>
      </div>

      {/* TABS */}
      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === t.id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><t.icon className="w-3.5 h-3.5" /> {t.label}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{kpis.map(k => (
            <div key={k.label} className={cn(cardCls, "p-3.5")}><div className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-2" style={{ backgroundColor: `${k.color}1a` }}><k.icon className="w-4 h-4" style={{ color: k.color }} /></div><p className={cn("text-[18px] font-extrabold", txt)}>{k.value}</p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
          ))}</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={cn(cardCls, "p-4")}>
              <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Users per Role</p>
              <div className="space-y-1.5">
                {(dash.distribution || []).slice(0, 12).map((d, i) => { const max = Math.max(...dash.distribution.map(x => x.count), 1); return (
                  <div key={i} className="flex items-center gap-2"><span className={cn("text-[11px] font-semibold w-32 truncate", txt)}>{d.name}</span><div className={cn("flex-1 h-4 rounded-[5px] overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}><div className="h-full rounded-[5px]" style={{ width: `${(d.count / max) * 100}%`, backgroundColor: d.color }} /></div><span className={cn("text-[11px] font-bold w-8 text-right", txt)}>{d.count}</span></div>
                ); })}
              </div>
            </div>
            <div className={cn(cardCls, "overflow-hidden")}>
              <p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b", sub, brd)}>Recent Activity</p>
              <div className={cn("divide-y max-h-80 overflow-y-auto", divide)}>
                {(dash.activity || []).length === 0 ? <p className={cn("p-4 text-xs", sub)}>No activity yet.</p> :
                  dash.activity.map((a, i) => <div key={i} className="px-4 py-2.5 flex items-center gap-2"><span className={cn("w-1.5 h-1.5 rounded-full shrink-0", a.status === "error" ? "bg-red-500" : "bg-emerald-500")} /><span className={cn("text-xs font-semibold capitalize", txt)}>{(a.event || "").replace(/_/g, " ")}</span><span className={cn("text-[10px] truncate", sub)}>{a.detail}</span><span className={cn("text-[10px] ml-auto shrink-0", sub)}>{timeAgo(a.created_at)}</span></div>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ROLES LIST */}
      {tab === "roles" && (
        <div className="space-y-3">
          <div className="relative max-w-sm"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={roleSearch} onChange={e => setRoleSearch(e.target.value)} className={cn(inpCls, "pl-9")} placeholder="Search roles…" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {roles.filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase())).map(r => (
              <div key={r.id} className={cn(cardCls, "p-4")}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5"><div className="w-10 h-10 rounded-[11px] flex items-center justify-center" style={{ backgroundColor: `${r.color}1a` }}>{r.is_super ? <Crown className="w-5 h-5" style={{ color: r.color }} /> : <Shield className="w-5 h-5" style={{ color: r.color }} />}</div>
                    <div><p className={cn("text-sm font-extrabold flex items-center gap-1.5", txt)}>{r.name} {r.is_super && <Lock className="w-3 h-3 text-amber-500" />}</p><div className="flex items-center gap-1.5 mt-0.5">{statusPill(r.status)}<span className={cn("text-[10px]", sub)}>priority {r.priority}</span></div></div>
                  </div>
                </div>
                <p className={cn("text-[11px] mt-2 line-clamp-2 min-h-[28px]", sub)}>{r.description || "—"}</p>
                <div className={cn("flex items-center justify-between mt-2 pt-2 border-t text-[11px]", brd)}>
                  <span className={sub}><b className={txt}>{r.permission_count}</b> perms · <b className={txt}>{r.user_count}</b> users</span>
                  <div className="flex gap-1">
                    <button onClick={() => { setTab("matrix"); setTimeout(() => selectMatrixRole(r), 0); }} className={cn("p-1.5 rounded-lg", hover, sub)} title="Permissions"><Grid3x3 className="w-4 h-4" /></button>
                    {!r.is_super && <button onClick={() => setEditRole(r)} className={cn("p-1.5 rounded-lg", hover, sub)} title="Edit"><Edit3 className="w-4 h-4" /></button>}
                    {!r.is_super && !r.is_system && <button onClick={() => setConfirm({ title: "Delete role?", message: r.name, onConfirm: () => post({ action: "delete", id: r.id }, "Deleted", loadRoles) })} className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10" title="Delete"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MATRIX */}
      {tab === "matrix" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap items-center gap-3")}>
            <span className={labelCls + " !mb-0"}>Role:</span>
            <select value={matrixRole?.id || ""} onChange={e => { const r = roles.find(x => x.id === e.target.value); if (r) selectMatrixRole(r); }} className={cn(inpCls, "w-auto")}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}{r.is_super ? " (all)" : ""}</option>)}
            </select>
            {matrixRole?.is_super && <span className="text-xs font-semibold text-amber-600 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Super Administrator always has all permissions</span>}
            <button onClick={saveMatrix} disabled={!matrixDirty || busy === "set_permissions" || matrixRole?.is_super} className={cn(btnPrimary, "ml-auto")}>{busy === "set_permissions" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Matrix</button>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className={cn("border-b", brd)}><th className={cn("px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider sticky left-0 z-10", sub, p)}>Module</th>{ACTIONS.map(a => <th key={a} className={cn("px-2 py-2.5 text-[10px] font-bold uppercase", sub)}>{a}</th>)}<th className={cn("px-2 py-2.5 text-[10px] font-bold uppercase", sub)}>All</th></tr></thead>
                <tbody className={cn("divide-y", divide)}>
                  {modules.map(mod => { const rowPerms = permByModule[mod]; const allOn = Object.values(rowPerms).every(pm => matrixPerms.has(pm.id)); return (
                    <tr key={mod} className={hover}>
                      <td className={cn("px-3 py-2 font-semibold capitalize sticky left-0 z-10", txt, p)}>{mod.replace(/_/g, " ")}</td>
                      {ACTIONS.map(a => { const pm = rowPerms[a]; return <td key={a} className="px-2 py-2 text-center">{pm ? <Toggle on={matrixPerms.has(pm.id)} disabled={matrixRole?.is_super} onClick={() => toggleMatrix(pm.id)} dark={dark} /> : <span className={cn("text-[10px]", sub)}>—</span>}</td>; })}
                      <td className="px-2 py-2 text-center"><button disabled={matrixRole?.is_super} onClick={() => toggleModuleRow(mod, !allOn)} className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", allOn ? "bg-emerald-500/15 text-emerald-600" : cn(sub, hover))}>{allOn ? "✓" : "all"}</button></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          </div>
          {/* Special permissions */}
          <div className={cn(cardCls, "p-4")}>
            <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Special Permissions</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {specialPerms.map(pm => (
                <label key={pm.id} className={cn("flex items-center justify-between rounded-[10px] border p-2.5", brd, matrixRole?.is_super ? "" : "cursor-pointer " + hover)}>
                  <span className={cn("text-[13px] font-semibold", txt)}>{pm.label}</span>
                  <Toggle on={matrixPerms.has(pm.id)} disabled={matrixRole?.is_super} onClick={() => toggleMatrix(pm.id)} dark={dark} />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* USERS */}
      {tab === "users" && (
        <div className="space-y-3">
          <div className="relative max-w-sm"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={userSearch} onChange={e => { setUserSearch(e.target.value); loadUsers(1, e.target.value); }} className={cn(inpCls, "pl-9")} placeholder="Search users…" /></div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Name", "Email", "Roles", "Account", "Joined", ""].map(h => <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {users.users.length === 0 ? <tr><td colSpan={6} className={cn("px-4 py-8 text-center text-xs", sub)}>No users.</td></tr> :
                  users.users.map(u => (
                    <tr key={u.id}>
                      <td className={cn("px-4 py-2.5 font-semibold", txt)}>{u.full_name || "—"}</td>
                      <td className={cn("px-4 py-2.5", sub)}>{u.email}</td>
                      <td className="px-4 py-2.5"><div className="flex flex-wrap gap-1">{(u.roles || []).length === 0 ? <span className={cn("text-[10px]", sub)}>{u.role === "admin" ? "Legacy admin" : "—"}</span> : u.roles.map((r, i) => r && <RoleBadge key={i} role={r} small />)}</div></td>
                      <td className="px-4 py-2.5">{statusPill(u.role === "suspended" ? "suspended" : u.role === "admin" ? "active" : "customer")}</td>
                      <td className={cn("px-4 py-2.5 text-[11px]", sub)}>{fmtDT(u.created_at)}</td>
                      <td className="px-4 py-2.5"><div className="flex gap-1 justify-end">
                        <button onClick={() => setAssignUser(u)} className={cn("h-7 px-2.5 rounded-[8px] text-[11px] font-bold border flex items-center gap-1", brd, txt, hover)}><UserCog className="w-3.5 h-3.5" /> Roles</button>
                        {u.role === "suspended" ? <button onClick={() => post({ action: "set_user_status", user_id: u.id, status: "active" }, "Reactivated", () => loadUsers(users.page, userSearch))} className="h-7 px-2.5 rounded-[8px] text-[11px] font-bold bg-emerald-500/10 text-emerald-600">Reactivate</button>
                          : u.role === "admin" && <button onClick={() => setConfirm({ title: "Suspend user?", message: `${u.email} will lose admin access.`, onConfirm: () => post({ action: "set_user_status", user_id: u.id, status: "suspended" }, "Suspended", () => loadUsers(users.page, userSearch)) })} className="h-7 px-2.5 rounded-[8px] text-[11px] font-bold bg-red-500/10 text-red-600">Suspend</button>}
                      </div></td>
                    </tr>
                  ))}
              </tbody>
            </table></div>
          </div>
          {users.total > users.pageSize && <div className="flex items-center justify-between"><span className={cn("text-xs", sub)}>{users.total} users</span><div className="flex gap-1.5"><button disabled={users.page <= 1} onClick={() => loadUsers(users.page - 1, userSearch)} className={cn(btnGhost, "h-8 disabled:opacity-40")}>Prev</button><button disabled={users.page * users.pageSize >= users.total} onClick={() => loadUsers(users.page + 1, userSearch)} className={cn(btnGhost, "h-8 disabled:opacity-40")}>Next</button></div></div>}
        </div>
      )}

      {/* AUDIT */}
      {tab === "audit" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Audit Log</p>
          {audit.length === 0 ? <p className={cn("p-8 text-center text-xs", sub)}>No activity yet.</p> : (
            <div className={cn("divide-y max-h-[600px] overflow-y-auto", divide)}>
              {audit.map(a => <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 min-w-0"><span className={cn("w-1.5 h-1.5 rounded-full shrink-0", a.status === "error" ? "bg-red-500" : "bg-emerald-500")} /><span className={cn("text-xs font-bold capitalize", txt)}>{(a.event || "").replace(/_/g, " ")}</span>{a.detail && <span className={cn("text-[10px] truncate", sub)}>· {a.detail}</span>}</div><span className={cn("text-[10px] shrink-0", sub)}>{a.actor_name} · {a.ip_address || "—"} · {fmtDT(a.created_at)}</span></div>)}
            </div>
          )}
        </div>
      )}

      {/* ROLE EDITOR MODAL */}
      {editRole && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50" onClick={() => setEditRole(null)}>
          <div className={cn("w-full max-w-lg rounded-[18px] border p-5 space-y-3 max-h-[90vh] overflow-y-auto", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className={cn("text-base font-extrabold", txt)}>{editRole.id ? "Edit Role" : "New Role"}</p><button onClick={() => setEditRole(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            <div><label className={labelCls}>Role Name *</label><input value={editRole.name} onChange={e => setEditRole(s => ({ ...s, name: e.target.value }))} className={inpCls} placeholder="e.g. Regional Manager" /></div>
            <div><label className={labelCls}>Description</label><textarea rows={2} value={editRole.description || ""} onChange={e => setEditRole(s => ({ ...s, description: e.target.value }))} className={taCls} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Priority</label><input type="number" value={editRole.priority} onChange={e => setEditRole(s => ({ ...s, priority: parseInt(e.target.value) || 50 }))} className={inpCls} /><p className={cn("text-[10px] mt-1", sub)}>Lower = higher authority</p></div>
              <div><label className={labelCls}>Status</label><select value={editRole.status} onChange={e => setEditRole(s => ({ ...s, status: e.target.value }))} className={inpCls}><option value="active">Active</option><option value="disabled">Disabled</option></select></div>
            </div>
            <div><label className={labelCls}>Color</label><div className="flex flex-wrap gap-2">{COLORS.map(c => <button key={c} onClick={() => setEditRole(s => ({ ...s, color: c }))} className={cn("w-7 h-7 rounded-full border-2 transition-transform", editRole.color === c ? "scale-110 border-white shadow" : "border-transparent")} style={{ backgroundColor: c }} />)}</div></div>
            <div><label className={labelCls}>Icon</label><select value={editRole.icon} onChange={e => setEditRole(s => ({ ...s, icon: e.target.value }))} className={inpCls}>{ICONS.map(i => <option key={i} value={i}>{i}</option>)}</select></div>
            <div><label className={labelCls}>Internal Notes</label><textarea rows={2} value={editRole.notes || ""} onChange={e => setEditRole(s => ({ ...s, notes: e.target.value }))} className={taCls} /></div>
            <button onClick={() => post(editRole.id ? { action: "update", ...editRole } : { action: "create", ...editRole }, "Role saved", () => { loadRoles(); setEditRole(null); })} disabled={busy === "create" || busy === "update" || !editRole.name} className={cn(btnPrimary, "w-full justify-center")}>{(busy === "create" || busy === "update") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Role</button>
          </div>
        </div>
      )}

      {/* ASSIGN ROLES MODAL */}
      {assignUser && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50" onClick={() => setAssignUser(null)}>
          <div className={cn("w-full max-w-md rounded-[18px] border p-5 space-y-3 max-h-[90vh] overflow-y-auto", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><div><p className={cn("text-base font-extrabold", txt)}>Assign Roles</p><p className={cn("text-xs", sub)}>{assignUser.email}</p></div><button onClick={() => setAssignUser(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            <p className={cn("text-[11px]", sub)}>A user can hold multiple roles — permissions are merged automatically.</p>
            <div className="space-y-1.5">
              {roles.map(r => { const has = (assignUser.roles || []).some(x => x?.key === r.key); return (
                <div key={r.id} className={cn("flex items-center justify-between rounded-[10px] border p-2.5", brd)}>
                  <RoleBadge role={r} small />
                  <button onClick={async () => { await post({ action: has ? "unassign_role" : "assign_role", user_id: assignUser.id, role_id: r.id }, has ? "Removed" : "Assigned"); const nu = { ...assignUser, roles: has ? assignUser.roles.filter(x => x?.key !== r.key) : [...(assignUser.roles || []), { key: r.key, name: r.name, color: r.color, status: r.status }] }; setAssignUser(nu); loadUsers(users.page, userSearch); }} className={cn("h-7 px-3 rounded-[8px] text-[11px] font-bold", has ? "bg-red-500/10 text-red-600" : "bg-[#2563eb] text-white")}>{has ? "Remove" : "Assign"}</button>
                </div>
              ); })}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM */}
      {confirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirm(null)}>
          <div className={cn("w-full max-w-sm rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><AlertTriangle className="w-5 h-5 text-amber-500" /> {confirm.title}</p>
            <p className={cn("text-sm", sub)}>{confirm.message}</p>
            <div className="flex gap-2 justify-end"><button onClick={() => setConfirm(null)} className={btnGhost}>Cancel</button><button onClick={() => { confirm.onConfirm(); setConfirm(null); }} className="h-10 px-4 rounded-[11px] bg-red-500 text-white text-sm font-bold hover:bg-red-600">Confirm</button></div>
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}

function Toggle({ on, disabled, onClick, dark }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={cn("w-9 h-5 rounded-full transition-colors relative shrink-0 mx-auto", disabled ? "opacity-50 cursor-not-allowed" : "", on ? "bg-emerald-500" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}><span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} /></button>;
}
