// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Truck, Package, MapPin, Globe, Clock, DollarSign, Search, Plus,
  ChevronLeft, ChevronRight, Edit3, Trash2, Download, RefreshCw,
  ArrowUpDown, Star, BarChart3, Eye, Check, X, Send, RotateCcw,
  Building2, Route, Tag, Layers, TrendingUp, AlertTriangle, Zap,
  Navigation, Box, Warehouse, Shield, Hash, Filter, ChevronDown,
  CheckCircle2, XCircle, Timer, Plane, Ship, Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";

const STATUS_MAP: Record<string, { label: string; color: string; darkColor: string }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700", darkColor: "bg-amber-900/40 text-amber-300" },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-700", darkColor: "bg-blue-900/40 text-blue-300" },
  shipped: { label: "Shipped", color: "bg-indigo-100 text-indigo-700", darkColor: "bg-indigo-900/40 text-indigo-300" },
  delivered: { label: "Delivered", color: "bg-emerald-100 text-emerald-700", darkColor: "bg-emerald-900/40 text-emerald-300" },
  returned: { label: "Returned", color: "bg-red-100 text-red-700", darkColor: "bg-red-900/40 text-red-300" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600", darkColor: "bg-gray-800 text-gray-400" },
};

const STATUSES = ["all", "pending", "processing", "shipped", "delivered", "returned", "cancelled"];

const METHOD_TYPES = [
  "flat_rate", "free_shipping", "weight_based", "price_based", "distance_based",
  "express", "standard", "pickup", "local_delivery", "cod", "custom",
];

const TABS = [
  { key: "shipments", label: "Shipments", icon: Truck },
  { key: "zones", label: "Zones", icon: MapPin },
  { key: "methods", label: "Methods", icon: Route },
  { key: "carriers", label: "Carriers", icon: Plane },
  { key: "rates", label: "Rates", icon: DollarSign },
  { key: "warehouses", label: "Warehouses", icon: Warehouse },
];

export function AdminShipping({ dark }: { dark: boolean }) {
  const [kpis, setKpis] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("shipments");
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);

  const [zones, setZones] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const [detailDrawer, setDetailDrawer] = useState<any>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [createDrawer, setCreateDrawer] = useState<string | null>(null);
  const [analyticsDrawer, setAnalyticsDrawer] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const api = useCallback(async (method: string, params?: any) => {
    const isGet = method === "GET";
    const url = isGet ? `/api/admin/shipping?${new URLSearchParams(params).toString()}` : "/api/admin/shipping";
    const res = await fetch(url, isGet ? undefined : {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(params),
    });
    return res.json();
  }, []);

  const loadKpis = useCallback(async () => { setKpis(await api("GET", { section: "kpis" })); }, [api]);

  const loadShipments = useCallback(async () => {
    setLoading(true);
    const params: any = { section: "shipments", page: String(page), limit: String(limit), sortBy, sortDir };
    if (search) params.search = search;
    if (statusFilter !== "all") params.status = statusFilter;
    if (carrierFilter) params.carrier = carrierFilter;
    if (methodFilter) params.method = methodFilter;
    const data = await api("GET", params);
    setRows(data.rows || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [api, page, limit, search, statusFilter, carrierFilter, methodFilter, sortBy, sortDir]);

  const loadMeta = useCallback(async () => {
    const [z, m, c, r, w] = await Promise.all([
      api("GET", { section: "zones" }),
      api("GET", { section: "methods" }),
      api("GET", { section: "carriers" }),
      api("GET", { section: "rates" }),
      api("GET", { section: "warehouses" }),
    ]);
    setZones(z.zones || []);
    setMethods(m.methods || []);
    setCarriers(c.carriers || []);
    setRates(r.rates || []);
    setWarehouses(w.warehouses || []);
  }, [api]);

  useEffect(() => { loadKpis(); loadMeta(); }, [loadKpis, loadMeta]);
  useEffect(() => { if (activeTab === "shipments") loadShipments(); }, [loadShipments, activeTab]);

  const openDetail = async (id: string) => {
    const data = await api("GET", { section: "detail", id });
    setDetailDrawer(data);
    setDetailTab("overview");
  };

  const openCreate = (type: string) => {
    const defaults: Record<string, any> = {
      zone: { name: "", countries: "", states: "", cities: "", zip_codes: "", priority: 0, is_active: true },
      method: { name: "", type: "flat_rate", description: "", is_active: true, min_order: "", max_order: "", min_weight: "", max_weight: "", base_cost: 0, free_shipping_threshold: "", estimated_days: "" },
      carrier: { name: "", code: "", logo: "", tracking_url: "", api_key: "", api_secret: "", is_active: true, estimated_days: "", description: "" },
      rate: { zone_id: "", method_id: "", carrier_id: "", min_weight: "", max_weight: "", min_price: "", max_price: "", rate: 0, rate_type: "fixed" },
      warehouse: { name: "", address: "", city: "", state: "", country: "", zip_code: "", phone: "", email: "", is_active: true, is_default: false, type: "main" },
    };
    setForm(defaults[type] || {});
    setCreateDrawer(type);
  };

  const saveCreate = async () => {
    setSaving(true);
    const actionMap: Record<string, string> = {
      zone: "create_zone", method: "create_method", carrier: "create_carrier",
      rate: "create_rate", warehouse: "create_warehouse",
    };
    const payload = { action: actionMap[createDrawer!], ...form };
    if (createDrawer === "zone") {
      payload.countries = (form.countries || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      payload.states = (form.states || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      payload.cities = (form.cities || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      payload.zip_codes = (form.zip_codes || "").split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    await api("POST", payload);
    setSaving(false);
    setCreateDrawer(null);
    loadMeta();
    loadKpis();
  };

  const deleteItem = async (id: string, table: string) => {
    await fetch(`/api/admin/shipping?id=${id}&table=${table}`, { method: "DELETE" });
    loadMeta();
    loadKpis();
    if (table === "shipments") loadShipments();
  };

  const bulkAction = async (action: string, extra?: any) => {
    if (!selected.length) return;
    await api("PATCH", { action, ids: selected, ...extra });
    setSelected([]);
    loadShipments();
    loadKpis();
  };

  const addEvent = async (shipment_id: string, status: string, description: string) => {
    await api("POST", { action: "add_event", shipment_id, status, description });
    openDetail(shipment_id);
    loadShipments();
    loadKpis();
  };

  const loadAnalytics = async () => {
    const data = await api("GET", { section: "analytics" });
    setAnalytics(data);
    setAnalyticsDrawer(true);
  };

  const exportCsv = async () => {
    const data = await api("GET", { section: "export" });
    const r = data.rows || [];
    if (!r.length) return;
    const keys = Object.keys(r[0]);
    const csv = [keys.join(","), ...r.map((row: any) => keys.map(k => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shipping-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(1);
  };

  const toggleSelect = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(s => s.length === rows.length ? [] : rows.map(r => r.id));
  const totalPages = Math.ceil(total / limit);

  const kpiCards = kpis ? [
    { label: "Total Shipments", value: kpis.totalShipments, icon: Truck },
    { label: "Pending", value: kpis.pending, icon: Clock },
    { label: "Processing", value: kpis.processing, icon: Package },
    { label: "Shipped", value: kpis.shipped, icon: Send },
    { label: "Delivered", value: kpis.delivered, icon: CheckCircle2 },
    { label: "Returned", value: kpis.returned, icon: RotateCcw },
    { label: "Cancelled", value: kpis.cancelled, icon: XCircle },
    { label: "Avg Cost", value: `$${kpis.avgCost}`, icon: DollarSign },
    { label: "Avg Delivery", value: `${kpis.avgDeliveryDays}d`, icon: Timer },
    { label: "Revenue", value: `$${kpis.shippingRevenue?.toLocaleString()}`, icon: TrendingUp },
    { label: "Top Carrier", value: kpis.topCarrier, icon: Star },
    { label: "Success Rate", value: `${kpis.successRate}%`, icon: Shield },
  ] : [];

  const Skel = ({ w = "w-full", h = "h-5" }: { w?: string; h?: string }) => (
    <div className={cn(w, h, "rounded-[8px] animate-pulse", dark ? "bg-[#252c36]" : "bg-[#e5e7eb]")} />
  );

  const ItemCard = ({ item, fields, table, onEdit }: { item: any; fields: { key: string; label: string }[]; table: string; onEdit?: () => void }) => (
    <div className={cn("rounded-[12px] border p-4", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={cn("font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{item.name}</p>
          {item.description && <p className={cn("text-xs mt-0.5", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{item.description}</p>}
        </div>
        <div className="flex items-center gap-1">
          {item.is_active !== undefined && (
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold",
              item.is_active ? (dark ? "bg-emerald-900/40 text-emerald-300" : "bg-emerald-100 text-emerald-700") : (dark ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-600")
            )}>{item.is_active ? "Active" : "Inactive"}</span>
          )}
          <button onClick={() => deleteItem(item.id, table)} className="p-1 rounded text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(f => (
          <div key={f.key}>
            <p className={cn("text-[10px] font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{f.label}</p>
            <p className={cn("text-xs font-semibold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{String(item[f.key] ?? "—")}</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {kpis ? kpiCards.map((k, i) => (
          <div key={i} className={cn("rounded-[14px] border p-3", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
            <div className="flex items-center gap-2 mb-1">
              <k.icon className={cn("w-4 h-4", dark ? "text-[#8b95a3]" : "text-[#8a929c]")} />
              <span className={cn("text-[11px] font-medium truncate", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{k.label}</span>
            </div>
            <p className={cn("text-lg font-bold truncate", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{k.value}</p>
          </div>
        )) : Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={cn("rounded-[14px] border p-3 space-y-2", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
            <Skel w="w-2/3" h="h-3" /><Skel w="w-1/2" h="h-6" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className={cn("flex gap-1 overflow-x-auto pb-1")}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setActiveTab(t.key); setSelected([]); }}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-semibold whitespace-nowrap transition-all",
              activeTab === t.key ? "bg-[#2563eb] text-white" : dark ? "text-[#8b95a3] hover:bg-[#252c36]" : "text-[#8a929c] hover:bg-[#f4f6f9]"
            )}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Shipments Tab */}
      {activeTab === "shipments" && (
        <>
          <div className={cn("rounded-[14px] border p-4", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", dark ? "text-[#8b95a3]" : "text-[#8a929c]")} />
                <input className={cn("w-full pl-9 pr-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}
                  placeholder="Search tracking, order, customer..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              </div>
              <button onClick={loadAnalytics} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-[10px] border text-sm font-medium", dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]")}>
                <BarChart3 className="w-4 h-4" /> Analytics
              </button>
              <button onClick={exportCsv} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-[10px] border text-sm font-medium", dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]")}>
                <Download className="w-4 h-4" /> Export
              </button>
              <button onClick={() => { loadShipments(); loadKpis(); }} className={cn("p-2 rounded-[10px] border", dark ? "border-[#252c36] text-[#8b95a3]" : "border-[#eef0f3] text-[#8a929c]")}>
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {STATUSES.map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={cn("px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                    statusFilter === s ? "bg-[#2563eb] text-white border-[#2563eb]" : dark ? "border-[#252c36] text-[#8b95a3] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#8a929c] hover:bg-[#f4f6f9]"
                  )}>{s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}</button>
              ))}
              {carriers.length > 0 && (
                <select value={carrierFilter} onChange={e => { setCarrierFilter(e.target.value); setPage(1); }}
                  className={cn("px-2 py-1 rounded-[8px] border text-xs", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")}>
                  <option value="">All Carriers</option>
                  {carriers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              )}
            </div>

            {selected.length > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}>
                <span className={cn("text-xs font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{selected.length} selected</span>
                {[
                  { label: "Mark Shipped", action: () => bulkAction("update_status", { status: "shipped" }), color: "text-indigo-500" },
                  { label: "Mark Delivered", action: () => bulkAction("update_status", { status: "delivered" }), color: "text-emerald-500" },
                  { label: "Delete", action: () => bulkAction("delete"), color: "text-red-500" },
                ].map(b => (
                  <button key={b.label} onClick={b.action} className={cn("text-xs font-semibold px-2 py-1 rounded-[6px] hover:bg-black/5", b.color)}>{b.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Shipments Table */}
          <div className={cn("rounded-[14px] border overflow-hidden", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn("border-b", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                    <th className="p-3 w-10"><input type="checkbox" checked={selected.length === rows.length && rows.length > 0} onChange={toggleAll} className="rounded" /></th>
                    {[
                      { key: "tracking_number", label: "Tracking" },
                      { key: "order_id", label: "Order" },
                      { key: "customer_name", label: "Customer" },
                      { key: "carrier", label: "Carrier" },
                      { key: "shipping_method", label: "Method" },
                      { key: "country", label: "Destination" },
                      { key: "shipping_cost", label: "Cost" },
                      { key: "status", label: "Status" },
                      { key: "created_at", label: "Date" },
                    ].map(col => (
                      <th key={col.key} className={cn("p-3 text-left font-semibold cursor-pointer select-none", dark ? "text-[#8b95a3]" : "text-[#8a929c]")} onClick={() => toggleSort(col.key)}>
                        <span className="flex items-center gap-1">{col.label}{sortBy === col.key && <ArrowUpDown className="w-3 h-3" />}</span>
                      </th>
                    ))}
                    <th className={cn("p-3 text-right font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className={cn("border-b", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                      {Array.from({ length: 11 }).map((_, j) => <td key={j} className="p-3"><Skel h="h-4" /></td>)}
                    </tr>
                  )) : rows.length === 0 ? (
                    <tr><td colSpan={11} className={cn("p-12 text-center", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No shipments found</td></tr>
                  ) : rows.map(row => {
                    const st = STATUS_MAP[row.status] || STATUS_MAP.pending;
                    return (
                      <tr key={row.id} className={cn("border-b cursor-pointer transition-colors", dark ? "border-[#252c36] hover:bg-[#1c2230]" : "border-[#eef0f3] hover:bg-[#f8f9fb]")} onClick={() => openDetail(row.id)}>
                        <td className="p-3" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelect(row.id)} className="rounded" />
                        </td>
                        <td className={cn("p-3 font-mono text-xs font-semibold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{row.tracking_number || "—"}</td>
                        <td className={cn("p-3 text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{row.order_id || "—"}</td>
                        <td className={cn("p-3 font-medium", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{row.customer_name || "—"}</td>
                        <td className={cn("p-3", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{row.carrier || "—"}</td>
                        <td className={cn("p-3 text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{row.shipping_method || "—"}</td>
                        <td className={cn("p-3 text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{[row.city, row.country].filter(Boolean).join(", ") || "—"}</td>
                        <td className={cn("p-3 font-semibold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>${(row.shipping_cost || 0).toFixed(2)}</td>
                        <td className="p-3"><span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", dark ? st.darkColor : st.color)}>{st.label}</span></td>
                        <td className={cn("p-3 text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}</td>
                        <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                          <button onClick={() => deleteItem(row.id, "shipments")} className="p-1.5 rounded-[8px] text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className={cn("flex items-center justify-between px-4 py-3 border-t", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                <span className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
                <div className="flex items-center gap-1">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={cn("p-1.5 rounded-[8px]", dark ? "text-[#8b95a3]" : "text-[#8a929c]", page <= 1 && "opacity-40")}><ChevronLeft className="w-4 h-4" /></button>
                  <span className={cn("text-xs px-2", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{page}/{totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className={cn("p-1.5 rounded-[8px]", dark ? "text-[#8b95a3]" : "text-[#8a929c]", page >= totalPages && "opacity-40")}><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Zones Tab */}
      {activeTab === "zones" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className={cn("text-sm font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{zones.length} zones</p>
            <button onClick={() => openCreate("zone")} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold"><Plus className="w-4 h-4" /> New Zone</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {zones.length === 0 ? (
              <div className={cn("col-span-full rounded-[14px] border p-12 text-center", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
                <p className={cn("text-sm", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No shipping zones configured</p>
              </div>
            ) : zones.map(z => (
              <ItemCard key={z.id} item={z} table="shipping_zones" fields={[
                { key: "countries", label: "Countries" },
                { key: "priority", label: "Priority" },
              ]} />
            ))}
          </div>
        </div>
      )}

      {/* Methods Tab */}
      {activeTab === "methods" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className={cn("text-sm font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{methods.length} methods</p>
            <button onClick={() => openCreate("method")} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold"><Plus className="w-4 h-4" /> New Method</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {methods.length === 0 ? (
              <div className={cn("col-span-full rounded-[14px] border p-12 text-center", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
                <p className={cn("text-sm", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No shipping methods configured</p>
              </div>
            ) : methods.map(m => (
              <ItemCard key={m.id} item={m} table="shipping_methods" fields={[
                { key: "type", label: "Type" },
                { key: "base_cost", label: "Base Cost" },
                { key: "estimated_days", label: "Est. Days" },
                { key: "free_shipping_threshold", label: "Free Threshold" },
              ]} />
            ))}
          </div>
        </div>
      )}

      {/* Carriers Tab */}
      {activeTab === "carriers" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className={cn("text-sm font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{carriers.length} carriers</p>
            <button onClick={() => openCreate("carrier")} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold"><Plus className="w-4 h-4" /> New Carrier</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {carriers.length === 0 ? (
              <div className={cn("col-span-full rounded-[14px] border p-12 text-center", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
                <p className={cn("text-sm", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No carriers configured</p>
              </div>
            ) : carriers.map(c => (
              <ItemCard key={c.id} item={{ ...c, description: c.description || c.code }} table="shipping_carriers" fields={[
                { key: "code", label: "Code" },
                { key: "estimated_days", label: "Est. Days" },
                { key: "tracking_url", label: "Tracking URL" },
              ]} />
            ))}
          </div>
        </div>
      )}

      {/* Rates Tab */}
      {activeTab === "rates" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className={cn("text-sm font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{rates.length} rates</p>
            <button onClick={() => openCreate("rate")} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold"><Plus className="w-4 h-4" /> New Rate</button>
          </div>
          <div className={cn("rounded-[14px] border overflow-hidden", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={cn("border-b", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                    {["Zone", "Method", "Carrier", "Weight Range", "Price Range", "Rate", "Type", ""].map((h, i) => (
                      <th key={i} className={cn("p-3 text-left font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rates.length === 0 ? (
                    <tr><td colSpan={8} className={cn("p-8 text-center text-sm", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No rates configured</td></tr>
                  ) : rates.map(r => (
                    <tr key={r.id} className={cn("border-b", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                      <td className={cn("p-3", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{zones.find(z => z.id === r.zone_id)?.name || "—"}</td>
                      <td className={cn("p-3", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{methods.find(m => m.id === r.method_id)?.name || "—"}</td>
                      <td className={cn("p-3", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{carriers.find(c => c.id === r.carrier_id)?.name || "—"}</td>
                      <td className={cn("p-3 text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{r.min_weight || 0}–{r.max_weight || "∞"} kg</td>
                      <td className={cn("p-3 text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>${r.min_price || 0}–${r.max_price || "∞"}</td>
                      <td className={cn("p-3 font-semibold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>${r.rate}</td>
                      <td className={cn("p-3 text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{r.rate_type}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => deleteItem(r.id, "shipping_rates")} className="p-1 rounded text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Warehouses Tab */}
      {activeTab === "warehouses" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className={cn("text-sm font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{warehouses.length} warehouses</p>
            <button onClick={() => openCreate("warehouse")} className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold"><Plus className="w-4 h-4" /> New Warehouse</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {warehouses.length === 0 ? (
              <div className={cn("col-span-full rounded-[14px] border p-12 text-center", dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]")}>
                <p className={cn("text-sm", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No warehouses configured</p>
              </div>
            ) : warehouses.map(w => (
              <ItemCard key={w.id} item={{ ...w, description: [w.address, w.city, w.country].filter(Boolean).join(", ") }} table="warehouses" fields={[
                { key: "type", label: "Type" },
                { key: "phone", label: "Phone" },
                { key: "email", label: "Email" },
                { key: "is_default", label: "Default" },
              ]} />
            ))}
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <Drawer open={!!detailDrawer} onClose={() => setDetailDrawer(null)} dark={dark} width="lg">
        {detailDrawer && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className={cn("text-xl font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Shipment Details</h2>
                <p className={cn("text-sm font-mono mt-1", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{detailDrawer.tracking_number || "No tracking"}</p>
              </div>
              {detailDrawer.status && (() => { const st = STATUS_MAP[detailDrawer.status] || STATUS_MAP.pending; return <span className={cn("px-3 py-1 rounded-full text-xs font-semibold", dark ? st.darkColor : st.color)}>{st.label}</span>; })()}
            </div>

            <div className={cn("flex gap-1 border-b pb-0", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
              {["overview", "timeline", "actions"].map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={cn("px-3 py-2 text-sm font-semibold rounded-t-[8px] -mb-px border-b-2 transition-all",
                    detailTab === t ? "border-[#2563eb] text-[#2563eb]" : cn("border-transparent", dark ? "text-[#8b95a3]" : "text-[#8a929c]")
                  )}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
              ))}
            </div>

            {detailTab === "overview" && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Order ID", value: detailDrawer.order_id },
                  { label: "Customer", value: detailDrawer.customer_name },
                  { label: "Carrier", value: detailDrawer.carrier },
                  { label: "Method", value: detailDrawer.shipping_method },
                  { label: "Cost", value: `$${(detailDrawer.shipping_cost || 0).toFixed(2)}` },
                  { label: "Weight", value: detailDrawer.weight ? `${detailDrawer.weight} kg` : "—" },
                  { label: "Destination", value: [detailDrawer.address, detailDrawer.city, detailDrawer.state, detailDrawer.country].filter(Boolean).join(", ") || "—" },
                  { label: "ZIP Code", value: detailDrawer.zip_code || "—" },
                  { label: "Shipped At", value: detailDrawer.shipped_at ? new Date(detailDrawer.shipped_at).toLocaleString() : "—" },
                  { label: "Delivered At", value: detailDrawer.delivered_at ? new Date(detailDrawer.delivered_at).toLocaleString() : "—" },
                  { label: "Est. Delivery", value: detailDrawer.estimated_delivery ? new Date(detailDrawer.estimated_delivery).toLocaleDateString() : "—" },
                  { label: "Notes", value: detailDrawer.notes || "—" },
                ].map((item, i) => (
                  <div key={i} className={cn("rounded-[10px] border p-3", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
                    <p className={cn("text-[11px] font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{item.label}</p>
                    <p className={cn("font-semibold mt-0.5 text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{item.value || "—"}</p>
                  </div>
                ))}
              </div>
            )}

            {detailTab === "timeline" && (
              <div className="space-y-3">
                {detailDrawer.events?.length > 0 ? detailDrawer.events.map((ev: any, i: number) => {
                  const evSt = STATUS_MAP[ev.status];
                  return (
                    <div key={i} className={cn("flex gap-3 p-3 rounded-[10px] border", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", evSt ? (dark ? evSt.darkColor : evSt.color) : (dark ? "bg-[#252c36] text-[#8b95a3]" : "bg-[#f4f6f9] text-[#8a929c]"))}>
                        <Truck className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={cn("font-semibold text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{ev.status?.charAt(0).toUpperCase() + ev.status?.slice(1)}</p>
                          <p className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{ev.created_at ? new Date(ev.created_at).toLocaleString() : "—"}</p>
                        </div>
                        {ev.description && <p className={cn("text-xs mt-0.5", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{ev.description}</p>}
                        {ev.location && <p className={cn("text-xs", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>📍 {ev.location}</p>}
                      </div>
                    </div>
                  );
                }) : (
                  <p className={cn("text-sm text-center py-8", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>No tracking events yet.</p>
                )}
              </div>
            )}

            {detailTab === "actions" && (
              <div className="space-y-3">
                <p className={cn("text-xs font-bold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Update Status</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(STATUS_MAP).map(([key, val]) => (
                    <button key={key} onClick={() => addEvent(detailDrawer.id, key, `Status updated to ${val.label}`)}
                      className={cn("px-3 py-2 rounded-[10px] text-sm font-semibold border transition-all",
                        detailDrawer.status === key ? "ring-2 ring-[#2563eb]" : "",
                        dark ? "border-[#252c36] text-[#e7ebf0] hover:bg-[#252c36]" : "border-[#eef0f3] text-[#16181d] hover:bg-[#f4f6f9]"
                      )}>{val.label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Create Drawer */}
      <Drawer open={!!createDrawer} onClose={() => setCreateDrawer(null)} dark={dark} width="lg">
        <div className="space-y-4">
          <h2 className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>
            Create {createDrawer?.charAt(0).toUpperCase()}{createDrawer?.slice(1)}
          </h2>

          {createDrawer === "zone" && (
            <>
              <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Zone Name *</label>
                <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              {["countries", "states", "cities", "zip_codes"].map(f => (
                <div key={f}><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{f.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())} (comma separated)</label>
                  <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form[f] || ""} onChange={e => setForm({ ...form, [f]: e.target.value })} /></div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Priority</label>
                  <input type="number" className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.priority || 0} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} /></div>
                <div className="flex items-end"><label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                  <span className={cn("text-sm font-medium", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Active</span>
                </label></div>
              </div>
            </>
          )}

          {createDrawer === "method" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Name *</label>
                  <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Type</label>
                  <select className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.type || "flat_rate"} onChange={e => setForm({ ...form, type: e.target.value })}>
                    {METHOD_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select></div>
              </div>
              <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Description</label>
                <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: "base_cost", label: "Base Cost ($)", type: "number" },
                  { key: "estimated_days", label: "Est. Days", type: "number" },
                  { key: "min_order", label: "Min Order ($)", type: "number" },
                  { key: "max_order", label: "Max Order ($)", type: "number" },
                  { key: "min_weight", label: "Min Weight (kg)", type: "number" },
                  { key: "max_weight", label: "Max Weight (kg)", type: "number" },
                  { key: "free_shipping_threshold", label: "Free Ship Threshold ($)", type: "number" },
                ].map(f => (
                  <div key={f.key}><label className={cn("text-[11px] font-medium", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{f.label}</label>
                    <input type={f.type} className={cn("w-full mt-1 px-3 py-1.5 rounded-[8px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form[f.key] || ""} onChange={e => setForm({ ...form, [f.key]: e.target.value ? parseFloat(e.target.value) : "" })} /></div>
                ))}
              </div>
            </>
          )}

          {createDrawer === "carrier" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Name *</label>
                  <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Code</label>
                  <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.code || ""} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="auto-generated" /></div>
              </div>
              {["logo", "tracking_url", "description"].map(f => (
                <div key={f}><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{f.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</label>
                  <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form[f] || ""} onChange={e => setForm({ ...form, [f]: e.target.value })} /></div>
              ))}
              <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Est. Delivery Days</label>
                <input type="number" className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.estimated_days || ""} onChange={e => setForm({ ...form, estimated_days: e.target.value ? parseInt(e.target.value) : "" })} /></div>
            </>
          )}

          {createDrawer === "rate" && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Zone</label>
                <select className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.zone_id || ""} onChange={e => setForm({ ...form, zone_id: e.target.value })}>
                  <option value="">Select zone</option>{zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select></div>
              <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Method</label>
                <select className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.method_id || ""} onChange={e => setForm({ ...form, method_id: e.target.value })}>
                  <option value="">Select method</option>{methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select></div>
              <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Carrier</label>
                <select className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.carrier_id || ""} onChange={e => setForm({ ...form, carrier_id: e.target.value })}>
                  <option value="">Select carrier</option>{carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Rate Type</label>
                <select className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.rate_type || "fixed"} onChange={e => setForm({ ...form, rate_type: e.target.value })}>
                  {["fixed", "percentage", "per_kg", "per_item"].map(t => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select></div>
              {[
                { key: "rate", label: "Rate ($)" },
                { key: "min_weight", label: "Min Weight (kg)" },
                { key: "max_weight", label: "Max Weight (kg)" },
                { key: "min_price", label: "Min Price ($)" },
                { key: "max_price", label: "Max Price ($)" },
              ].map(f => (
                <div key={f.key}><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{f.label}</label>
                  <input type="number" className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form[f.key] || ""} onChange={e => setForm({ ...form, [f.key]: e.target.value ? parseFloat(e.target.value) : "" })} /></div>
              ))}
            </div>
          )}

          {createDrawer === "warehouse" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Name *</label>
                  <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Type</label>
                  <select className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form.type || "main"} onChange={e => setForm({ ...form, type: e.target.value })}>
                    {["main", "cj", "usa", "europe", "asia", "custom"].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select></div>
              </div>
              {["address", "city", "state", "country", "zip_code", "phone", "email"].map(f => (
                <div key={f}><label className={cn("text-xs font-semibold", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>{f.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</label>
                  <input className={cn("w-full mt-1 px-3 py-2 rounded-[10px] border text-sm", dark ? "bg-[#0f1318] border-[#252c36] text-[#e7ebf0]" : "bg-[#f4f6f9] border-[#eef0f3] text-[#16181d]")} value={form[f] || ""} onChange={e => setForm({ ...form, [f]: e.target.value })} /></div>
              ))}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_default || false} onChange={e => setForm({ ...form, is_default: e.target.checked })} className="rounded" />
                  <span className={cn("text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Default Warehouse</span>
                </label>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setCreateDrawer(null)} className={cn("px-4 py-2 rounded-[10px] text-sm font-semibold border", dark ? "border-[#252c36] text-[#8b95a3]" : "border-[#eef0f3] text-[#8a929c]")}>Cancel</button>
            <button onClick={saveCreate} disabled={saving || !form.name} className="px-4 py-2 rounded-[10px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-40">
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </Drawer>

      {/* Analytics Drawer */}
      <Drawer open={analyticsDrawer} onClose={() => setAnalyticsDrawer(false)} dark={dark} width="lg">
        <div className="space-y-5">
          <h2 className={cn("text-lg font-bold", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>Shipping Analytics</h2>
          {analytics ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className={cn("rounded-[10px] border p-3", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
                  <p className={cn("text-[11px]", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Total Shipments</p>
                  <p className={cn("font-bold text-lg", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{analytics.totalShipments}</p>
                </div>
                <div className={cn("rounded-[10px] border p-3", dark ? "bg-[#0f1318] border-[#252c36]" : "bg-[#f8f9fb] border-[#eef0f3]")}>
                  <p className={cn("text-[11px]", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Delayed</p>
                  <p className="font-bold text-lg text-amber-500">{analytics.delayedCount}</p>
                </div>
              </div>

              {analytics.byCarrier && Object.keys(analytics.byCarrier).length > 0 && (
                <div>
                  <p className={cn("text-xs font-bold mb-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Performance by Carrier</p>
                  <div className="space-y-2">
                    {Object.entries(analytics.byCarrier).map(([name, data]: [string, any]) => (
                      <div key={name} className={cn("flex items-center justify-between px-3 py-2 rounded-[8px] border", dark ? "border-[#252c36]" : "border-[#eef0f3]")}>
                        <span className={cn("font-semibold text-sm", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{name}</span>
                        <div className="flex items-center gap-4 text-xs">
                          <span className={dark ? "text-[#8b95a3]" : "text-[#8a929c]"}>{data.count} shipments</span>
                          <span className="text-emerald-500">{data.delivered} delivered</span>
                          <span className={dark ? "text-[#8b95a3]" : "text-[#8a929c]"}>${data.cost.toFixed(0)} revenue</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics.byCountry && Object.keys(analytics.byCountry).length > 0 && (
                <div>
                  <p className={cn("text-xs font-bold mb-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>Shipments by Country</p>
                  <div className="space-y-1">
                    {Object.entries(analytics.byCountry).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10).map(([country, count]: [string, any]) => (
                      <div key={country} className="flex items-center gap-3">
                        <span className={cn("text-xs w-24 truncate", dark ? "text-[#e7ebf0]" : "text-[#16181d]")}>{country}</span>
                        <div className={cn("flex-1 h-5 rounded-full overflow-hidden", dark ? "bg-[#252c36]" : "bg-[#f4f6f9]")}>
                          <div className="h-full bg-[#2563eb] rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${Math.max(10, (count / analytics.totalShipments) * 100)}%` }}>
                            <span className="text-[10px] font-bold text-white">{count}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics.byMethod && Object.keys(analytics.byMethod).length > 0 && (
                <div>
                  <p className={cn("text-xs font-bold mb-2", dark ? "text-[#8b95a3]" : "text-[#8a929c]")}>By Shipping Method</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(analytics.byMethod).map(([method, count]: [string, any]) => (
                      <span key={method} className={cn("px-3 py-1 rounded-full text-xs font-medium", dark ? "bg-[#252c36] text-[#8b95a3]" : "bg-[#f4f6f9] text-[#8a929c]")}>{method}: {count}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} h="h-16" />)}</div>
          )}
        </div>
      </Drawer>
    </div>
  );
}
