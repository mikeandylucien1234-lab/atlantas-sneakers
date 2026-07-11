// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Plug, LayoutDashboard, Boxes, Webhook, KeyRound, RefreshCw, ScrollText,
  Loader2, Search, Download, X, CheckCircle2, XCircle, AlertTriangle, Power,
  PlugZap, Settings2, Copy, Trash2, Plus, RotateCw, Clock, Zap, Activity,
  CreditCard, Truck, BarChart2, Mail, MessageSquare, HardDrive, Megaphone,
  Users, Bot, ShoppingBag, LogIn, Send, Server,
} from "lucide-react";

type Props = { dark: boolean };

const CAT_ICON = { Payments: CreditCard, Shipping: Truck, Analytics: BarChart2, Email: Mail, SMS: MessageSquare, Storage: HardDrive, Marketing: Megaphone, CRM: Users, AI: Bot, Dropshipping: ShoppingBag, Authentication: LogIn, Communication: Send };
const STATUS = { connected: { c: "#16a34a", l: "Connected" }, disconnected: { c: "#8a929c", l: "Disconnected" }, error: { c: "#dc2626", l: "Error" }, warning: { c: "#ea7317", l: "Warning" } };

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return "never"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

export function AdminIntegrations({ dark }: Props) {
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
  const [integrations, setIntegrations] = useState([]);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(null);
  const [webhooks, setWebhooks] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [logs, setLogs] = useState({ logs: [], total: 0, page: 1 });
  const [secretModal, setSecretModal] = useState(null);

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3200); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api/integrations${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadList = useCallback(async () => { try { const r = await api("/list"); setIntegrations(r.integrations || []); } catch (e) { showToast(e.message, "error"); } }, [api, showToast]);
  const loadDash = useCallback(async () => { try { setDash(await api("/dashboard")); } catch {} }, [api]);
  const loadWebhooks = useCallback(async () => { try { const r = await api("/webhooks"); setWebhooks(r.webhooks || []); } catch {} }, [api]);
  const loadKeys = useCallback(async () => { try { const r = await api("/api-keys"); setApiKeys(r.keys || []); } catch {} }, [api]);
  const loadJobs = useCallback(async () => { try { const r = await api("/sync"); setJobs(r.jobs || []); } catch {} }, [api]);
  const loadLogs = useCallback(async (page = 1) => { try { const r = await api(`/logs?page=${page}`); setLogs({ ...r }); } catch {} }, [api]);

  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadDash(), loadList()]); setLoading(false); })(); }, [loadDash, loadList]);
  useEffect(() => {
    if (tab === "dashboard") loadDash(); if (tab === "integrations") loadList();
    if (tab === "webhooks") loadWebhooks(); if (tab === "apikeys") loadKeys(); if (tab === "sync") loadJobs(); if (tab === "logs") loadLogs(1);
  }, [tab]); // eslint-disable-line

  const post = async (action, body, okMsg, after) => {
    setBusy(action + (body?.id || ""));
    try { const r = await api(`/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (okMsg) showToast(typeof okMsg === "function" ? okMsg(r) : okMsg); if (after) await after(r); return r; }
    catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };
  const testOne = (i) => post("test", { id: i.id }, (r) => `${i.name}: ${r.ok ? `Connected${r.latency ? ` · ${r.latency}ms` : ""}` : r.message}`, () => { loadList(); if (drawer?.id === i.id) setDrawer(prev => ({ ...prev })); });

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const kpis = [
    { label: "Total", value: K.total }, { label: "Connected", value: K.connected, c: "#16a34a" }, { label: "Disconnected", value: K.disconnected },
    { label: "Errors", value: K.errors, c: K.errors ? "#dc2626" : undefined }, { label: "API Requests Today", value: K.apiRequestsToday },
    { label: "API Errors Today", value: K.apiErrorsToday, c: K.apiErrorsToday ? "#ea7317" : undefined }, { label: "Webhooks Received", value: K.webhooksReceived },
    { label: "Webhooks Failed", value: K.webhooksFailed, c: K.webhooksFailed ? "#dc2626" : undefined }, { label: "Active API Keys", value: K.activeApiKeys },
    { label: "Expired Tokens", value: K.expiredTokens, c: K.expiredTokens ? "#ea7317" : undefined }, { label: "Sync Queue", value: K.syncQueue },
  ];
  const categories = ["All", ...Array.from(new Set(integrations.map(i => i.category)))];
  const shown = integrations.filter(i => (cat === "All" || i.category === cat) && (i.name.toLowerCase().includes(q.toLowerCase()) || i.category.toLowerCase().includes(q.toLowerCase())));
  const statusOf = (i) => STATUS[i.status] || STATUS.disconnected;

  const jobBadge = (st) => <span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ backgroundColor: st === "completed" ? "#16a34a1a" : st === "failed" ? "#dc26261a" : st === "running" ? "#2563eb1a" : "#8a929c1a", color: st === "completed" ? "#16a34a" : st === "failed" ? "#dc2626" : st === "running" ? "#2563eb" : "#8a929c" }}>{st}</span>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Plug className="w-5 h-5 text-[#2563eb]" /> Integrations</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Integration Center · {K.connected || 0}/{K.total || 0} connected</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/integrations/export?format=csv" className={btnGhost}><Download className="w-3.5 h-3.5" /> CSV</a>
          <a href="/api/integrations/export?format=json" className={btnGhost}><Download className="w-3.5 h-3.5" /> JSON</a>
        </div>
      </div>

      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {[["dashboard", "Dashboard", LayoutDashboard], ["integrations", "Integrations", Boxes], ["webhooks", "Webhooks", Webhook], ["apikeys", "API Keys", KeyRound], ["sync", "Sync Center", RefreshCw], ["logs", "Logs", ScrollText]].map(([id, l, I]) => <button key={id} onClick={() => setTab(id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><I className="w-3.5 h-3.5" /> {l}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">{kpis.map(k => (
            <div key={k.label} className={cn(cardCls, "p-3.5")}><p className="text-[18px] font-extrabold" style={{ color: k.c }}><span className={k.c ? "" : txt}>{k.value ?? 0}</span></p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
          ))}</div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={cn(cardCls, "p-4 lg:col-span-2")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>API Requests (14 days)</p><AreaChart series={dash.series || []} dark={dark} /></div>
            <div className={cn(cardCls, "overflow-hidden")}>
              <p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b", sub, brd)}>Recent Activity</p>
              <div className={cn("divide-y max-h-64 overflow-y-auto", divide)}>
                {(dash.recent || []).length === 0 ? <p className={cn("p-4 text-xs", sub)}>No integration activity yet.</p> :
                  dash.recent.map((l, i) => <div key={i} className="px-4 py-2.5 flex items-center gap-2"><span className={cn("w-1.5 h-1.5 rounded-full shrink-0", l.status === "ok" ? "bg-emerald-500" : "bg-red-500")} /><span className={cn("text-xs font-semibold capitalize", txt)}>{l.integration_id} · {l.action}</span><span className={cn("text-[10px] ml-auto shrink-0", sub)}>{l.latency_ms ? `${l.latency_ms}ms · ` : ""}{timeAgo(l.created_at)}</span></div>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTEGRATIONS */}
      {tab === "integrations" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap gap-2 items-center")}>
            <div className="relative flex-1 min-w-[180px]"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={q} onChange={e => setQ(e.target.value)} className={cn(inpCls, "pl-9 h-9")} placeholder="Search integrations…" /></div>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">{categories.map(c => { const I = CAT_ICON[c] || Boxes; return <button key={c} onClick={() => setCat(c)} className={cn("h-8 px-3 rounded-[9px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap border", cat === c ? "bg-[#2563eb] text-white border-transparent" : cn(brd, sub, hover))}>{c !== "All" && <I className="w-3.5 h-3.5" />}{c}</button>; })}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shown.map(i => { const st = statusOf(i); return (
              <div key={i.id} className={cn(cardCls, "p-4 flex flex-col")}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 text-white font-extrabold" style={{ background: i.color }}>{i.name[0]}</div>
                  <div className="min-w-0 flex-1"><p className={cn("text-sm font-bold", txt)}>{i.name}</p><p className={cn("text-[11px]", sub)}>{i.category}</p></div>
                  <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: st.c }} title={st.l} />
                </div>
                <p className={cn("text-[11px] mb-2 line-clamp-1", sub)}>{i.description}</p>
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${st.c}1a`, color: st.c }}>{st.l}</span>
                  {!i.configured && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-600">Needs credentials</span>}
                  {i.last_test_at && <span className={cn("text-[10px]", sub)}>tested {timeAgo(i.last_test_at)}</span>}
                </div>
                <div className="mt-auto flex items-center gap-1.5 flex-wrap">
                  <button onClick={() => testOne(i)} disabled={busy === "test" + i.id} className={btnGhost}>{busy === "test" + i.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />} Test</button>
                  {i.enabled ? <button onClick={() => post("disconnect", { id: i.id }, "Disconnected", loadList)} className={cn(btnGhost, "text-red-500")}><Power className="w-3.5 h-3.5" /> Disable</button>
                    : <button onClick={() => post("connect", { id: i.id }, "Enabled", loadList)} disabled={!i.configured} className={btnPrimary}><Plug className="w-3.5 h-3.5" /> Enable</button>}
                  <button onClick={() => setDrawer(i)} className={btnGhost}><Settings2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ); })}
          </div>
          {shown.length === 0 && <div className={cn(cardCls, "p-10 text-center")}><Boxes className={cn("w-8 h-8 mx-auto mb-2", sub)} /><p className={cn("text-sm", sub)}>No integrations found.</p></div>}
        </div>
      )}

      {/* WEBHOOKS */}
      {tab === "webhooks" && (
        <div className="space-y-3">
          <div className="flex justify-end"><button onClick={() => { const url = prompt("Webhook URL:"); if (url) { const integ = prompt("Integration id (e.g. stripe):") || "custom"; post("webhook", { integration_id: integ, url, events: ["*"] }, null, (r) => { if (r?.secret) setSecretModal({ title: "Webhook secret", value: r.secret }); loadWebhooks(); }); } }} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add Webhook</button></div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Integration", "URL", "Secret", "Events", "Deliveries", "Last", "Status", ""].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {webhooks.length === 0 ? <tr><td colSpan={8} className={cn("px-4 py-8 text-center text-xs", sub)}>No webhooks configured.</td></tr> :
                  webhooks.map(w => <tr key={w.id}><td className={cn("px-3 py-2.5 font-semibold", txt)}>{w.integration_id}</td><td className={cn("px-3 py-2.5 truncate max-w-[180px]", sub)}>{w.url}</td><td className={cn("px-3 py-2.5 font-mono text-[10px]", sub)}>{w.secret_prefix}</td><td className={cn("px-3 py-2.5", sub)}>{(w.events || []).join(", ")}</td><td className={cn("px-3 py-2.5", txt)}>{w.deliveries || 0}{w.failures ? <span className="text-red-500"> / {w.failures} failed</span> : ""}</td><td className={cn("px-3 py-2.5 text-[11px]", sub)}>{timeAgo(w.last_delivery_at)}</td><td className="px-3 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600">{w.status}</span></td><td className="px-3 py-2.5"><div className="flex gap-1"><button onClick={() => post("webhook", { op: "rotate", id: w.id }, null, (r) => { if (r?.secret) setSecretModal({ title: "New secret", value: r.secret }); loadWebhooks(); })} title="Rotate secret" className={sub}><RotateCw className="w-3.5 h-3.5" /></button><button onClick={() => post("webhook", { op: "delete", id: w.id }, "Deleted", loadWebhooks)} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div></td></tr>)}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {/* API KEYS */}
      {tab === "apikeys" && (
        <div className="space-y-3">
          <div className="flex justify-end"><button onClick={() => { const name = prompt("API key name:"); if (name) post("api-key", { name, scopes: ["read"] }, null, (r) => { if (r?.key) setSecretModal({ title: "API key (shown once)", value: r.key }); loadKeys(); }); }} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Generate Key</button></div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Name", "Service", "Key", "Scopes", "Usage", "Expires", "Status", ""].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {apiKeys.length === 0 ? <tr><td colSpan={8} className={cn("px-4 py-8 text-center text-xs", sub)}>No API keys.</td></tr> :
                  apiKeys.map(k => <tr key={k.id}><td className={cn("px-3 py-2.5 font-semibold", txt)}>{k.name}</td><td className={cn("px-3 py-2.5", sub)}>{k.integration_id || "—"}</td><td className={cn("px-3 py-2.5 font-mono text-[10px]", sub)}>{k.key_prefix}</td><td className={cn("px-3 py-2.5", sub)}>{(k.scopes || []).join(", ")}</td><td className={cn("px-3 py-2.5", txt)}>{k.usage_count || 0}</td><td className={cn("px-3 py-2.5 text-[11px]", sub)}>{k.expires_at ? fmtDT(k.expires_at) : "—"}</td><td className="px-3 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: k.status === "active" ? "#16a34a1a" : "#dc26261a", color: k.status === "active" ? "#16a34a" : "#dc2626" }}>{k.status}</span></td><td className="px-3 py-2.5"><div className="flex gap-1">{k.status === "active" && <><button onClick={() => post("api-key", { op: "rotate", id: k.id }, null, (r) => { if (r?.key) setSecretModal({ title: "Rotated key", value: r.key }); loadKeys(); })} title="Rotate" className={sub}><RotateCw className="w-3.5 h-3.5" /></button><button onClick={() => post("api-key", { op: "revoke", id: k.id }, "Revoked", loadKeys)} className="text-red-500" title="Revoke"><XCircle className="w-3.5 h-3.5" /></button></>}</div></td></tr>)}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {/* SYNC */}
      {tab === "sync" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{["queued", "running", "completed", "failed"].map(st => <div key={st} className={cn(cardCls, "p-3.5")}><p className="text-[18px] font-extrabold" style={{ color: st === "failed" ? "#dc2626" : st === "completed" ? "#16a34a" : undefined }}><span className={txt}>{jobs.filter(j => j.status === st).length}</span></p><p className={cn("text-[11px] font-semibold mt-0.5 capitalize", sub)}>{st} Jobs</p></div>)}</div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}><p className={cn("text-sm font-extrabold", txt)}>Sync Jobs</p><button onClick={loadJobs} className={cn("text-xs flex items-center gap-1", sub)}><RefreshCw className="w-3.5 h-3.5" /> Refresh</button></div>
            <div className={cn("divide-y", divide)}>
              {jobs.length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No sync jobs yet. Trigger a sync from an integration.</p> :
                jobs.map(j => <div key={j.id} className="px-4 py-3 flex items-center justify-between gap-3"><div className="min-w-0"><p className={cn("text-sm font-bold", txt)}>{j.integration_id} · {j.job_type}</p><p className={cn("text-[10px]", sub)}>{j.detail || j.error || "—"} · {timeAgo(j.created_at)}</p></div><div className="flex items-center gap-2">{jobBadge(j.status)}{j.status === "failed" && <button onClick={() => post("sync-retry", { id: j.id }, "Requeued", loadJobs)} className="text-[11px] font-bold text-[#2563eb]">Retry</button>}</div></div>)}
            </div>
          </div>
        </div>
      )}

      {/* LOGS */}
      {tab === "logs" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Date", "Service", "Action", "Status", "Latency", "Error"].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {logs.logs.length === 0 ? <tr><td colSpan={6} className={cn("px-4 py-8 text-center text-xs", sub)}>No logs yet.</td></tr> :
                  logs.logs.map(l => <tr key={l.id}><td className={cn("px-3 py-2.5 text-[11px]", sub)}>{fmtDT(l.created_at)}</td><td className={cn("px-3 py-2.5 font-semibold", txt)}>{l.integration_id}</td><td className={cn("px-3 py-2.5 capitalize", sub)}>{l.action}</td><td className="px-3 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: l.status === "ok" ? "#16a34a1a" : "#dc26261a", color: l.status === "ok" ? "#16a34a" : "#dc2626" }}>{l.status}</span></td><td className={cn("px-3 py-2.5", sub)}>{l.latency_ms ? `${l.latency_ms}ms` : "—"}</td><td className={cn("px-3 py-2.5 text-[11px] text-red-500 truncate max-w-[200px]")}>{l.error || ""}</td></tr>)}
              </tbody>
            </table></div>
          </div>
          {logs.total > 40 && <div className="flex items-center justify-between"><span className={cn("text-xs", sub)}>{logs.total} logs · page {logs.page}</span><div className="flex gap-1.5"><button disabled={logs.page <= 1} onClick={() => loadLogs(logs.page - 1)} className={cn(btnGhost, "disabled:opacity-40")}>Prev</button><button disabled={logs.page * 40 >= logs.total} onClick={() => loadLogs(logs.page + 1)} className={cn(btnGhost, "disabled:opacity-40")}>Next</button></div></div>}
        </div>
      )}

      {/* CONFIG DRAWER */}
      {drawer && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDrawer(null)}>
          <div className={cn("w-full max-w-md h-full overflow-y-auto border-l p-5 space-y-4", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-[12px] flex items-center justify-center text-white font-extrabold" style={{ background: drawer.color }}>{drawer.name[0]}</div><div><p className={cn("text-lg font-extrabold", txt)}>{drawer.name}</p><p className={cn("text-xs", sub)}>{drawer.category}</p></div></div>
              <button onClick={() => setDrawer(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => testOne(drawer)} className={btnGhost}><PlugZap className="w-3.5 h-3.5" /> Test Connection</button>
              {drawer.capabilities?.includes("sync") && <button onClick={() => post("sync", { id: drawer.id }, (r) => r.ok ? "Synced" : r.message, loadList)} className={btnGhost}><RefreshCw className="w-3.5 h-3.5" /> Sync</button>}
              {drawer.enabled ? <button onClick={() => post("disconnect", { id: drawer.id }, "Disabled", () => { loadList(); setDrawer(null); })} className={cn(btnGhost, "text-red-500")}><Power className="w-3.5 h-3.5" /> Disable</button> : <button onClick={() => post("connect", { id: drawer.id }, "Enabled", () => { loadList(); setDrawer(null); })} disabled={!drawer.configured} className={btnPrimary}><Plug className="w-3.5 h-3.5" /> Enable</button>}
            </div>
            {drawer.last_test_message && <div className={cn("rounded-[10px] p-2.5 text-xs font-semibold", drawer.last_test_status === "connected" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>{drawer.last_test_message}{drawer.last_test_latency ? ` · ${drawer.last_test_latency}ms` : ""}</div>}
            <div className={cn("rounded-[12px] border", brd)}>
              <p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b flex items-center gap-1.5", sub, brd)}><KeyRound className="w-3.5 h-3.5" /> Required Credentials (server env)</p>
              <div className="p-3 space-y-1.5">
                {(drawer.env_status || []).length === 0 ? <p className={cn("text-xs", sub)}>No credentials required.</p> : drawer.env_status.map(e => (
                  <div key={e.key} className="flex items-center justify-between"><code className={cn("text-[11px]", txt)}>{e.key}</code>{e.present ? <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> set</span> : <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-600">not set</span>}</div>
                ))}
                <p className={cn("text-[10px] mt-2 leading-relaxed", sub)}>Secret values are stored <b className={txt}>only in server environment variables</b> — never in the database or the browser. Set them on o2switch, then Test.</p>
              </div>
            </div>
            <div className={cn("rounded-[12px] border p-3", brd)}>
              <label className={labelCls}>Mode</label>
              <select value={drawer.mode} onChange={e => { setDrawer(d => ({ ...d, mode: e.target.value })); post("connect", { id: drawer.id, mode: e.target.value }, "Mode updated", loadList); }} className={inpCls} disabled={!drawer.capabilities?.includes("sandbox")}>
                <option value="production">Production</option><option value="sandbox">Sandbox</option>
              </select>
              {!drawer.capabilities?.includes("sandbox") && <p className={cn("text-[10px] mt-1", sub)}>This provider has no sandbox mode.</p>}
            </div>
            {drawer.docs_url && <a href={drawer.docs_url} target="_blank" rel="noreferrer" className={cn("text-xs text-[#2563eb] font-semibold")}>Documentation ↗</a>}
          </div>
        </div>
      )}

      {secretModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setSecretModal(null)}>
          <div className={cn("w-full max-w-md rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><KeyRound className="w-5 h-5 text-emerald-500" /> {secretModal.title}</p>
            <p className={cn("text-xs", sub)}>Copy it now — it will not be shown again.</p>
            <div className={cn("rounded-[10px] border p-3 flex items-center gap-2", brd)}><code className={cn("text-xs font-bold flex-1 break-all", txt)}>{secretModal.value}</code><button onClick={() => { navigator.clipboard?.writeText(secretModal.value); showToast("Copied"); }} className={sub}><Copy className="w-4 h-4" /></button></div>
            <button onClick={() => setSecretModal(null)} className={cn(btnPrimary, "w-full justify-center h-10")}>Done</button>
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200 max-w-sm", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
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
      <defs><linearGradient id="ig" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#ig)" /><path d={line("requests")} fill="none" stroke="#2563eb" strokeWidth="2.5" /><path d={line("errors")} fill="none" stroke="#dc2626" strokeWidth="2" />
    </svg>
      <div className="flex gap-4 mt-2 text-[11px]"><span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-[#2563eb] rounded" />Requests</span><span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-[#dc2626] rounded" />Errors</span></div>
    </div>
  );
}
