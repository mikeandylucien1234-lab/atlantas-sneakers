// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, LayoutDashboard, Table2, GitBranch, FileText, Loader2, Search, Download,
  Upload, X, Plus, Trash2, CheckCircle2, AlertTriangle, ChevronRight, ChevronLeft, Save,
  ShieldOff, Filter, Link2, Package, Grid3x3, Award, Globe2, Languages, Paperclip,
  ClipboardCheck, Power, Copy, Sparkles,
} from "lucide-react";

type Props = { dark: boolean };

const TYPES = ["manufacturer", "seller", "extended", "limited", "lifetime", "replacement", "repair", "international", "local", "custom"];
const TYPE_LABEL = { manufacturer: "Manufacturer", seller: "Seller", extended: "Extended", limited: "Limited", lifetime: "Lifetime", replacement: "Replacement", repair: "Repair", international: "International", local: "Local", custom: "Custom" };
const DURATIONS = [
  { label: "No Warranty", type: "none", value: 0 },
  { label: "7 Days", type: "days", value: 7 }, { label: "15 Days", type: "days", value: 15 },
  { label: "30 Days", type: "days", value: 30 }, { label: "60 Days", type: "days", value: 60 },
  { label: "90 Days", type: "days", value: 90 }, { label: "6 Months", type: "months", value: 6 },
  { label: "1 Year", type: "years", value: 1 }, { label: "2 Years", type: "years", value: 2 },
  { label: "3 Years", type: "years", value: 3 }, { label: "5 Years", type: "years", value: 5 },
  { label: "Lifetime", type: "lifetime", value: 0 }, { label: "Custom Duration", type: "custom", value: 0 },
];
const COVERAGE = ["Manufacturing Defects", "Hardware", "Software", "Battery", "Display", "Keyboard", "Motherboard", "Camera", "Speakers", "Charging Port", "Accessories", "Replacement", "Repair", "Refund", "Exchange"];
const EXCLUSIONS = ["Water Damage", "Physical Damage", "Drops", "Misuse", "Unauthorized Repairs", "Fire", "Flood", "Theft", "Lost Product", "Normal Wear"];
const COUNTRIES = ["Worldwide", "USA", "Canada", "Haiti", "France"];
const LANGUAGES = ["English", "French", "Spanish", "Créole"];
const FILE_TYPES = ["pdf", "terms", "conditions", "image", "video", "link"];

function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
function durLabel(t, v, c) { if (t === "lifetime") return "Lifetime"; if (t === "none") return "No Warranty"; if (t === "custom") return c || "Custom"; if (!v) return "—"; const u = t === "days" ? "day" : t === "years" ? "year" : "month"; return `${v} ${u}${v > 1 ? "s" : ""}`; }

export function AdminWarranties({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inpBg = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inpBg, "focus:border-[#2563eb]");
  const taCls = cn("w-full rounded-[11px] border-[1.5px] px-3 py-2 text-sm outline-none", inpBg, "focus:border-[#2563eb]");
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
  const [list, setList] = useState({ warranties: [], total: 0, page: 1, pages: 1 });
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fType, setFType] = useState("");
  const [sort, setSort] = useState("created_at");
  const [dir, setDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());

  const [drawer, setDrawer] = useState(null);   // full warranty being edited
  const [catalog, setCatalog] = useState({ products: [], categories: [], brands: [] });
  const [claims, setClaims] = useState([]);
  const [importOpen, setImportOpen] = useState(false);

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3200); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api/warranties${path}`, opts);
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);

  const loadDash = useCallback(async () => { try { setDash(await api("/dashboard")); } catch (e) { showToast(e.message, "error"); } }, [api, showToast]);
  const loadList = useCallback(async () => {
    try {
      const params = new URLSearchParams({ q, status: fStatus, type: fType, sort, dir, page: String(page), pageSize: "20" });
      setList(await api(`/list?${params}`));
    } catch (e) { showToast(e.message, "error"); }
  }, [api, q, fStatus, fType, sort, dir, page, showToast]);
  const loadCatalog = useCallback(async () => {
    try {
      const [prods, cats, brands] = await Promise.all([api("/products"), api("/categories"), api("/brands")]);
      setCatalog({ products: prods.products || [], categories: cats.categories || [], brands: brands.brands || [] });
    } catch {}
  }, [api]);

  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadDash(), loadList(), loadCatalog()]); setLoading(false); })(); }, []); // eslint-disable-line
  useEffect(() => { if (tab === "dashboard") loadDash(); if (tab === "all") loadList(); if (tab === "claims") api("/claims").then(r => setClaims(r.claims || [])).catch(() => {}); }, [tab]); // eslint-disable-line
  useEffect(() => { if (tab === "all") loadList(); }, [q, fStatus, fType, sort, dir, page]); // eslint-disable-line

  const post = async (action, bodyObj, okMsg, after) => {
    setBusy(action);
    try {
      const r = await api(`/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyObj) });
      if (okMsg) showToast(typeof okMsg === "function" ? okMsg(r) : okMsg);
      if (after) await after(r);
      return r;
    } catch (e) { showToast(e.message, "error"); throw e; }
    finally { setBusy(null); }
  };

  const emptyWarranty = () => ({
    _new: true, name: "", code: "", description: "", short_description: "", icon_url: "", banner_url: "",
    status: "active", warranty_type: "manufacturer", duration_type: "years", duration_value: 1, duration_custom: "",
    coverage: [], exclusions: [], claim_steps: [], claim_docs: [], claim_email: "", claim_phone: "", claim_url: "",
    processing_time: "", countries: ["Worldwide"], languages: ["English"], default_language: "English",
    badge_text: "", badge_color: "#2563eb", show_on_product: true, schema_enabled: true, is_default: false, cj_default: false, priority: 100,
    product_ids: [], category_ids: [], brand_ids: [], files: [], translations: [], rules: [], _tab: "general",
  });

  const openWarranty = async (id) => {
    try {
      const r = await api(`/detail?id=${id}`);
      setDrawer({ ...r.warranty, product_ids: r.product_ids, category_ids: r.category_ids, brand_ids: r.brand_ids, files: r.files, translations: r.translations, rules: r.rules, _tab: "general" });
    } catch (e) { showToast(e.message, "error"); }
  };

  const saveWarranty = async () => {
    const d = drawer;
    if (!d.name) { showToast("Warranty name is required", "error"); return; }
    if (d._new) {
      const r = await post("create", d, "Warranty created");
      if (r?.warranty?.id) { await openWarranty(r.warranty.id); loadList(); loadDash(); }
    } else {
      await post("update", { ...d, id: d.id }, "Saved", () => { loadList(); loadDash(); });
    }
  };

  const toggleArr = (key, val) => setDrawer(d => ({ ...d, [key]: d[key].includes(val) ? d[key].filter(x => x !== val) : [...d[key], val] }));

  const saveAssignment = async (target) => {
    const key = target === "products" ? "product_ids" : target === "categories" ? "category_ids" : "brand_ids";
    await post("assign", { warranty_id: drawer.id, target, ids: drawer[key] }, `Assigned to ${drawer[key].length} ${target}`, () => { loadDash(); loadList(); });
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const kpis = [
    { label: "Total Warranties", value: K.total }, { label: "Active", value: K.active }, { label: "Inactive", value: K.inactive },
    { label: "Products Covered", value: K.productsCovered }, { label: "Categories Covered", value: K.categoriesCovered }, { label: "Brands Covered", value: K.brandsCovered },
    { label: "Expired", value: K.expired }, { label: "Most Used", value: K.mostUsed }, { label: "Most Used ×", value: K.mostUsedCount },
  ];

  const allSelected = list.warranties.length > 0 && list.warranties.every(w => selected.has(w.id));
  const toggleSel = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(s => allSelected ? new Set() : new Set(list.warranties.map(w => w.id)));

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><ShieldCheck className="w-5 h-5 text-[#2563eb]" /> Warranty Management</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Policies, assignment rules, claims & storefront display — connected to Products, Categories, Brands & CJ.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/warranties/export?format=csv" className={btnGhost}><Download className="w-3.5 h-3.5" /> CSV</a>
          <a href="/api/warranties/export?format=json" className={btnGhost}><Download className="w-3.5 h-3.5" /> JSON</a>
          <button onClick={() => setImportOpen(true)} className={btnGhost}><Upload className="w-3.5 h-3.5" /> Import</button>
          <button onClick={() => setDrawer(emptyWarranty())} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> New Warranty</button>
        </div>
      </div>

      {/* tabs */}
      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {[["dashboard", "Dashboard", LayoutDashboard], ["all", "All Warranties", Table2], ["claims", "Claims", ClipboardCheck]].map(([id, l, I]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><I className="w-3.5 h-3.5" /> {l}</button>
        ))}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {kpis.map(k => (
              <div key={k.label} className={cn(cardCls, "p-3.5")}><p className={cn("text-[18px] font-extrabold truncate", txt)}>{k.value ?? 0}</p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
            ))}
          </div>
          <div className={cardCls}>
            <p className={cn("px-4 py-3 text-sm font-extrabold border-b flex items-center gap-2", txt, brd)}><Sparkles className="w-4 h-4 text-[#2563eb]" /> Recently Added</p>
            <div className={cn("divide-y", divide)}>
              {(dash.recent || []).length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No warranties yet. Create your first policy.</p> :
                (dash.recent || []).map(w => (
                  <button key={w.id} onClick={() => openWarranty(w.id)} className={cn("w-full px-4 py-3 flex items-center justify-between text-left", hover)}>
                    <span className={cn("text-sm font-semibold", txt)}>{w.name}</span>
                    <span className="flex items-center gap-3"><StatusPill status={w.status} /><span className={cn("text-[11px]", sub)}>{fmtDate(w.created_at)}</span><ChevronRight className={cn("w-4 h-4", sub)} /></span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ALL WARRANTIES */}
      {tab === "all" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap gap-2 items-center")}>
            <div className="relative flex-1 min-w-[180px]"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} className={cn(inpCls, "pl-9 h-9")} placeholder="Search warranties…" /></div>
            <select value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto h-9")}><option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
            <select value={fType} onChange={e => { setFType(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto h-9")}><option value="">All Types</option>{TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select>
            <select value={`${sort}:${dir}`} onChange={e => { const [sc, dc] = e.target.value.split(":"); setSort(sc); setDir(dc); }} className={cn(inpCls, "w-auto h-9")}>
              <option value="created_at:desc">Newest</option><option value="created_at:asc">Oldest</option>
              <option value="name:asc">Name A→Z</option><option value="name:desc">Name Z→A</option>
              <option value="updated_at:desc">Recently Updated</option>
            </select>
          </div>

          {/* bulk bar */}
          {selected.size > 0 && (
            <div className={cn(cardCls, "p-2.5 flex flex-wrap items-center gap-2")}>
              <span className={cn("text-xs font-bold px-2", txt)}>{selected.size} selected</span>
              <button onClick={() => post("bulk-status", { ids: [...selected], status: "active" }, "Activated", () => { setSelected(new Set()); loadList(); loadDash(); })} className={btnGhost}><Power className="w-3.5 h-3.5 text-green-500" /> Activate</button>
              <button onClick={() => post("bulk-status", { ids: [...selected], status: "inactive" }, "Deactivated", () => { setSelected(new Set()); loadList(); loadDash(); })} className={btnGhost}><ShieldOff className="w-3.5 h-3.5" /> Deactivate</button>
              <button onClick={() => setConfirm({ title: "Delete selected warranties?", message: `${selected.size} warranties will be permanently removed.`, danger: true, onConfirm: () => post("bulk-delete", { ids: [...selected] }, "Deleted", () => { setSelected(new Set()); loadList(); loadDash(); }) })} className={cn(btnGhost, "text-red-500")}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
            </div>
          )}

          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className={cn("border-b text-left", brd, sub)}>
                  <th className="px-3 py-2.5 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                  {["Warranty", "Type", "Duration", "Coverage", "Applies To", "Using", "Status", "Created", "Updated", ""].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody className={cn("divide-y", divide)}>
                  {list.warranties.length === 0 ? (
                    <tr><td colSpan={11} className={cn("px-4 py-12 text-center", sub)}><ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-sm font-semibold">No warranties found</p><p className="text-xs mt-1">Create a policy or adjust your filters.</p></td></tr>
                  ) : list.warranties.map(w => (
                    <tr key={w.id} className={hover}>
                      <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(w.id)} onChange={() => toggleSel(w.id)} /></td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => openWarranty(w.id)} className="flex items-center gap-2.5 text-left">
                          <span className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ backgroundColor: (w.badge_color || "#2563eb") + "1a" }}>{w.icon_url ? <img src={w.icon_url} className="w-5 h-5 object-contain" /> : <ShieldCheck className="w-4 h-4" style={{ color: w.badge_color || "#2563eb" }} />}</span>
                          <span><span className={cn("font-bold block", txt)}>{w.name}</span>{w.code && <span className={cn("text-[11px]", sub)}>{w.code}</span>}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5"><span className={cn("text-xs capitalize", txt)}>{TYPE_LABEL[w.warranty_type] || w.warranty_type}</span></td>
                      <td className="px-3 py-2.5"><span className={cn("text-xs", txt)}>{w.duration_label}</span></td>
                      <td className="px-3 py-2.5"><span className={cn("text-xs", sub)}>{(w.coverage || []).length} items</span></td>
                      <td className="px-3 py-2.5"><span className={cn("text-[11px]", sub)}>{(w.applies_to || []).join(", ") || "—"}</span></td>
                      <td className="px-3 py-2.5"><span className={cn("text-xs font-bold", txt)}>{w.products_count}</span></td>
                      <td className="px-3 py-2.5"><StatusPill status={w.status} /></td>
                      <td className="px-3 py-2.5"><span className={cn("text-[11px]", sub)}>{fmtDate(w.created_at)}</span></td>
                      <td className="px-3 py-2.5"><span className={cn("text-[11px]", sub)}>{fmtDate(w.updated_at)}</span></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => post("toggle-status", { id: w.id }, "Updated", () => { loadList(); loadDash(); })} title="Toggle status" className={cn("p-1.5 rounded-lg", hover, sub)}><Power className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setConfirm({ title: "Delete warranty?", message: `"${w.name}" will be permanently removed.`, danger: true, onConfirm: () => post("delete", { id: w.id }, "Deleted", () => { loadList(); loadDash(); }) })} className={cn("p-1.5 rounded-lg text-red-500", hover)}><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.pages > 1 && (
              <div className={cn("flex items-center justify-between px-4 py-3 border-t", brd)}>
                <span className={cn("text-xs", sub)}>Page {list.page} of {list.pages} · {list.total} total</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={btnGhost}><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <button disabled={page >= list.pages} onClick={() => setPage(p => p + 1)} className={btnGhost}><ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLAIMS */}
      {tab === "claims" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Warranty Claims</p>
          <div className={cn("divide-y", divide)}>
            {claims.length === 0 ? <p className={cn("p-8 text-center text-xs", sub)}>No claims submitted yet. Customers file claims from the product page.</p> :
              claims.map(c => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div><p className={cn("text-sm font-semibold", txt)}>{c.subject || c.reference || "Claim"}</p><p className={cn("text-[11px]", sub)}>{c.customer_name || c.customer_email || "Anonymous"} · {fmtDate(c.created_at)}</p></div>
                  <select value={c.status} onChange={e => post("claim-update", { id: c.id, status: e.target.value }, "Updated", () => api("/claims").then(r => setClaims(r.claims || [])))} className={cn(inpCls, "w-auto h-9")}>
                    {["pending", "reviewing", "approved", "rejected", "resolved"].map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* DRAWER */}
      {drawer && (
        <WarrantyDrawer
          drawer={drawer} setDrawer={setDrawer} catalog={catalog} busy={busy}
          save={saveWarranty} post={post} saveAssignment={saveAssignment} toggleArr={toggleArr}
          openWarranty={openWarranty} setConfirm={setConfirm} loadList={loadList} loadDash={loadDash}
          styles={{ p, brd, txt, sub, inpCls, taCls, labelCls, btnGhost, btnPrimary, hover, cardCls, divide }}
        />
      )}

      {/* IMPORT */}
      {importOpen && <ImportModal post={post} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); loadList(); loadDash(); }} styles={{ p, brd, txt, sub, taCls, btnGhost, btnPrimary }} />}

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

  function StatusPill({ status }) {
    const on = status === "active";
    return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap" style={{ backgroundColor: on ? "#16a34a1a" : "#8a929c1a", color: on ? "#16a34a" : "#8a929c" }}>{status}</span>;
  }
}

// ============ DRAWER ============
function WarrantyDrawer({ drawer, setDrawer, catalog, busy, save, post, saveAssignment, toggleArr, openWarranty, setConfirm, loadList, loadDash, styles }) {
  const { p, brd, txt, sub, inpCls, taCls, labelCls, btnGhost, btnPrimary, hover, cardCls, divide } = styles;
  const d = drawer;
  const set = (patch) => setDrawer(x => ({ ...x, ...patch }));
  const SUBTABS = [["general", "General"], ["type", "Type & Duration"], ["coverage", "Coverage"], ["claim", "Claim Process"], ["assign", "Assignment"], ["rules", "Auto Rules"], ["files", "Attachments"], ["lang", "Languages"], ["seo", "SEO"]];
  const chip = (on) => cn("text-[11px] px-2.5 py-1 rounded-full font-bold border transition-colors", on ? "bg-[#2563eb] text-white border-transparent" : cn(brd, sub));

  const durSel = DURATIONS.find(x => x.type === d.duration_type && x.value === (d.duration_value || 0))?.label || "Custom Duration";

  return (
    <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDrawer(null)}>
      <div className={cn("w-full max-w-2xl h-full overflow-y-auto border-l flex flex-col", p, brd)} onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className={cn("flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10", p, brd)}>
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: (d.badge_color || "#2563eb") + "1a" }}><ShieldCheck className="w-5 h-5" style={{ color: d.badge_color || "#2563eb" }} /></span>
            <div><p className={cn("text-base font-extrabold", txt)}>{d._new ? "New Warranty" : d.name}</p><p className={cn("text-[11px]", sub)}>{d._new ? "Create a warranty policy" : durLabel(d.duration_type, d.duration_value, d.duration_custom)}</p></div>
          </div>
          <button onClick={() => setDrawer(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button>
        </div>

        {/* subtabs */}
        <div className={cn("px-3 py-2 flex gap-1 overflow-x-auto border-b", brd)}>
          {SUBTABS.map(([id, l]) => <button key={id} onClick={() => set({ _tab: id })} disabled={d._new && !["general", "type", "coverage", "claim"].includes(id)} className={cn("h-8 px-3 rounded-[9px] text-[11px] font-bold whitespace-nowrap disabled:opacity-30", d._tab === id ? "bg-[#2563eb] text-white" : cn(sub, hover))}>{l}</button>)}
        </div>

        <div className="flex-1 p-5 space-y-4">
          {d._new && <div className={cn("rounded-[11px] border p-3 text-[11px] flex items-center gap-2", brd, sub)}><AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Create the warranty first — assignment, rules, attachments & translations unlock after saving.</div>}

          {/* GENERAL */}
          {d._tab === "general" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={labelCls}>Warranty Name *</label><input value={d.name} onChange={e => set({ name: e.target.value })} className={inpCls} placeholder="e.g. Nike 1 Year Warranty" /></div>
              <div><label className={labelCls}>Internal Code</label><input value={d.code || ""} onChange={e => set({ code: e.target.value })} className={inpCls} placeholder="WR-NIKE-1Y" /></div>
              <div><label className={labelCls}>Status</label><select value={d.status} onChange={e => set({ status: e.target.value })} className={inpCls}><option value="active">Active</option><option value="inactive">Inactive</option><option value="draft">Draft</option><option value="archived">Archived</option></select></div>
              <div className="col-span-2"><label className={labelCls}>Short Description</label><input value={d.short_description || ""} onChange={e => set({ short_description: e.target.value })} className={inpCls} placeholder="One-line summary shown on the product badge" /></div>
              <div className="col-span-2"><label className={labelCls}>Full Description</label><textarea rows={3} value={d.description || ""} onChange={e => set({ description: e.target.value })} className={taCls} /></div>
              <div><label className={labelCls}>Warranty Icon URL</label><input value={d.icon_url || ""} onChange={e => set({ icon_url: e.target.value })} className={inpCls} placeholder="https://…/icon.svg" /></div>
              <div><label className={labelCls}>Warranty Banner URL</label><input value={d.banner_url || ""} onChange={e => set({ banner_url: e.target.value })} className={inpCls} placeholder="https://…/banner.jpg" /></div>
              <div><label className={labelCls}>Badge Text</label><input value={d.badge_text || ""} onChange={e => set({ badge_text: e.target.value })} className={inpCls} placeholder="1 Year Warranty" /></div>
              <div><label className={labelCls}>Badge Color</label><div className="flex gap-2 items-center"><input type="color" value={d.badge_color || "#2563eb"} onChange={e => set({ badge_color: e.target.value })} className="w-10 h-[42px] rounded-[11px] border-0 bg-transparent" /><input value={d.badge_color || ""} onChange={e => set({ badge_color: e.target.value })} className={inpCls} /></div></div>
              <label className={cn("col-span-2 flex items-center gap-2 text-sm cursor-pointer", txt)}><input type="checkbox" checked={d.show_on_product} onChange={e => set({ show_on_product: e.target.checked })} /> Show warranty on product page</label>
            </div>
          )}

          {/* TYPE & DURATION */}
          {d._tab === "type" && (
            <div className="space-y-4">
              <div><label className={labelCls}>Warranty Type</label>
                <div className="flex flex-wrap gap-1.5">{TYPES.map(t => <button key={t} onClick={() => set({ warranty_type: t })} className={chip(d.warranty_type === t)}>{TYPE_LABEL[t]}</button>)}</div>
              </div>
              <div><label className={labelCls}>Duration</label>
                <div className="flex flex-wrap gap-1.5">{DURATIONS.map(dr => <button key={dr.label} onClick={() => set({ duration_type: dr.type, duration_value: dr.value })} className={chip(durSel === dr.label)}>{dr.label}</button>)}</div>
              </div>
              {d.duration_type === "custom" && <div><label className={labelCls}>Custom Duration Text</label><input value={d.duration_custom || ""} onChange={e => set({ duration_custom: e.target.value })} className={inpCls} placeholder="e.g. 18 months limited" /></div>}
              <div><label className={labelCls}>Country Support</label>
                <div className="flex flex-wrap gap-1.5">{COUNTRIES.map(c => <button key={c} onClick={() => toggleArr("countries", c)} className={chip((d.countries || []).includes(c))}>{c}</button>)}</div>
              </div>
            </div>
          )}

          {/* COVERAGE */}
          {d._tab === "coverage" && (
            <div className="space-y-4">
              <div><label className={cn(labelCls, "flex items-center gap-1.5")}><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Coverage (what's covered)</label>
                <div className="flex flex-wrap gap-1.5">{COVERAGE.map(c => <button key={c} onClick={() => toggleArr("coverage", c)} className={chip((d.coverage || []).includes(c))}>{c}</button>)}</div>
                <CustomAdd onAdd={v => !(d.coverage || []).includes(v) && set({ coverage: [...(d.coverage || []), v] })} inpCls={inpCls} btnGhost={btnGhost} placeholder="Add custom coverage…" />
              </div>
              <div><label className={cn(labelCls, "flex items-center gap-1.5")}><ShieldOff className="w-3.5 h-3.5 text-red-500" /> Exclusions (not covered)</label>
                <div className="flex flex-wrap gap-1.5">{EXCLUSIONS.map(c => <button key={c} onClick={() => toggleArr("exclusions", c)} className={chip((d.exclusions || []).includes(c))}>{c}</button>)}</div>
                <CustomAdd onAdd={v => !(d.exclusions || []).includes(v) && set({ exclusions: [...(d.exclusions || []), v] })} inpCls={inpCls} btnGhost={btnGhost} placeholder="Add custom exclusion…" />
              </div>
            </div>
          )}

          {/* CLAIM */}
          {d._tab === "claim" && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Claim Steps</label>
                <div className="space-y-2">
                  {(d.claim_steps || []).map((st, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="w-6 h-6 rounded-full bg-[#2563eb] text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <input value={st.title || ""} onChange={e => { const s = [...d.claim_steps]; s[i] = { ...s[i], title: e.target.value }; set({ claim_steps: s }); }} className={cn(inpCls, "h-9")} placeholder={`Step ${i + 1}…`} />
                      <button onClick={() => set({ claim_steps: d.claim_steps.filter((_, x) => x !== i) })} className="text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => set({ claim_steps: [...(d.claim_steps || []), { title: "" }] })} className={btnGhost}><Plus className="w-3.5 h-3.5" /> Add Step</button>
                </div>
              </div>
              <div><label className={labelCls}>Documents Required</label>
                <div className="flex flex-wrap gap-1.5 mb-2">{(d.claim_docs || []).map((dc, i) => <span key={i} className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border", brd, txt)}>{dc}<button onClick={() => set({ claim_docs: d.claim_docs.filter((_, x) => x !== i) })} className="text-red-500"><X className="w-3 h-3" /></button></span>)}</div>
                <CustomAdd onAdd={v => set({ claim_docs: [...(d.claim_docs || []), v] })} inpCls={inpCls} btnGhost={btnGhost} placeholder="e.g. Proof of purchase…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Contact Email</label><input value={d.claim_email || ""} onChange={e => set({ claim_email: e.target.value })} className={inpCls} placeholder="support@…" /></div>
                <div><label className={labelCls}>Contact Phone</label><input value={d.claim_phone || ""} onChange={e => set({ claim_phone: e.target.value })} className={inpCls} placeholder="+509 …" /></div>
                <div><label className={labelCls}>Support URL</label><input value={d.claim_url || ""} onChange={e => set({ claim_url: e.target.value })} className={inpCls} placeholder="https://…/support" /></div>
                <div><label className={labelCls}>Estimated Processing Time</label><input value={d.processing_time || ""} onChange={e => set({ processing_time: e.target.value })} className={inpCls} placeholder="5-7 business days" /></div>
              </div>
            </div>
          )}

          {/* ASSIGNMENT */}
          {d._tab === "assign" && !d._new && (
            <div className="space-y-4">
              <AssignBlock icon={Package} title="Products" items={catalog.products} sel={d.product_ids} labelKey="name" onToggle={id => toggleArr("product_ids", id)} onSave={() => saveAssignment("products")} styles={styles} busy={busy} />
              <AssignBlock icon={Grid3x3} title="Categories" items={catalog.categories} sel={d.category_ids} labelKey="name" onToggle={id => toggleArr("category_ids", id)} onSave={() => saveAssignment("categories")} styles={styles} busy={busy} />
              <AssignBlock icon={Award} title="Brands" items={catalog.brands} sel={d.brand_ids} labelKey="name" onToggle={id => toggleArr("brand_ids", id)} onSave={() => saveAssignment("brands")} styles={styles} busy={busy} />
              <div className={cn("rounded-[11px] border p-3 space-y-2", brd)}>
                <label className={cn("flex items-center gap-2 text-sm cursor-pointer", txt)}><input type="checkbox" checked={d.cj_default} onChange={e => { set({ cj_default: e.target.checked }); post("cj-default", { warranty_id: e.target.checked ? d.id : null }, e.target.checked ? "Set as CJ default" : "CJ default cleared"); }} /> Apply automatically to all CJ-imported products (CJ Default Warranty)</label>
                <p className={cn("text-[10px]", sub)}>When a product is imported from CJ Dropshipping, this warranty is attached automatically.</p>
              </div>
            </div>
          )}

          {/* AUTO RULES */}
          {d._tab === "rules" && !d._new && (
            <RulesBlock drawer={d} setDrawer={setDrawer} catalog={catalog} post={post} openWarranty={openWarranty} styles={styles} />
          )}

          {/* FILES */}
          {d._tab === "files" && !d._new && (
            <div className="space-y-3">
              <FileAdd warrantyId={d.id} post={post} onAdd={f => set({ files: [...(d.files || []), f] })} styles={styles} />
              <div className={cn("divide-y rounded-[12px] border", divide, brd)}>
                {(d.files || []).length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No attachments. Add warranty PDFs, terms, images, videos or links.</p> :
                  (d.files || []).map(f => (
                    <div key={f.id} className="px-3 py-2.5 flex items-center justify-between gap-2">
                      <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 min-w-0"><Paperclip className={cn("w-3.5 h-3.5 shrink-0", sub)} /><span className={cn("text-sm truncate", txt)}>{f.title || f.url}</span><span className={cn("text-[10px] px-1.5 py-0.5 rounded uppercase font-bold", brd, sub)}>{f.file_type}</span></a>
                      <button onClick={() => post("file-delete", { id: f.id }, "Removed", () => set({ files: d.files.filter(x => x.id !== f.id) }))} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* LANGUAGES */}
          {d._tab === "lang" && !d._new && (
            <TranslationsBlock drawer={d} setDrawer={setDrawer} post={post} styles={styles} />
          )}

          {/* SEO */}
          {d._tab === "seo" && (
            <div className="space-y-3">
              <div className={cn("rounded-[11px] border p-3 text-[11px] flex items-center gap-2", brd, sub)}><Sparkles className="w-3.5 h-3.5 text-[#2563eb] shrink-0" /> Meta fields auto-generate from the warranty name & duration. Override below if needed. Schema.org Warranty structured data is emitted on the product page.</div>
              <div><label className={labelCls}>Meta Title</label><input value={d.meta_title || ""} onChange={e => set({ meta_title: e.target.value })} className={inpCls} placeholder="Auto-generated" /></div>
              <div><label className={labelCls}>Meta Description</label><textarea rows={3} value={d.meta_description || ""} onChange={e => set({ meta_description: e.target.value })} className={taCls} placeholder="Auto-generated" /></div>
              <div><label className={labelCls}>Open Graph Image URL</label><input value={d.og_image || ""} onChange={e => set({ og_image: e.target.value })} className={inpCls} /></div>
              <label className={cn("flex items-center gap-2 text-sm cursor-pointer", txt)}><input type="checkbox" checked={d.schema_enabled} onChange={e => set({ schema_enabled: e.target.checked })} /> Emit Schema.org structured data</label>
            </div>
          )}
        </div>

        {/* footer */}
        <div className={cn("px-5 py-4 border-t flex gap-2 sticky bottom-0", p, brd)}>
          <button onClick={save} disabled={busy === "create" || busy === "update" || !d.name} className={cn(btnPrimary, "flex-1 justify-center h-10")}>{(busy === "create" || busy === "update") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {d._new ? "Create Warranty" : "Save Changes"}</button>
          {!d._new && <button onClick={() => setConfirm({ title: "Delete warranty?", message: `"${d.name}" and all its assignments will be removed.`, danger: true, onConfirm: () => post("delete", { id: d.id }, "Deleted", () => { setDrawer(null); loadList(); loadDash(); }) })} className={cn(btnGhost, "text-red-500 h-10")}><Trash2 className="w-4 h-4" /></button>}
        </div>
      </div>
    </div>
  );
}

function CustomAdd({ onAdd, inpCls, btnGhost, placeholder }) {
  const [v, setV] = useState("");
  const add = () => { if (v.trim()) { onAdd(v.trim()); setV(""); } };
  return <div className="flex gap-2 mt-2"><input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())} className={cn(inpCls, "h-9 flex-1")} placeholder={placeholder} /><button onClick={add} className={cn(btnGhost, "h-9")}><Plus className="w-3.5 h-3.5" /></button></div>;
}

function AssignBlock({ icon: Icon, title, items, sel, labelKey, onToggle, onSave, styles, busy }) {
  const { brd, txt, sub, btnPrimary, inpCls } = styles;
  const [q, setQ] = useState("");
  const shown = useMemo(() => items.filter(i => (i[labelKey] || "").toLowerCase().includes(q.toLowerCase())).slice(0, 60), [items, q, labelKey]);
  return (
    <div className={cn("rounded-[12px] border p-3 space-y-2", brd)}>
      <div className="flex items-center justify-between">
        <p className={cn("text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5", sub)}><Icon className="w-3.5 h-3.5" /> {title} <span className="text-[#2563eb]">({sel.length})</span></p>
        <button onClick={onSave} disabled={busy === "assign"} className={cn(btnPrimary, "h-7")}>{busy === "assign" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />} Save</button>
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} className={cn(inpCls, "h-8")} placeholder={`Search ${title.toLowerCase()}…`} />
      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
        {shown.map(i => { const on = sel.includes(i.id); return <button key={i.id} onClick={() => onToggle(i.id)} className={cn("text-[11px] px-2.5 py-1 rounded-full font-semibold border", on ? "bg-[#2563eb] text-white border-transparent" : cn(brd, sub))}>{i[labelKey]}</button>; })}
        {shown.length === 0 && <span className={cn("text-xs", sub)}>No matches.</span>}
      </div>
    </div>
  );
}

function RulesBlock({ drawer, setDrawer, catalog, post, openWarranty, styles }) {
  const { brd, txt, sub, inpCls, labelCls, btnGhost, btnPrimary, divide } = styles;
  const [form, setForm] = useState({ name: "", match_type: "brand", match_value: "", match_label: "" });
  const options = form.match_type === "brand" ? catalog.brands : form.match_type === "category" ? catalog.categories : [];
  const save = async () => {
    if (!form.name) return;
    const lbl = options.find(o => o.id === form.match_value)?.name || form.match_value;
    await post("rule-save", { warranty_id: drawer.id, ...form, match_label: lbl }, "Rule saved", () => { setForm({ name: "", match_type: "brand", match_value: "", match_label: "" }); openWarranty(drawer.id); });
  };
  return (
    <div className="space-y-3">
      <div className={cn("rounded-[12px] border p-3 space-y-2", brd)}>
        <p className={cn("text-[11px] font-bold uppercase tracking-wider", sub)}>New Automatic Rule</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inpCls} placeholder="Rule name — e.g. All Nike Sneakers" /></div>
          <select value={form.match_type} onChange={e => setForm(f => ({ ...f, match_type: e.target.value, match_value: "" }))} className={inpCls}>
            <option value="brand">Match Brand</option><option value="category">Match Category</option><option value="tag">Match Tag</option><option value="all">All Products</option>
          </select>
          {form.match_type === "tag" ? <input value={form.match_value} onChange={e => setForm(f => ({ ...f, match_value: e.target.value }))} className={inpCls} placeholder="tag value" /> :
            form.match_type === "all" ? <div className={cn("h-[42px] flex items-center text-xs px-3", sub)}>Applies to every product</div> :
              <select value={form.match_value} onChange={e => setForm(f => ({ ...f, match_value: e.target.value }))} className={inpCls}><option value="">Select…</option>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}
        </div>
        <button onClick={save} className={btnPrimary}><GitBranch className="w-3.5 h-3.5" /> Save Rule</button>
      </div>
      <div className={cn("rounded-[12px] border divide-y", brd, divide)}>
        {(drawer.rules || []).length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No rules yet. Rules auto-attach this warranty to matching products.</p> :
          (drawer.rules || []).map(r => (
            <div key={r.id} className="px-3 py-2.5 flex items-center justify-between gap-2">
              <div><p className={cn("text-sm font-semibold", txt)}>{r.name}</p><p className={cn("text-[11px]", sub)}>{r.match_type}{r.match_label ? `: ${r.match_label}` : ""}</p></div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => post("rule-apply", { id: r.id }, res => `Applied → ${res.count} products`, () => openWarranty(drawer.id))} className={btnGhost}><Sparkles className="w-3.5 h-3.5" /> Apply Now</button>
                <button onClick={() => post("rule-delete", { id: r.id }, "Removed", () => openWarranty(drawer.id))} className="text-red-500 p-1.5"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function FileAdd({ warrantyId, post, onAdd, styles }) {
  const { brd, sub, inpCls, btnPrimary } = styles;
  const [f, setF] = useState({ file_type: "pdf", title: "", url: "" });
  const add = async () => { if (!f.url) return; const r = await post("file-add", { warranty_id: warrantyId, ...f }, "Attachment added", null); if (r?.file) { onAdd(r.file); setF({ file_type: "pdf", title: "", url: "" }); } };
  return (
    <div className={cn("rounded-[12px] border p-3 grid grid-cols-1 sm:grid-cols-4 gap-2", brd)}>
      <select value={f.file_type} onChange={e => setF(x => ({ ...x, file_type: e.target.value }))} className={inpCls}>{FILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
      <input value={f.title} onChange={e => setF(x => ({ ...x, title: e.target.value }))} className={inpCls} placeholder="Title" />
      <input value={f.url} onChange={e => setF(x => ({ ...x, url: e.target.value }))} className={cn(inpCls, "sm:col-span-1")} placeholder="https://…" />
      <button onClick={add} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add</button>
    </div>
  );
}

function TranslationsBlock({ drawer, setDrawer, post, styles }) {
  const { brd, txt, sub, inpCls, taCls, labelCls, btnPrimary, btnGhost } = styles;
  const [lang, setLang] = useState("French");
  const existing = (drawer.translations || []).find(t => t.language === lang) || { language: lang, name: "", description: "", badge_text: "", meta_title: "", meta_description: "" };
  const [form, setForm] = useState(existing);
  useEffect(() => { setForm((drawer.translations || []).find(t => t.language === lang) || { language: lang, name: "", description: "", badge_text: "", meta_title: "", meta_description: "" }); }, [lang, drawer.translations]);
  const save = () => post("translation-save", { warranty_id: drawer.id, ...form, language: lang }, `${lang} translation saved`, () => post && setDrawer(d => ({ ...d }))); // refresh handled via openWarranty externally
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">{LANGUAGES.map(l => <button key={l} onClick={() => setLang(l)} className={cn("text-[11px] px-2.5 py-1 rounded-full font-bold border", lang === l ? "bg-[#2563eb] text-white border-transparent" : cn(brd, sub))}>{l}</button>)}</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className={labelCls}>Name ({lang})</label><input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inpCls} /></div>
        <div className="col-span-2"><label className={labelCls}>Description ({lang})</label><textarea rows={2} value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={taCls} /></div>
        <div><label className={labelCls}>Badge Text</label><input value={form.badge_text || ""} onChange={e => setForm(f => ({ ...f, badge_text: e.target.value }))} className={inpCls} /></div>
        <div><label className={labelCls}>Meta Title</label><input value={form.meta_title || ""} onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))} className={inpCls} /></div>
      </div>
      <button onClick={save} className={btnPrimary}><Languages className="w-3.5 h-3.5" /> Save {lang}</button>
    </div>
  );
}

function ImportModal({ post, onClose, onDone, styles }) {
  const { p, brd, txt, sub, taCls, btnGhost, btnPrimary } = styles;
  const [csv, setCsv] = useState("name,code,warranty_type,duration_type,duration_value,status\nNike 1 Year,WR-NIKE-1Y,manufacturer,years,1,active");
  const [busy, setBusy] = useState(false);
  const doImport = async () => {
    setBusy(true);
    try {
      const lines = csv.trim().split(/\r?\n/); const headers = lines[0].split(",").map(h => h.trim());
      const rows = lines.slice(1).map(l => { const cells = l.split(","); const o = {}; headers.forEach((h, i) => o[h] = (cells[i] || "").trim()); return o; }).filter(r => r.name);
      await post("import", { rows }, r => `Imported ${r.created} (${r.failed} failed)`, onDone);
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className={cn("w-full max-w-lg rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
        <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><Upload className="w-5 h-5 text-[#2563eb]" /> Import Warranties (CSV)</p>
        <p className={cn("text-xs", sub)}>First row = headers. Supported: name, code, warranty_type, duration_type, duration_value, status, claim_email, claim_phone, processing_time.</p>
        <textarea rows={7} value={csv} onChange={e => setCsv(e.target.value)} className={cn(taCls, "font-mono text-xs")} />
        <div className="flex gap-2 justify-end"><button onClick={onClose} className={btnGhost}>Cancel</button><button onClick={doImport} disabled={busy} className={btnPrimary}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import</button></div>
      </div>
    </div>
  );
}
