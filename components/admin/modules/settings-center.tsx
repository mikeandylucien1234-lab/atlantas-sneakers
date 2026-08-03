// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Settings2, LayoutDashboard, Flag, History, Loader2, Search, Download, Upload,
  Save, X, RotateCcw, CheckCircle2, Store, Globe, ShoppingBag, ShoppingCart,
  Package, ClipboardList, Users, CreditCard, Truck, Mail, Shield, Zap, Image,
  Bell, Server, ChevronRight, AlertTriangle, Camera,
} from "lucide-react";

type Props = { dark: boolean };

const GROUP_ICON = { general: Store, localization: Globe, store: ShoppingBag, checkout: ShoppingCart, product: Package, order: ClipboardList, customer: Users, seller: Store, payment_defaults: CreditCard, shipping_defaults: Truck, email: Mail, seo_defaults: Search, security: Shield, performance: Zap, media: Image, notifications: Bell, system: Server };

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return "never"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

export function AdminSettingsCenter({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inpBg = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inpBg, "focus:border-[#2563eb]");
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnGhost = cn("h-9 px-3 rounded-[10px] text-xs font-semibold border transition-colors flex items-center gap-1.5 disabled:opacity-50", brd, txt, hover);
  const btnPrimary = "h-9 px-3 rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-1.5";
  const divide = dark ? "divide-[#252c36]" : "divide-[#eef0f3]";

  const [tab, setTab] = useState("config");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [groups, setGroups] = useState([]);
  const [flags, setFlags] = useState([]);
  const [dash, setDash] = useState(null);
  const [activeGroup, setActiveGroup] = useState("general");
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState({});          // "group.key" -> new value
  const [history, setHistory] = useState({ history: [], total: 0, page: 1 });

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3000); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api/settings${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const load = useCallback(async () => { try { const r = await api("/groups"); setGroups(r.groups || []); setFlags(r.flags || []); } catch (e) { showToast(e.message, "error"); } }, [api, showToast]);
  const loadDash = useCallback(async () => { try { setDash(await api("/dashboard")); } catch {} }, [api]);
  const loadHistory = useCallback(async (page = 1) => { try { setHistory(await api(`/history?page=${page}`)); } catch {} }, [api]);

  useEffect(() => { (async () => { setLoading(true); await Promise.all([load(), loadDash()]); setLoading(false); })(); }, [load, loadDash]);
  useEffect(() => { if (tab === "dashboard") loadDash(); if (tab === "history") loadHistory(1); }, [tab]); // eslint-disable-line

  const setField = (group, key, value) => setDirty(d => ({ ...d, [`${group}.${key}`]: value }));
  const valueOf = (group, f) => { const k = `${group}.${f.key}`; return k in dirty ? dirty[k] : f.value; };
  const dirtyCount = Object.keys(dirty).length;

  const save = async () => {
    setBusy("save");
    try { await api("/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes: dirty }) }); showToast(`${dirtyCount} setting(s) saved`); setDirty({}); await load(); }
    catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };
  const toggleFlag = async (f) => { setFlags(fs => fs.map(x => x.key === f.key ? { ...x, enabled: !x.enabled } : x)); try { await api("/feature-flag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: f.key, enabled: !f.enabled }) }); showToast(!f.enabled ? "Enabled" : "Disabled"); } catch (e) { showToast(e.message, "error"); load(); } };
  const resetGroup = (group) => setConfirm({ title: "Reset to defaults?", message: `All ${group} settings will revert to defaults.`, danger: true, onConfirm: async () => { await api("/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ group }) }); showToast("Reset done"); load(); } });
  const snapshot = () => api("/version", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: `Manual ${new Date().toISOString().slice(0, 16)}` }) }).then(() => showToast("Snapshot saved")).catch(e => showToast(e.message, "error"));
  const doImport = () => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json"; inp.onchange = async () => { const file = inp.files?.[0]; if (!file) return; try { const snap = JSON.parse(await file.text()); await api("/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshot: snap }) }); showToast("Configuration imported"); load(); } catch (e) { showToast("Invalid file: " + e.message, "error"); } }; inp.click(); };

  // NOTE: all hooks must run before any early return (React rules of hooks).
  const filteredGroups = useMemo(() => {
    if (!q) return groups;
    const ql = q.toLowerCase();
    return groups
      .map(g => ({ ...g, fields: (g.fields || []).filter(f => f.label.toLowerCase().includes(ql) || f.key.includes(ql)) }))
      .filter(g => g.label.toLowerCase().includes(ql) || g.fields.length);
  }, [groups, q]);
  const current = filteredGroups.find(g => g.id === activeGroup) || filteredGroups[0];

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const dashCards = dash ? [
    { label: "Version", value: K.version }, { label: "Environment", value: K.environment }, { label: "Store Mode", value: K.storeMode, c: K.storeMode !== "production" ? "#ea7317" : "#16a34a" },
    { label: "Maintenance", value: K.maintenance ? "ON" : "OFF", c: K.maintenance ? "#dc2626" : undefined }, { label: "Total Settings", value: K.totalSettings }, { label: "Setting Groups", value: K.activeGroups },
    { label: "Enabled Features", value: `${K.enabledFeatures}/${K.totalFeatures}` }, { label: "Health Score", value: `${K.healthScore}%`, c: K.healthScore >= 85 ? "#16a34a" : "#ea7317" },
    { label: "Config Warnings", value: K.configWarnings, c: K.configWarnings ? "#ea7317" : undefined }, { label: "Last Update", value: timeAgo(K.lastUpdate) }, { label: "Last Backup", value: timeAgo(K.lastBackup) },
  ] : [];

  const renderField = (f) => {
    const v = valueOf(current.id, f);
    if (f.type === "toggle") return <button type="button" onClick={() => setField(current.id, f.key, !v)} className={cn("w-11 h-6 rounded-full transition-colors relative shrink-0", v ? "bg-emerald-500" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}><span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform", v ? "translate-x-[22px]" : "translate-x-0.5")} /></button>;
    if (f.type === "select") return <select value={v ?? ""} onChange={e => setField(current.id, f.key, e.target.value)} className={cn(inpCls, "w-56")}>{(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}</select>;
    if (f.type === "textarea") return <textarea value={v ?? ""} onChange={e => setField(current.id, f.key, e.target.value)} rows={2} className={cn("rounded-[11px] border-[1.5px] px-3 py-2 text-sm outline-none w-72", inpBg, "focus:border-[#2563eb]")} />;
    if (f.type === "number") return <input type="number" value={v ?? 0} onChange={e => setField(current.id, f.key, parseFloat(e.target.value) || 0)} className={cn(inpCls, "w-40")} />;
    return <input value={v ?? ""} onChange={e => setField(current.id, f.key, e.target.value)} className={cn(inpCls, "w-72")} />;
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Settings2 className="w-5 h-5 text-[#2563eb]" /> Settings</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Enterprise Settings Center · everything configurable without code</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/settings/export?format=json" className={btnGhost}><Download className="w-3.5 h-3.5" /> Export</a>
          <button onClick={doImport} className={btnGhost}><Upload className="w-3.5 h-3.5" /> Import</button>
          <button onClick={snapshot} className={btnGhost}><Save className="w-3.5 h-3.5" /> Snapshot</button>
        </div>
      </div>

      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {[["config", "Configuration", Settings2], ["dashboard", "Dashboard", LayoutDashboard], ["flags", "Feature Flags", Flag], ["history", "History", History]].map(([id, l, I]) => <button key={id} onClick={() => setTab(id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><I className="w-3.5 h-3.5" /> {l}</button>)}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">{dashCards.map(c => (
          <div key={c.label} className={cn(cardCls, "p-3.5")}><p className="text-[16px] font-extrabold capitalize truncate" style={{ color: c.c }}><span className={c.c ? "" : txt}>{c.value}</span></p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{c.label}</p></div>
        ))}</div>
      )}

      {/* CONFIG */}
      {tab === "config" && (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
          <div className="space-y-2">
            <div className="relative"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={q} onChange={e => setQ(e.target.value)} className={cn(inpCls, "pl-9 h-9")} placeholder="Search settings…" /></div>
            <div className={cn(cardCls, "p-1.5 space-y-0.5 max-h-[70vh] overflow-y-auto")}>
              {filteredGroups.map(g => { const I = GROUP_ICON[g.id] || Settings2; const active = current?.id === g.id; return (
                <button key={g.id} onClick={() => setActiveGroup(g.id)} className={cn("w-full h-9 px-3 rounded-[9px] text-xs font-bold flex items-center gap-2 transition-colors", active ? "bg-[#2563eb] text-white" : cn(sub, hover))}><I className="w-4 h-4 shrink-0" /> <span className="truncate">{g.label}</span>{q && <span className="ml-auto text-[9px]">{g.fields.length}</span>}</button>
              ); })}
            </div>
          </div>
          <div className="space-y-3">
            {current && (
              <div className={cn(cardCls, "overflow-hidden")}>
                <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}>
                  <div><p className={cn("text-sm font-extrabold", txt)}>{current.label}</p><p className={cn("text-[11px]", sub)}>{current.description}</p></div>
                  <button onClick={() => resetGroup(current.id)} className={cn(btnGhost, "text-red-500")}><RotateCcw className="w-3.5 h-3.5" /> Reset</button>
                </div>
                <div className={cn("divide-y", divide)}>
                  {current.fields.length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No matching settings.</p> :
                    current.fields.map(f => { const changed = `${current.id}.${f.key}` in dirty; return (
                      <div key={f.key} className={cn("px-5 py-3 flex items-center justify-between gap-4", changed && (dark ? "bg-blue-500/[.05]" : "bg-blue-500/[.03]"))}>
                        <div className="min-w-0"><p className={cn("text-sm font-semibold", txt)}>{f.label} {changed && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 font-bold">modified</span>}</p><p className={cn("text-[10px] font-mono", sub)}>{current.id}.{f.key}</p></div>
                        <div className="shrink-0">{renderField(f)}</div>
                      </div>
                    ); })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FEATURE FLAGS */}
      {tab === "flags" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {flags.map(f => (
            <div key={f.key} className={cn(cardCls, "p-4 flex items-start justify-between gap-3")}>
              <div className="min-w-0"><p className={cn("text-sm font-extrabold", txt)}>{f.label}</p><p className={cn("text-[11px] mt-0.5", sub)}>{f.description}</p><p className={cn("text-[10px] font-mono mt-1", sub)}>{f.key}</p></div>
              <button type="button" onClick={() => toggleFlag(f)} className={cn("w-11 h-6 rounded-full transition-colors relative shrink-0", f.enabled ? "bg-emerald-500" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}><span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform", f.enabled ? "translate-x-[22px]" : "translate-x-0.5")} /></button>
            </div>
          ))}
        </div>
      )}

      {/* HISTORY */}
      {tab === "history" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["Date", "Setting", "Before", "After", "By", "IP"].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {history.history.length === 0 ? <tr><td colSpan={6} className={cn("px-4 py-8 text-center text-xs", sub)}>No configuration changes yet.</td></tr> :
                  history.history.map(h => <tr key={h.id}><td className={cn("px-3 py-2.5 text-[11px]", sub)}>{fmtDT(h.created_at)}</td><td className={cn("px-3 py-2.5 font-mono text-[11px] font-semibold", txt)}>{h.key}</td><td className={cn("px-3 py-2.5 text-[11px] truncate max-w-[140px]", sub)}>{JSON.stringify(h.old_value)}</td><td className={cn("px-3 py-2.5 text-[11px] truncate max-w-[140px] font-semibold", txt)}>{JSON.stringify(h.new_value)}</td><td className={cn("px-3 py-2.5", sub)}>{h.actor_name}</td><td className={cn("px-3 py-2.5 text-[11px]", sub)}>{h.ip_address || "—"}</td></tr>)}
              </tbody>
            </table></div>
          </div>
          {history.total > 40 && <div className="flex items-center justify-between"><span className={cn("text-xs", sub)}>{history.total} changes · page {history.page}</span><div className="flex gap-1.5"><button disabled={history.page <= 1} onClick={() => loadHistory(history.page - 1)} className={cn(btnGhost, "disabled:opacity-40")}>Prev</button><button disabled={history.page * 40 >= history.total} onClick={() => loadHistory(history.page + 1)} className={cn(btnGhost, "disabled:opacity-40")}>Next</button></div></div>}
        </div>
      )}

      {/* STICKY SAVE BAR */}
      {dirtyCount > 0 && tab === "config" && (
        <div className="fixed bottom-0 left-0 lg:left-[264px] right-0 z-[90] px-4 py-3 border-t backdrop-blur flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2" style={{ background: dark ? "rgba(23,28,36,.95)" : "rgba(255,255,255,.95)", borderColor: dark ? "#252c36" : "#eef0f3" }}>
          <span className={cn("text-sm font-semibold", txt)}>{dirtyCount} unsaved change{dirtyCount > 1 ? "s" : ""}</span>
          <div className="flex gap-2"><button onClick={() => setDirty({})} className={btnGhost}>Discard</button><button onClick={save} disabled={busy === "save"} className={cn(btnPrimary, "h-9")}>{busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes</button></div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirm(null)}>
          <div className={cn("w-full max-w-sm rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><AlertTriangle className={cn("w-5 h-5", confirm.danger ? "text-red-500" : "text-amber-500")} /> {confirm.title}</p>
            <p className={cn("text-sm", sub)}>{confirm.message}</p>
            <div className="flex gap-2 justify-end"><button onClick={() => setConfirm(null)} className={btnGhost}>Cancel</button><button onClick={() => { confirm.onConfirm(); setConfirm(null); }} className={cn("h-9 px-4 rounded-[10px] text-white text-xs font-bold", confirm.danger ? "bg-red-500 hover:bg-red-600" : "bg-[#2563eb]")}>Confirm</button></div>
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-20 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200 max-w-sm", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}
