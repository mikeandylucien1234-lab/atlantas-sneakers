// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  KeyRound, LayoutDashboard, ListChecks, ScrollText, FlaskConical, BookOpen,
  Loader2, Search, Download, X, Plus, Copy, Trash2, RotateCw, Power, Ban,
  CheckCircle2, XCircle, AlertTriangle, Settings2, Clock, Activity, Play, Shield,
} from "lucide-react";

type Props = { dark: boolean };

const ENVS = ["development", "testing", "sandbox", "staging", "production"];
const KEY_TYPES = ["public", "private", "partner", "internal", "webhook", "read_only", "read_write", "temporary"];
const MODULES = ["orders", "products", "categories", "brands", "inventory", "customers", "payments", "shipping", "returns", "coupons", "reviews", "blog", "media", "seo", "notifications", "analytics", "settings", "staff", "roles", "security", "api", "audit"];
const ACTIONS = ["read", "write", "update", "delete", "export"];
const STATUS = { active: { c: "#16a34a", l: "Active" }, disabled: { c: "#ea7317", l: "Disabled" }, revoked: { c: "#dc2626", l: "Revoked" }, expired: { c: "#dc2626", l: "Expired" } };
const TEST_ENDPOINTS = [["/api/v1/ping", "GET"], ["/api/v1/products", "GET"], ["/api/v1/orders", "GET"], ["/api/v1/products", "POST"]];

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return "never"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }
function effStatus(k) { if (k.status === "active" && k.expires_at && new Date(k.expires_at) < new Date()) return "expired"; return k.status; }

export function AdminApiKeys({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inpBg = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inpBg, "focus:border-[#2563eb]");
  const labelCls = cn("text-[12px] font-semibold mb-1.5 block", txt);
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnGhost = cn("h-9 px-3 rounded-[10px] text-xs font-semibold border transition-colors flex items-center gap-1.5 disabled:opacity-50", brd, txt, hover);
  const btnPrimary = "h-9 px-3 rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-1.5";
  const divide = dark ? "divide-[#252c36]" : "divide-[#eef0f3]";

  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [dash, setDash] = useState(null);
  const [list, setList] = useState({ keys: [], total: 0, page: 1, pageSize: 25 });
  const [filters, setFilters] = useState({ q: "", environment: "all", status: "all" });
  const [logs, setLogs] = useState({ logs: [], total: 0, page: 1 });
  const [drawer, setDrawer] = useState(null);
  const [createForm, setCreateForm] = useState(null);
  const [secretModal, setSecretModal] = useState(null);
  const [testForm, setTestForm] = useState({ secret: "", endpoint: "/api/v1/ping", method: "GET", body: "" });
  const [testResult, setTestResult] = useState(null);

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3200); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api/developer${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadDash = useCallback(async () => { try { setDash(await api("/dashboard")); } catch {} }, [api]);
  const loadList = useCallback(async (page = 1) => { try { const qs = new URLSearchParams({ page, ...filters }); const r = await api(`/keys?${qs}`); setList({ ...r }); } catch (e) { showToast(e.message, "error"); } }, [api, filters, showToast]);
  const loadLogs = useCallback(async (page = 1) => { try { const r = await api(`/logs?page=${page}`); setLogs({ ...r }); } catch {} }, [api]);

  useEffect(() => { (async () => { setLoading(true); await loadDash(); setLoading(false); })(); }, [loadDash]);
  useEffect(() => { if (tab === "dashboard") loadDash(); if (tab === "keys") loadList(1); if (tab === "logs") loadLogs(1); }, [tab]); // eslint-disable-line
  useEffect(() => { if (tab === "keys") loadList(1); }, [filters]); // eslint-disable-line

  const post = async (action, body, okMsg, after) => {
    setBusy(action + (body?.id || ""));
    try { const r = await api(`/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (okMsg) showToast(typeof okMsg === "function" ? okMsg(r) : okMsg); if (after) await after(r); return r; }
    catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };
  const openDetail = async (id) => { setDrawer({ loading: true }); try { setDrawer(await api(`/detail?id=${id}`)); } catch (e) { showToast(e.message, "error"); setDrawer(null); } };

  const emptyForm = () => ({ name: "", description: "", owner: "", environment: "production", key_type: "private", permissions: {}, rate_per_minute: 120, rate_per_hour: 5000, rate_per_day: 50000, allowed_domains: "", allowed_ips: "", webhook_access: false, logging_enabled: true, monitoring_enabled: true, notifications_enabled: false, expires_at: "" });
  const togglePerm = (mod, act) => setCreateForm(f => { const cur = f.permissions[mod] || []; const next = cur.includes(act) ? cur.filter(x => x !== act) : [...cur, act]; const perms = { ...f.permissions }; if (next.length) perms[mod] = next; else delete perms[mod]; return { ...f, permissions: perms }; });
  const submitCreate = async () => {
    const body = { ...createForm, allowed_domains: createForm.allowed_domains.split(",").map(x => x.trim()).filter(Boolean), allowed_ips: createForm.allowed_ips.split(",").map(x => x.trim()).filter(Boolean), expires_at: createForm.expires_at || null };
    const r = await post("create", body, null, () => { loadList(1); loadDash(); });
    if (r?.secret) { setCreateForm(null); setSecretModal({ title: "API Key created", keyId: r.key_id, secret: r.secret }); }
  };
  const runTest = async () => { setBusy("test"); setTestResult(null); try { const r = await api("/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(testForm) }); setTestResult(r); } catch (e) { setTestResult({ ok: false, error: e.message }); } finally { setBusy(null); } };

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const kpis = [
    { label: "Total Keys", value: K.total }, { label: "Active", value: K.active, c: "#16a34a" }, { label: "Disabled", value: K.disabled, c: "#ea7317" },
    { label: "Revoked", value: K.revoked, c: K.revoked ? "#dc2626" : undefined }, { label: "Expired", value: K.expired, c: K.expired ? "#dc2626" : undefined },
    { label: "Requests Today", value: K.requestsToday }, { label: "Requests / Month", value: K.requestsMonth }, { label: "Failed", value: K.failed, c: K.failed ? "#ea7317" : undefined },
    { label: "Blocked", value: K.blocked, c: K.blocked ? "#dc2626" : undefined }, { label: "Rate Limited", value: K.rateLimited, c: K.rateLimited ? "#ea7317" : undefined },
    { label: "Developers", value: K.activeDevelopers }, { label: "Applications", value: K.activeApplications }, { label: "Webhooks", value: K.webhooksConnected }, { label: "Avg Response", value: `${K.avgResponseTime || 0}ms` },
  ];
  const statusBadge = (k) => { const st = effStatus(k); return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${STATUS[st]?.c || "#8a929c"}1a`, color: STATUS[st]?.c || "#8a929c" }}>{STATUS[st]?.l || st}</span>; };
  const permCount = (perms) => Object.values(perms || {}).reduce((a, arr) => a + arr.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><KeyRound className="w-5 h-5 text-[#2563eb]" /> API Keys</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Developer Access Center · {K.active || 0} active keys</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/developer/export?format=csv" className={btnGhost}><Download className="w-3.5 h-3.5" /> CSV</a>
          <button onClick={() => setCreateForm(emptyForm())} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Create API Key</button>
        </div>
      </div>

      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {[["dashboard", "Dashboard", LayoutDashboard], ["keys", "API Keys", ListChecks], ["logs", "API Logs", ScrollText], ["test", "Test API", FlaskConical], ["portal", "Developer Portal", BookOpen]].map(([id, l, I]) => <button key={id} onClick={() => setTab(id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><I className="w-3.5 h-3.5" /> {l}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">{kpis.map(k => (
            <div key={k.label} className={cn(cardCls, "p-3.5")}><p className="text-[18px] font-extrabold" style={{ color: k.c }}><span className={k.c ? "" : txt}>{k.value ?? 0}</span></p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
          ))}</div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={cn(cardCls, "p-4 lg:col-span-2")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>API Requests (14 days)</p><AreaChart series={dash.series || []} dark={dark} /></div>
            <div className={cn(cardCls, "overflow-hidden")}>
              <p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b", sub, brd)}>Recent Requests</p>
              <div className={cn("divide-y max-h-64 overflow-y-auto", divide)}>
                {(dash.recent || []).length === 0 ? <p className={cn("p-4 text-xs", sub)}>No API requests yet.</p> :
                  dash.recent.map((l, i) => <div key={i} className="px-4 py-2 flex items-center gap-2"><span className={cn("w-1.5 h-1.5 rounded-full shrink-0", l.result === "ok" ? "bg-emerald-500" : "bg-red-500")} /><span className={cn("text-[11px] font-mono truncate", txt)}>{l.method} {l.endpoint}</span><span className={cn("text-[10px] ml-auto shrink-0", sub)}>{l.status_code} · {l.response_time_ms}ms</span></div>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KEYS */}
      {tab === "keys" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap gap-2 items-center")}>
            <div className="relative flex-1 min-w-[180px]"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} className={cn(inpCls, "pl-9 h-9")} placeholder="Search name, key ID, owner…" /></div>
            <select value={filters.environment} onChange={e => setFilters(f => ({ ...f, environment: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All environments</option>{ENVS.map(e => <option key={e} value={e}>{e}</option>)}</select>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All status</option>{["active", "disabled", "revoked"].map(s => <option key={s} value={s}>{s}</option>)}</select>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Name", "Key ID", "Type", "Owner", "Env", "Perms", "Usage", "Last Used", "Status", ""].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {list.keys.length === 0 ? <tr><td colSpan={10} className={cn("px-4 py-10 text-center", sub)}><KeyRound className="w-8 h-8 mx-auto mb-2" /><p className="text-sm">No API keys yet. Create one to get started.</p></td></tr> :
                  list.keys.map(k => (
                    <tr key={k.id} className={cn(hover, "cursor-pointer")} onClick={() => openDetail(k.id)}>
                      <td className={cn("px-3 py-2.5 font-semibold", txt)}>{k.name}</td>
                      <td className={cn("px-3 py-2.5 font-mono text-[11px]", sub)}>{k.key_id}</td>
                      <td className={cn("px-3 py-2.5 capitalize", sub)}>{(k.key_type || "").replace(/_/g, " ")}</td>
                      <td className={cn("px-3 py-2.5", sub)}>{k.owner || "—"}</td>
                      <td className="px-3 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: dark ? "#1d242e" : "#f0f2f5", color: sub }}>{k.environment}</span></td>
                      <td className={cn("px-3 py-2.5", txt)}>{permCount(k.permissions)}</td>
                      <td className={cn("px-3 py-2.5", txt)}>{(k.usage_count || 0).toLocaleString()}</td>
                      <td className={cn("px-3 py-2.5 text-[11px]", sub)}>{timeAgo(k.last_used_at)}</td>
                      <td className="px-3 py-2.5">{statusBadge(k)}</td>
                      <td className="px-3 py-2.5"><Settings2 className={cn("w-4 h-4", sub)} /></td>
                    </tr>
                  ))}
              </tbody>
            </table></div>
          </div>
          {list.total > list.pageSize && <div className="flex items-center justify-between"><span className={cn("text-xs", sub)}>{list.total} keys · page {list.page}</span><div className="flex gap-1.5"><button disabled={list.page <= 1} onClick={() => loadList(list.page - 1)} className={cn(btnGhost, "disabled:opacity-40")}>Prev</button><button disabled={list.page * list.pageSize >= list.total} onClick={() => loadList(list.page + 1)} className={cn(btnGhost, "disabled:opacity-40")}>Next</button></div></div>}
        </div>
      )}

      {/* LOGS */}
      {tab === "logs" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Date", "Endpoint", "Method", "Status", "Time", "IP", "Result", "Error"].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {logs.logs.length === 0 ? <tr><td colSpan={8} className={cn("px-4 py-8 text-center text-xs", sub)}>No API logs yet.</td></tr> :
                  logs.logs.map(l => <tr key={l.id}><td className={cn("px-3 py-2.5 text-[11px]", sub)}>{fmtDT(l.created_at)}</td><td className={cn("px-3 py-2.5 font-mono text-[11px]", txt)}>{l.endpoint}</td><td className={cn("px-3 py-2.5", sub)}>{l.method}</td><td className={cn("px-3 py-2.5 font-bold", l.status_code < 400 ? "text-emerald-600" : "text-red-500")}>{l.status_code}</td><td className={cn("px-3 py-2.5", sub)}>{l.response_time_ms}ms</td><td className={cn("px-3 py-2.5", sub)}>{l.ip_address || "—"}</td><td className="px-3 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: l.result === "ok" ? "#16a34a1a" : "#dc26261a", color: l.result === "ok" ? "#16a34a" : "#dc2626" }}>{l.result}</span></td><td className={cn("px-3 py-2.5 text-[11px] text-red-500 truncate max-w-[160px]")}>{l.error || ""}</td></tr>)}
              </tbody>
            </table></div>
          </div>
          {logs.total > 40 && <div className="flex items-center justify-between"><span className={cn("text-xs", sub)}>{logs.total} logs · page {logs.page}</span><div className="flex gap-1.5"><button disabled={logs.page <= 1} onClick={() => loadLogs(logs.page - 1)} className={cn(btnGhost, "disabled:opacity-40")}>Prev</button><button disabled={logs.page * 40 >= logs.total} onClick={() => loadLogs(logs.page + 1)} className={cn(btnGhost, "disabled:opacity-40")}>Next</button></div></div>}
        </div>
      )}

      {/* TEST */}
      {tab === "test" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={cn(cardCls, "p-5 space-y-3")}>
            <p className={cn("text-sm font-extrabold flex items-center gap-2", txt)}><FlaskConical className="w-4 h-4 text-[#2563eb]" /> API Tester</p>
            <p className={cn("text-[11px]", sub)}>Paste an API key secret and call the live <code>/api/v1</code> surface — permissions, rate limits and IP rules are really enforced.</p>
            <div><label className={labelCls}>API Key Secret (sk_…)</label><input value={testForm.secret} onChange={e => setTestForm(f => ({ ...f, secret: e.target.value }))} className={inpCls} placeholder="sk_live_…" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>Endpoint</label><select value={`${testForm.endpoint}|${testForm.method}`} onChange={e => { const [ep, m] = e.target.value.split("|"); setTestForm(f => ({ ...f, endpoint: ep, method: m })); }} className={inpCls}>{TEST_ENDPOINTS.map(([ep, m]) => <option key={ep + m} value={`${ep}|${m}`}>{m} {ep}</option>)}</select></div>
              <div className="flex items-end"><button onClick={runTest} disabled={busy === "test" || !testForm.secret} className={cn(btnPrimary, "h-[42px] w-full justify-center")}>{busy === "test" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Send Request</button></div>
            </div>
            {testForm.method === "POST" && <div><label className={labelCls}>Body (JSON)</label><textarea rows={3} value={testForm.body} onChange={e => setTestForm(f => ({ ...f, body: e.target.value }))} className={cn(inpCls, "h-auto py-2")} placeholder='{"name":"Test Product","price":99}' /></div>}
          </div>
          <div className={cn(cardCls, "p-5")}>
            <p className={cn("text-sm font-extrabold mb-2", txt)}>Response</p>
            {!testResult ? <p className={cn("text-xs", sub)}>Send a request to see the response.</p> : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">{testResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}<span className={cn("text-sm font-bold", testResult.ok ? "text-emerald-600" : "text-red-500")}>{testResult.status || "Error"}</span>{testResult.time != null && <span className={cn("text-xs", sub)}>· {testResult.time}ms</span>}</div>
                {testResult.error && <p className="text-xs text-red-500">{testResult.error}</p>}
                {testResult.response && <pre className={cn("text-[11px] p-3 rounded-lg overflow-x-auto max-h-72", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]", txt)}>{(() => { try { return JSON.stringify(JSON.parse(testResult.response), null, 2); } catch { return testResult.response; } })()}</pre>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PORTAL */}
      {tab === "portal" && (
        <div className="space-y-4">
          <div className={cn(cardCls, "p-5")}>
            <p className={cn("text-sm font-extrabold flex items-center gap-2 mb-3", txt)}><BookOpen className="w-4 h-4 text-[#2563eb]" /> Developer Portal · API v1</p>
            <p className={cn("text-xs mb-3", sub)}>Authenticate every request with a Bearer secret. Base URL: <code className={txt}>{typeof window !== "undefined" ? window.location.origin : ""}/api/v1</code></p>
            <div className="space-y-3">
              {[["GET /api/v1/ping", "products/orders none", "Verify authentication.", 'curl -H "Authorization: Bearer sk_live_..." $BASE/api/v1/ping'],
                ["GET /api/v1/products", "products.read", "List active products.", 'curl -H "Authorization: Bearer sk_live_..." "$BASE/api/v1/products?limit=20"'],
                ["POST /api/v1/products", "products.write", "Create a product.", 'curl -X POST -H "Authorization: Bearer sk_live_..." -H "Content-Type: application/json" -d \'{"name":"Air Max","price":149}\' $BASE/api/v1/products'],
                ["GET /api/v1/orders", "orders.read", "List recent orders.", 'curl -H "Authorization: Bearer sk_live_..." $BASE/api/v1/orders']].map(([ep, perm, desc, curl]) => (
                <div key={ep} className={cn("rounded-[12px] border p-3", brd)}>
                  <div className="flex items-center justify-between flex-wrap gap-2"><code className={cn("text-xs font-bold", txt)}>{ep}</code><span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-600">requires: {perm}</span></div>
                  <p className={cn("text-[11px] mt-1", sub)}>{desc}</p>
                  <pre className={cn("text-[10px] mt-2 p-2 rounded-lg overflow-x-auto", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]", txt)}>{curl}</pre>
                </div>
              ))}
            </div>
          </div>
          <div className={cn(cardCls, "p-5")}>
            <p className={cn("text-sm font-extrabold mb-2", txt)}>Authentication & Errors</p>
            <ul className={cn("text-xs space-y-1.5 list-disc pl-4", sub)}>
              <li>Header: <code className={txt}>Authorization: Bearer sk_live_…</code> (or <code className={txt}>x-api-key</code>).</li>
              <li><b className={txt}>401</b> invalid/missing key · <b className={txt}>403</b> revoked/disabled/expired, IP or domain blocked, missing permission · <b className={txt}>429</b> rate limit exceeded.</li>
              <li>Rate limits: per-minute, per-hour and per-day, configurable per key.</li>
            </ul>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {createForm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50" onClick={() => setCreateForm(null)}>
          <div className={cn("w-full max-w-2xl rounded-[18px] border p-5 space-y-4 max-h-[92vh] overflow-y-auto", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className={cn("text-base font-extrabold", txt)}>Create API Key</p><button onClick={() => setCreateForm(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><label className={labelCls}>API Name *</label><input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Owner</label><input value={createForm.owner} onChange={e => setCreateForm(f => ({ ...f, owner: e.target.value }))} className={inpCls} placeholder="email" /></div>
              <div><label className={labelCls}>Type</label><select value={createForm.key_type} onChange={e => setCreateForm(f => ({ ...f, key_type: e.target.value }))} className={inpCls}>{KEY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></div>
              <div className="md:col-span-3"><label className={labelCls}>Description</label><input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Environment</label><select value={createForm.environment} onChange={e => setCreateForm(f => ({ ...f, environment: e.target.value }))} className={inpCls}>{ENVS.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
              <div><label className={labelCls}>Expiration</label><input type="date" value={createForm.expires_at} onChange={e => setCreateForm(f => ({ ...f, expires_at: e.target.value }))} className={inpCls} /></div>
            </div>
            <div>
              <label className={labelCls}>Permissions</label>
              <div className={cn("rounded-[12px] border overflow-hidden", brd)}>
                <div className="overflow-x-auto max-h-56 overflow-y-auto"><table className="w-full text-xs">
                  <thead className="sticky top-0"><tr className={cn("border-b", brd, p)}><th className={cn("px-2 py-1.5 text-left", sub)}>Module</th>{ACTIONS.map(a => <th key={a} className={cn("px-2 py-1.5 capitalize", sub)}>{a}</th>)}</tr></thead>
                  <tbody className={cn("divide-y", divide)}>
                    {MODULES.map(mod => <tr key={mod}><td className={cn("px-2 py-1 font-semibold capitalize", txt)}>{mod}</td>{ACTIONS.map(a => { const on = (createForm.permissions[mod] || []).includes(a); return <td key={a} className="px-2 py-1 text-center"><button type="button" onClick={() => togglePerm(mod, a)} className={cn("w-4 h-4 rounded border flex items-center justify-center", on ? "bg-emerald-500 border-emerald-500" : brd)}>{on && <CheckCircle2 className="w-3 h-3 text-white" />}</button></td>; })}</tr>)}
                  </tbody>
                </table></div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className={labelCls}>Rate / min</label><input type="number" value={createForm.rate_per_minute} onChange={e => setCreateForm(f => ({ ...f, rate_per_minute: parseInt(e.target.value) || 0 }))} className={inpCls} /></div>
              <div><label className={labelCls}>Rate / hour</label><input type="number" value={createForm.rate_per_hour} onChange={e => setCreateForm(f => ({ ...f, rate_per_hour: parseInt(e.target.value) || 0 }))} className={inpCls} /></div>
              <div><label className={labelCls}>Rate / day</label><input type="number" value={createForm.rate_per_day} onChange={e => setCreateForm(f => ({ ...f, rate_per_day: parseInt(e.target.value) || 0 }))} className={inpCls} /></div>
              <div><label className={labelCls}>Burst</label><input type="number" value={createForm.burst_limit || 40} onChange={e => setCreateForm(f => ({ ...f, burst_limit: parseInt(e.target.value) || 0 }))} className={inpCls} /></div>
              <div className="md:col-span-2"><label className={labelCls}>Allowed Domains (comma)</label><input value={createForm.allowed_domains} onChange={e => setCreateForm(f => ({ ...f, allowed_domains: e.target.value }))} className={inpCls} placeholder="atlantassneakers.com" /></div>
              <div className="md:col-span-2"><label className={labelCls}>Allowed IPs (comma)</label><input value={createForm.allowed_ips} onChange={e => setCreateForm(f => ({ ...f, allowed_ips: e.target.value }))} className={inpCls} placeholder="1.2.3.4" /></div>
            </div>
            <div className="flex flex-wrap gap-3">
              {[["webhook_access", "Webhook Access"], ["logging_enabled", "Enable Logging"], ["monitoring_enabled", "Enable Monitoring"], ["notifications_enabled", "Enable Notifications"]].map(([k, l]) => <label key={k} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!createForm[k]} onChange={e => setCreateForm(f => ({ ...f, [k]: e.target.checked }))} className="rounded" /><span className={cn("text-xs font-semibold", txt)}>{l}</span></label>)}
            </div>
            <button onClick={submitCreate} disabled={busy === "create" || !createForm.name} className={cn(btnPrimary, "w-full justify-center h-10")}>{busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Generate API Key</button>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {drawer && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDrawer(null)}>
          <div className={cn("w-full max-w-xl h-full overflow-y-auto border-l", p, brd)} onClick={e => e.stopPropagation()}>
            {drawer.loading ? <div className="p-10 flex justify-center"><Loader2 className={cn("w-6 h-6 animate-spin", sub)} /></div> : (() => { const k = drawer.key; return (
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div><p className={cn("text-lg font-extrabold", txt)}>{k.name}</p><p className={cn("text-xs font-mono", sub)}>{k.key_id}</p><div className="mt-1.5 flex gap-1.5 flex-wrap">{statusBadge(k)}<span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: dark ? "#1d242e" : "#f0f2f5", color: sub }}>{k.environment}</span><span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ background: dark ? "#1d242e" : "#f0f2f5", color: sub }}>{(k.key_type || "").replace(/_/g, " ")}</span></div></div>
                  <button onClick={() => setDrawer(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setConfirm({ title: "Rotate secret?", message: "Choose a grace period for the old secret.", rotate: true, id: k.id })} className={btnGhost}><RotateCw className="w-3.5 h-3.5" /> Rotate</button>
                  {effStatus(k) === "active" ? <button onClick={() => post("disable", { id: k.id }, "Disabled", () => openDetail(k.id))} className={cn(btnGhost, "text-amber-600")}><Power className="w-3.5 h-3.5" /> Disable</button> : k.status === "disabled" ? <button onClick={() => post("enable", { id: k.id }, "Enabled", () => openDetail(k.id))} className={cn(btnGhost, "text-emerald-600")}><Power className="w-3.5 h-3.5" /> Enable</button> : null}
                  {k.status !== "revoked" ? <button onClick={() => setConfirm({ title: "Revoke key?", message: "The key stops working immediately. This can be restored later.", danger: true, onConfirm: () => post("revoke", { id: k.id }, "Revoked", () => openDetail(k.id)) })} className={cn(btnGhost, "text-red-500")}><Ban className="w-3.5 h-3.5" /> Revoke</button> : <button onClick={() => post("restore", { id: k.id }, "Restored", () => openDetail(k.id))} className={cn(btnGhost, "text-emerald-600")}><CheckCircle2 className="w-3.5 h-3.5" /> Restore</button>}
                  <button onClick={() => setConfirm({ title: "Delete key?", message: "Permanently delete this key and its history.", danger: true, onConfirm: () => post("delete", { id: k.id }, "Deleted", () => { setDrawer(null); loadList(list.page); }) })} className={cn(btnGhost, "text-red-500")}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                </div>
                <Section title="Info" dark={dark} txt={txt} sub={sub} brd={brd} rows={[["Owner", k.owner], ["Created", fmtDT(k.created_at)], ["Last Used", timeAgo(k.last_used_at)], ["Expires", k.expires_at ? fmtDT(k.expires_at) : "Never"], ["Usage", (k.usage_count || 0).toLocaleString()], ["Rate", `${k.rate_per_minute}/m · ${k.rate_per_hour}/h · ${k.rate_per_day}/d`], ["Domains", (k.allowed_domains || []).join(", ") || "Any"], ["IPs", (k.allowed_ips || []).join(", ") || "Any"]]} />
                <div className={cn("rounded-[12px] border", brd)}>
                  <p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b flex items-center gap-1.5", sub, brd)}><Shield className="w-3.5 h-3.5" /> Permissions</p>
                  <div className="p-3 flex flex-wrap gap-1.5">{Object.keys(k.permissions || {}).length === 0 ? <span className={cn("text-xs", sub)}>No permissions granted.</span> : Object.entries(k.permissions).map(([mod, arr]) => <span key={mod} className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-600">{mod}: {arr.join("/")}</span>)}</div>
                </div>
                <div className={cn("rounded-[12px] border", brd)}>
                  <p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b", sub, brd)}>Recent Requests</p>
                  <div className={cn("divide-y max-h-48 overflow-y-auto", divide)}>{(drawer.logs || []).length === 0 ? <p className={cn("p-4 text-xs", sub)}>No requests yet.</p> : drawer.logs.map(l => <div key={l.id} className="px-3 py-2 flex items-center gap-2 text-xs"><span className={cn("font-mono truncate", txt)}>{l.method} {l.endpoint}</span><span className={cn("ml-auto", l.status_code < 400 ? "text-emerald-600" : "text-red-500")}>{l.status_code}</span><span className={sub}>{l.response_time_ms}ms</span></div>)}</div>
                </div>
              </div>
            ); })()}
          </div>
        </div>
      )}

      {/* SECRET MODAL */}
      {secretModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setSecretModal(null)}>
          <div className={cn("w-full max-w-md rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><KeyRound className="w-5 h-5 text-emerald-500" /> {secretModal.title}</p>
            <p className={cn("text-xs text-amber-600 font-semibold")}>⚠ Copy the secret now — it will never be shown again.</p>
            {secretModal.keyId && <div><p className={cn("text-[11px] mb-1", sub)}>Key ID (public)</p><div className={cn("rounded-[10px] border p-2.5 flex items-center gap-2", brd)}><code className={cn("text-xs flex-1 break-all", txt)}>{secretModal.keyId}</code><button onClick={() => { navigator.clipboard?.writeText(secretModal.keyId); showToast("Copied"); }} className={sub}><Copy className="w-4 h-4" /></button></div></div>}
            <div><p className={cn("text-[11px] mb-1", sub)}>Secret Key</p><div className={cn("rounded-[10px] border p-2.5 flex items-center gap-2", brd)}><code className={cn("text-xs font-bold flex-1 break-all", txt)}>{secretModal.secret}</code><button onClick={() => { navigator.clipboard?.writeText(secretModal.secret); showToast("Copied"); }} className={sub}><Copy className="w-4 h-4" /></button></div></div>
            <div className="flex gap-2">
              <button onClick={() => { const blob = new Blob([`ATLANTA SNEAKERS API KEY\n\nKey ID: ${secretModal.keyId || ""}\nSecret: ${secretModal.secret}\n\nKeep this secret safe — it cannot be retrieved again.`], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "atlanta-api-key.txt"; a.click(); URL.revokeObjectURL(url); }} className={btnGhost}><Download className="w-4 h-4" /> Download</button>
              <button onClick={() => setSecretModal(null)} className={cn(btnPrimary, "flex-1 justify-center h-9")}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM (with rotate options) */}
      {confirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirm(null)}>
          <div className={cn("w-full max-w-sm rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><AlertTriangle className={cn("w-5 h-5", confirm.danger ? "text-red-500" : "text-amber-500")} /> {confirm.title}</p>
            <p className={cn("text-sm", sub)}>{confirm.message}</p>
            {confirm.rotate ? (
              <div className="space-y-2">
                {[["immediate", "Immediate (old secret dies now)"], ["24h", "Keep old secret 24h"], ["7d", "Keep old secret 7 days"]].map(([g, l]) => (
                  <button key={g} onClick={async () => { const r = await post("rotate", { id: confirm.id, grace: g }, null, () => openDetail(confirm.id)); setConfirm(null); if (r?.secret) setSecretModal({ title: "Secret rotated", secret: r.secret }); }} className={cn("w-full text-left rounded-[10px] border p-2.5 text-sm font-semibold", brd, hover, txt)}>{l}</button>
                ))}
                <button onClick={() => setConfirm(null)} className={cn(btnGhost, "w-full justify-center")}>Cancel</button>
              </div>
            ) : (
              <div className="flex gap-2 justify-end"><button onClick={() => setConfirm(null)} className={btnGhost}>Cancel</button><button onClick={() => { confirm.onConfirm(); setConfirm(null); }} className={cn("h-9 px-4 rounded-[10px] text-white text-xs font-bold", confirm.danger ? "bg-red-500 hover:bg-red-600" : "bg-[#2563eb]")}>Confirm</button></div>
            )}
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200 max-w-sm", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}

function Section({ title, rows, dark, txt, sub, brd }) {
  return (
    <div className={cn("rounded-[12px] border", brd)}>
      <p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b", sub, brd)}>{title}</p>
      <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2">{rows.map(([k, v]) => <div key={k}><p className={cn("text-[10px]", sub)}>{k}</p><p className={cn("text-xs font-semibold break-words", txt)}>{v || "—"}</p></div>)}</div>
    </div>
  );
}
function AreaChart({ series, dark }) {
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  if (!series.length) return <p className={cn("text-xs py-8 text-center", sub)}>No data.</p>;
  const w = 720, h = 160, pad = 10;
  const max = Math.max(...series.map(s => s.requests), 1);
  const x = (i) => pad + (i / Math.max(series.length - 1, 1)) * (w - pad * 2);
  const y = (v) => h - pad - ((Number(v) || 0) / max) * (h - pad * 2);
  const line = (k) => series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(s[k])}`).join(" ");
  const area = `${line("requests")} L${x(series.length - 1)},${h - pad} L${x(0)},${h - pad} Z`;
  return (
    <div className="overflow-x-auto"><svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ minWidth: 520 }}>
      <defs><linearGradient id="akg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#akg)" /><path d={line("requests")} fill="none" stroke="#2563eb" strokeWidth="2.5" /><path d={line("errors")} fill="none" stroke="#dc2626" strokeWidth="2" />
    </svg>
      <div className="flex gap-4 mt-2 text-[11px]"><span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-[#2563eb] rounded" />Requests</span><span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-[#dc2626] rounded" />Errors</span></div>
    </div>
  );
}
