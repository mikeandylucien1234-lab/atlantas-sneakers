// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  HardDrive, LayoutDashboard, Database, RotateCcw, ShieldCheck, Settings2,
  Loader2, Search, Download, X, Plus, Trash2, Play, CheckCircle2, XCircle,
  AlertTriangle, Clock, Lock, FileCheck2, Server, Activity, ShieldAlert, Copy,
} from "lucide-react";

type Props = { dark: boolean };

const STATUS = { success: { c: "#16a34a", l: "Success" }, running: { c: "#ea7317", l: "Running" }, failed: { c: "#dc2626", l: "Failed" } };
const BACKUP_TYPES = [["database", "Database (all)"], ["full", "Full System"], ["products", "Products"], ["orders", "Orders"], ["customers", "Customers"], ["categories", "Categories"], ["brands", "Brands"], ["coupons", "Coupons"], ["reviews", "Reviews"], ["roles", "Roles & Permissions"], ["settings", "Settings"], ["seo", "SEO"], ["payment_settings", "Payment Settings"], ["api_keys", "API Keys"], ["notifications", "Notifications"], ["media", "Media"], ["configuration", "Configuration"]];
const RESTORE_SCOPES = ["products", "orders", "customers", "categories", "brands", "coupons", "reviews", "roles", "settings", "seo", "media"];
const RETENTIONS = [[7, "7 days"], [30, "30 days"], [90, "90 days"], [180, "180 days"], [365, "1 year"], [0, "Unlimited"]];

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function dur(ms) { if (!ms) return "—"; if (ms < 1000) return `${ms}ms`; if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`; return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`; }
function timeAgo(d) { if (!d) return "never"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

export function AdminBackup({ dark }: Props) {
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
  const [list, setList] = useState({ backups: [], total: 0, page: 1, pageSize: 25 });
  const [filters, setFilters] = useState({ q: "", type: "all", status: "all" });
  const [drawer, setDrawer] = useState(null);
  const [settings, setSettings] = useState(null);
  const [restores, setRestores] = useState({ restores: [], successRate: 100 });
  const [createForm, setCreateForm] = useState({ backup_type: "database", encrypt: false, compress: true, name: "" });
  const [restorePreview, setRestorePreview] = useState(null);

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3500); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api/backups${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadDash = useCallback(async () => { try { setDash(await api("/dashboard")); } catch {} }, [api]);
  const loadList = useCallback(async (page = 1) => { try { const qs = new URLSearchParams({ page, ...filters }); const r = await api(`/history?${qs}`); setList({ ...r }); } catch (e) { showToast(e.message, "error"); } }, [api, filters, showToast]);
  const loadSettings = useCallback(async () => { try { setSettings(await api("/settings")); } catch {} }, [api]);
  const loadRestores = useCallback(async () => { try { setRestores(await api("/restores")); } catch {} }, [api]);

  useEffect(() => { (async () => { setLoading(true); await loadDash(); setLoading(false); })(); }, [loadDash]);
  useEffect(() => { if (tab === "dashboard") loadDash(); if (tab === "backups") loadList(1); if (tab === "settings") loadSettings(); if (tab === "recovery") loadRestores(); if (tab === "restore") { loadList(1); loadSettings(); } }, [tab]); // eslint-disable-line
  useEffect(() => { if (tab === "backups") loadList(1); }, [filters]); // eslint-disable-line

  const post = async (action, body, okMsg, after) => {
    setBusy(action + (body?.id || body?.backup_id || ""));
    try { const r = await api(`/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (okMsg) showToast(typeof okMsg === "function" ? okMsg(r) : okMsg); if (after) await after(r); return r; }
    catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };
  const openDetail = async (id) => { setDrawer({ loading: true }); try { setDrawer(await api(`/detail?id=${id}`)); } catch (e) { showToast(e.message, "error"); setDrawer(null); } };
  const doCreate = () => post("create", createForm, (r) => r.ok ? `Backup done · ${r.tableCount} tables, ${r.rowCount} rows` : "Backup failed", () => { loadDash(); loadList(1); });
  const download = async (id) => { try { const r = await api(`/download?id=${id}`); if (r.url) window.open(r.url, "_blank"); } catch (e) { showToast(e.message, "error"); } };

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const kpis = [
    { label: "Total Backups", value: K.total }, { label: "Successful", value: K.successful, c: "#16a34a" }, { label: "Failed", value: K.failed, c: K.failed ? "#dc2626" : undefined },
    { label: "Scheduled", value: K.scheduled }, { label: "Running", value: K.running, c: K.running ? "#ea7317" : undefined },
    { label: "Storage Used", value: K.storageUsedH }, { label: "Storage Free", value: K.storageRemainingH }, { label: "Database Size", value: K.databaseSizeH },
    { label: "Total Rows", value: (K.totalRows || 0).toLocaleString() }, { label: "Avg Backup", value: dur(K.avgBackupMs) }, { label: "Avg Restore", value: dur(K.avgRestoreMs) },
    { label: "Last Backup", value: timeAgo(K.lastBackup) }, { label: "Last Restore", value: timeAgo(K.lastRestore) }, { label: "Health Score", value: `${K.healthScore || 0}%`, c: (K.healthScore || 0) >= 80 ? "#16a34a" : (K.healthScore || 0) >= 50 ? "#ea7317" : "#dc2626" },
  ];
  const statusBadge = (st) => <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${STATUS[st]?.c || "#8a929c"}1a`, color: STATUS[st]?.c || "#8a929c" }}>{STATUS[st]?.l || st}</span>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><HardDrive className="w-5 h-5 text-[#2563eb]" /> Backup <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Disaster Recovery</span></h1>
          <p className={cn("text-xs mt-0.5", sub)}>Health {K.healthScore || 0}% · last backup {timeAgo(K.lastBackup)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/backups/export?format=csv" className={btnGhost}><Download className="w-3.5 h-3.5" /> CSV</a>
          <button onClick={doCreate} disabled={busy === "create"} className={btnPrimary}>{busy === "create" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />} Backup Now</button>
        </div>
      </div>

      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {[["dashboard", "Dashboard", LayoutDashboard], ["backups", "History", Database], ["create", "Create Backup", Plus], ["restore", "Restore Center", RotateCcw], ["recovery", "Disaster Recovery", ShieldAlert], ["settings", "Settings", Settings2]].map(([id, l, I]) => <button key={id} onClick={() => setTab(id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><I className="w-3.5 h-3.5" /> {l}</button>)}
      </div>

      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">{kpis.map(k => (
            <div key={k.label} className={cn(cardCls, "p-3.5")}><p className="text-[16px] font-extrabold truncate" style={{ color: k.c }}><span className={k.c ? "" : txt}>{k.value ?? 0}</span></p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
          ))}</div>
          <div className={cn(cardCls, "p-4")}><p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Backup History (14 days)</p><BackupChart series={dash.series || []} dark={dark} /></div>
        </div>
      )}

      {tab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={cn(cardCls, "p-5 space-y-4")}>
            <p className={cn("text-sm font-extrabold", txt)}>Create Backup</p>
            <div><label className={labelCls}>Backup Type</label><select value={createForm.backup_type} onChange={e => setCreateForm(f => ({ ...f, backup_type: e.target.value }))} className={inpCls}>{BACKUP_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className={labelCls}>Name (optional)</label><input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className={inpCls} placeholder="auto-generated" /></div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={createForm.compress} onChange={e => setCreateForm(f => ({ ...f, compress: e.target.checked }))} className="rounded" /><span className={cn("text-xs font-semibold", txt)}>Compression (gzip)</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={createForm.encrypt} onChange={e => setCreateForm(f => ({ ...f, encrypt: e.target.checked }))} className="rounded" /><span className={cn("text-xs font-semibold", txt)}>Encryption (AES-256-GCM)</span></label>
            </div>
            {createForm.encrypt && settings && !settings.encryption_configured && <div className="rounded-[10px] p-2.5 text-[11px] bg-amber-500/10 text-amber-600">Set <code>BACKUP_ENCRYPTION_KEY</code> on the server to enable encryption; otherwise the backup is stored unencrypted.</div>}
            <button onClick={doCreate} disabled={busy === "create"} className={cn(btnPrimary, "h-10")}>{busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />} Run Backup</button>
          </div>
          <div className={cn(cardCls, "p-5 space-y-2")}>
            <p className={cn("text-sm font-extrabold", txt)}>How it works</p>
            <ul className={cn("text-xs space-y-1.5 list-disc pl-4", sub)}>
              <li>Selected tables are exported to a JSON manifest via the service role.</li>
              <li>Compressed (gzip), a <b className={txt}>SHA-256 checksum</b> is computed, optionally <b className={txt}>AES-256-GCM</b> encrypted.</li>
              <li>The artifact is uploaded to the private <code className={txt}>backups</code> storage bucket.</li>
              <li>Every backup is validatable and fully restorable (merge or replace).</li>
              <li>Success/failure raises an alert and is written to Audit Logs + Activity.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === "backups" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap gap-2 items-center")}>
            <div className="relative flex-1 min-w-[180px]"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} className={cn(inpCls, "pl-9 h-9")} placeholder="Search backup name…" /></div>
            <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All types</option>{BACKUP_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All status</option>{["success", "running", "failed"].map(s => <option key={s} value={s}>{s}</option>)}</select>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Name", "Type", "Status", "Size", "Ratio", "Rows", "Duration", "Enc", "Valid", "Created", ""].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {list.backups.length === 0 ? <tr><td colSpan={11} className={cn("px-4 py-10 text-center", sub)}><Database className="w-8 h-8 mx-auto mb-2" /><p className="text-sm">No backups yet. Run your first backup.</p></td></tr> :
                  list.backups.map(bk => (
                    <tr key={bk.id} className={cn(hover, "cursor-pointer")} onClick={() => openDetail(bk.id)}>
                      <td className={cn("px-3 py-2.5 font-semibold", txt)}>{bk.name}</td>
                      <td className={cn("px-3 py-2.5 capitalize", sub)}>{bk.backup_type}</td>
                      <td className="px-3 py-2.5">{statusBadge(bk.status)}</td>
                      <td className={cn("px-3 py-2.5", txt)}>{bk.size_h}</td>
                      <td className={cn("px-3 py-2.5", sub)}>{bk.compression_ratio ? `${Math.round((1 - bk.compression_ratio) * 100)}%` : "—"}</td>
                      <td className={cn("px-3 py-2.5", txt)}>{(bk.row_count || 0).toLocaleString()}</td>
                      <td className={cn("px-3 py-2.5", sub)}>{dur(bk.duration_ms)}</td>
                      <td className="px-3 py-2.5">{bk.encrypted ? <Lock className="w-3.5 h-3.5 text-emerald-500" /> : <span className={sub}>—</span>}</td>
                      <td className="px-3 py-2.5">{bk.valid === true ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : bk.valid === false ? <XCircle className="w-4 h-4 text-red-500" /> : <span className={sub}>?</span>}</td>
                      <td className={cn("px-3 py-2.5 text-[11px]", sub)}>{fmtDT(bk.created_at)}</td>
                      <td className="px-3 py-2.5"><div className="flex gap-1" onClick={e => e.stopPropagation()}><button onClick={() => post("validate", { id: bk.id }, (r) => r.ok ? "Valid ✓" : r.message, () => loadList(list.page))} title="Validate" className={sub}><FileCheck2 className="w-3.5 h-3.5" /></button><button onClick={() => download(bk.id)} title="Download" className={sub}><Download className="w-3.5 h-3.5" /></button><button onClick={() => setConfirm({ title: "Delete backup?", message: `${bk.name} and its artifact will be permanently deleted.`, danger: true, onConfirm: () => post("delete", { id: bk.id }, "Deleted", () => loadList(list.page)) })} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div></td>
                    </tr>
                  ))}
              </tbody>
            </table></div>
          </div>
          {list.total > list.pageSize && <div className="flex items-center justify-between"><span className={cn("text-xs", sub)}>{list.total} backups · page {list.page}</span><div className="flex gap-1.5"><button disabled={list.page <= 1} onClick={() => loadList(list.page - 1)} className={cn(btnGhost, "disabled:opacity-40")}>Prev</button><button disabled={list.page * list.pageSize >= list.total} onClick={() => loadList(list.page + 1)} className={cn(btnGhost, "disabled:opacity-40")}>Next</button></div></div>}
        </div>
      )}

      {tab === "restore" && (
        <div className="space-y-3">
          <div className={cn("rounded-[12px] border p-3.5 flex gap-3", "border-amber-500/30 bg-amber-500/[.06]")}><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /><p className={cn("text-[12px] leading-relaxed", sub)}>Restore re-applies backed-up rows to the live database. <b className={txt}>Merge</b> upserts (safe); <b className={txt}>Replace</b> wipes each table first. Always preview and confirm. The checksum is verified before any restore — corrupted backups are refused.</p></div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Select a backup to restore</p>
            <div className={cn("divide-y max-h-[500px] overflow-y-auto", divide)}>
              {list.backups.filter(b => b.status === "success").length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No successful backups available.</p> :
                list.backups.filter(b => b.status === "success").map(bk => (
                  <div key={bk.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0"><p className={cn("text-sm font-bold truncate", txt)}>{bk.name}</p><p className={cn("text-[11px]", sub)}>{bk.backup_type} · {bk.size_h} · {(bk.row_count || 0).toLocaleString()} rows · {fmtDT(bk.created_at)} {bk.encrypted && "· encrypted"}</p></div>
                    <button onClick={async () => { const pv = await api(`/preview?id=${bk.id}`); setRestorePreview({ backup: bk, preview: pv, mode: "merge", scope: [] }); }} className={btnPrimary}><RotateCcw className="w-3.5 h-3.5" /> Restore</button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {tab === "recovery" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className={cn(cardCls, "p-4")}><p className="text-[22px] font-extrabold" style={{ color: restores.successRate >= 80 ? "#16a34a" : "#ea7317" }}>{restores.successRate}%</p><p className={cn("text-xs", sub)}>Recovery Success Rate</p></div>
            <div className={cn(cardCls, "p-4")}><p className={cn("text-[22px] font-extrabold", txt)}>{dur(dash?.kpis?.avgRestoreMs)}</p><p className={cn("text-xs", sub)}>Estimated Recovery Time</p></div>
            <div className={cn(cardCls, "p-4")}><p className={cn("text-[22px] font-extrabold", txt)}>{dash?.kpis?.healthScore || 0}%</p><p className={cn("text-xs", sub)}>Backup Health Score</p></div>
          </div>
          <div className={cn(cardCls, "p-4")}>
            <p className={cn("text-sm font-extrabold mb-2", txt)}>Recovery Plan</p>
            <ol className={cn("text-xs space-y-1.5 list-decimal pl-4", sub)}>
              <li>Identify the most recent <b className={txt}>valid</b> backup (green check in History).</li>
              <li>Validate its checksum to confirm integrity.</li>
              <li>Preview the impact, then restore in <b className={txt}>Merge</b> mode first.</li>
              <li>Verify data, then escalate to <b className={txt}>Replace</b> only if required.</li>
            </ol>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Recovery History</p>
            <div className={cn("divide-y", divide)}>
              {restores.restores.length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No restores performed yet.</p> :
                restores.restores.map(r => <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3"><div><p className={cn("text-sm font-bold", txt)}>{r.mode} restore · {r.tables_restored} tables · {r.rows_restored} rows</p><p className={cn("text-[11px]", sub)}>{r.created_by_name} · {fmtDT(r.created_at)} · {dur(r.duration_ms)}</p></div>{statusBadge(r.status)}</div>)}
            </div>
          </div>
        </div>
      )}

      {tab === "settings" && settings && (
        <div className="space-y-4">
          <div className={cn(cardCls, "p-5 space-y-4")}>
            <p className={cn("text-sm font-extrabold", txt)}>Retention Policy</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className={labelCls}>Keep backups for</label><select value={settings.retention?.retention_days} onChange={e => setSettings(s => ({ ...s, retention: { ...s.retention, retention_days: parseInt(e.target.value) } }))} className={inpCls}>{RETENTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><label className={labelCls}>Always keep newest</label><input type="number" value={settings.retention?.keep_min ?? 5} onChange={e => setSettings(s => ({ ...s, retention: { ...s.retention, keep_min: parseInt(e.target.value) || 0 } }))} className={inpCls} /></div>
              <div className="flex items-end"><label className="flex items-center gap-2 cursor-pointer h-[42px]"><input type="checkbox" checked={!!settings.retention?.auto_cleanup} onChange={e => setSettings(s => ({ ...s, retention: { ...s.retention, auto_cleanup: e.target.checked } }))} className="rounded" /><span className={cn("text-xs font-semibold", txt)}>Auto cleanup</span></label></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => post("settings", { retention: settings.retention }, "Saved")} className={btnPrimary}><CheckCircle2 className="w-4 h-4" /> Save Policy</button>
              <button onClick={() => setConfirm({ title: "Run cleanup now?", message: "Delete backups older than the retention window (keeping the newest N).", danger: true, onConfirm: () => post("cleanup", {}, (r) => `${r.removed} removed`, () => { loadList(1); loadDash(); }) })} className={cn(btnGhost, "text-red-500")}><Trash2 className="w-4 h-4" /> Run Cleanup</button>
            </div>
          </div>
          <div className={cn(cardCls, "p-5 space-y-3")}>
            <p className={cn("text-sm font-extrabold", txt)}>Destinations</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(settings.destinations || []).map(d => (
                <div key={d.id} className={cn("flex items-center justify-between rounded-[10px] border p-3", brd)}>
                  <div className="flex items-center gap-2"><Server className={cn("w-4 h-4", d.enabled ? "text-emerald-500" : sub)} /><div><p className={cn("text-sm font-bold", txt)}>{d.name}</p><p className={cn("text-[10px]", sub)}>{d.is_default ? "Default · " : ""}{d.configured ? "configured" : "needs credentials"}</p></div></div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: d.enabled ? "#16a34a1a" : "#8a929c1a", color: d.enabled ? "#16a34a" : "#8a929c" }}>{d.enabled ? "active" : "off"}</span>
                </div>
              ))}
            </div>
            <p className={cn("text-[11px]", sub)}>Supabase Storage is the active destination. External destinations activate once their env credentials are set on the server. Encryption: <b className={settings.encryption_configured ? "text-emerald-600" : "text-amber-600"}>{settings.encryption_configured ? "AES-256 key configured" : "set BACKUP_ENCRYPTION_KEY to enable"}</b>.</p>
          </div>
          <div className={cn(cardCls, "p-5 space-y-3")}>
            <div className="flex items-center justify-between"><p className={cn("text-sm font-extrabold", txt)}>Scheduled Backups</p><button onClick={() => post("settings", { job: { name: "Daily database", backup_type: "database", schedule: "daily", enabled: true, compress: true } }, "Schedule added", loadSettings)} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add Schedule</button></div>
            <div className={cn("divide-y", divide)}>
              {(settings.jobs || []).length === 0 ? <p className={cn("text-xs", sub)}>No schedules. Add one to run automatic backups (trigger via a server cron on <code>/api/backups/create</code>).</p> :
                settings.jobs.map(j => <div key={j.id} className="py-2.5 flex items-center justify-between"><div><p className={cn("text-sm font-bold", txt)}>{j.name || j.backup_type}</p><p className={cn("text-[10px]", sub)}>{j.schedule} · {j.backup_type} {j.encrypt && "· encrypted"}</p></div><div className="flex items-center gap-2"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: j.enabled ? "#16a34a1a" : "#8a929c1a", color: j.enabled ? "#16a34a" : "#8a929c" }}>{j.enabled ? "enabled" : "off"}</span><button onClick={() => post("settings", { deleteJob: j.id }, "Removed", loadSettings)} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div></div>)}
            </div>
          </div>
        </div>
      )}

      {drawer && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDrawer(null)}>
          <div className={cn("w-full max-w-lg h-full overflow-y-auto border-l", p, brd)} onClick={e => e.stopPropagation()}>
            {drawer.loading ? <div className="p-10 flex justify-center"><Loader2 className={cn("w-6 h-6 animate-spin", sub)} /></div> : (() => { const bk = drawer.backup; return (
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between"><div><p className={cn("text-lg font-extrabold", txt)}>{bk.name}</p><p className={cn("text-xs", sub)}>{fmtDT(bk.created_at)} · by {bk.created_by_name}</p><div className="mt-1.5 flex gap-1.5 flex-wrap">{statusBadge(bk.status)}{bk.encrypted && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 flex items-center gap-1"><Lock className="w-3 h-3" /> AES-256</span>}{bk.valid === true && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600">Valid</span>}</div></div><button onClick={() => setDrawer(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => post("validate", { id: bk.id }, (r) => r.ok ? "Valid ✓" : r.message, () => openDetail(bk.id))} className={btnGhost}><FileCheck2 className="w-3.5 h-3.5" /> Validate</button>
                  <button onClick={() => download(bk.id)} className={btnGhost}><Download className="w-3.5 h-3.5" /> Download</button>
                  {bk.status === "success" && <button onClick={async () => { const pv = await api(`/preview?id=${bk.id}`); setRestorePreview({ backup: bk, preview: pv, mode: "merge", scope: [] }); setDrawer(null); }} className={btnPrimary}><RotateCcw className="w-3.5 h-3.5" /> Restore</button>}
                  <button onClick={() => setConfirm({ title: "Delete backup?", message: bk.name, danger: true, onConfirm: () => post("delete", { id: bk.id }, "Deleted", () => { setDrawer(null); loadList(list.page); }) })} className={cn(btnGhost, "text-red-500")}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                </div>
                <Section title="General" dark={dark} txt={txt} sub={sub} brd={brd} rows={[["Type", bk.backup_type], ["Size", bk.size_h], ["Uncompressed", `${((bk.uncompressed_bytes || 0) / 1024 / 1024).toFixed(2)} MB`], ["Compression", bk.compression_ratio ? `${Math.round((1 - bk.compression_ratio) * 100)}% saved` : "—"], ["Tables", bk.table_count], ["Rows", (bk.row_count || 0).toLocaleString()], ["Duration", dur(bk.duration_ms)], ["Destination", bk.destination]]} />
                <div className={cn("rounded-[12px] border", brd)}><p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b", sub, brd)}>Checksum (SHA-256)</p><div className="p-3 flex items-center gap-2"><code className={cn("text-[10px] break-all flex-1", txt)}>{bk.checksum}</code><button onClick={() => { navigator.clipboard?.writeText(bk.checksum); showToast("Copied"); }} className={sub}><Copy className="w-3.5 h-3.5" /></button></div></div>
                <div className={cn("rounded-[12px] border", brd)}><p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b", sub, brd)}>Backed-up Tables</p><div className="p-3 flex flex-wrap gap-1.5">{(bk.scope || []).map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-600">{t}</span>)}</div></div>
                <div className={cn("rounded-[12px] border", brd)}><p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b", sub, brd)}>Logs</p><div className={cn("divide-y max-h-40 overflow-y-auto", divide)}>{(drawer.logs || []).map(l => <div key={l.id} className="px-3 py-2 flex items-center gap-2 text-xs"><span className={cn("w-1.5 h-1.5 rounded-full", l.status === "ok" ? "bg-emerald-500" : "bg-red-500")} /><span className={cn("capitalize", txt)}>{l.event}</span><span className={cn("truncate", sub)}>{l.detail}</span><span className={cn("ml-auto shrink-0", sub)}>{timeAgo(l.created_at)}</span></div>)}</div></div>
              </div>
            ); })()}
          </div>
        </div>
      )}

      {restorePreview && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setRestorePreview(null)}>
          <div className={cn("w-full max-w-lg rounded-[18px] border p-5 space-y-4 max-h-[92vh] overflow-y-auto", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><RotateCcw className="w-5 h-5 text-[#2563eb]" /> Preview & Restore</p><button onClick={() => setRestorePreview(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            {restorePreview.preview?.error ? <p className="text-sm text-red-500">{restorePreview.preview.error}</p> : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {[["Backup date", fmtDT(restorePreview.preview.backup_date)], ["Tables", restorePreview.preview.table_count], ["Rows", (restorePreview.preview.row_count || 0).toLocaleString()]].map(([l, v]) => <div key={l} className={cn(cardCls, "p-3")}><p className={cn("text-sm font-extrabold", txt)}>{v}</p><p className={cn("text-[10px]", sub)}>{l}</p></div>)}
                </div>
                <div><label className={labelCls}>Restore Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[["merge", "Merge (upsert — safe)"], ["replace", "Replace (wipe + insert)"]].map(([m, l]) => <button key={m} onClick={() => setRestorePreview(r => ({ ...r, mode: m }))} className={cn("rounded-[10px] border p-2.5 text-xs font-bold text-left", restorePreview.mode === m ? (m === "replace" ? "border-red-500 text-red-500" : "border-[#2563eb] text-[#2563eb]") : cn(brd, sub))}>{l}</button>)}
                  </div>
                </div>
                <div><label className={labelCls}>Scope (empty = all tables in backup)</label>
                  <div className="flex flex-wrap gap-1.5">{RESTORE_SCOPES.map(sc => { const on = restorePreview.scope.includes(sc); return <button key={sc} onClick={() => setRestorePreview(r => ({ ...r, scope: on ? r.scope.filter(x => x !== sc) : [...r.scope, sc] }))} className={cn("text-[11px] px-2.5 py-1 rounded-full font-bold border", on ? "bg-[#2563eb] text-white border-transparent" : cn(brd, sub))}>{sc}</button>; })}</div>
                </div>
                {restorePreview.mode === "replace" && <div className="rounded-[10px] p-2.5 text-[11px] bg-red-500/10 text-red-600 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Replace mode wipes each targeted table before inserting. This cannot be undone.</div>}
                <button onClick={() => setConfirm({ title: `Confirm ${restorePreview.mode} restore?`, message: `This will restore ${restorePreview.scope.length || restorePreview.preview.table_count} table(s) from ${fmtDT(restorePreview.preview.backup_date)}.`, danger: restorePreview.mode === "replace", onConfirm: () => { const rp = restorePreview; setRestorePreview(null); post("restore", { backup_id: rp.backup.id, mode: rp.mode, scope: rp.scope }, (r) => r.ok ? `Restored ${r.tables} tables, ${r.rows} rows` : `Failed: ${r.error}`, () => { loadDash(); loadRestores(); }); } })} disabled={busy?.startsWith("restore")} className={restorePreview.mode === "replace" ? "h-10 px-4 rounded-[11px] bg-red-500 text-white text-sm font-bold hover:bg-red-600 w-full flex items-center justify-center gap-2" : cn(btnPrimary, "h-10 w-full justify-center")}>{busy?.startsWith("restore") ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Restore Now</button>
              </>
            )}
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirm(null)}>
          <div className={cn("w-full max-w-sm rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><AlertTriangle className={cn("w-5 h-5", confirm.danger ? "text-red-500" : "text-amber-500")} /> {confirm.title}</p>
            <p className={cn("text-sm", sub)}>{confirm.message}</p>
            <div className="flex gap-2 justify-end"><button onClick={() => setConfirm(null)} className={btnGhost}>Cancel</button><button onClick={() => { confirm.onConfirm(); setConfirm(null); }} className={cn("h-9 px-4 rounded-[10px] text-white text-xs font-bold", confirm.danger ? "bg-red-500 hover:bg-red-600" : "bg-[#2563eb]")}>Confirm</button></div>
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[140] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200 max-w-sm", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}

function Section({ title, rows, dark, txt, sub, brd }) {
  return (
    <div className={cn("rounded-[12px] border", brd)}>
      <p className={cn("px-3 py-2 text-[11px] font-bold uppercase tracking-wider border-b", sub, brd)}>{title}</p>
      <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2">{rows.map(([k, v]) => <div key={k}><p className={cn("text-[10px]", sub)}>{k}</p><p className={cn("text-xs font-semibold break-words capitalize", txt)}>{v ?? "—"}</p></div>)}</div>
    </div>
  );
}
function BackupChart({ series, dark }) {
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  if (!series.length) return <p className={cn("text-xs py-8 text-center", sub)}>No data.</p>;
  const w = 720, h = 160, pad = 10;
  const max = Math.max(...series.map(s => s.success + s.failed), 1);
  const bw = (w - pad * 2) / series.length;
  return (
    <div className="overflow-x-auto"><svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ minWidth: 520 }}>
      {series.map((s, i) => { const x = pad + i * bw; const sh = (s.success / max) * (h - pad * 2); const fh = (s.failed / max) * (h - pad * 2); return (
        <g key={i}><rect x={x + bw * 0.25} y={h - pad - sh} width={bw * 0.5} height={sh} fill="#16a34a" rx="1.5" />{fh > 0 && <rect x={x + bw * 0.25} y={h - pad - sh - fh} width={bw * 0.5} height={fh} fill="#dc2626" rx="1.5" />}</g>
      ); })}
    </svg>
      <div className="flex gap-4 mt-2 text-[11px]"><span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#16a34a]" />Success</span><span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#dc2626]" />Failed</span></div>
    </div>
  );
}
