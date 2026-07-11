// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Drawer } from "@/components/ui/drawer";
import {
  Receipt, RefreshCw, Download, Upload, Plus, Search, Loader2, Eye,
  Edit3, Copy, Trash2, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  Percent, DollarSign, Globe, Clock, FileText, History, Power,
  AlertTriangle, Landmark, Layers, Users, Calendar, ArrowUpDown,
} from "lucide-react";

type Props = { dark: boolean };

const TAX_TYPES = [
  ["sales_tax", "Sales Tax"], ["vat", "VAT / TVA"], ["gst", "GST"], ["hst", "HST"],
  ["digital_vat", "Digital VAT"], ["service_tax", "Service Tax"],
  ["luxury_tax", "Luxury Tax"], ["environmental_tax", "Environmental Tax"],
];
const TAX_TYPE_LABEL = Object.fromEntries(TAX_TYPES);
const APPLIES_TO = [
  ["all", "All Products"], ["physical", "Physical Products"], ["digital", "Digital Products"],
  ["specific_categories", "Specific Categories"], ["specific_brands", "Specific Brands"], ["specific_products", "Specific Products"],
];
const CUSTOMER_TYPES = [
  ["all", "All Customers"], ["guest", "Guest"], ["registered", "Registered"],
  ["business", "Business"], ["wholesale", "Wholesale"], ["vip", "VIP"],
];
const STATUS_META = {
  active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-600" },
  inactive: { label: "Inactive", cls: "bg-gray-500/10 text-gray-500" },
  draft: { label: "Draft", cls: "bg-amber-500/10 text-amber-600" },
};
const COMMON_COUNTRIES = ["Haiti", "United States", "Canada", "Dominican Republic", "France", "Mexico", "United Kingdom", "Germany", "Spain", "Brazil", "China"];

const emptyForm = {
  name: "", tax_type: "sales_tax", value_type: "percentage", inclusive: false, rate: "",
  country: "", state: "", city: "", postal_code: "", applies_to: "all",
  target_category_ids: [], target_brand_ids: [], target_product_ids: [],
  customer_type: "all", min_order: "", max_order: "", priority: "0",
  status: "active", start_date: "", end_date: "", internal_notes: "", visible_description: "",
};

function fmtDate(d) { return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"; }
function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function money(n) { return `$${(Number(n) || 0).toFixed(2)}`; }

export function AdminTax({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");
  const labelCls = cn("text-[12px] font-semibold mb-1.5 block", txt);
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnGhost = cn("h-10 px-4 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2", brd, txt, hover);

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [rules, setRules] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [countries, setCountries] = useState([]);
  const [sort, setSort] = useState("priority");
  const [order, setOrder] = useState("asc");
  const [selected, setSelected] = useState(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const importRef = useRef(null);
  const [toast, setToast] = useState(null);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const showToast = useCallback((message, type = "success") => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); }, []);

  const loadKpis = useCallback(async () => {
    try { const r = await fetch("/api/admin/tax?section=kpis"); if (r.ok) setKpis(await r.json()); } catch {}
  }, []);
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), per_page: "20", sort, order });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("tax_type", typeFilter);
      if (countryFilter) params.set("country", countryFilter);
      const r = await fetch(`/api/admin/tax?${params}`);
      if (r.ok) { const d = await r.json(); setRules(d.rules || []); setTotal(d.total || 0); setTotalPages(d.totalPages || 0); }
    } catch {} finally { setLoading(false); }
  }, [page, sort, order, search, statusFilter, typeFilter, countryFilter]);

  useEffect(() => { loadKpis(); fetch("/api/admin/tax?section=countries").then(r => r.ok ? r.json() : null).then(d => d && setCountries(d.countries || [])).catch(() => {}); }, [loadKpis]);
  useEffect(() => { const t = setTimeout(loadList, search ? 300 : 0); return () => clearTimeout(t); }, [loadList]);
  const refresh = () => { loadKpis(); loadList(); };

  const openCreate = () => { setEditId(null); setForm({ ...emptyForm }); setFormOpen(true); };
  const openEdit = (r) => {
    setEditId(r.id);
    setForm({
      name: r.name, tax_type: r.tax_type, value_type: r.value_type, inclusive: !!r.inclusive,
      rate: String(r.rate ?? ""), country: r.country || "", state: r.state || "", city: r.city || "",
      postal_code: r.postal_code || "", applies_to: r.applies_to || "all",
      target_category_ids: r.target_category_ids || [], target_brand_ids: r.target_brand_ids || [], target_product_ids: r.target_product_ids || [],
      customer_type: r.customer_type || "all", min_order: r.min_order ? String(r.min_order) : "", max_order: r.max_order ? String(r.max_order) : "",
      priority: String(r.priority ?? 0), status: r.status || "active",
      start_date: r.start_date ? r.start_date.slice(0, 16) : "", end_date: r.end_date ? r.end_date.slice(0, 16) : "",
      internal_notes: r.internal_notes || "", visible_description: r.visible_description || "",
    });
    setFormOpen(true);
  };

  const validate = () => {
    if (!form.name.trim()) return "Tax name is required";
    if (!form.country.trim()) return "Country is required";
    const rate = parseFloat(form.rate);
    if (!Number.isFinite(rate)) return "Tax value is required";
    if (rate < 0) return "Tax value cannot be negative";
    if (form.value_type === "percentage" && rate > 100) return "Percentage cannot exceed 100%";
    if (form.start_date && form.end_date && new Date(form.start_date) > new Date(form.end_date)) return "End date must be after start date";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { showToast(err, "error"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form, rate: parseFloat(form.rate) || 0, priority: parseInt(form.priority) || 0,
        min_order: form.min_order === "" ? 0 : Number(form.min_order),
        max_order: form.max_order === "" ? null : Number(form.max_order),
        start_date: form.start_date || null, end_date: form.end_date || null,
      };
      const viaApi = async () => {
        const method = editId ? "PUT" : "POST";
        const body = editId ? { id: editId, ...payload } : payload;
        const r = await fetch("/api/admin/tax", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const text = await r.text();
        let d; try { d = text ? JSON.parse(text) : {}; } catch { const e = new Error("nonjson"); e.nonJson = true; throw e; }
        if (!r.ok) throw new Error(d.error || "Save failed");
      };
      const viaSupabase = async () => {
        const supabase = createClient();
        const rec = { ...payload };
        ["min_order"].forEach(() => {});
        if (editId) { const { error } = await supabase.from("tax_rules").update({ ...rec, updated_at: new Date().toISOString() }).eq("id", editId); if (error) throw new Error(error.message); }
        else { const { error } = await supabase.from("tax_rules").insert(rec); if (error) throw new Error(error.message); }
      };
      try { await viaApi(); } catch (e) { if (e.nonJson) await viaSupabase(); else throw e; }
      showToast(editId ? "Tax rule updated" : "Tax rule created");
      setFormOpen(false); refresh();
    } catch (e) { showToast(e.message || "Save failed", "error"); } finally { setSaving(false); }
  };

  const openDetail = async (id) => {
    setDetailLoading(true);
    try { const r = await fetch(`/api/admin/tax?section=detail&id=${id}`); if (r.ok) setDetail(await r.json()); } catch {} finally { setDetailLoading(false); }
  };

  const runBulk = async (action, ids) => {
    try {
      const r = await fetch("/api/admin/tax", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Action failed");
      showToast(action === "duplicate" ? "Duplicated" : action === "delete" ? "Deleted" : "Updated");
      setSelected(new Set()); refresh();
    } catch (e) { showToast(e.message, "error"); }
  };

  const toggleStatus = async (r) => {
    const status = r.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch("/api/admin/tax", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, name: r.name, country: r.country, rate: r.rate, value_type: r.value_type, status }) });
      if (!res.ok) { const supabase = createClient(); await supabase.from("tax_rules").update({ status, updated_at: new Date().toISOString() }).eq("id", r.id); }
      refresh();
    } catch { showToast("Failed", "error"); }
  };

  const doDelete = async (id) => {
    try {
      const r = await fetch(`/api/admin/tax?id=${id}`, { method: "DELETE" });
      if (!r.ok) { const supabase = createClient(); const { error } = await supabase.from("tax_rules").delete().eq("id", id); if (error) throw new Error(error.message); }
      showToast("Tax rule deleted"); setConfirmDel(null); refresh();
    } catch (e) { showToast(e.message || "Delete failed", "error"); }
  };

  const exportCsv = async () => {
    try {
      const r = await fetch("/api/admin/tax?section=export");
      const d = await r.json();
      const cols = ["name", "tax_type", "value_type", "inclusive", "rate", "country", "state", "city", "postal_code", "applies_to", "customer_type", "min_order", "max_order", "priority", "status", "start_date", "end_date"];
      const csv = [cols.join(","), ...(d.rules || []).map(row => cols.map(c => {
        const v = row[c]; return typeof v === "string" && v.includes(",") ? `"${v}"` : (v ?? "");
      }).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `tax-rules-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      showToast("Exported");
    } catch { showToast("Export failed", "error"); }
  };

  const importCsv = async (file) => {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error("Empty file");
      const header = lines[0].split(",").map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const cells = line.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
        const obj = {};
        header.forEach((h, i) => { let v = (cells[i] || "").trim().replace(/^"|"$/g, ""); obj[h] = v; });
        obj.rate = parseFloat(obj.rate) || 0;
        obj.priority = parseInt(obj.priority) || 0;
        obj.inclusive = obj.inclusive === "true";
        return obj;
      });
      const r = await fetch("/api/admin/tax", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import", rules: rows }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Import failed");
      showToast(`Imported ${d.created} rule(s)${d.errors?.length ? `, ${d.errors.length} skipped` : ""}`);
      refresh();
    } catch (e) { showToast(e.message || "Invalid CSV", "error"); }
    if (importRef.current) importRef.current.value = "";
  };

  const rateLabel = (r) => r.value_type === "fixed" ? money(r.rate) : `${Number(r.rate)}%`;

  const kpiCards = useMemo(() => kpis ? [
    { label: "Total Tax Rules", value: kpis.total, icon: Receipt, color: "#2563eb" },
    { label: "Active Taxes", value: kpis.active, icon: CheckCircle2, color: "#16a34a" },
    { label: "Inactive Taxes", value: kpis.inactive + kpis.draft, icon: XCircle, color: "#8a929c" },
    { label: "Collected Today", value: money(kpis.collectedToday), icon: DollarSign, color: "#16a34a" },
    { label: "Collected This Month", value: money(kpis.collectedMonth), icon: Landmark, color: "#0891b2" },
    { label: "Countries Configured", value: kpis.countriesConfigured, icon: Globe, color: "#8b5cf6" },
  ] : [], [kpis]);

  const toggleSort = (col) => { if (sort === col) setOrder(o => o === "asc" ? "desc" : "asc"); else { setSort(col); setOrder("asc"); } setPage(1); };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em]", txt)}>Tax Management</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Configure and manage every tax rule applied across the platform.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openCreate} className="h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors flex items-center gap-2"><Plus className="w-4 h-4" /> Add Tax</button>
          <button onClick={() => importRef.current?.click()} className={btnGhost}><Upload className="w-4 h-4" /> Import</button>
          <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => e.target.files?.[0] && importCsv(e.target.files[0])} />
          <button onClick={exportCsv} className={btnGhost}><Download className="w-4 h-4" /> Export</button>
          <button onClick={refresh} className={btnGhost}><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh</button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpiCards.length === 0
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className={cn("rounded-[14px] border p-3 animate-pulse h-[84px]", p, brd)} />)
          : kpiCards.map(k => (
            <div key={k.label} className={cn("rounded-[14px] border p-3.5", p, brd)}>
              <div className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-2" style={{ backgroundColor: `${k.color}1a` }}>
                <k.icon className="w-4 h-4" style={{ color: k.color }} />
              </div>
              <p className={cn("text-[19px] font-extrabold tracking-[-.02em]", txt)}>{k.value}</p>
              <p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p>
            </div>
          ))}
      </div>

      {/* FILTERS */}
      <div className={cn(cardCls, "p-3 flex flex-col lg:flex-row gap-2")}>
        <div className="relative flex-1">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", sub)} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, country, state or city…" className={cn(inpCls, "pl-9")} />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")}>
            <option value="">All Statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="draft">Draft</option>
          </select>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")}>
            <option value="">All Types</option>{TAX_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setPage(1); }} className={cn(inpCls, "w-auto")}>
            <option value="">All Countries</option>{countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* BULK BAR */}
      {selected.size > 0 && (
        <div className={cn(cardCls, "p-3 flex flex-wrap items-center gap-2")}>
          <span className={cn("text-sm font-bold mr-2", txt)}>{selected.size} selected</span>
          <button onClick={() => runBulk("enable", [...selected])} className="h-8 px-3 rounded-[9px] bg-emerald-500/10 text-emerald-600 text-xs font-bold hover:bg-emerald-500/20">Enable</button>
          <button onClick={() => runBulk("disable", [...selected])} className="h-8 px-3 rounded-[9px] bg-gray-500/10 text-gray-500 text-xs font-bold hover:bg-gray-500/20">Disable</button>
          <button onClick={() => runBulk("duplicate", [...selected])} className="h-8 px-3 rounded-[9px] bg-blue-500/10 text-blue-600 text-xs font-bold hover:bg-blue-500/20">Duplicate</button>
          <button onClick={() => runBulk("delete", [...selected])} className="h-8 px-3 rounded-[9px] bg-red-500/10 text-red-600 text-xs font-bold hover:bg-red-500/20">Delete</button>
          <button onClick={() => setSelected(new Set())} className={cn("h-8 px-3 rounded-[9px] text-xs font-bold", sub)}>Clear</button>
        </div>
      )}

      {/* TABLE */}
      <div className={cn(cardCls, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={cn("border-b", brd)}>
                <th className="p-3 w-10"><input type="checkbox" checked={rules.length > 0 && selected.size === rules.length} onChange={e => setSelected(e.target.checked ? new Set(rules.map(r => r.id)) : new Set())} className="rounded" /></th>
                {[["Tax Name", "name"], ["Country", "country"], ["State / City", null], ["Type", "tax_type"], ["Rate", "rate"], ["Priority", "priority"], ["Status", "status"], ["Created", "created_at"], ["", null]].map(([label, col]) => (
                  <th key={label} className={cn("p-3 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap", sub)}>
                    {col ? <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-[#2563eb]">{label}<ArrowUpDown className="w-3 h-3 opacity-40" /></button> : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className={cn("border-b", brd)}><td colSpan={10} className="p-3"><div className={cn("h-8 rounded-[8px] animate-pulse", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")} /></td></tr>
                ))
              ) : rules.length === 0 ? (
                <tr><td colSpan={10} className="p-12 text-center">
                  <Receipt className={cn("w-10 h-10 mx-auto mb-3", sub)} />
                  <p className={cn("text-sm font-bold", txt)}>No tax rules yet</p>
                  <p className={cn("text-xs mt-1", sub)}>Create your first tax rule to start collecting taxes.</p>
                  <button onClick={openCreate} className="mt-4 h-9 px-4 rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Tax</button>
                </td></tr>
              ) : rules.map(r => {
                const meta = STATUS_META[r.status] || STATUS_META.draft;
                return (
                  <tr key={r.id} className={cn("border-b transition-colors cursor-pointer", brd, hover)} onClick={() => openDetail(r.id)}>
                    <td className="p-3" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(r.id)} onChange={() => setSelected(s => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} className="rounded" /></td>
                    <td className="p-3">
                      <p className={cn("text-xs font-bold", txt)}>{r.name}</p>
                      <p className={cn("text-[10px] flex items-center gap-1", sub)}>{r.inclusive ? "Inclusive" : "Exclusive"} · {r.value_type === "fixed" ? "Fixed" : "Percentage"}</p>
                    </td>
                    <td className={cn("p-3 text-xs whitespace-nowrap", txt)}>{r.country}</td>
                    <td className={cn("p-3 text-xs whitespace-nowrap", sub)}>{[r.state, r.city].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="p-3 whitespace-nowrap"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", dark ? "bg-[#252c36] text-[#e7ebf0]" : "bg-[#f0f2f5] text-[#16181d]")}>{TAX_TYPE_LABEL[r.tax_type] || r.tax_type}</span></td>
                    <td className={cn("p-3 text-xs font-bold whitespace-nowrap", txt)}>{rateLabel(r)}</td>
                    <td className={cn("p-3 text-xs whitespace-nowrap", sub)}>{r.priority}</td>
                    <td className="p-3 whitespace-nowrap"><span className={cn("px-2 py-1 rounded-full text-[10px] font-bold", meta.cls)}>{meta.label}</span></td>
                    <td className={cn("p-3 text-xs whitespace-nowrap", sub)}>{fmtDate(r.created_at)}</td>
                    <td className="p-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => openDetail(r.id)} title="View" className={cn("w-7 h-7 rounded-[8px] flex items-center justify-center", hover)}><Eye className={cn("w-3.5 h-3.5", sub)} /></button>
                        <button onClick={() => openEdit(r)} title="Edit" className={cn("w-7 h-7 rounded-[8px] flex items-center justify-center", hover)}><Edit3 className={cn("w-3.5 h-3.5", sub)} /></button>
                        <button onClick={() => runBulk("duplicate", [r.id])} title="Duplicate" className={cn("w-7 h-7 rounded-[8px] flex items-center justify-center", hover)}><Copy className={cn("w-3.5 h-3.5", sub)} /></button>
                        <button onClick={() => toggleStatus(r)} title={r.status === "active" ? "Disable" : "Enable"} className={cn("w-7 h-7 rounded-[8px] flex items-center justify-center", hover)}><Power className={cn("w-3.5 h-3.5", r.status === "active" ? "text-emerald-500" : sub)} /></button>
                        <button onClick={() => setConfirmDel(r)} title="Delete" className="w-7 h-7 rounded-[8px] flex items-center justify-center hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className={cn("flex items-center justify-between p-3 border-t", brd)}>
            <span className={cn("text-xs", sub)}>{total} rule(s) — page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(x => x - 1)} className={cn("w-8 h-8 rounded-[9px] border flex items-center justify-center disabled:opacity-40", brd, hover)}><ChevronLeft className={cn("w-4 h-4", sub)} /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(x => x + 1)} className={cn("w-8 h-8 rounded-[9px] border flex items-center justify-center disabled:opacity-40", brd, hover)}><ChevronRight className={cn("w-4 h-4", sub)} /></button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT DRAWER */}
      <Drawer open={formOpen} onClose={() => setFormOpen(false)} title={editId ? "Edit Tax Rule" : "Add New Tax"} dark={dark} width="xl">
        <div className="p-4 space-y-4">
          {/* Basics */}
          <TaxCard dark={dark} icon={Receipt} title="Tax Details">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Tax Name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setField("name", e.target.value)} className={cn(inpCls, !form.name.trim() && "border-red-500/40")} placeholder="e.g. Haiti VAT" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Tax Type <span className="text-red-500">*</span></label>
                  <select value={form.tax_type} onChange={e => setField("tax_type", e.target.value)} className={inpCls}>{TAX_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </div>
                <div>
                  <label className={labelCls}>Calculation</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[["exclusive", "Exclusive", false], ["inclusive", "Inclusive", true]].map(([k, lbl, val]) => (
                      <button key={k} type="button" onClick={() => setField("inclusive", val)} className={cn("h-[42px] rounded-[11px] border-[1.5px] text-[12px] font-semibold transition-colors", form.inclusive === val ? "border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]" : cn(brd, sub, hover))}>{lbl}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Value Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[["percentage", "Percentage", Percent], ["fixed", "Fixed Amount", DollarSign]].map(([v, lbl, Ico]) => (
                      <button key={v} type="button" onClick={() => setField("value_type", v)} className={cn("h-[42px] rounded-[11px] border-[1.5px] text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors", form.value_type === v ? "border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]" : cn(brd, sub, hover))}><Ico className="w-3.5 h-3.5" /> {lbl}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Tax Value <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type="number" min={0} step="0.01" value={form.rate} onChange={e => setField("rate", e.target.value)} className={cn(inpCls, "pr-9")} placeholder={form.value_type === "fixed" ? "5.00" : "15"} />
                    <span className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold", sub)}>{form.value_type === "fixed" ? "$" : "%"}</span>
                  </div>
                </div>
              </div>
            </div>
          </TaxCard>

          {/* Region */}
          <TaxCard dark={dark} icon={Globe} title="Region">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Country <span className="text-red-500">*</span></label>
                <input list="tax-countries" value={form.country} onChange={e => setField("country", e.target.value)} className={cn(inpCls, !form.country.trim() && "border-red-500/40")} placeholder="Haiti" />
                <datalist id="tax-countries">{COMMON_COUNTRIES.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div><label className={labelCls}>State / Province</label><input value={form.state} onChange={e => setField("state", e.target.value)} className={inpCls} placeholder="Optional" /></div>
              <div><label className={labelCls}>City</label><input value={form.city} onChange={e => setField("city", e.target.value)} className={inpCls} placeholder="Optional" /></div>
              <div><label className={labelCls}>Postal Code</label><input value={form.postal_code} onChange={e => setField("postal_code", e.target.value)} className={inpCls} placeholder="Optional" /></div>
            </div>
          </TaxCard>

          {/* Scope */}
          <TaxCard dark={dark} icon={Layers} title="Scope & Conditions">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Applies To</label>
                  <select value={form.applies_to} onChange={e => setField("applies_to", e.target.value)} className={inpCls}>{APPLIES_TO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </div>
                <div>
                  <label className={labelCls}>Customer Type</label>
                  <select value={form.customer_type} onChange={e => setField("customer_type", e.target.value)} className={inpCls}>{CUSTOMER_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </div>
              </div>
              {["specific_categories", "specific_brands", "specific_products"].includes(form.applies_to) && (
                <div>
                  <label className={labelCls}>{form.applies_to === "specific_categories" ? "Category IDs" : form.applies_to === "specific_brands" ? "Brand IDs" : "Product IDs"} (comma-separated)</label>
                  <input
                    value={(form.applies_to === "specific_categories" ? form.target_category_ids : form.applies_to === "specific_brands" ? form.target_brand_ids : form.target_product_ids).join(", ")}
                    onChange={e => {
                      const arr = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                      const key = form.applies_to === "specific_categories" ? "target_category_ids" : form.applies_to === "specific_brands" ? "target_brand_ids" : "target_product_ids";
                      setField(key, arr);
                    }}
                    className={inpCls} placeholder="uuid, uuid, …" />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><label className={labelCls}>Min Order ($)</label><input type="number" min={0} step="0.01" value={form.min_order} onChange={e => setField("min_order", e.target.value)} className={inpCls} placeholder="0" /></div>
                <div><label className={labelCls}>Max Order ($)</label><input type="number" min={0} step="0.01" value={form.max_order} onChange={e => setField("max_order", e.target.value)} className={inpCls} placeholder="No limit" /></div>
                <div><label className={labelCls}>Priority</label><input type="number" value={form.priority} onChange={e => setField("priority", e.target.value)} className={inpCls} placeholder="0" /></div>
              </div>
            </div>
          </TaxCard>

          {/* Status & dates */}
          <TaxCard dark={dark} icon={Calendar} title="Status & Schedule">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {[["active", "Active"], ["inactive", "Inactive"], ["draft", "Draft"]].map(([v, lbl]) => (
                    <button key={v} type="button" onClick={() => setField("status", v)} className={cn("h-[42px] rounded-[11px] border-[1.5px] text-[12px] font-semibold transition-colors", form.status === v ? "border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb]" : cn(brd, sub, hover))}>{lbl}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={labelCls}>Start Date</label><input type="datetime-local" value={form.start_date} onChange={e => setField("start_date", e.target.value)} className={inpCls} /></div>
                <div><label className={labelCls}>End Date</label><input type="datetime-local" value={form.end_date} onChange={e => setField("end_date", e.target.value)} className={inpCls} /></div>
              </div>
            </div>
          </TaxCard>

          {/* Description */}
          <TaxCard dark={dark} icon={FileText} title="Description">
            <div className="space-y-4">
              <div><label className={labelCls}>Internal Notes</label><textarea value={form.internal_notes} onChange={e => setField("internal_notes", e.target.value)} rows={2} className={cn("w-full rounded-[11px] border-[1.5px] p-3 text-sm outline-none resize-y", inp, "focus:border-[#2563eb]")} placeholder="Not shown to customers" /></div>
              <div><label className={labelCls}>Visible Description</label><textarea value={form.visible_description} onChange={e => setField("visible_description", e.target.value)} rows={2} className={cn("w-full rounded-[11px] border-[1.5px] p-3 text-sm outline-none resize-y", inp, "focus:border-[#2563eb]")} placeholder="Shown to customers at checkout" /></div>
            </div>
          </TaxCard>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setFormOpen(false)} className={cn("flex-1 h-[44px] rounded-[11px] border text-sm font-semibold", brd, txt, hover)}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 h-[44px] rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}{saving ? "Saving…" : editId ? "Update Tax" : "Create Tax"}
            </button>
          </div>
        </div>
      </Drawer>

      {/* DETAIL DRAWER */}
      <Drawer open={!!detail || detailLoading} onClose={() => setDetail(null)} title={detail ? detail.name : "Loading…"} dark={dark} width="lg">
        {detailLoading || !detail ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-[#2563eb]" /></div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold", (STATUS_META[detail.status] || STATUS_META.draft).cls)}>{(STATUS_META[detail.status] || STATUS_META.draft).label}</span>
              <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold", dark ? "bg-[#252c36] text-[#e7ebf0]" : "bg-[#f0f2f5] text-[#16181d]")}>{TAX_TYPE_LABEL[detail.tax_type] || detail.tax_type}</span>
              <span className={cn("text-lg font-extrabold ml-auto", txt)}>{rateLabel(detail)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Country", detail.country], ["State / City", [detail.state, detail.city].filter(Boolean).join(" / ") || "—"],
                ["Postal Code", detail.postal_code || "—"], ["Calculation", detail.inclusive ? "Inclusive" : "Exclusive"],
                ["Applies To", (APPLIES_TO.find(a => a[0] === detail.applies_to) || [, detail.applies_to])[1]],
                ["Customer Type", (CUSTOMER_TYPES.find(a => a[0] === detail.customer_type) || [, detail.customer_type])[1]],
                ["Min Order", detail.min_order ? money(detail.min_order) : "—"], ["Max Order", detail.max_order ? money(detail.max_order) : "No limit"],
                ["Priority", detail.priority], ["Created", fmtDT(detail.created_at)],
                ["Start Date", fmtDT(detail.start_date)], ["End Date", fmtDT(detail.end_date)],
              ].map(([k, v]) => (
                <div key={k} className={cn("rounded-[10px] border p-2.5", brd)}>
                  <p className={cn("text-[10px] font-bold uppercase tracking-wider", sub)}>{k}</p>
                  <p className={cn("text-sm font-semibold mt-0.5", txt)}>{v}</p>
                </div>
              ))}
            </div>
            {detail.visible_description && <div><p className={labelCls}>Visible Description</p><p className={cn("text-sm rounded-[10px] border p-3", brd, txt)}>{detail.visible_description}</p></div>}
            {detail.internal_notes && <div><p className={labelCls}>Internal Notes</p><p className={cn("text-sm rounded-[10px] border p-3", brd, sub)}>{detail.internal_notes}</p></div>}

            <div className="flex gap-2">
              <button onClick={() => { setDetail(null); openEdit(detail); }} className="flex-1 h-10 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] flex items-center justify-center gap-1.5"><Edit3 className="w-4 h-4" /> Edit</button>
              <button onClick={() => runBulk("duplicate", [detail.id])} className={cn("h-10 px-4 rounded-[11px] border text-sm font-semibold", brd, txt, hover)}><Copy className="w-4 h-4" /></button>
              <button onClick={() => { setDetail(null); setConfirmDel(detail); }} className="h-10 px-4 rounded-[11px] bg-red-500/10 text-red-500 text-sm font-semibold hover:bg-red-500/20"><Trash2 className="w-4 h-4" /></button>
            </div>

            {/* Audit log */}
            <div>
              <p className={cn("text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5", sub)}><History className="w-3.5 h-3.5" /> Audit Trail</p>
              {(detail.logs || []).length === 0 ? <p className={cn("text-xs", sub)}>No history yet.</p> : (
                <div className="space-y-1.5">
                  {detail.logs.map(l => (
                    <div key={l.id} className={cn("rounded-[9px] border p-2 flex items-center justify-between", brd)}>
                      <span className={cn("text-xs font-semibold capitalize", txt)}>{l.action}</span>
                      <span className={cn("text-[10px]", sub)}>{l.actor_name} · {fmtDT(l.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* DELETE CONFIRM */}
      {confirmDel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" onClick={() => setConfirmDel(null)} />
          <div className={cn("relative w-full max-w-sm rounded-[16px] border shadow-2xl p-6 animate-in zoom-in-95 duration-200", p, brd)}>
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3"><AlertTriangle className="w-5 h-5 text-red-500" /></div>
            <h3 className={cn("text-[16px] font-extrabold", txt)}>Delete “{confirmDel.name}”?</h3>
            <p className={cn("text-[13px] mt-1", sub)}>This tax rule will be removed. Past orders keep their recorded tax and are unaffected.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmDel(null)} className={cn("flex-1 h-[42px] rounded-[11px] border text-sm font-semibold", brd, txt, hover)}>Cancel</button>
              <button onClick={() => doDelete(confirmDel.id)} className="flex-1 h-[42px] rounded-[11px] bg-red-500 text-white text-sm font-semibold hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={cn("fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.message}</div>
      )}
    </div>
  );
}

function TaxCard({ dark, icon: Icon, title, children }) {
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const surface = dark ? "bg-[#1d242e]/40" : "bg-[#f6f8fb]";
  return (
    <div className={cn("rounded-[14px] border p-4", brd, surface)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-[#2563eb]" />
        <p className={cn("text-[13px] font-extrabold", txt)}>{title}</p>
      </div>
      {children}
    </div>
  );
}
