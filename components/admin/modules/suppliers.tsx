// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Boxes, LayoutDashboard, Store, Plug, Search, PackageSearch, ListChecks,
  ShoppingCart, Warehouse, DollarSign, Truck, FolderTree, ScrollText, Activity,
  Loader2, X, Plus, RefreshCw, PlugZap, Power, Download, CheckCircle2, XCircle,
  AlertTriangle, ChevronRight, ChevronLeft, Copy, Trash2, Package, Image as ImageIcon,
} from "lucide-react";

type Props = { dark: boolean; initialView?: string; focusSupplier?: string };

const NAV = [
  ["dashboard", "Dashboard", LayoutDashboard], ["suppliers", "Suppliers", Store], ["supplier", "Supplier", Plug],
  ["explorer", "Products Explorer", PackageSearch], ["queue", "Import Queue", ListChecks], ["orders", "Orders Sync", ShoppingCart],
  ["inventory", "Inventory Sync", Warehouse], ["pricing", "Pricing Rules", DollarSign], ["categories", "Categories Mapping", FolderTree],
  ["logs", "Logs", ScrollText], ["monitor", "API Monitor", Activity],
];
const WIZARD_STEPS = ["Information", "Images", "Variants", "Pricing", "SEO", "Shipping", "Inventory", "Classification", "Review", "Publish"];
const PAGE_ORDER = ["women", "men", "kids", "curve", "quickship", "beauty", "home"];
// Marketing sections → underlying product flag/tag. Fully data-agnostic on the storefront.
const MARKETING = [
  { key: "is_new", label: "New Arrivals" },
  { key: "is_best_seller", label: "Best Sellers" },
  { key: "is_trending", label: "Trending Now" },
  { key: "is_featured", label: "Top Ranking Items" },
  { key: "super_deal", label: "Super Deal" },
  { key: "flash_sale", label: "Flash Sale" },
  { key: "flash_deals", label: "Flash Deals" },
];

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function timeAgo(d) { if (!d) return "never"; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; }

export function AdminSuppliers({ dark, initialView, focusSupplier }: Props) {
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

  const [view, setView] = useState(initialView || "dashboard");
  const [supplier, setSupplier] = useState(focusSupplier || "cj");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [dash, setDash] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [overview, setOverview] = useState(null);
  const [explorer, setExplorer] = useState({ q: "", products: [], total: 0, loading: false, message: "" });
  const [detail, setDetail] = useState(null);
  const [wizard, setWizard] = useState(null);
  const [wizStep, setWizStep] = useState(0);
  const [queue, setQueue] = useState([]);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [cats, setCats] = useState([]);
  const [logs, setLogs] = useState({ logs: [], total: 0, page: 1 });
  const [monitor, setMonitor] = useState(null);
  const [secretModal, setSecretModal] = useState(null);
  // Classification data (all loaded from DB — nothing hardcoded)
  const [classify, setClassify] = useState({ pages: [], cats: [], subcats: [], collections: [] });
  const [subSearch, setSubSearch] = useState("");
  const [beautyTab, setBeautyTab] = useState("");

  // Load the pages (from men_page_settings) + real categories once.
  useEffect(() => {
    const sb = createClient();
    (async () => {
      try {
        const [{ data: settings }, { data: categories }] = await Promise.all([
          sb.from("men_page_settings").select("id, seo_slug"),
          sb.from("categories").select("id, slug, name"),
        ]);
        const pages = (settings || []).sort((a, b) => {
          const ia = PAGE_ORDER.indexOf(a.id), ib = PAGE_ORDER.indexOf(b.id);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        });
        setClassify(c => ({ ...c, pages, cats: categories || [] }));
      } catch {}
    })();
  }, []);

  // When a main category is picked, load its sub-categories + collections live.
  useEffect(() => {
    const pg = wizard?.page; setSubSearch(""); setBeautyTab("");
    if (!pg) { setClassify(c => ({ ...c, subcats: [], collections: [] })); return; }
    const sb = createClient();
    (async () => {
      try {
        const [{ data: sc }, { data: col }] = await Promise.all([
          sb.from("men_shop_categories").select("id, name, tab, linked_category_id, category:categories(slug)").eq("page", pg).eq("is_active", true).order("tab").order("sort_order"),
          sb.from("men_collections").select("id, name").eq("page", pg).eq("is_active", true).order("sort_order"),
        ]);
        setClassify(c => ({ ...c, subcats: sc || [], collections: col || [] }));
      } catch {}
    })();
  }, [wizard?.page]);

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3200); }, []);
  const api = useCallback(async (path, opts) => {
    const res = await fetch(`/api${path}`, opts);
    const data = (res.headers.get("content-type") || "").includes("json") ? await res.json() : {};
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, []);
  const sapi = useCallback((path, opts) => api(`/suppliers/${supplier}${path}`, opts), [api, supplier]);

  const loadDash = useCallback(async () => { try { setDash(await api("/suppliers?section=dashboard")); } catch {} }, [api]);
  const loadSuppliers = useCallback(async () => { try { const r = await api("/suppliers?section=list"); setSuppliers(r.suppliers || []); } catch {} }, [api]);
  const [overviewErr, setOverviewErr] = useState(null);
  const loadOverview = useCallback(async () => { setOverviewErr(null); try { setOverview(await sapi("/overview")); } catch (e) { setOverviewErr(e.message || "Failed to load"); } }, [sapi]);

  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadDash(), loadSuppliers()]); setLoading(false); })(); }, [loadDash, loadSuppliers]);
  useEffect(() => {
    if (view === "dashboard") loadDash(); if (view === "suppliers") loadSuppliers(); if (view === "supplier") loadOverview();
    if (view === "queue") sapi("/queue").then(r => setQueue(r.jobs || [])).catch(() => {});
    if (view === "orders") sapi("/orders").then(r => setOrders(r.orders || [])).catch(() => {});
    if (view === "inventory") sapi("/inventory").then(r => setInventory(r.inventory || [])).catch(() => {});
    if (view === "pricing") sapi("/pricing-rules").then(r => setPricing(r.rules || [])).catch(() => {});
    if (view === "categories") sapi("/categories").then(r => setCats(r.categories || [])).catch(() => {});
    if (view === "logs") sapi("/logs?page=1").then(r => setLogs(r)).catch(() => {});
    if (view === "monitor") sapi("/api-monitor").then(r => setMonitor(r)).catch(() => {});
  }, [view, supplier]); // eslint-disable-line

  const post = async (path, body, okMsg, after) => {
    setBusy(path);
    try { const r = await sapi(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }); if (okMsg) showToast(typeof okMsg === "function" ? okMsg(r) : okMsg); if (after) await after(r); return r; }
    catch (e) { showToast(e.message, "error"); } finally { setBusy(null); }
  };

  const search = async (page = 1) => {
    setExplorer(e => ({ ...e, loading: true, message: "" }));
    try { const r = await sapi(`/search?q=${encodeURIComponent(explorer.q)}&page=${page}`); setExplorer(e => ({ ...e, products: r.products || [], total: r.total || 0, loading: false, message: r.ok ? "" : (r.message || "") })); }
    catch (e) { setExplorer(x => ({ ...x, loading: false, message: e.message })); }
  };
  const openWizard = async (external_id) => {
    setWizStep(0); setWizard({ loading: true });
    try { const r = await sapi(`/product?id=${external_id}`); if (!r.ok && !r.product) { showToast(r.message || "Cannot load product", "error"); setWizard(null); return; }
      const pr = r.product; setWizard({ external_id, name: pr.name, slug: "", description: pr.description || pr.name, category_id: "", brand_id: "", tags: "", price: null, compare_price: null, supplier_price: pr.supplier_price, images: pr.images || (pr.main_image ? [pr.main_image] : []), meta_title: pr.name, meta_description: (pr.description || "").slice(0, 160), is_featured: false, is_new: true, is_trending: false, is_best_seller: false, flash_sale: false, super_deal: false, flash_deals: false, page: "", subcat: "", collections: [], status: "draft", variants: pr.variants || [], detail: pr }); }
    catch (e) { showToast(e.message, "error"); setWizard(null); }
  };
  const publish = async () => {
    const w = wizard;
    // Resolve the real category id: chosen sub-category's linked category wins,
    // else the page's own top-level category (slug === page id).
    const sc = classify.subcats.find(s => s.id === w.subcat);
    const pageCat = classify.cats.find(c => c.slug === w.page);
    const categoryId = w.category_id || sc?.linked_category_id || pageCat?.id || undefined;
    // Merge tags: manual tags + selected sub-category + collections + super-deal marker.
    const collNames = (w.collections || []).map(id => (classify.collections.find(c => c.id === id)?.name)).filter(Boolean);
    const tags = [
      ...(w.tags ? w.tags.split(",").map(x => x.trim()) : []),
      ...(sc ? [sc.name] : []),
      ...collNames,
      ...(w.super_deal ? ["super-deal"] : []),
    ].filter(Boolean);
    const isQuick = w.page === "quickship";
    const totalStock = (w.variants || []).reduce((a, v) => a + (v.stock || 0), 0);
    const overrides = { name: w.name, slug: w.slug || undefined, description: w.description, category_id: categoryId, brand_id: w.brand_id || undefined, tags: tags.length ? tags : undefined, price: w.price ?? undefined, compare_price: w.compare_price ?? undefined, supplier_price: w.supplier_price, images: w.images, meta_title: w.meta_title, meta_description: w.meta_description,
      is_featured: !!w.is_featured, is_new: !!w.is_new, is_trending: !!w.is_trending, is_best_seller: !!w.is_best_seller, flash_sale: !!(w.flash_sale || w.flash_deals),
      is_quickship: isQuick, local_stock: isQuick ? (totalStock || 20) : undefined, delivery_hours: isQuick ? 48 : undefined,
      status: w.status, variants: w.variants, detail: w.detail };
    await post("/import", { external_id: w.external_id, overrides }, (r) => `Imported → product created`, () => { setWizard(null); loadDash(); });
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;

  const K = dash?.kpis || {};
  const kpis = [
    { label: "Connected", value: K.connectedSuppliers }, { label: "Configured", value: K.configuredSuppliers }, { label: "API Status", value: K.apiStatus, c: K.apiStatus === "operational" ? "#16a34a" : undefined },
    { label: "Products Imported", value: K.productsImported }, { label: "Products Synced", value: K.productsSynced }, { label: "Orders Sent", value: K.ordersSent },
    { label: "Orders Failed", value: K.ordersFailed, c: K.ordersFailed ? "#dc2626" : undefined }, { label: "Inventory Updated", value: K.inventoryUpdated }, { label: "Images Imported", value: K.imagesImported },
    { label: "Categories Synced", value: K.categoriesSynced }, { label: "Avg Sync", value: `${K.avgSyncTime || 0}ms` }, { label: "API Requests Today", value: K.apiRequestsToday },
    { label: "Webhook Events", value: K.webhookEvents }, { label: "Last Sync", value: timeAgo(K.lastSync) },
  ];
  const sup = suppliers.find(x => x.id === supplier);
  const jobBadge = (st) => <span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ backgroundColor: st === "completed" ? "#16a34a1a" : st === "failed" ? "#dc26261a" : st === "running" ? "#2563eb1a" : "#8a929c1a", color: st === "completed" ? "#16a34a" : st === "failed" ? "#dc2626" : st === "running" ? "#2563eb" : "#8a929c" }}>{st}</span>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Boxes className="w-5 h-5 text-[#2563eb]" /> Supplier Center</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Multi-supplier sourcing · active: <b className={txt}>{sup?.name || supplier}</b></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={supplier} onChange={e => setSupplier(e.target.value)} className={cn(inpCls, "w-auto h-9")}>{suppliers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        </div>
      </div>

      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {NAV.map(([id, l, I]) => <button key={id} onClick={() => setView(id)} className={cn("h-9 px-3 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", view === id ? "bg-[#2563eb] text-white" : cn(sub, hover))}><I className="w-3.5 h-3.5" /> {l}</button>)}
      </div>

      {/* DASHBOARD */}
      {view === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">{kpis.map(k => (
            <div key={k.label} className={cn(cardCls, "p-3.5")}><p className="text-[16px] font-extrabold capitalize truncate" style={{ color: k.c }}><span className={k.c ? "" : txt}>{k.value ?? 0}</span></p><p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p></div>
          ))}</div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b", sub, brd)}>Recent Activity</p>
            <div className={cn("divide-y max-h-72 overflow-y-auto", divide)}>
              {(dash.recent || []).length === 0 ? <p className={cn("p-4 text-xs", sub)}>No supplier activity yet.</p> :
                dash.recent.map((l, i) => <div key={i} className="px-4 py-2.5 flex items-center gap-2"><span className={cn("w-1.5 h-1.5 rounded-full shrink-0", l.status === "ok" ? "bg-emerald-500" : "bg-red-500")} /><span className={cn("text-xs font-semibold capitalize", txt)}>{l.supplier_id || supplier} · {l.action}</span><span className={cn("text-[10px] ml-auto", sub)}>{l.latency_ms ? `${l.latency_ms}ms · ` : ""}{timeAgo(l.created_at)}</span></div>)}
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIERS */}
      {view === "suppliers" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className={cn("border-b text-left", brd, sub)}>{["Supplier", "Country", "Status", "Products", "Orders", "API Health", "Last Sync", ""].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody className={cn("divide-y", divide)}>
              {suppliers.map(x => (
                <tr key={x.id} className={hover}>
                  <td className="px-3 py-2.5"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-[9px] flex items-center justify-center text-white font-extrabold text-xs" style={{ background: "#2563eb" }}>{x.name[0]}</div><span className={cn("font-semibold", txt)}>{x.name}</span></div></td>
                  <td className={cn("px-3 py-2.5", sub)}>{x.country}</td>
                  <td className="px-3 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: x.status === "connected" ? "#16a34a1a" : x.configured ? "#2563eb1a" : "#8a929c1a", color: x.status === "connected" ? "#16a34a" : x.configured ? "#2563eb" : "#8a929c" }}>{x.status === "connected" ? "Connected" : x.configured ? "Ready" : "Available"}</span></td>
                  <td className={cn("px-3 py-2.5", txt)}>{x.products}</td>
                  <td className={cn("px-3 py-2.5", txt)}>{x.orders}</td>
                  <td className={cn("px-3 py-2.5 capitalize", sub)}>{x.api_health}</td>
                  <td className={cn("px-3 py-2.5 text-[11px]", sub)}>{timeAgo(x.last_sync)}</td>
                  <td className="px-3 py-2.5"><button onClick={() => { setSupplier(x.id); setView("supplier"); }} className={btnGhost}>Manage</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* SUPPLIER (CJ) PAGE */}
      {view === "supplier" && !overview && (
        <div className={cn(cardCls, "p-8 flex flex-col items-center justify-center gap-3 text-center")}>
          {overviewErr ? (
            <>
              <XCircle className="w-8 h-8 text-red-400" />
              <p className={cn("text-sm font-bold", txt)}>Could not load {supplier?.toUpperCase()} supplier</p>
              <p className={cn("text-xs max-w-xs", sub)}>{overviewErr}</p>
              <button onClick={loadOverview} className={btnPrimary}><RefreshCw className="w-3.5 h-3.5" /> Retry</button>
            </>
          ) : (
            <><Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" /><p className={cn("text-xs", sub)}>Loading supplier…</p></>
          )}
        </div>
      )}
      {view === "supplier" && overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={cn(cardCls, "p-5 space-y-3")}>
            <div className="flex items-center gap-2"><PlugZap className="w-4 h-4 text-[#2563eb]" /><p className={cn("text-sm font-extrabold", txt)}>{overview.supplier?.name} Connection</p></div>
            {[["Status", overview.connection?.connected ? "Connected" : "Disconnected", overview.connection?.connected], ["Environment", overview.connection?.environment || "production", true], ["API Health", overview.connection?.api_health || "unknown", overview.connection?.api_health === "healthy"], ["Credentials", overview.configured ? "Configured" : `Missing: ${(overview.missing_env || []).join(", ")}`, overview.configured], ["Webhook", overview.connection?.webhook_status || "inactive", overview.connection?.webhook_status === "active"], ["Last API call", overview.connection?.last_api_call_at ? fmtDT(overview.connection.last_api_call_at) : "never", !!overview.connection?.last_api_call_at], ["Last sync", overview.connection?.last_sync_at ? fmtDT(overview.connection.last_sync_at) : "never", !!overview.connection?.last_sync_at]].map(([l, v, ok]) => (
              <div key={l} className="flex items-center gap-2.5">{ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}<div className="flex-1"><p className={cn("text-xs font-bold", txt)}>{l}</p><p className={cn("text-[11px] capitalize", sub)}>{v}</p></div></div>
            ))}
            <CredsForm supplier={supplier} creds={overview.creds} configured={overview.configured} post={post} reload={loadOverview} styles={{ brd, txt, sub, inpCls, labelCls, btnGhost, btnPrimary }} />
            <div className={cn("rounded-[10px] border p-3", brd)}><p className={cn("text-[11px] leading-relaxed", sub)}>🔒 Credentials are AES-256 encrypted and stored server-side — never shown again and never sent to the browser. Server env vars ({(overview.env_keys || []).map(k => <code key={k}>{k} </code>)}) still take precedence if set on o2switch.</p></div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => post("/test", {}, (r) => r.ok ? `Connected${r.latency ? ` · ${r.latency}ms` : ""}` : r.message, loadOverview)} disabled={busy === "/test"} className={btnGhost}>{busy === "/test" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />} Test Connection</button>
              {overview.connection?.connected ? <button onClick={() => post("/disconnect", {}, "Disconnected", loadOverview)} className={cn(btnGhost, "text-red-500")}><Power className="w-3.5 h-3.5" /> Disconnect</button> : <button onClick={() => post("/connect", {}, "Connected", loadOverview)} disabled={!overview.configured} className={btnPrimary}><Plug className="w-3.5 h-3.5" /> Connect</button>}
              <button onClick={() => post("/generate-webhook", { event: "order_shipped", url: `${location.origin}/api/webhooks/suppliers/${supplier}` }, null, (r) => r?.secret && setSecretModal(r.secret))} className={btnGhost}>Generate Webhook</button>
            </div>
          </div>
          <div className={cn(cardCls, "p-5 space-y-3")}>
            <p className={cn("text-sm font-extrabold", txt)}>Overview</p>
            <div className="grid grid-cols-3 gap-2">{[["Products", overview.stats?.products], ["Imported", overview.stats?.imported], ["Orders", overview.stats?.orders]].map(([l, v]) => <div key={l} className={cn("rounded-[10px] border p-3", brd)}><p className={cn("text-lg font-extrabold", txt)}>{v || 0}</p><p className={cn("text-[10px]", sub)}>{l}</p></div>)}</div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => setView("explorer")} className={btnPrimary}><PackageSearch className="w-3.5 h-3.5" /> Explore Products</button>
              <button onClick={() => post("/sync", { job_type: "inventory" }, (r) => r.ok ? `Synced ${r.updated || 0}` : r.message, () => setView("queue"))} disabled={busy === "/sync"} className={btnGhost}>{busy === "/sync" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync Inventory</button>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCTS EXPLORER */}
      {view === "explorer" && (
        <div className="space-y-3">
          <div className={cn(cardCls, "p-3 flex flex-wrap gap-2 items-center")}>
            <div className="relative flex-1 min-w-[200px]"><Search className={cn("w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2", sub)} /><input value={explorer.q} onChange={e => setExplorer(x => ({ ...x, q: e.target.value }))} onKeyDown={e => e.key === "Enter" && search(1)} className={cn(inpCls, "pl-9 h-9")} placeholder={`Search ${sup?.name || supplier} products…`} /></div>
            <button onClick={() => search(1)} disabled={explorer.loading} className={btnPrimary}>{explorer.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Search</button>
          </div>
          {explorer.message && <div className={cn("rounded-[12px] border p-3.5 flex gap-3", "border-amber-500/30 bg-amber-500/[.06]")}><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /><p className={cn("text-[12px]", sub)}>{explorer.message}</p></div>}
          {explorer.products.length === 0 && !explorer.message ? <div className={cn(cardCls, "p-10 text-center")}><PackageSearch className={cn("w-8 h-8 mx-auto mb-2", sub)} /><p className={cn("text-sm", sub)}>Search to explore live supplier products.</p></div> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {explorer.products.map(pr => (
                <div key={pr.external_id} className={cn(cardCls, "overflow-hidden flex flex-col")}>
                  <div className="aspect-square bg-black/5 overflow-hidden">{pr.image ? <img src={pr.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className={cn("w-8 h-8", sub)} /></div>}</div>
                  <div className="p-3 flex-1 flex flex-col">
                    <p className={cn("text-xs font-semibold line-clamp-2 flex-1", txt)}>{pr.name}</p>
                    <p className={cn("text-sm font-extrabold mt-1", txt)}>${(Number(pr.supplier_price) || 0).toFixed(2)}</p>
                    <button onClick={() => openWizard(pr.external_id)} className={cn(btnPrimary, "mt-2 w-full justify-center")}><Download className="w-3.5 h-3.5" /> Import</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* QUEUE */}
      {view === "queue" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}><p className={cn("text-sm font-extrabold", txt)}>Import & Sync Queue</p><button onClick={() => sapi("/queue").then(r => setQueue(r.jobs || []))} className={cn("text-xs flex items-center gap-1", sub)}><RefreshCw className="w-3.5 h-3.5" /> Refresh</button></div>
          <div className={cn("divide-y", divide)}>
            {queue.length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No jobs yet.</p> :
              queue.map(j => <div key={j.id} className="px-4 py-3"><div className="flex items-center justify-between"><div><p className={cn("text-sm font-bold capitalize", txt)}>{j.job_type} · {j.total} items</p><p className={cn("text-[10px]", sub)}>{j.detail || j.error || "—"} · {timeAgo(j.created_at)}</p></div><div className="flex items-center gap-2">{jobBadge(j.status)}{j.status === "failed" && <button onClick={() => post("/queue-action", { id: j.id, op: "retry" }, "Requeued", () => sapi("/queue").then(r => setQueue(r.jobs || [])))} className="text-[11px] font-bold text-[#2563eb]">Retry</button>}</div></div>{j.total > 0 && <div className={cn("mt-2 h-1.5 rounded-full overflow-hidden", dark ? "bg-[#1d242e]" : "bg-[#f0f2f5]")}><div className="h-full bg-[#2563eb] rounded-full" style={{ width: `${j.progress || 0}%` }} /></div>}</div>)}
          </div>
        </div>
      )}

      {/* ORDERS */}
      {view === "orders" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className={cn("border-b text-left", brd, sub)}>{["External ID", "Our Order", "Status", "Total", "Error", "Created"].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody className={cn("divide-y", divide)}>
              {orders.length === 0 ? <tr><td colSpan={6} className={cn("px-4 py-8 text-center text-xs", sub)}>No supplier orders yet. They're created automatically when customers order imported products.</td></tr> :
                orders.map(o => <tr key={o.id}><td className={cn("px-3 py-2.5 font-mono text-[11px]", txt)}>{o.external_order_id || "—"}</td><td className={cn("px-3 py-2.5", sub)}>{o.order_id || "—"}</td><td className="px-3 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold capitalize" style={{ backgroundColor: o.status === "created" ? "#16a34a1a" : o.status === "failed" ? "#dc26261a" : "#8a929c1a", color: o.status === "created" ? "#16a34a" : o.status === "failed" ? "#dc2626" : "#8a929c" }}>{o.status}</span></td><td className={cn("px-3 py-2.5", txt)}>${(Number(o.total) || 0).toFixed(2)}</td><td className={cn("px-3 py-2.5 text-[11px] text-red-500 truncate max-w-[160px]")}>{o.error || ""}</td><td className={cn("px-3 py-2.5 text-[11px]", sub)}>{fmtDT(o.created_at)}</td></tr>)}
            </tbody>
          </table></div>
        </div>
      )}

      {/* INVENTORY */}
      {view === "inventory" && (
        <div className="space-y-3">
          <div className="flex justify-end"><button onClick={() => post("/sync", { job_type: "inventory" }, (r) => r.ok ? `Synced ${r.updated || 0}` : r.message, () => sapi("/inventory").then(r => setInventory(r.inventory || [])))} disabled={busy === "/sync"} className={btnPrimary}>{busy === "/sync" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync Now</button></div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className={cn("border-b text-left", brd, sub)}>{["External ID", "Product", "Stock", "Supplier Price", "Synced"].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody className={cn("divide-y", divide)}>
                {inventory.length === 0 ? <tr><td colSpan={5} className={cn("px-4 py-8 text-center text-xs", sub)}>No inventory synced yet.</td></tr> :
                  inventory.map(iv => <tr key={iv.id}><td className={cn("px-3 py-2.5 font-mono text-[11px]", txt)}>{iv.external_id}</td><td className={cn("px-3 py-2.5", sub)}>{iv.product_id || "—"}</td><td className={cn("px-3 py-2.5", txt)}>{iv.stock}</td><td className={cn("px-3 py-2.5", txt)}>${(Number(iv.supplier_price) || 0).toFixed(2)}</td><td className={cn("px-3 py-2.5 text-[11px]", sub)}>{timeAgo(iv.synced_at)}</td></tr>)}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {/* PRICING RULES */}
      {view === "pricing" && (
        <div className="space-y-3">
          <div className="flex justify-end"><button onClick={() => post("/pricing-rule", { name: "New rule", rule_type: "markup_percent", value: 35, rounding: "0.99" }, "Rule added", () => sapi("/pricing-rules").then(r => setPricing(r.rules || [])))} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add Rule</button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pricing.map(r => (
              <div key={r.id} className={cn(cardCls, "p-4")}>
                <div className="flex items-center justify-between"><p className={cn("text-sm font-extrabold", txt)}>{r.name} {r.is_default && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 font-bold">default</span>}</p><button onClick={() => post("/pricing-rule", { op: "delete", id: r.id }, "Deleted", () => sapi("/pricing-rules").then(x => setPricing(x.rules || [])))} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div><span className={sub}>Type:</span> <span className={cn("font-bold", txt)}>{r.rule_type}</span></div>
                  <div><span className={sub}>Value:</span> <span className={cn("font-bold", txt)}>{r.value}</span></div>
                  <div><span className={sub}>Rounding:</span> <span className={cn("font-bold", txt)}>{r.rounding}</span></div>
                  <div><span className={sub}>Min profit:</span> <span className={cn("font-bold", txt)}>${r.min_profit || 0}</span></div>
                </div>
                <p className={cn("text-[11px] mt-2", sub)}>Example: $10 cost → <b className={txt}>${(r.rule_type === "markup_percent" ? (10 * (1 + r.value / 100)) : r.rule_type === "markup_fixed" ? 10 + r.value : r.value).toFixed(2).replace(/\.\d+$/, r.rounding === "0.99" ? ".99" : r.rounding === "9.99" ? "9.99" : m => m)}</b> sale price</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CATEGORIES MAPPING */}
      {view === "categories" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <p className={cn("px-4 py-3 text-sm font-extrabold border-b", txt, brd)}>Category Mapping</p>
          <div className={cn("divide-y", divide)}>
            {cats.length === 0 ? <p className={cn("p-6 text-center text-xs", sub)}>No categories yet. They populate after searching/importing products; the mapping is remembered per supplier.</p> :
              cats.map(c => <div key={c.id} className="px-4 py-2.5 flex items-center justify-between"><span className={cn("text-sm", txt)}>{c.external_category}</span><span className={cn("text-[11px]", c.mapped_category_id ? "text-emerald-600" : sub)}>{c.mapped_category_id ? "mapped" : "unmapped"}</span></div>)}
          </div>
        </div>
      )}

      {/* LOGS */}
      {view === "logs" && (
        <div className={cn(cardCls, "overflow-hidden")}>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className={cn("border-b text-left", brd, sub)}>{["Date", "Action", "Status", "Latency", "Error"].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody className={cn("divide-y", divide)}>
              {logs.logs.length === 0 ? <tr><td colSpan={5} className={cn("px-4 py-8 text-center text-xs", sub)}>No logs yet.</td></tr> :
                logs.logs.map(l => <tr key={l.id}><td className={cn("px-3 py-2.5 text-[11px]", sub)}>{fmtDT(l.created_at)}</td><td className={cn("px-3 py-2.5 font-semibold", txt)}>{l.action}</td><td className="px-3 py-2.5"><span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: l.status === "ok" ? "#16a34a1a" : "#dc26261a", color: l.status === "ok" ? "#16a34a" : "#dc2626" }}>{l.status}</span></td><td className={cn("px-3 py-2.5", sub)}>{l.latency_ms ? `${l.latency_ms}ms` : "—"}</td><td className={cn("px-3 py-2.5 text-[11px] text-red-500 truncate max-w-[200px]")}>{l.error || ""}</td></tr>)}
            </tbody>
          </table></div>
        </div>
      )}

      {/* API MONITOR */}
      {view === "monitor" && monitor && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">{[["API Calls (24h)", monitor.calls], ["Errors", monitor.errors], ["Avg Latency", `${monitor.avgLatency}ms`]].map(([l, v]) => <div key={l} className={cn(cardCls, "p-4")}><p className={cn("text-[22px] font-extrabold", txt)}>{v}</p><p className={cn("text-xs", sub)}>{l}</p></div>)}</div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <p className={cn("px-4 py-3 text-xs font-bold uppercase tracking-wider border-b", sub, brd)}>Recent Calls</p>
            <div className={cn("divide-y max-h-96 overflow-y-auto", divide)}>{(monitor.recent || []).map((l, i) => <div key={i} className="px-4 py-2 flex items-center gap-2 text-xs"><span className={cn("w-1.5 h-1.5 rounded-full", l.status === "ok" ? "bg-emerald-500" : "bg-red-500")} /><span className={cn("font-semibold", txt)}>{l.action}</span><span className={cn("ml-auto", sub)}>{l.latency_ms || 0}ms · {timeAgo(l.created_at)}</span></div>)}</div>
          </div>
        </div>
      )}

      {/* IMPORT WIZARD */}
      {wizard && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50" onClick={() => setWizard(null)}>
          <div className={cn("w-full max-w-2xl rounded-[18px] border p-5 space-y-4 max-h-[92vh] overflow-y-auto", p, brd)} onClick={e => e.stopPropagation()}>
            {wizard.loading ? <div className="p-10 flex justify-center"><Loader2 className={cn("w-6 h-6 animate-spin", sub)} /></div> : (<>
              <div className="flex items-center justify-between"><p className={cn("text-base font-extrabold", txt)}>Import Wizard · Step {wizStep + 1}/10 — {WIZARD_STEPS[wizStep]}</p><button onClick={() => setWizard(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
              <div className="flex gap-1">{WIZARD_STEPS.map((_, i) => <div key={i} className={cn("h-1.5 flex-1 rounded-full", i <= wizStep ? "bg-[#2563eb]" : dark ? "bg-[#252c36]" : "bg-[#e5e7eb]")} />)}</div>

              {wizStep === 0 && <div className="space-y-3"><div><label className={labelCls}>Product Name</label><input value={wizard.name} onChange={e => setWizard(w => ({ ...w, name: e.target.value }))} className={inpCls} /></div><div><label className={labelCls}>Slug (optional)</label><input value={wizard.slug} onChange={e => setWizard(w => ({ ...w, slug: e.target.value }))} className={inpCls} placeholder="auto" /></div><div><label className={labelCls}>Description</label><textarea rows={4} value={wizard.description} onChange={e => setWizard(w => ({ ...w, description: e.target.value }))} className={cn("w-full rounded-[11px] border-[1.5px] px-3 py-2 text-sm", inpBg, "focus:border-[#2563eb]")} /></div></div>}
              {wizStep === 1 && <div className="space-y-3"><p className={cn("text-xs", sub)}>{wizard.images.length} images will be imported. Uncheck to exclude; first image is the main.</p><div className="grid grid-cols-4 gap-2">{wizard.images.map((img, i) => <div key={i} className="relative aspect-square rounded-[10px] overflow-hidden border" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}><img src={img} className="w-full h-full object-cover" /><button onClick={() => setWizard(w => ({ ...w, images: w.images.filter((_, j) => j !== i) }))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>{i === 0 && <span className="absolute bottom-1 left-1 text-[8px] px-1 rounded bg-[#2563eb] text-white font-bold">MAIN</span>}</div>)}</div></div>}
              {wizStep === 2 && <div className="space-y-2"><p className={cn("text-xs", sub)}>{wizard.variants.length} variants detected.</p><div className={cn("rounded-[10px] border divide-y max-h-64 overflow-y-auto", brd, divide)}>{wizard.variants.map((v, i) => <div key={i} className="px-3 py-2 flex items-center gap-2 text-xs"><span className={cn("font-semibold", txt)}>{v.color || "—"} {v.size ? `/ ${v.size}` : ""}</span><span className={sub}>{v.sku}</span><span className={cn("ml-auto", txt)}>${(Number(v.supplier_price) || 0).toFixed(2)} · stock {v.stock ?? "—"}</span></div>)}{wizard.variants.length === 0 && <p className={cn("p-3 text-xs", sub)}>No variants — a single default product will be created.</p>}</div></div>}
              {wizStep === 3 && (() => {
                const cost = Number(wizard.supplier_price) || 0;
                const suggested = +(cost * 1.35).toFixed(2);
                const price = wizard.price ?? suggested;
                const marginPct = cost ? Math.round(((price - cost) / cost) * 100) : 0;
                const setFromMargin = (pct) => { const p = +(cost * (1 + (pct || 0) / 100)).toFixed(2); setWizard(w => ({ ...w, margin: pct, price: p })); };
                const setFromPrice = (p) => { const pct = cost ? Math.round(((p - cost) / cost) * 100) : 0; setWizard(w => ({ ...w, price: p, margin: pct })); };
                return <div className="space-y-3">
                  <div className={cn("rounded-[10px] border p-3", brd)}><p className={cn("text-xs", sub)}>Supplier cost: <b className={txt}>${cost.toFixed(2)}</b> · default rule suggests <b className={txt}>${suggested}</b></p></div>
                  <div><label className={labelCls}>Profit margin (%) — sets the sale price automatically</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={wizard.margin ?? marginPct} onChange={e => setFromMargin(parseFloat(e.target.value) || 0)} className={inpCls} placeholder="35" />
                      <div className="flex gap-1">{[20, 35, 50, 100].map(pct => <button key={pct} onClick={() => setFromMargin(pct)} className={cn("h-9 px-2.5 rounded-[9px] text-[11px] font-bold border", (wizard.margin ?? marginPct) === pct ? "bg-[#2563eb] text-white border-transparent" : cn(brd, sub))}>{pct}%</button>)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Sale Price ($)</label><input type="number" value={price} onChange={e => setFromPrice(parseFloat(e.target.value) || 0)} className={inpCls} /></div>
                    <div><label className={labelCls}>Compare-at ($)</label><input type="number" value={wizard.compare_price ?? +(suggested * 1.3).toFixed(2)} onChange={e => setWizard(w => ({ ...w, compare_price: parseFloat(e.target.value) || 0 }))} className={inpCls} /></div>
                  </div>
                  <p className={cn("text-[11px]", sub)}>Profit: <b className="text-emerald-600">${(price - cost).toFixed(2)}</b> ({marginPct}% margin)</p>
                </div>;
              })()}
              {wizStep === 4 && <div className="space-y-3"><div><label className={labelCls}>Meta Title</label><input value={wizard.meta_title} onChange={e => setWizard(w => ({ ...w, meta_title: e.target.value }))} className={inpCls} /></div><div><label className={labelCls}>Meta Description</label><textarea rows={3} value={wizard.meta_description} onChange={e => setWizard(w => ({ ...w, meta_description: e.target.value }))} className={cn("w-full rounded-[11px] border-[1.5px] px-3 py-2 text-sm", inpBg, "focus:border-[#2563eb]")} /></div><div><label className={labelCls}>Tags (comma)</label><input value={wizard.tags} onChange={e => setWizard(w => ({ ...w, tags: e.target.value }))} className={inpCls} placeholder="sneakers, running" /></div></div>}
              {wizStep === 5 && <div className={cn("rounded-[10px] border p-4", brd)}><p className={cn("text-sm font-bold", txt)}>Shipping</p><p className={cn("text-xs mt-1", sub)}>Processing time: {wizard.detail?.processing_time || "—"}. Shipping methods & costs sync from the supplier and can be refined in Shipping Rules. Weight: {wizard.detail?.weight || "—"}.</p></div>}
              {wizStep === 6 && <div className={cn("rounded-[10px] border p-4", brd)}><p className={cn("text-sm font-bold", txt)}>Inventory</p><p className={cn("text-xs mt-1", sub)}>Stock is imported from variants and kept in sync via the Inventory engine. Total stock: {wizard.variants.reduce((a, v) => a + (v.stock || 0), 0)}.</p></div>}
              {wizStep === 7 && (() => {
                const beautyTabs = wizard.page === "beauty" ? [...new Set(classify.subcats.map(s => s.tab).filter(Boolean))] : [];
                const subList = classify.subcats
                  .filter(s => !beautyTabs.length || !beautyTab || s.tab === beautyTab)
                  .filter(s => !subSearch || s.name.toLowerCase().includes(subSearch.toLowerCase()));
                const cap = (x) => x ? x.charAt(0).toUpperCase() + x.slice(1) : x;
                return <div className="space-y-4">
                  {/* 1. Main category */}
                  <div>
                    <label className={labelCls}>1. Main category</label>
                    <div className="flex flex-wrap gap-1.5">
                      {classify.pages.map(pg => (
                        <button key={pg.id} onClick={() => setWizard(w => ({ ...w, page: pg.id, subcat: "", collections: [] }))}
                          className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold border transition-colors", wizard.page === pg.id ? "bg-[#2563eb] text-white border-transparent" : cn(brd, txt, hover))}>
                          {cap(pg.id)}
                        </button>
                      ))}
                      {!classify.pages.length && <p className={cn("text-xs", sub)}>Loading categories…</p>}
                    </div>
                  </div>

                  {wizard.page && (
                    <>
                      {/* Beauty tabs */}
                      {beautyTabs.length > 0 && (
                        <div>
                          <label className={labelCls}>Beauty tab</label>
                          <div className="flex flex-wrap gap-1.5">
                            <button onClick={() => setBeautyTab("")} className={cn("h-8 px-3 rounded-[9px] text-[11px] font-bold border", beautyTab === "" ? "bg-[#2563eb] text-white border-transparent" : cn(brd, sub))}>All</button>
                            {beautyTabs.map(t => <button key={t} onClick={() => setBeautyTab(t)} className={cn("h-8 px-3 rounded-[9px] text-[11px] font-bold border", beautyTab === t ? "bg-[#2563eb] text-white border-transparent" : cn(brd, sub))}>{cap(t)}</button>)}
                          </div>
                        </div>
                      )}

                      {/* 2. Sub-category (searchable) */}
                      <div>
                        <label className={labelCls}>2. Shop by Category {classify.subcats.length ? `(${classify.subcats.length})` : ""}</label>
                        <input value={subSearch} onChange={e => setSubSearch(e.target.value)} placeholder="Search sub-category…" className={cn(inpCls, "mb-2")} />
                        <div className={cn("rounded-[10px] border max-h-44 overflow-y-auto divide-y", brd, divide)}>
                          {subList.length === 0 && <p className={cn("p-3 text-xs", sub)}>{classify.subcats.length ? "No match." : "No sub-categories for this page yet — manage them in Landing Pages."}</p>}
                          {subList.map(s => (
                            <button key={s.id} onClick={() => setWizard(w => ({ ...w, subcat: w.subcat === s.id ? "" : s.id }))} className={cn("w-full flex items-center justify-between px-3 py-2 text-left text-sm", hover, wizard.subcat === s.id ? "bg-[#2563eb]/10" : "")}>
                              <span className={cn("font-semibold", txt)}>{s.name}{s.tab ? <span className={cn("ml-2 text-[10px]", sub)}>· {cap(s.tab)}</span> : ""}</span>
                              {wizard.subcat === s.id && <CheckCircle2 className="w-4 h-4 text-[#2563eb]" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 3. Collections (multi) */}
                      {classify.collections.length > 0 && (
                        <div>
                          <label className={labelCls}>3. Collections (multi-select)</label>
                          <div className="flex flex-wrap gap-1.5">
                            {classify.collections.map(c => {
                              const on = (wizard.collections || []).includes(c.id);
                              return <button key={c.id} onClick={() => setWizard(w => ({ ...w, collections: on ? w.collections.filter(x => x !== c.id) : [...(w.collections || []), c.id] }))} className={cn("h-8 px-3 rounded-full text-[11px] font-bold border transition-colors", on ? "bg-[#2563eb] text-white border-transparent" : cn(brd, sub))}>{c.name}</button>;
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* 4. Marketing sections */}
                  <div>
                    <label className={labelCls}>4. Marketing sections (choose any)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {MARKETING.map(({ key, label }) => (
                        <label key={key} className={cn("flex items-center gap-2 cursor-pointer rounded-[10px] border px-3 py-2", brd, wizard[key] ? "border-[#2563eb]" : "")}>
                          <input type="checkbox" checked={!!wizard[key]} onChange={e => setWizard(w => ({ ...w, [key]: e.target.checked }))} className="rounded" />
                          <span className={cn("text-sm font-semibold", txt)}>{label}</span>
                        </label>
                      ))}
                    </div>
                    <p className={cn("text-[11px] mt-1.5", sub)}>The product can belong to several sections at once. Everything above is loaded live from your catalog — add a page, sub-category or collection in the admin and it appears here automatically.</p>
                  </div>

                  <div><label className={labelCls}>Status</label><select value={wizard.status} onChange={e => setWizard(w => ({ ...w, status: e.target.value }))} className={inpCls}><option value="draft">Draft</option><option value="active">Active (publish)</option></select></div>
                </div>;
              })()}
              {wizStep === 8 && <div className="space-y-2"><p className={cn("text-sm font-extrabold", txt)}>Review</p>{[["Name", wizard.name], ["Price", `$${wizard.price ?? "auto"}`], ["Images", wizard.images.length], ["Variants", wizard.variants.length], ["Status", wizard.status]].map(([l, v]) => <div key={l} className="flex justify-between text-xs"><span className={sub}>{l}</span><span className={cn("font-bold", txt)}>{v}</span></div>)}</div>}
              {wizStep === 9 && <div className={cn("rounded-[10px] border p-4 text-center", brd)}><Package className={cn("w-8 h-8 mx-auto mb-2", txt)} /><p className={cn("text-sm font-bold", txt)}>Ready to publish</p><p className={cn("text-xs mt-1", sub)}>A real product will be created in your catalog with variants, images and pricing.</p></div>}

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => setWizStep(s => Math.max(0, s - 1))} disabled={wizStep === 0} className={btnGhost}><ChevronLeft className="w-3.5 h-3.5" /> Back</button>
                {wizStep < 9 ? <button onClick={() => setWizStep(s => s + 1)} className={btnPrimary}>Next <ChevronRight className="w-3.5 h-3.5" /></button>
                  : <button onClick={publish} disabled={busy === "/import"} className={btnPrimary}>{busy === "/import" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Publish Product</button>}
              </div>
            </>)}
          </div>
        </div>
      )}

      {secretModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setSecretModal(null)}>
          <div className={cn("w-full max-w-md rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold", txt)}>Webhook Secret</p><p className={cn("text-xs", sub)}>Copy it now — shown once.</p>
            <div className={cn("rounded-[10px] border p-3 flex items-center gap-2", brd)}><code className={cn("text-xs font-bold flex-1 break-all", txt)}>{secretModal}</code><button onClick={() => { navigator.clipboard?.writeText(secretModal); showToast("Copied"); }} className={sub}><Copy className="w-4 h-4" /></button></div>
            <button onClick={() => setSecretModal(null)} className={cn(btnPrimary, "w-full justify-center h-10")}>Done</button>
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200 max-w-sm", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}

// Secure credential entry form. Values are write-only: they are encrypted
// server-side and never sent back, so the inputs start empty and only submit
// what the admin types.
function CredsForm({ supplier, creds, configured, post, reload, styles }) {
  const { brd, txt, sub, inpCls, labelCls, btnGhost, btnPrimary } = styles;
  const [open, setOpen] = useState(!configured);
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const stored = creds?.stored;

  const save = async () => {
    if (!email && !apiKey && !token) return;
    setBusy(true);
    try {
      await post("/save-credentials", { email: email || undefined, api_key: apiKey || undefined, access_token: token || undefined },
        (r) => r?.test?.ok ? "Credentials saved & verified ✓" : `Saved, but test failed: ${r?.test?.message || "check values"}`,
        async () => { setEmail(""); setApiKey(""); setToken(""); await reload(); });
    } finally { setBusy(false); }
  };

  return (
    <div className={cn("rounded-[12px] border p-3.5 space-y-3", brd)}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full">
        <span className={cn("text-xs font-extrabold flex items-center gap-1.5", txt)}><PlugZap className="w-3.5 h-3.5 text-[#2563eb]" /> API Credentials {stored && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold">saved{creds?.hint ? ` · ${creds.hint}` : ""}</span>}</span>
        <ChevronRight className={cn("w-4 h-4 transition-transform", sub, open && "rotate-90")} />
      </button>
      {open && (
        <div className="space-y-2.5">
          <div>
            <label className={labelCls}>CJ Account Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} className={inpCls} placeholder={stored ? "•••••• (leave blank to keep)" : "your-cj-account@email.com"} autoComplete="off" />
          </div>
          <div>
            <label className={labelCls}>CJ API Key</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className={inpCls} placeholder={stored ? "•••••• (leave blank to keep)" : "API key from My CJ → Authorization"} autoComplete="new-password" />
          </div>
          <details>
            <summary className={cn("text-[11px] cursor-pointer", sub)}>Advanced: use a pre-issued Access Token instead</summary>
            <input type="password" value={token} onChange={e => setToken(e.target.value)} className={cn(inpCls, "mt-2")} placeholder="CJ Access Token (optional)" autoComplete="new-password" />
          </details>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={save} disabled={busy || (!email && !apiKey && !token)} className={btnPrimary}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Save & Verify</button>
            {stored && <button onClick={() => post("/clear-credentials", {}, "Credentials removed", reload)} className={cn(btnGhost, "text-red-500")}><Trash2 className="w-3.5 h-3.5" /> Remove</button>}
          </div>
          <p className={cn("text-[10px] leading-relaxed", sub)}>Get your API key at <b>My CJ → Authorization → API</b>. It is encrypted (AES-256-GCM) before storage and never displayed again.</p>
        </div>
      )}
    </div>
  );
}
