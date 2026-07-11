// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, LayoutDashboard, KeyRound, Lock, Fingerprint, LogIn, Monitor,
  Smartphone, Code2, Globe2, Flame, FileCode2, ShieldAlert, ScrollText, FileSearch,
  Loader2, Save, RefreshCw, Search, X, Ban, CheckCircle2, XCircle, AlertTriangle,
  Trash2, Plus, Power, Wifi, Activity, Server, ListChecks, Copy,
} from "lucide-react";

type Props = { dark: boolean };

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "authentication", label: "Authentication", icon: LogIn },
  { id: "password", label: "Password Policy", icon: Lock },
  { id: "twofa", label: "2FA", icon: Fingerprint },
  { id: "login", label: "Login Security", icon: KeyRound },
  { id: "sessions", label: "Sessions", icon: Monitor },
  { id: "devices", label: "Devices", icon: Smartphone },
  { id: "api", label: "API Security", icon: Code2 },
  { id: "ip", label: "IP Security", icon: Globe2 },
  { id: "firewall", label: "Firewall", icon: Flame },
  { id: "headers", label: "Headers", icon: FileCode2 },
  { id: "encryption", label: "Encryption", icon: KeyRound },
  { id: "alerts", label: "Alerts", icon: ShieldAlert },
  { id: "logs", label: "Security Logs", icon: ScrollText },
  { id: "audit", label: "Audit Log", icon: ListChecks },
  { id: "scanner", label: "Malware Scan", icon: FileSearch },
];
const LEVEL = { secure: { c: "#16a34a", l: "Secure" }, warning: { c: "#ea7317", l: "Attention" }, critical: { c: "#dc2626", l: "Critical" } };
const SEV = { critical: "#dc2626", medium: "#ea7317", low: "#16a34a" };

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return "never"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

export function AdminSecurity({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inpBg = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inpBg, "focus:border-[#2563eb]");
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
  const [settings, setSettings] = useState(null);
  const [dash, setDash] = useState(null);
  const [d, setD] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [newKey, setNewKey] = useState(null);

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3200); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api/security${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadSettings = useCallback(async () => { try { const r = await api("/settings"); setSettings(r.settings); } catch {} }, [api]);
  const loadDash = useCallback(async () => { try { setDash(await api("/dashboard")); } catch {} }, [api]);
  const loadSection = useCallback(async (section, key) => { try { const r = await api(`/${section}`); setD(prev => ({ ...prev, [key || section]: r })); } catch {} }, [api]);

  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadSettings(), loadDash()]); setLoading(false); })(); }, [loadSettings, loadDash]);
  useEffect(() => {
    const map = { sessions: "sessions", devices: "devices", ip: "ip-lists", firewall: "firewall", alerts: "alerts", logs: "logs", audit: "audit", api: "api-keys", encryption: "encryption", dashboard: "dashboard" };
    if (map[tab]) { if (tab === "dashboard") loadDash(); else loadSection(map[tab], tab); }
  }, [tab]); // eslint-disable-line

  const patch = (group, key, val) => setSettings(s => ({ ...s, [group]: { ...(s[group] || {}), [key]: val } }));
  const saveGroup = async (groups) => {
    setBusy("save");
    try { const body = {}; groups.forEach(g => { body[g] = settings[g]; }); await api("/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); showToast("Settings applied"); }
    catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };
  const post = async (action, body, okMsg, after) => {
    setBusy(action);
    try { const r = await api(`/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }); if (okMsg) showToast(typeof okMsg === "function" ? okMsg(r) : okMsg); if (after) await after(r); return r; }
    catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };

  if (loading || !settings) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const Toggle = ({ on, onClick }) => <button type="button" onClick={onClick} className={cn("w-10 h-5 rounded-full transition-colors relative shrink-0", on ? "bg-emerald-500" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}><span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform", on ? "translate-x-[22px]" : "translate-x-0.5")} /></button>;
  const Row = ({ label, hint, children }) => <div className={cn("flex items-center justify-between gap-4 rounded-[11px] border p-3", brd)}><div><p className={cn("text-sm font-semibold", txt)}>{label}</p>{hint && <p className={cn("text-[11px] mt-0.5", sub)}>{hint}</p>}</div>{children}</div>;
  const NumRow = ({ label, group, k, hint, min, max }) => <Row label={label} hint={hint}><input type="number" min={min} max={max} value={settings[group]?.[k] ?? 0} onChange={e => patch(group, k, parseInt(e.target.value) || 0)} className={cn(inpCls, "w-24 h-9")} /></Row>;
  const TogRow = ({ label, group, k, hint }) => <Row label={label} hint={hint}><Toggle on={!!settings[group]?.[k]} onClick={() => patch(group, k, !settings[group]?.[k])} /></Row>;
  const SaveBtn = ({ groups }) => <button onClick={() => saveGroup(groups)} disabled={busy === "save"} className={btnPrimary}>{busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Apply & Save</button>;

  const sc = dash?.score;
  const kpis = dash ? [
    { label: "Logins Today", value: dash.kpis.loginsToday, icon: LogIn },
    { label: "Failed Attempts", value: dash.kpis.failedToday, icon: XCircle, warn: dash.kpis.failedToday > 0 },
    { label: "Locked Accounts", value: dash.kpis.lockedAccounts, icon: Lock },
    { label: "Active Sessions", value: dash.kpis.activeSessions, icon: Monitor },
    { label: "Online Now", value: dash.kpis.onlineNow, icon: Wifi },
    { label: "Connected Devices", value: dash.kpis.connectedDevices, icon: Smartphone },
    { label: "Active API Keys", value: dash.kpis.activeApiKeys, icon: Code2 },
    { label: "Threats Blocked", value: dash.kpis.threatsBlocked, icon: ShieldCheck },
    { label: "Critical Alerts", value: dash.kpis.criticalAlerts, icon: ShieldAlert, crit: dash.kpis.criticalAlerts > 0 },
    { label: "Medium Alerts", value: dash.kpis.mediumAlerts, icon: AlertTriangle, warn: dash.kpis.mediumAlerts > 0 },
  ] : [];

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><ShieldCheck className="w-5 h-5 text-[#2563eb]" /> Security Center</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Enterprise protection · last scan {timeAgo(settings.updated_at)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => post("test", { sample: "Password123!" }, null, (r) => setTestResult(r))} disabled={busy === "test"} className={btnGhost}>{busy === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />} Run Security Test</button>
          <button onClick={() => setConfirm({ title: "Sign out all sessions?", message: "Every tracked staff session will be revoked immediately.", danger: true, onConfirm: () => post("logout-all", {}, "All sessions revoked", () => loadDash()) })} className={cn(btnGhost, "text-red-500")}><Power className="w-4 h-4" /> Logout All</button>
        </div>
      </div>

      {/* TABS */}
      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("h-9 px-3 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === t.id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><t.icon className="w-3.5 h-3.5" /> {t.label}</button>)}
      </div>

      {/* TEST RESULT */}
      {testResult && (
        <div className={cn(cardCls, "p-4")}>
          <div className="flex items-center justify-between mb-2"><p className={cn("text-sm font-extrabold", txt)}>Security Self-Test</p><button onClick={() => setTestResult(null)} className={sub}><X className="w-4 h-4" /></button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{testResult.checks.map((c, i) => <div key={i} className={cn("flex items-center gap-2 rounded-[10px] border p-2", brd)}>{c.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}<span className={cn("text-xs font-semibold flex-1", txt)}>{c.name}</span><span className={cn("text-[10px] truncate max-w-[140px]", sub)}>{c.value}</span></div>)}</div>
        </div>
      )}

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={cn(cardCls, "p-5 flex items-center gap-5")}>
              <ScoreRing score={sc.score} color={LEVEL[sc.level].c} dark={dark} />
              <div><p className={cn("text-xs font-bold uppercase tracking-wider", sub)}>Security Score</p><p className="text-3xl font-extrabold" style={{ color: LEVEL[sc.level].c }}>{sc.score}<span className={cn("text-base", sub)}>/100</span></p><p className="text-sm font-bold" style={{ color: LEVEL[sc.level].c }}>{LEVEL[sc.level].l}</p></div>
            </div>
            <div className={cn(cardCls, "p-4 lg:col-span-2")}>
              <p className={cn("text-xs font-bold uppercase tracking-wider mb-2", sub)}>Score Breakdown</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 max-h-40 overflow-y-auto">
                {sc.checks.map((c, i) => <div key={i} className="flex items-center gap-2">{c.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}<span className={cn("text-[11px] flex-1 truncate", c.ok ? sub : txt)}>{c.label}</span><span className={cn("text-[10px] font-bold", sub)}>+{c.weight}</span></div>)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">{kpis.map(k => (
            <div key={k.label} className={cn(cardCls, "p-3.5")}><div className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-2" style={{ backgroundColor: k.crit ? "#dc26261a" : k.warn ? "#ea73171a" : dark ? "#1d242e" : "#f0f2f5" }}><k.icon className="w-4 h-4" style={{ color: k.crit ? "#dc2626" : k.warn ? "#ea7317" : dark ? "#8b95a3" : "#8a929c" }} /></div><p className={cn("text-[18px] font-extrabold", k.crit ? "text-red-500" : k.warn ? "text-orange-500" : txt)}>{k.value}</p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
          ))}</div>
          <div className={cn(cardCls, "p-4")}>
            <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Security Events (14d)</p>
            <EventChart series={dash.series || []} dark={dark} />
          </div>
        </div>
      )}

      {/* AUTHENTICATION */}
      {tab === "authentication" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TogRow label="Email Login" group="authentication" k="email_login" />
            <TogRow label="Phone Login" group="authentication" k="phone_login" />
            <TogRow label="Social Login" group="authentication" k="social_login" />
            <TogRow label="Magic Link" group="authentication" k="magic_link" />
            <TogRow label="Passkeys (WebAuthn)" group="authentication" k="passkeys" />
            <TogRow label="Remember Me" group="authentication" k="remember_me" />
            <NumRow label="Session Timeout (min)" group="authentication" k="session_timeout_minutes" />
            <NumRow label="Maximum Sessions" group="authentication" k="max_sessions" />
            <NumRow label="Password Expiration (days, 0=off)" group="authentication" k="password_expiration_days" />
          </div>
          <SaveBtn groups={["authentication"]} />
        </div>
      )}

      {/* PASSWORD POLICY */}
      {tab === "password" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NumRow label="Minimum Length" group="password_policy" k="min_length" min={6} max={64} />
            <NumRow label="Maximum Length" group="password_policy" k="max_length" min={8} max={128} />
            <TogRow label="Uppercase Required" group="password_policy" k="uppercase" />
            <TogRow label="Lowercase Required" group="password_policy" k="lowercase" />
            <TogRow label="Number Required" group="password_policy" k="number" />
            <TogRow label="Special Character Required" group="password_policy" k="special" />
            <NumRow label="Password History" group="password_policy" k="history" hint="Remembered passwords" />
            <NumRow label="Expiration (days, 0=off)" group="password_policy" k="expiration_days" />
            <TogRow label="Prevent Password Reuse" group="password_policy" k="prevent_reuse" />
          </div>
          <div className={cn("rounded-[11px] border p-3 text-[11px]", brd, sub)}>This policy is enforced server-side by <code>validatePassword()</code> on password creation/reset flows.</div>
          <SaveBtn groups={["password_policy"]} />
        </div>
      )}

      {/* 2FA */}
      {tab === "twofa" && (
        <div className="space-y-3">
          <TogRow label="Enable Two-Factor Authentication" group="two_factor" k="enabled" hint="Master switch for all 2FA methods" />
          <div className={cn(cardCls, "p-4")}>
            <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Methods</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[["totp", "Authenticator (Google/MS/Authy)"], ["email_otp", "Email OTP"], ["sms_otp", "SMS OTP"]].map(([k, l]) => { const on = (settings.two_factor?.methods || []).includes(k); return (
                <button key={k} onClick={() => { const m = settings.two_factor?.methods || []; patch("two_factor", "methods", on ? m.filter(x => x !== k) : [...m, k]); }} className={cn("rounded-[10px] border p-3 text-left flex items-center justify-between", on ? "border-emerald-500" : brd)}><span className={cn("text-[13px] font-semibold", txt)}>{l}</span>{on && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}</button>
              ); })}
            </div>
          </div>
          <TogRow label="Recovery / Backup Codes" group="two_factor" k="recovery_codes" />
          <div className={cn(cardCls, "p-4")}>
            <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Enforce 2FA for</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <TogRow label="Administrators" group="two_factor" k="enforce_admins" />
              <TogRow label="Managers" group="two_factor" k="enforce_managers" />
              <TogRow label="Staff" group="two_factor" k="enforce_staff" />
              <TogRow label="All Users" group="two_factor" k="enforce_all" />
            </div>
          </div>
          <SaveBtn groups={["two_factor"]} />
        </div>
      )}

      {/* LOGIN SECURITY */}
      {tab === "login" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NumRow label="Maximum Login Attempts" group="login_security" k="max_attempts" min={3} max={20} />
            <NumRow label="Temporary Lock (min)" group="login_security" k="temp_lock_minutes" />
            <TogRow label="Permanent Lock after repeated abuse" group="login_security" k="permanent_lock" />
            <TogRow label="CAPTCHA" group="login_security" k="captcha" />
            <Row label="CAPTCHA Provider"><select value={settings.login_security?.captcha_provider || "recaptcha"} onChange={e => patch("login_security", "captcha_provider", e.target.value)} className={cn(inpCls, "w-44 h-9")}><option value="recaptcha">Google reCAPTCHA</option><option value="turnstile">Cloudflare Turnstile</option><option value="invisible">Invisible CAPTCHA</option></select></Row>
            <TogRow label="Device Verification" group="login_security" k="device_verification" />
            <TogRow label="Email Verification" group="login_security" k="email_verification" />
            <TogRow label="Phone Verification" group="login_security" k="phone_verification" />
          </div>
          <SaveBtn groups={["login_security"]} />
        </div>
      )}

      {/* SESSIONS */}
      {tab === "sessions" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}><p className={cn("text-sm font-extrabold", txt)}>Active Sessions</p><button onClick={() => loadSection("sessions", "sessions")} className={cn("text-xs flex items-center gap-1", sub)}><RefreshCw className="w-3.5 h-3.5" /> Refresh</button></div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className={cn("border-b text-left", brd, sub)}>{["User", "IP", "Location", "Browser", "OS", "Last activity", ""].map(h => <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody className={cn("divide-y", divide)}>
              {(d.sessions?.sessions || []).filter(x => !x.revoked).length === 0 ? <tr><td colSpan={7} className={cn("px-4 py-8 text-center text-xs", sub)}>No active sessions.</td></tr> :
                d.sessions.sessions.filter(x => !x.revoked).map(s => <tr key={s.id}><td className={cn("px-4 py-2.5 font-semibold", txt)}>{s.profiles?.full_name || s.profiles?.email || "—"}</td><td className={cn("px-4 py-2.5", sub)}>{s.ip_address || "—"}</td><td className={cn("px-4 py-2.5", sub)}>{[s.city, s.country].filter(Boolean).join(", ") || "—"}</td><td className={cn("px-4 py-2.5", sub)}>{s.browser || "—"}</td><td className={cn("px-4 py-2.5", sub)}>{s.os || "—"}</td><td className={cn("px-4 py-2.5 text-[11px]", sub)}>{timeAgo(s.last_activity)}</td><td className="px-4 py-2.5 text-right"><button onClick={() => post("revoke-session", { session_id: s.id }, "Revoked", () => loadSection("sessions", "sessions"))} className="text-red-500 text-[11px] font-bold">Revoke</button></td></tr>)}
            </tbody>
          </table></div>
        </div>
      )}

      {/* DEVICES */}
      {tab === "devices" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Device Management</p>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className={cn("border-b text-left", brd, sub)}>{["Device", "Type", "OS", "Browser", "IP", "Country", "Last login", "Status", ""].map(h => <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody className={cn("divide-y", divide)}>
              {(d.devices?.devices || []).length === 0 ? <tr><td colSpan={9} className={cn("px-4 py-8 text-center text-xs", sub)}>No devices recorded yet.</td></tr> :
                d.devices.devices.map(dv => <tr key={dv.id}><td className={cn("px-4 py-2.5 font-semibold", txt)}>{dv.device_name || dv.profiles?.email || "Device"}</td><td className={cn("px-4 py-2.5", sub)}>{dv.device_type || "—"}</td><td className={cn("px-4 py-2.5", sub)}>{dv.os || "—"}</td><td className={cn("px-4 py-2.5", sub)}>{dv.browser || "—"}</td><td className={cn("px-4 py-2.5", sub)}>{dv.ip_address || "—"}</td><td className={cn("px-4 py-2.5", sub)}>{dv.country || "—"}</td><td className={cn("px-4 py-2.5 text-[11px]", sub)}>{timeAgo(dv.last_seen)}</td><td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: dv.status === "active" ? "#16a34a1a" : "#dc26261a", color: dv.status === "active" ? "#16a34a" : "#dc2626" }}>{dv.status}</span></td><td className="px-4 py-2.5"><button onClick={() => post("block-device", { device_id: dv.id, status: dv.status === "active" ? "blocked" : "active" }, "Updated", () => loadSection("devices", "devices"))} className={cn("text-[11px] font-bold", dv.status === "active" ? "text-red-500" : "text-emerald-600")}>{dv.status === "active" ? "Block" : "Unblock"}</button></td></tr>)}
            </tbody>
          </table></div>
        </div>
      )}

      {/* API SECURITY */}
      {tab === "api" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NumRow label="JWT Expiration (min)" group="api_security" k="jwt_expiration_minutes" />
            <TogRow label="Refresh Tokens" group="api_security" k="refresh_tokens" />
            <TogRow label="CSRF Protection" group="api_security" k="csrf" />
            <TogRow label="CORS" group="api_security" k="cors" />
            <TogRow label="Origin Validation" group="api_security" k="origin_validation" />
            <TogRow label="Request Signing" group="api_security" k="request_signing" />
            <NumRow label="Rate Limit (req/min)" group="api_security" k="rate_limit_per_min" />
          </div>
          <SaveBtn groups={["api_security"]} />
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}><p className={cn("text-sm font-extrabold", txt)}>API Keys</p><button onClick={() => post("create-api-key", { name: prompt("Key name:") || "API Key", scopes: ["read"] }, null, (r) => { if (r?.key) { setNewKey(r); loadSection("api-keys", "api"); } })} className={cn(btnPrimary, "h-8")}><Plus className="w-4 h-4" /> Generate Key</button></div>
            <div className={cn("divide-y", divide)}>
              {(d.api?.keys || []).length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No API keys.</p> :
                d.api.keys.map(k => <div key={k.id} className="px-4 py-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className={cn("text-sm font-bold", txt)}>{k.name} <span className={cn("text-[10px] font-mono", sub)}>{k.key_prefix}</span></p><p className={cn("text-[10px]", sub)}>{(k.scopes || []).join(", ")} · used {timeAgo(k.last_used_at)}</p></div><div className="flex items-center gap-2"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: k.status === "active" ? "#16a34a1a" : "#dc26261a", color: k.status === "active" ? "#16a34a" : "#dc2626" }}>{k.status}</span>{k.status === "active" && <button onClick={() => post("revoke-api-key", { id: k.id }, "Revoked", () => loadSection("api-keys", "api"))} className="text-red-500 text-[11px] font-bold">Revoke</button>}</div></div>)}
            </div>
          </div>
        </div>
      )}

      {/* IP SECURITY */}
      {tab === "ip" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-4")}>
            <p className={cn("text-sm font-extrabold mb-3", txt)}>Block an IP Address</p>
            <IpBlocker post={post} inpCls={inpCls} btnPrimary={btnPrimary} labelCls={labelCls} onDone={() => loadSection("ip-lists", "ip")} />
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>IP Rules · enforced live at the edge</p>
            <div className={cn("divide-y", divide)}>
              {(d.ip?.ips || []).length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No IP rules yet.</p> :
                d.ip.ips.map(ip => <div key={ip.id} className="px-4 py-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: ip.list_type === "blacklist" ? "#dc26261a" : "#16a34a1a", color: ip.list_type === "blacklist" ? "#dc2626" : "#16a34a" }}>{ip.list_type}</span><span className={cn("text-sm font-mono font-bold", txt)}>{ip.ip_address}</span><span className={cn("text-[11px]", sub)}>{ip.reason}</span></div><button onClick={() => post("unblock-ip", { ip: ip.ip_address }, "Removed", () => loadSection("ip-lists", "ip"))} className="text-red-500"><Trash2 className="w-4 h-4" /></button></div>)}
            </div>
          </div>
        </div>
      )}

      {/* FIREWALL */}
      {tab === "firewall" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[["sql_injection", "SQL Injection Protection"], ["xss", "XSS Protection"], ["csrf", "CSRF Protection"], ["command_injection", "Command Injection"], ["path_traversal", "Path Traversal"], ["brute_force", "Brute Force Protection"], ["ddos", "DDoS Protection"], ["bot_protection", "Bot Protection"]].map(([k, l]) => <TogRow key={k} label={l} group="firewall" k={k} />)}
          </div>
          <div className={cn("rounded-[11px] border p-3 text-[11px]", brd, sub)}>SQLi, XSS, path-traversal & command-injection rules are enforced server-side by <code>inspectPayload()</code>; brute-force uses the login attempt limits above; IP rules run at the edge in the proxy.</div>
          <SaveBtn groups={["firewall"]} />
        </div>
      )}

      {/* HEADERS */}
      {tab === "headers" && (
        <div className="space-y-3">
          <div className={cn("rounded-[11px] border p-3 text-[11px] flex items-center gap-2", "border-emerald-500/30 bg-emerald-500/[.06]")}><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /><span className={sub}>These headers are applied to <b className={txt}>every response</b> by the proxy right now — verify with the Security Test.</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TogRow label="Content-Security-Policy" group="headers" k="csp" />
            <TogRow label="HSTS (Strict-Transport-Security)" group="headers" k="hsts" />
            <TogRow label="Permissions-Policy" group="headers" k="permissions_policy" />
            <TogRow label="X-Content-Type-Options" group="headers" k="x_content_type_options" />
            <Row label="X-Frame-Options"><select value={settings.headers?.x_frame_options || "SAMEORIGIN"} onChange={e => patch("headers", "x_frame_options", e.target.value)} className={cn(inpCls, "w-40 h-9")}><option>SAMEORIGIN</option><option>DENY</option></select></Row>
            <Row label="Referrer-Policy"><select value={settings.headers?.referrer_policy || "strict-origin-when-cross-origin"} onChange={e => patch("headers", "referrer_policy", e.target.value)} className={cn(inpCls, "w-auto h-9")}><option>strict-origin-when-cross-origin</option><option>no-referrer</option><option>same-origin</option></select></Row>
          </div>
          <SaveBtn groups={["headers"]} />
        </div>
      )}

      {/* ENCRYPTION */}
      {tab === "encryption" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {d.encryption?.encryption && Object.entries({ "HTTPS": d.encryption.encryption.https ? "Enabled" : "Disabled", "SSL Certificate": d.encryption.encryption.ssl, "Password Hash": d.encryption.encryption.password_hash, "Hash Algorithm": d.encryption.encryption.hash_algorithm, "JWT Secret": d.encryption.encryption.jwt, "Data at Rest": d.encryption.encryption.at_rest }).map(([k, v]) => (
            <div key={k} className={cn(cardCls, "p-4 flex items-center gap-3")}><KeyRound className="w-5 h-5 text-emerald-500" /><div><p className={cn("text-sm font-extrabold", txt)}>{v}</p><p className={cn("text-xs", sub)}>{k}</p></div></div>
          ))}
        </div>
      )}

      {/* ALERTS */}
      {tab === "alerts" && (
        <div className="space-y-2">
          {(d.alerts?.alerts || []).length === 0 ? <div className={cn(cardCls, "p-10 text-center")}><ShieldCheck className="w-8 h-8 mx-auto mb-2 text-emerald-500" /><p className={cn("text-sm font-semibold", txt)}>No security alerts. All clear.</p></div> :
            d.alerts.alerts.map(a => (
              <div key={a.id} className={cn(cardCls, "p-4 flex items-start gap-3")} style={{ borderLeftWidth: 3, borderLeftColor: SEV[a.severity] }}>
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: SEV[a.severity] }} />
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className={cn("text-sm font-extrabold", txt)}>{a.title}</span><span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ backgroundColor: `${SEV[a.severity]}1a`, color: SEV[a.severity] }}>{a.severity}</span><span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ background: dark ? "#1d242e" : "#f0f2f5" }}>{a.status}</span></div><p className={cn("text-xs mt-0.5", sub)}>{a.message}</p><p className={cn("text-[10px] mt-1", sub)}>{a.ip_address || ""} · {fmtDT(a.created_at)}</p></div>
                {a.status === "open" && <button onClick={() => post("resolve-alert", { id: a.id }, "Resolved", () => loadSection("alerts", "alerts"))} className={btnGhost + " h-8"}>Resolve</button>}
              </div>
            ))}
        </div>
      )}

      {/* LOGS */}
      {tab === "logs" && <LogsTable which="logs" api={api} dark={dark} cardCls={cardCls} brd={brd} txt={txt} sub={sub} divide={divide} inpCls={inpCls} />}
      {tab === "audit" && <LogsTable which="audit" api={api} dark={dark} cardCls={cardCls} brd={brd} txt={txt} sub={sub} divide={divide} inpCls={inpCls} />}

      {/* SCANNER */}
      {tab === "scanner" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-5")}>
            <p className={cn("text-sm font-extrabold mb-2", txt)}>Malware / Upload Scanner</p>
            <p className={cn("text-xs mb-3", sub)}>Scans stored media & uploads for dangerous file extensions and suspicious names. Flagged items raise a critical alert.</p>
            <button onClick={() => post("scan", {}, (r) => `Scanned ${r.scanned} files · ${r.flagged.length} flagged`, (r) => setD(p => ({ ...p, scan: r })))} disabled={busy === "scan"} className={btnPrimary}>{busy === "scan" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />} Run Scan</button>
          </div>
          {d.scan && (
            <div className={cn(cardCls, "p-4")}>
              <div className="flex items-center gap-2 mb-2">{d.scan.flagged.length ? <XCircle className="w-5 h-5 text-red-500" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}<p className={cn("text-sm font-extrabold", txt)}>{d.scan.scanned} files scanned · {d.scan.flagged.length} flagged</p></div>
              {d.scan.flagged.length > 0 && <div className="space-y-1">{d.scan.flagged.map((f, i) => <p key={i} className="text-xs text-red-500 truncate">{f}</p>)}</div>}
            </div>
          )}
        </div>
      )}

      {/* NEW KEY MODAL */}
      {newKey && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setNewKey(null)}>
          <div className={cn("w-full max-w-md rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><KeyRound className="w-5 h-5 text-emerald-500" /> API Key Created</p>
            <p className={cn("text-xs", sub)}>Copy it now — it will not be shown again.</p>
            <div className={cn("rounded-[10px] border p-3 flex items-center gap-2", brd)}><code className={cn("text-xs font-bold flex-1 break-all", txt)}>{newKey.key}</code><button onClick={() => { navigator.clipboard?.writeText(newKey.key); showToast("Copied"); }} className={sub}><Copy className="w-4 h-4" /></button></div>
            <button onClick={() => setNewKey(null)} className={cn(btnPrimary, "w-full justify-center")}>Done</button>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirm(null)}>
          <div className={cn("w-full max-w-sm rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><AlertTriangle className={cn("w-5 h-5", confirm.danger ? "text-red-500" : "text-amber-500")} /> {confirm.title}</p>
            <p className={cn("text-sm", sub)}>{confirm.message}</p>
            <div className="flex gap-2 justify-end"><button onClick={() => setConfirm(null)} className={btnGhost}>Cancel</button><button onClick={() => { confirm.onConfirm(); setConfirm(null); }} className={cn("h-10 px-4 rounded-[11px] text-white text-sm font-bold", confirm.danger ? "bg-red-500 hover:bg-red-600" : "bg-[#2563eb]")}>Confirm</button></div>
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200 max-w-sm", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}

function IpBlocker({ post, inpCls, btnPrimary, labelCls, onDone }) {
  const [ip, setIp] = useState(""); const [reason, setReason] = useState(""); const [type, setType] = useState("blacklist");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
      <div className="sm:col-span-1"><label className={labelCls}>IP Address</label><input value={ip} onChange={e => setIp(e.target.value)} className={inpCls} placeholder="1.2.3.4" /></div>
      <div className="sm:col-span-1"><label className={labelCls}>List</label><select value={type} onChange={e => setType(e.target.value)} className={inpCls}><option value="blacklist">Blacklist</option><option value="whitelist">Whitelist</option><option value="trusted">Trusted</option></select></div>
      <div className="sm:col-span-1"><label className={labelCls}>Reason</label><input value={reason} onChange={e => setReason(e.target.value)} className={inpCls} placeholder="optional" /></div>
      <button onClick={() => { if (ip) post("block-ip", { ip, reason, list_type: type }, "Applied", () => { setIp(""); setReason(""); onDone(); }); }} className={btnPrimary}><Ban className="w-4 h-4" /> Apply</button>
    </div>
  );
}

function LogsTable({ which, api, dark, cardCls, brd, txt, sub, divide, inpCls }) {
  const [data, setData] = useState({ rows: [], total: 0, page: 1 });
  const [q, setQ] = useState(""); const [result, setResult] = useState("all");
  const load = useCallback(async (page = 1) => {
    try { const qs = new URLSearchParams({ page }); if (which === "logs") { qs.set("q", q); qs.set("result", result); }
      const r = await api(`/${which}?${qs}`); setData({ rows: which === "logs" ? r.logs : r.audit, total: r.total, page }); } catch {}
  }, [api, which, q, result]);
  useEffect(() => { load(1); }, [load]);
  return (
    <div className="space-y-3">
      {which === "logs" && <div className={cn(cardCls, "p-3 flex gap-2")}><div className="relative flex-1"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={q} onChange={e => setQ(e.target.value)} className={cn(inpCls, "pl-9 h-9")} placeholder="Search action, user, IP…" /></div><select value={result} onChange={e => setResult(e.target.value)} className={cn(inpCls, "w-auto h-9")}><option value="all">All results</option><option value="ok">OK</option><option value="denied">Denied</option><option value="blocked">Blocked</option><option value="failed">Failed</option></select></div>}
      <div className={cn(cardCls, "overflow-hidden")}>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className={cn("border-b text-left", brd, sub)}>{(which === "logs" ? ["Date", "User", "Action", "IP", "Result"] : ["Date", "User", "Action", "Entity", "IP"]).map(h => <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody className={cn("divide-y", divide)}>
            {data.rows.length === 0 ? <tr><td colSpan={5} className={cn("px-4 py-8 text-center text-xs", sub)}>No entries.</td></tr> :
              data.rows.map(r => <tr key={r.id}><td className={cn("px-4 py-2.5 text-[11px]", sub)}>{fmtDT(r.created_at)}</td><td className={cn("px-4 py-2.5", txt)}>{r.actor_name || "—"}</td><td className={cn("px-4 py-2.5 font-semibold capitalize", txt)}>{(r.action || "").replace(/_/g, " ")}</td>{which === "logs" ? <><td className={cn("px-4 py-2.5", sub)}>{r.ip_address || "—"}</td><td className="px-4 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: r.result === "ok" ? "#16a34a1a" : "#dc26261a", color: r.result === "ok" ? "#16a34a" : "#dc2626" }}>{r.result}</span></td></> : <><td className={cn("px-4 py-2.5", sub)}>{r.entity || "—"}</td><td className={cn("px-4 py-2.5", sub)}>{r.ip_address || "—"}</td></>}</tr>)}
          </tbody>
        </table></div>
      </div>
      {data.total > 40 && <div className="flex items-center justify-between"><span className={cn("text-xs", sub)}>{data.total} entries · page {data.page}</span><div className="flex gap-1.5"><button disabled={data.page <= 1} onClick={() => load(data.page - 1)} className={cn("h-8 px-3 rounded-[9px] text-xs font-bold border disabled:opacity-40", brd, txt)}>Prev</button><button disabled={data.page * 40 >= data.total} onClick={() => load(data.page + 1)} className={cn("h-8 px-3 rounded-[9px] text-xs font-bold border disabled:opacity-40", brd, txt)}>Next</button></div></div>}
    </div>
  );
}

function ScoreRing({ score, color, dark }) {
  const r = 34, c = 2 * Math.PI * r, off = c - (score / 100) * c;
  return <svg viewBox="0 0 80 80" className="w-20 h-20 shrink-0"><circle cx="40" cy="40" r={r} fill="none" stroke={dark ? "#252c36" : "#eef0f3"} strokeWidth="8" /><circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 40 40)" /><text x="40" y="46" textAnchor="middle" fontSize="18" fontWeight="800" fill={color}>{score}</text></svg>;
}

function EventChart({ series, dark }) {
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  if (!series || !series.length) return <p className={cn("text-xs py-8 text-center", sub)}>No events yet.</p>;
  const w = 720, h = 150, pad = 10;
  const max = Math.max(...series.map(s => Math.max(s.ok, s.blocked)), 1);
  const x = (i) => pad + (i / Math.max(series.length - 1, 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((Number(v) || 0) / max) * (h - pad * 2);
  const line = (k) => series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(s[k])}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ minWidth: 520 }}>
        <path d={line("ok")} fill="none" stroke="#16a34a" strokeWidth="2.5" />
        <path d={line("blocked")} fill="none" stroke="#dc2626" strokeWidth="2" />
        {series.map((s, i) => <circle key={i} cx={x(i)} cy={y(s.blocked)} r="2" fill="#dc2626" />)}
      </svg>
      <div className="flex gap-4 mt-2 text-[11px]"><span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-[#16a34a] rounded" />Normal</span><span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-[#dc2626] rounded" />Blocked/Failed</span></div>
    </div>
  );
}
