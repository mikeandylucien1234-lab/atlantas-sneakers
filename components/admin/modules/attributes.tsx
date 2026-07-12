// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Tags, LayoutDashboard, ListChecks, GitMerge, Loader2, Search, Download, Upload,
  X, Plus, Trash2, Edit3, Copy, CheckCircle2, XCircle, AlertTriangle, Settings2,
  Palette, ChevronRight,
} from "lucide-react";

type Props = { dark: boolean };

const ATTR_TYPES = ["text", "number", "color", "image", "icon", "boolean", "date", "size", "dropdown", "radio", "checkbox", "button", "tag", "multi_select", "url", "file"];
const DISPLAY_TYPES = ["dropdown", "radio", "color_swatches", "image_swatches", "buttons", "checkboxes", "tags", "text"];

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return "never"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

export function AdminAttributes({ dark }: Props) {
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
  const [list, setList] = useState({ attributes: [], total: 0, page: 1, pageSize: 25 });
  const [filters, setFilters] = useState({ q: "", group: "all", status: "all", type: "all" });
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [drawer, setDrawer] = useState(null);
  const [mappings, setMappings] = useState([]);

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3200); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api/attributes${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadDash = useCallback(async () => { try { setDash(await api("/dashboard")); } catch {} }, [api]);
  const loadList = useCallback(async (page = 1) => { try { const qs = new URLSearchParams({ page, ...filters }); const r = await api(`/list?${qs}`); setList({ ...r }); setSelected(new Set()); } catch (e) { showToast(e.message, "error"); } }, [api, filters, showToast]);
  const loadMeta = useCallback(async () => { try { const [g, c] = await Promise.all([api("/groups"), api("/categories")]); setGroups(g.groups || []); setCategories(c.categories || []); } catch {} }, [api]);

  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadDash(), loadMeta()]); setLoading(false); })(); }, [loadDash, loadMeta]);
  useEffect(() => { if (tab === "dashboard") loadDash(); if (tab === "attributes") loadList(1); if (tab === "mapping") api("/mapping").then(r => setMappings(r.mappings || [])).catch(() => {}); }, [tab]); // eslint-disable-line
  useEffect(() => { if (tab === "attributes") loadList(1); }, [filters]); // eslint-disable-line

  const post = async (action, body, okMsg, after) => {
    setBusy(action);
    try { const r = await api(`/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (okMsg) showToast(typeof okMsg === "function" ? okMsg(r) : okMsg); if (after) await after(r); return r; }
    catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };
  const openNew = () => setDrawer({ name: "", slug: "", description: "", display_name: "", group_id: "", attribute_type: "dropdown", display_type: "dropdown", display_order: 100, status: "active", is_required: false, is_filterable: true, is_searchable: false, is_comparable: false, visible_product: true, visible_search: true, visible_category: true, seo_schema: "", values: [], category_ids: [] });
  const openEdit = async (id) => { try { const r = await api(`/detail?id=${id}`); setDrawer({ ...r.attribute, values: r.values, category_ids: r.category_ids }); } catch (e) { showToast(e.message, "error"); } };
  const saveDrawer = async () => {
    const d = drawer;
    if (d.id) { await post("update", { ...d }, "Saved", () => { setDrawer(null); loadList(list.page); }); }
    else { await post("create", { ...d }, "Attribute created", () => { setDrawer(null); loadList(1); loadDash(); }); }
  };
  const toggleSel = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const doImport = () => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json"; inp.onchange = async () => { const f = inp.files?.[0]; if (!f) return; try { const data = JSON.parse(await f.text()); await post("import", { attributes: data.attributes || data }, "Imported", () => { loadList(1); loadDash(); }); } catch (e) { showToast("Invalid file", "error"); } }; inp.click(); };

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const kpis = [
    { label: "Total", value: K.total }, { label: "Published", value: K.published, c: "#16a34a" }, { label: "Hidden", value: K.hidden },
    { label: "System", value: K.system }, { label: "Custom", value: K.custom }, { label: "Total Values", value: K.totalValues },
    { label: "Products Using", value: K.productsUsing }, { label: "Categories Linked", value: K.categoriesLinked },
    { label: "Last Created", value: timeAgo(K.lastCreated) }, { label: "Last Updated", value: timeAgo(K.lastUpdated) },
  ];
  const statusBadge = (st) => <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: st === "active" ? "#16a34a1a" : "#8a929c1a", color: st === "active" ? "#16a34a" : "#8a929c" }}>{st === "active" ? "Published" : "Hidden"}</span>;
  const check = (v) => v ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-gray-300 dark:text-gray-600" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Tags className="w-5 h-5 text-[#2563eb]" /> Attributes</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Reusable product attributes · variants · filters · search · SEO · CJ mapping</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/attributes/export?format=json" className={btnGhost}><Download className="w-3.5 h-3.5" /> Export</a>
          <button onClick={doImport} className={btnGhost}><Upload className="w-3.5 h-3.5" /> Import</button>
          <button onClick={openNew} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> New Attribute</button>
        </div>
      </div>

      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {[["dashboard", "Dashboard", LayoutDashboard], ["attributes", "Attributes", ListChecks], ["mapping", "CJ Mapping", GitMerge]].map(([id, l, I]) => <button key={id} onClick={() => setTab(id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><I className="w-3.5 h-3.5" /> {l}</button>)}
      </div>

      {tab === "dashboard" && dash && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">{kpis.map(k => (
          <div key={k.label} className={cn(cardCls, "p-3.5")}><p className="text-[16px] font-extrabold" style={{ color: k.c }}><span className={k.c ? "" : txt}>{k.value ?? 0}</span></p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
        ))}</div>
      )}

      {tab === "attributes" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap gap-2 items-center")}>
            <div className="relative flex-1 min-w-[180px]"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} className={cn(inpCls, "pl-9 h-9")} placeholder="Search attributes…" /></div>
            <select value={filters.group} onChange={e => setFilters(f => ({ ...f, group: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All groups</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All types</option>{ATTR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className={cn(inpCls, "w-auto h-9")}><option value="all">All status</option><option value="active">Published</option><option value="hidden">Hidden</option></select>
          </div>

          {selected.size > 0 && (
            <div className={cn(cardCls, "p-2.5 flex items-center gap-2 flex-wrap")}>
              <span className={cn("text-xs font-bold", txt)}>{selected.size} selected</span>
              <button onClick={() => post("bulk", { op: "activate", ids: [...selected] }, "Activated", () => loadList(list.page))} className={btnGhost}>Activate</button>
              <button onClick={() => post("bulk", { op: "deactivate", ids: [...selected] }, "Deactivated", () => loadList(list.page))} className={btnGhost}>Deactivate</button>
              <button onClick={() => post("bulk", { op: "duplicate", ids: [...selected] }, "Duplicated", () => loadList(list.page))} className={btnGhost}><Copy className="w-3.5 h-3.5" /> Duplicate</button>
              <button onClick={() => setConfirm({ title: "Delete selected?", message: `${selected.size} attribute(s). System attributes are skipped.`, danger: true, onConfirm: () => post("bulk", { op: "delete", ids: [...selected] }, "Deleted", () => loadList(1)) })} className={cn(btnGhost, "text-red-500")}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
            </div>
          )}

          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}><th className="px-3 py-2.5 w-8"></th>{["Name", "Type", "Display", "Values", "Products", "Cats", "Filter", "Search", "Status", ""].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {list.attributes.length === 0 ? <tr><td colSpan={11} className={cn("px-4 py-10 text-center", sub)}><Tags className="w-8 h-8 mx-auto mb-2" /><p className="text-sm">No attributes. Create your first one.</p></td></tr> :
                  list.attributes.map(a => (
                    <tr key={a.id} className={cn(hover, "cursor-pointer")} onClick={() => openEdit(a.id)}>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSel(a.id)} className="rounded" /></td>
                      <td className="px-3 py-2.5"><div><p className={cn("font-semibold", txt)}>{a.name} {a.is_system && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 font-bold">system</span>}</p><p className={cn("text-[10px] font-mono", sub)}>{a.slug} · {a.group_name || "—"}</p></div></td>
                      <td className={cn("px-3 py-2.5 capitalize", sub)}>{a.attribute_type}</td>
                      <td className={cn("px-3 py-2.5", sub)}>{(a.display_type || "").replace(/_/g, " ")}</td>
                      <td className={cn("px-3 py-2.5", txt)}>{a.values_count}</td>
                      <td className={cn("px-3 py-2.5", txt)}>{a.products_count}</td>
                      <td className={cn("px-3 py-2.5", txt)}>{a.categories_count}</td>
                      <td className="px-3 py-2.5">{check(a.is_filterable)}</td>
                      <td className="px-3 py-2.5">{check(a.is_searchable)}</td>
                      <td className="px-3 py-2.5">{statusBadge(a.status)}</td>
                      <td className="px-3 py-2.5"><ChevronRight className={cn("w-4 h-4", sub)} /></td>
                    </tr>
                  ))}
              </tbody>
            </table></div>
          </div>
          {list.total > list.pageSize && <div className="flex items-center justify-between"><span className={cn("text-xs", sub)}>{list.total} attributes · page {list.page}</span><div className="flex gap-1.5"><button disabled={list.page <= 1} onClick={() => loadList(list.page - 1)} className={cn(btnGhost, "disabled:opacity-40")}>Prev</button><button disabled={list.page * list.pageSize >= list.total} onClick={() => loadList(list.page + 1)} className={cn(btnGhost, "disabled:opacity-40")}>Next</button></div></div>}
        </div>
      )}

      {/* CJ MAPPING */}
      {tab === "mapping" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-4")}>
            <p className={cn("text-sm font-extrabold mb-2", txt)}>CJ Attribute Mapping</p>
            <MapForm groups={list.attributes} api={api} post={post} inpCls={inpCls} labelCls={labelCls} btnPrimary={btnPrimary} onDone={() => api("/mapping").then(r => setMappings(r.mappings || []))} loadAttrs={() => api("/list?pageSize=100").then(r => r.attributes)} />
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Saved Mappings</p>
            <div className={cn("divide-y", divide)}>
              {mappings.length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No mappings yet. Map CJ attribute names to your attributes so imports normalize automatically.</p> :
                mappings.map(m => <div key={m.id} className="px-4 py-3 flex items-center justify-between"><span className={cn("text-sm", txt)}><b>{m.external_attribute}</b>{m.external_value && ` = ${m.external_value}`} <span className={sub}>→</span> {m.attributes?.name || m.attribute_id}</span><button onClick={() => post("map-delete", { id: m.id }, "Removed", () => api("/mapping").then(r => setMappings(r.mappings || [])))} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>)}
            </div>
          </div>
        </div>
      )}

      {/* DRAWER FORM */}
      {drawer && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDrawer(null)}>
          <div className={cn("w-full max-w-lg h-full overflow-y-auto border-l p-5 space-y-4", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className={cn("text-base font-extrabold", txt)}>{drawer.id ? "Edit Attribute" : "New Attribute"}</p><button onClick={() => setDrawer(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Name *</label><input value={drawer.name} onChange={e => setDrawer(d => ({ ...d, name: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Slug</label><input value={drawer.slug} onChange={e => setDrawer(d => ({ ...d, slug: e.target.value }))} disabled={drawer.is_system} className={cn(inpCls, drawer.is_system && "opacity-60")} placeholder="auto" /></div>
              <div><label className={labelCls}>Display Name</label><input value={drawer.display_name || ""} onChange={e => setDrawer(d => ({ ...d, display_name: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Group</label><select value={drawer.group_id || ""} onChange={e => setDrawer(d => ({ ...d, group_id: e.target.value }))} className={inpCls}><option value="">—</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
              <div><label className={labelCls}>Attribute Type</label><select value={drawer.attribute_type} onChange={e => setDrawer(d => ({ ...d, attribute_type: e.target.value }))} className={inpCls}>{ATTR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className={labelCls}>Display Type</label><select value={drawer.display_type} onChange={e => setDrawer(d => ({ ...d, display_type: e.target.value }))} className={inpCls}>{DISPLAY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</select></div>
              <div><label className={labelCls}>Display Order</label><input type="number" value={drawer.display_order} onChange={e => setDrawer(d => ({ ...d, display_order: parseInt(e.target.value) || 0 }))} className={inpCls} /></div>
              <div><label className={labelCls}>SEO Schema Prop</label><input value={drawer.seo_schema || ""} onChange={e => setDrawer(d => ({ ...d, seo_schema: e.target.value }))} className={inpCls} placeholder="color, size…" /></div>
            </div>
            <div><label className={labelCls}>Description</label><textarea rows={2} value={drawer.description || ""} onChange={e => setDrawer(d => ({ ...d, description: e.target.value }))} className={cn("w-full rounded-[11px] border-[1.5px] px-3 py-2 text-sm", inpBg, "focus:border-[#2563eb]")} /></div>

            <div className={cn("rounded-[12px] border p-3 space-y-2", brd)}>
              <p className={cn("text-[11px] font-bold uppercase tracking-wider", sub)}>Behaviour</p>
              <div className="grid grid-cols-2 gap-2">
                {[["is_required", "Required"], ["is_filterable", "Filterable"], ["is_searchable", "Searchable"], ["is_comparable", "Comparable"], ["visible_product", "Visible on Product"], ["visible_search", "Visible on Search"], ["visible_category", "Visible on Category"]].map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!drawer[k]} onChange={e => setDrawer(d => ({ ...d, [k]: e.target.checked }))} className="rounded" /><span className={cn("text-xs", txt)}>{l}</span></label>
                ))}
                <div className="col-span-2"><label className={labelCls}>Status</label><select value={drawer.status} onChange={e => setDrawer(d => ({ ...d, status: e.target.value }))} className={cn(inpCls, "h-9")}><option value="active">Published</option><option value="hidden">Hidden</option></select></div>
              </div>
            </div>

            {/* VALUES */}
            <ValuesEditor drawer={drawer} setDrawer={setDrawer} api={api} showToast={showToast} dark={dark} brd={brd} txt={txt} sub={sub} inpCls={inpCls} labelCls={labelCls} btnGhost={btnGhost} hover={hover} />

            {/* CATEGORY LINKS */}
            <div className={cn("rounded-[12px] border p-3", brd)}>
              <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", sub)}>Linked Categories</p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">{categories.map(c => { const on = (drawer.category_ids || []).includes(c.id); return <button key={c.id} onClick={() => setDrawer(d => ({ ...d, category_ids: on ? d.category_ids.filter(x => x !== c.id) : [...(d.category_ids || []), c.id] }))} className={cn("text-[11px] px-2.5 py-1 rounded-full font-bold border", on ? "bg-[#2563eb] text-white border-transparent" : cn(brd, sub))}>{c.name}</button>; })}</div>
              <p className={cn("text-[10px] mt-2", sub)}>Products in linked categories will show this attribute automatically.</p>
            </div>

            <div className="flex gap-2">
              <button onClick={saveDrawer} disabled={busy === "create" || busy === "update" || !drawer.name} className={cn(btnPrimary, "flex-1 justify-center h-10")}>{(busy === "create" || busy === "update") ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save Attribute</button>
              {drawer.id && !drawer.is_system && <button onClick={() => setConfirm({ title: "Delete attribute?", message: drawer.name, danger: true, onConfirm: () => post("delete", { id: drawer.id }, "Deleted", () => { setDrawer(null); loadList(1); loadDash(); }) })} className={cn(btnGhost, "text-red-500 h-10")}><Trash2 className="w-4 h-4" /></button>}
            </div>
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

function ValuesEditor({ drawer, setDrawer, api, showToast, dark, brd, txt, sub, inpCls, labelCls, btnGhost, hover }) {
  const [nv, setNv] = useState({ label: "", color_hex: "#000000" });
  const isColor = drawer.attribute_type === "color";
  const isImage = drawer.attribute_type === "image";
  const add = async () => {
    if (!nv.label) return;
    if (drawer.id) { const r = await api("/value", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attribute_id: drawer.id, label: nv.label, color_hex: isColor ? nv.color_hex : null }) }).catch(e => { showToast(e.message, "error"); return null; }); if (r?.value) setDrawer(d => ({ ...d, values: [...(d.values || []), r.value] })); }
    else setDrawer(d => ({ ...d, values: [...(d.values || []), { label: nv.label, value: nv.label, color_hex: isColor ? nv.color_hex : null }] }));
    setNv({ label: "", color_hex: "#000000" });
  };
  const remove = async (v, i) => {
    if (v.id) { await api("/value", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "delete", id: v.id }) }).catch(() => {}); }
    setDrawer(d => ({ ...d, values: d.values.filter((_, j) => j !== i) }));
  };
  return (
    <div className={cn("rounded-[12px] border p-3", brd)}>
      <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", sub)}>Values / Options {(drawer.values || []).length ? `(${drawer.values.length})` : ""}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {(drawer.values || []).map((v, i) => (
          <span key={i} className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border", brd, txt)}>
            {v.color_hex && <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: v.color_hex, borderColor: dark ? "#252c36" : "#eef0f3" }} />}
            {v.image_url && <img src={v.image_url} className="w-3 h-3 rounded object-cover" />}
            {v.label}
            <button onClick={() => remove(v, i)} className="text-red-500"><X className="w-3 h-3" /></button>
          </span>
        ))}
        {(drawer.values || []).length === 0 && <span className={cn("text-xs", sub)}>No values yet.</span>}
      </div>
      <div className="flex gap-2 items-center">
        {isColor && <input type="color" value={nv.color_hex} onChange={e => setNv(x => ({ ...x, color_hex: e.target.value }))} className="w-10 h-9 rounded-lg border-0 cursor-pointer" />}
        <input value={nv.label} onChange={e => setNv(x => ({ ...x, label: e.target.value }))} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())} className={cn(inpCls, "h-9 flex-1")} placeholder={isColor ? "Color name (e.g. Black)" : isImage ? "Value label (add image URL below)" : "Add a value…"} />
        <button onClick={add} className={cn(btnGhost, "h-9")}><Plus className="w-3.5 h-3.5" /> Add</button>
      </div>
      {isColor && nv.label && <div className="flex items-center gap-2 mt-2"><span className="w-5 h-5 rounded-full border" style={{ backgroundColor: nv.color_hex }} /><span className={cn("text-[11px]", sub)}>{nv.color_hex} · preview</span></div>}
    </div>
  );
}

function MapForm({ api, post, inpCls, labelCls, btnPrimary, onDone, loadAttrs }) {
  const [attrs, setAttrs] = useState([]);
  const [m, setM] = useState({ external_attribute: "", external_value: "", attribute_id: "" });
  useEffect(() => { loadAttrs().then(setAttrs).catch(() => {}); }, []); // eslint-disable-line
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
      <div><label className={labelCls}>CJ Attribute</label><input value={m.external_attribute} onChange={e => setM(x => ({ ...x, external_attribute: e.target.value }))} className={inpCls} placeholder="e.g. Colour" /></div>
      <div><label className={labelCls}>CJ Value (optional)</label><input value={m.external_value} onChange={e => setM(x => ({ ...x, external_value: e.target.value }))} className={inpCls} placeholder="e.g. Wine Red" /></div>
      <div><label className={labelCls}>→ Attribute</label><select value={m.attribute_id} onChange={e => setM(x => ({ ...x, attribute_id: e.target.value }))} className={inpCls}><option value="">Select…</option>{attrs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
      <button onClick={() => { if (m.external_attribute && m.attribute_id) post("map", { supplier_id: "cj", ...m }, "Mapping saved", () => { setM({ external_attribute: "", external_value: "", attribute_id: "" }); onDone(); }); }} className={btnPrimary}><GitMerge className="w-3.5 h-3.5" /> Map</button>
    </div>
  );
}
