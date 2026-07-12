// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Ruler, LayoutDashboard, Table2, ArrowLeftRight, GitMerge, BookOpen, Loader2,
  Search, Download, X, Plus, Trash2, CheckCircle2, AlertTriangle, ChevronRight, Save,
} from "lucide-react";

type Props = { dark: boolean };

const CATEGORIES = ["shoes", "clothing", "kids", "baby", "accessories"];
const GENDERS = ["unisex", "men", "women", "kids", "baby"];
const MEASURE_FIELDS = ["chest", "waist", "hip", "foot_length", "shoulder", "height"];

function timeAgo(d) { if (!d) return "never"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

export function AdminSizes({ dark }: Props) {
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
  const [charts, setCharts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(null);          // chart detail (with sizes, guide)
  const [conv, setConv] = useState({ system: "shoes", rows: [] });
  const [convTest, setConvTest] = useState({ value: "", match: null });
  const [mappings, setMappings] = useState([]);

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3200); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api/sizes${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadDash = useCallback(async () => { try { setDash(await api("/dashboard")); } catch {} }, [api]);
  const loadCharts = useCallback(async () => { try { const r = await api("/charts"); setCharts(r.charts || []); } catch {} }, [api]);
  const loadCats = useCallback(async () => { try { const r = await api("/categories"); setCategories(r.categories || []); } catch {} }, [api]);
  const loadConv = useCallback(async (system = "shoes") => { try { const r = await api(`/conversion?system=${system}`); setConv(r); } catch {} }, [api]);

  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadDash(), loadCharts(), loadCats()]); setLoading(false); })(); }, [loadDash, loadCharts, loadCats]);
  useEffect(() => { if (tab === "dashboard") loadDash(); if (tab === "charts") loadCharts(); if (tab === "conversion") loadConv(conv.system); if (tab === "mapping") api("/mapping").then(r => setMappings(r.mappings || [])).catch(() => {}); }, [tab]); // eslint-disable-line

  const post = async (action, body, okMsg, after) => {
    setBusy(action);
    try { const r = await api(`/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (okMsg) showToast(typeof okMsg === "function" ? okMsg(r) : okMsg); if (after) await after(r); return r; }
    catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };
  const openChart = async (id) => { try { const r = await api(`/chart?id=${id}`); setDrawer({ ...r.chart, sizes: r.sizes, category_ids: r.category_ids, guide: r.guide || { title: "", content: "", tips: "" } }); } catch (e) { showToast(e.message, "error"); } };
  const newChart = () => setDrawer({ _new: true, name: "", description: "", category: "shoes", gender: "unisex", country: "", system: "shoes", status: "active", sort_order: 100, sizes: [], category_ids: [], guide: { title: "", content: "", tips: "" } });

  const createChart = async () => { await post("chart-create", drawer, "Chart created", async (r) => { if (r?.id) openChart(r.id); loadCharts(); loadDash(); }); };
  const saveChart = async () => { await post("chart-update", { ...drawer, id: drawer.id }, "Saved", () => loadCharts()); };
  const addSize = async (label) => { if (!label || drawer._new) { if (drawer._new) showToast("Create the chart first", "error"); return; } const r = await post("size-add", { chart_id: drawer.id, label, value: label, abbreviation: label }, null, null); if (r?.size) setDrawer(d => ({ ...d, sizes: [...d.sizes, r.size] })); };
  const delSize = async (sz) => { await post("size-delete", { id: sz.id }); setDrawer(d => ({ ...d, sizes: d.sizes.filter(x => x.id !== sz.id) })); };
  const saveGuide = () => post("guide", { chart_id: drawer.id, ...drawer.guide }, "Guide saved");

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const kpis = [
    { label: "Size Charts", value: K.totalCharts }, { label: "Total Sizes", value: K.totalSizes }, { label: "Products Using", value: K.productsUsing },
    { label: "Categories Using", value: K.categoriesUsing }, { label: "Most Used", value: K.mostUsedChart }, { label: "Last Updated", value: timeAgo(K.lastUpdated) },
  ];
  const shown = charts.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Ruler className="w-5 h-5 text-[#2563eb]" /> Size Management</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Sizes are specialized system attributes — reusable in products, variants, filters & search</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/sizes/export" className={btnGhost}><Download className="w-3.5 h-3.5" /> Export</a>
          <button onClick={newChart} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> New Size Chart</button>
        </div>
      </div>

      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {[["dashboard", "Dashboard", LayoutDashboard], ["charts", "Size Charts", Table2], ["conversion", "Conversion", ArrowLeftRight], ["mapping", "CJ Mapping", GitMerge]].map(([id, l, I]) => <button key={id} onClick={() => setTab(id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><I className="w-3.5 h-3.5" /> {l}</button>)}
      </div>

      {tab === "dashboard" && dash && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">{kpis.map(k => (
          <div key={k.label} className={cn(cardCls, "p-3.5")}><p className={cn("text-[16px] font-extrabold truncate", txt)}>{k.value ?? 0}</p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
        ))}</div>
      )}

      {/* CHARTS */}
      {tab === "charts" && (
        <div className="space-y-3">
          <div className="relative max-w-sm"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={q} onChange={e => setQ(e.target.value)} className={cn(inpCls, "pl-9")} placeholder="Search charts…" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {shown.map(c => (
              <div key={c.id} className={cn(cardCls, "p-4 cursor-pointer")} onClick={() => openChart(c.id)}>
                <div className="flex items-start justify-between"><div><p className={cn("text-sm font-extrabold", txt)}>{c.name} {c.is_system && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 font-bold">system</span>}</p><p className={cn("text-[11px] capitalize", sub)}>{c.category} · {c.gender} {c.country && `· ${c.country}`}</p></div><span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: c.status === "active" ? "#16a34a1a" : "#8a929c1a", color: c.status === "active" ? "#16a34a" : "#8a929c" }}>{c.status}</span></div>
                <p className={cn("text-[11px] mt-2 line-clamp-1", sub)}>{c.description || "—"}</p>
                <div className={cn("flex items-center justify-between mt-2 pt-2 border-t", brd)}><span className={cn("text-[11px]", sub)}><b className={txt}>{c.sizes_count}</b> sizes · <b className={txt}>{c.categories_count}</b> categories</span><ChevronRight className={cn("w-4 h-4", sub)} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONVERSION */}
      {tab === "conversion" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap gap-2 items-center")}>
            <select value={conv.system} onChange={e => { loadConv(e.target.value); setConvTest({ value: "", match: null }); }} className={cn(inpCls, "w-auto h-9")}><option value="shoes">Shoes</option><option value="clothing">Clothing</option></select>
            <div className="flex items-center gap-2 ml-auto">
              <input value={convTest.value} onChange={e => setConvTest(x => ({ ...x, value: e.target.value }))} className={cn(inpCls, "w-28 h-9")} placeholder="US value" />
              <button onClick={async () => { const r = await api(`/convert?system=${conv.system}&from=us&value=${encodeURIComponent(convTest.value)}`); setConvTest(x => ({ ...x, match: r.match })); }} className={btnPrimary}><ArrowLeftRight className="w-3.5 h-3.5" /> Convert</button>
            </div>
          </div>
          {convTest.match && <div className={cn(cardCls, "p-4 flex items-center gap-4")}><span className={cn("text-sm font-bold", txt)}>US {convTest.match.us}</span><span className={sub}>=</span><span className={cn("text-sm font-bold", txt)}>EU {convTest.match.eu}</span><span className={sub}>=</span><span className={cn("text-sm font-bold", txt)}>UK {convTest.match.uk}</span>{convTest.match.cm && <><span className={sub}>=</span><span className={cn("text-sm font-bold", txt)}>{convTest.match.cm} cm</span></>}</div>}
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["US", "EU", "UK", conv.system === "shoes" ? "CM" : "INTL"].map(h => <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {conv.rows.map(r => <tr key={r.id}><td className={cn("px-4 py-2.5 font-bold", txt)}>{r.us}</td><td className={cn("px-4 py-2.5", txt)}>{r.eu}</td><td className={cn("px-4 py-2.5", txt)}>{r.uk}</td><td className={cn("px-4 py-2.5", sub)}>{conv.system === "shoes" ? r.cm : r.intl}</td></tr>)}
              </tbody>
            </table></div>
          </div>
          <p className={cn("text-[11px]", sub)}>This conversion matrix powers automatic US↔EU↔UK↔CM mapping — used on product pages and when importing CJ products.</p>
        </div>
      )}

      {/* CJ MAPPING */}
      {tab === "mapping" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-4")}>
            <p className={cn("text-sm font-extrabold mb-2", txt)}>CJ Size Mapping</p>
            <SizeMapForm charts={charts} api={api} post={post} inpCls={inpCls} labelCls={labelCls} btnPrimary={btnPrimary} onDone={() => api("/mapping").then(r => setMappings(r.mappings || []))} />
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Saved Mappings</p>
            <div className={cn("divide-y", divide)}>
              {mappings.length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No size mappings yet. Map CJ size labels to your sizes so imports normalize automatically.</p> :
                mappings.map(m => <div key={m.id} className="px-4 py-3 flex items-center justify-between"><span className={cn("text-sm", txt)}><b>{m.external_size}</b> <span className={sub}>→</span> {m.sizes?.label || m.size_id}</span><button onClick={() => post("map-delete", { id: m.id }, "Removed", () => api("/mapping").then(r => setMappings(r.mappings || [])))} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>)}
            </div>
          </div>
        </div>
      )}

      {/* DRAWER */}
      {drawer && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDrawer(null)}>
          <div className={cn("w-full max-w-lg h-full overflow-y-auto border-l p-5 space-y-4", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className={cn("text-base font-extrabold", txt)}>{drawer._new ? "New Size Chart" : drawer.name}</p><button onClick={() => setDrawer(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={labelCls}>Chart Name *</label><input value={drawer.name} onChange={e => setDrawer(d => ({ ...d, name: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Category</label><select value={drawer.category} onChange={e => setDrawer(d => ({ ...d, category: e.target.value, system: e.target.value === "clothing" ? "clothing" : "shoes" }))} className={inpCls}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className={labelCls}>Gender</label><select value={drawer.gender} onChange={e => setDrawer(d => ({ ...d, gender: e.target.value }))} className={inpCls}>{GENDERS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
              <div><label className={labelCls}>Country</label><input value={drawer.country || ""} onChange={e => setDrawer(d => ({ ...d, country: e.target.value }))} className={inpCls} placeholder="US / EU / UK" /></div>
              <div><label className={labelCls}>Sort Order</label><input type="number" value={drawer.sort_order} onChange={e => setDrawer(d => ({ ...d, sort_order: parseInt(e.target.value) || 0 }))} className={inpCls} /></div>
              <div className="col-span-2"><label className={labelCls}>Description</label><input value={drawer.description || ""} onChange={e => setDrawer(d => ({ ...d, description: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Status</label><select value={drawer.status} onChange={e => setDrawer(d => ({ ...d, status: e.target.value }))} className={inpCls}><option value="active">Active</option><option value="hidden">Hidden</option></select></div>
            </div>

            {drawer._new ? (
              <button onClick={createChart} disabled={busy === "chart-create" || !drawer.name} className={cn(btnPrimary, "w-full justify-center h-10")}>{busy === "chart-create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Create Chart</button>
            ) : (<>
              {/* SIZES */}
              <div className={cn("rounded-[12px] border p-3", brd)}>
                <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", sub)}>Sizes ({(drawer.sizes || []).length}) — synced as reusable attribute values</p>
                <div className="flex flex-wrap gap-1.5 mb-2">{(drawer.sizes || []).map(sz => <span key={sz.id} className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border", brd, txt)}>{sz.label}<button onClick={() => delSize(sz)} className="text-red-500"><X className="w-3 h-3" /></button></span>)}{(drawer.sizes || []).length === 0 && <span className={cn("text-xs", sub)}>No sizes yet.</span>}</div>
                <SizeAdd onAdd={addSize} inpCls={inpCls} btnGhost={btnGhost} />
              </div>
              {/* CATEGORY LINKS */}
              <div className={cn("rounded-[12px] border p-3", brd)}>
                <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", sub)}>Linked Categories</p>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">{categories.map(c => { const on = (drawer.category_ids || []).includes(c.id); return <button key={c.id} onClick={() => setDrawer(d => ({ ...d, category_ids: on ? d.category_ids.filter(x => x !== c.id) : [...(d.category_ids || []), c.id] }))} className={cn("text-[11px] px-2.5 py-1 rounded-full font-bold border", on ? "bg-[#2563eb] text-white border-transparent" : cn(brd, sub))}>{c.name}</button>; })}</div>
                <p className={cn("text-[10px] mt-2", sub)}>Products in these categories show this chart's sizes automatically.</p>
              </div>
              {/* GUIDE */}
              <div className={cn("rounded-[12px] border p-3 space-y-2", brd)}>
                <p className={cn("text-[11px] font-bold uppercase tracking-wider", sub)}>Size Guide</p>
                <input value={drawer.guide?.title || ""} onChange={e => setDrawer(d => ({ ...d, guide: { ...d.guide, title: e.target.value } }))} className={cn(inpCls, "h-9")} placeholder="Guide title" />
                <textarea rows={3} value={drawer.guide?.content || ""} onChange={e => setDrawer(d => ({ ...d, guide: { ...d.guide, content: e.target.value } }))} className={cn("w-full rounded-[11px] border-[1.5px] px-3 py-2 text-sm", inpBg, "focus:border-[#2563eb]")} placeholder="How to measure / fit advice…" />
                <input value={drawer.guide?.image_url || ""} onChange={e => setDrawer(d => ({ ...d, guide: { ...d.guide, image_url: e.target.value } }))} className={cn(inpCls, "h-9")} placeholder="Illustration image URL" />
                <input value={drawer.guide?.tips || ""} onChange={e => setDrawer(d => ({ ...d, guide: { ...d.guide, tips: e.target.value } }))} className={cn(inpCls, "h-9")} placeholder="Tips (e.g. runs small, size up)" />
                <button onClick={saveGuide} className={btnGhost}><Save className="w-3.5 h-3.5" /> Save Guide</button>
              </div>

              <div className="flex gap-2">
                <button onClick={saveChart} disabled={busy === "chart-update"} className={cn(btnPrimary, "flex-1 justify-center h-10")}>{busy === "chart-update" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save Chart</button>
                {!drawer.is_system && <button onClick={() => setConfirm({ title: "Delete size chart?", message: `${drawer.name} and its sizes/attribute will be removed.`, danger: true, onConfirm: () => post("chart-delete", { id: drawer.id }, "Deleted", () => { setDrawer(null); loadCharts(); loadDash(); }) })} className={cn(btnGhost, "text-red-500 h-10")}><Trash2 className="w-4 h-4" /></button>}
              </div>
            </>)}
          </div>
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

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200 max-w-sm", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}

function SizeAdd({ onAdd, inpCls, btnGhost }) {
  const [v, setV] = useState("");
  return <div className="flex gap-2"><input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), onAdd(v), setV(""))} className={cn(inpCls, "h-9 flex-1")} placeholder="Add a size (e.g. US 9, XL)…" /><button onClick={() => { onAdd(v); setV(""); }} className={cn(btnGhost, "h-9")}><Plus className="w-3.5 h-3.5" /> Add</button></div>;
}
function SizeMapForm({ charts, api, post, inpCls, labelCls, btnPrimary, onDone }) {
  const [sizes, setSizes] = useState([]);
  const [chartId, setChartId] = useState("");
  const [m, setM] = useState({ external_size: "", size_id: "" });
  useEffect(() => { if (chartId) api(`/chart?id=${chartId}`).then(r => setSizes(r.sizes || [])).catch(() => {}); }, [chartId]); // eslint-disable-line
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
      <div><label className={labelCls}>CJ Size</label><input value={m.external_size} onChange={e => setM(x => ({ ...x, external_size: e.target.value }))} className={inpCls} placeholder="e.g. 41" /></div>
      <div><label className={labelCls}>Chart</label><select value={chartId} onChange={e => setChartId(e.target.value)} className={inpCls}><option value="">Select…</option>{charts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label className={labelCls}>→ Size</label><select value={m.size_id} onChange={e => setM(x => ({ ...x, size_id: e.target.value }))} className={inpCls}><option value="">Select…</option>{sizes.map(sz => <option key={sz.id} value={sz.id}>{sz.label}</option>)}</select></div>
      <button onClick={() => { if (m.external_size && m.size_id) post("map", { supplier_id: "cj", external_size: m.external_size, size_id: m.size_id, chart_id: chartId }, "Mapping saved", () => { setM({ external_size: "", size_id: "" }); onDone(); }); }} className={btnPrimary}><GitMerge className="w-3.5 h-3.5" /> Map</button>
    </div>
  );
}
