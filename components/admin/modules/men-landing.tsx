// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Layout, Plus, X, Loader2, Save, Trash2, AlertTriangle, GripVertical,
  ArrowUp, ArrowDown, Pencil, ImagePlus, Image as ImageIcon, Images,
  Grid3x3, Award, Settings, Search as SearchIcon, Eye, EyeOff,
} from "lucide-react";

type Props = { dark: boolean };
const EXT = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp" };

const SECTION_LABELS = {
  hero: "Hero Banner", collections: "Collections", shop_category: "Shop by Category",
  new_arrivals: "New Arrivals", flash_sale: "Flash Sale", super_deals: "Super Deals",
  best_sellers: "Best Sellers", brands: "Brands", recommended: "Recommended",
};

export function AdminMenLanding({ dark }: Props) {
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

  const [tab, setTab] = useState("hero");
  const [toast, setToast] = useState(null);
  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3000); }, []);
  const sb = () => createClient();
  const authed = async () => {
    const supabase = sb();
    const { data } = await supabase.auth.getSession();
    if (!data?.session) throw new Error("Session expired — refresh and sign in again.");
    return supabase;
  };
  const uploadImage = async (file, prefix, cb) => {
    if (!file) return;
    if (!EXT[file.type]) { showToast("Use JPG, PNG or WEBP", "error"); return; }
    try {
      const supabase = await authed();
      const path = `men-landing/${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[file.type]}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      cb(pub.publicUrl); showToast("Image uploaded");
    } catch (e) { showToast(e.message, "error"); }
  };

  const styles = { p, brd, txt, sub, inpBg, hover, inpCls, labelCls, cardCls, btnGhost, btnPrimary, divide };
  const shared = { styles, authed, sb, showToast, uploadImage };

  const TABS = [
    { id: "hero", label: "Hero Banner", icon: Images },
    { id: "collections", label: "Collections", icon: Layout },
    { id: "shop_category", label: "Shop by Category", icon: Grid3x3 },
    { id: "brands", label: "Brands", icon: Award },
    { id: "settings", label: "Display & SEO", icon: Settings },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Layout className="w-5 h-5 text-[#2563eb]" /> Men Landing Page <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", inpBg)}>/men</span></h1>
        <p className={cn("text-xs mt-0.5", sub)}>Manage everything on the Men landing page — no code changes needed. New Arrivals, Flash Sale, Super Deals, Best Sellers & Recommended pull men's products automatically.</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const I = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("h-9 px-3 rounded-[10px] text-xs font-bold flex items-center gap-1.5 transition-colors", tab === t.id ? "bg-[#2563eb] text-white" : cn(btnGhost))}>
              <I className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "hero" && <HeroEditor {...shared} />}
      {tab === "collections" && <ListEditor {...shared} table="men_collections" prefix="collections" title="Men's Collections" imageField="image_url" imageLabel="Image" hasCategory={false} />}
      {tab === "shop_category" && <ListEditor {...shared} table="men_shop_categories" prefix="shop-category" title="Shop by Category" imageField="image_url" imageLabel="Image (round)" round hasCategory />}
      {tab === "brands" && <ListEditor {...shared} table="men_brands" prefix="brands" title="Brands" imageField="logo_url" imageLabel="Logo" hasBrand />}
      {tab === "settings" && <SettingsPanel {...shared} />}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}

/* ============ Generic list editor (collections / shop cats / brands) ============ */
function ListEditor({ styles, authed, sb, showToast, uploadImage, table, prefix, title, imageField, imageLabel, round, hasCategory, hasBrand }) {
  const { p, brd, txt, sub, hover, inpCls, labelCls, cardCls, btnGhost, btnPrimary, divide } = styles;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [brands, setBrands] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);

  const load = useCallback(async () => {
    try {
      const sel = hasCategory ? "*, category:categories(name)" : hasBrand ? "*, brand:brands(name)" : "*";
      const reqs = [sb().from(table).select(sel).order("sort_order")];
      if (hasCategory) reqs.push(sb().from("categories").select("id,name").order("name"));
      if (hasBrand) reqs.push(sb().from("brands").select("id,name").order("name"));
      const res = await Promise.all(reqs);
      setRows(res[0].data || []);
      if (hasCategory) setCats(res[1].data || []);
      if (hasBrand) setBrands(res[1].data || []);
    } catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  }, [table, hasCategory, hasBrand, showToast]);
  useEffect(() => { load(); }, [load]);

  const empty = () => ({ _new: true, name: "", [imageField]: "", link_url: "", sort_order: rows.length + 1, is_active: true, linked_category_id: "", linked_brand_id: "" });

  const save = async () => {
    const d = drawer;
    if (!d.name) { showToast("Name is required", "error"); return; }
    setBusy(true);
    try {
      const supabase = await authed();
      const payload = { name: d.name, [imageField]: d[imageField] || null, link_url: d.link_url || null, sort_order: Number(d.sort_order) || 100, is_active: !!d.is_active };
      if (hasCategory) payload.linked_category_id = d.linked_category_id || null;
      if (hasBrand) payload.linked_brand_id = d.linked_brand_id || null;
      if (d._new) { const { error } = await supabase.from(table).insert(payload); if (error) throw error; }
      else { const { error } = await supabase.from(table).update(payload).eq("id", d.id); if (error) throw error; }
      showToast("Saved"); setDrawer(null); load();
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(false); }
  };
  const remove = async (id) => { try { const s = await authed(); const { error } = await s.from(table).delete().eq("id", id); if (error) throw error; showToast("Deleted"); load(); } catch (e) { showToast(e.message, "error"); } };
  const toggle = async (r) => { try { const s = await authed(); await s.from(table).update({ is_active: !r.is_active }).eq("id", r.id); load(); } catch (e) { showToast(e.message, "error"); } };
  const persistOrder = async (ordered) => { setRows(ordered); try { const s = await authed(); await Promise.all(ordered.map((r, i) => s.from(table).update({ sort_order: i + 1 }).eq("id", r.id))); } catch (e) { showToast(e.message, "error"); load(); } };
  const move = (idx, dir) => { const next = [...rows]; const j = idx + dir; if (j < 0 || j >= next.length) return; [next[idx], next[j]] = [next[j], next[idx]]; persistOrder(next); };
  const onDrop = (idx) => { if (dragIdx === null || dragIdx === idx) return; const next = [...rows]; const [m] = next.splice(dragIdx, 1); next.splice(idx, 0, m); setDragIdx(null); persistOrder(next); };

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-16 animate-pulse", p, brd)} />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={cn("text-sm font-bold", txt)}>{title} <span className={cn("font-normal", sub)}>· {rows.length} item(s)</span></p>
        <button onClick={() => setDrawer(empty())} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add</button>
      </div>

      <div className={cn(cardCls, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className={cn("border-b text-left", brd, sub)}>{["", imageLabel, "Name", "Links To", "Order", "Status", ""].map((h, i) => <th key={i} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className={cn("divide-y", divide)}>
              {rows.length === 0 ? <tr><td colSpan={7} className={cn("px-4 py-10 text-center", sub)}>No items yet. Click “Add”.</td></tr> : rows.map((r, idx) => (
                <tr key={r.id} draggable onDragStart={() => setDragIdx(idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(idx)} className={cn(hover, dragIdx === idx && "opacity-50")}>
                  <td className="px-2 py-2.5 cursor-grab active:cursor-grabbing"><GripVertical className={cn("w-4 h-4", sub)} /></td>
                  <td className="px-3 py-2.5"><div className={cn("w-10 h-10 overflow-hidden ring-1 ring-black/5 bg-[#f4f5f7]", round ? "rounded-full" : "rounded-[8px]")}>{r[imageField] && <img src={r[imageField]} alt="" className="w-full h-full object-cover" />}</div></td>
                  <td className="px-3 py-2.5"><span className={cn("font-bold", txt)}>{r.name}</span></td>
                  <td className="px-3 py-2.5"><span className={cn("text-xs", sub)}>{r.category?.name || r.brand?.name || r.link_url || "—"}</span></td>
                  <td className="px-3 py-2.5"><div className="flex items-center gap-1"><span className={cn("text-xs font-bold w-5 text-center", txt)}>{r.sort_order}</span><button onClick={() => move(idx, -1)} className={cn("p-1 rounded", hover, sub)}><ArrowUp className="w-3.5 h-3.5" /></button><button onClick={() => move(idx, 1)} className={cn("p-1 rounded", hover, sub)}><ArrowDown className="w-3.5 h-3.5" /></button></div></td>
                  <td className="px-3 py-2.5"><button onClick={() => toggle(r)} className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: r.is_active ? "#16a34a1a" : "#8a929c1a", color: r.is_active ? "#16a34a" : "#8a929c" }}>{r.is_active ? "active" : "hidden"}</button></td>
                  <td className="px-3 py-2.5"><div className="flex items-center gap-1"><button onClick={() => setDrawer({ ...r })} className={cn("p-1.5 rounded-lg", hover, sub)}><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => setConfirm({ name: r.name, onConfirm: () => remove(r.id) })} className={cn("p-1.5 rounded-lg text-red-500", hover)}><Trash2 className="w-3.5 h-3.5" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDrawer(null)}>
          <div className={cn("w-full max-w-lg h-full overflow-y-auto border-l p-5 space-y-4", p, brd)} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className={cn("text-base font-extrabold", txt)}>{drawer._new ? "Add" : "Edit"} — {title}</p><button onClick={() => setDrawer(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            <div>
              <label className={labelCls}>{imageLabel}</label>
              <div className="flex items-center gap-3">
                <div className={cn("w-20 h-20 overflow-hidden ring-1 ring-black/10 bg-[#f4f5f7] shrink-0 flex items-center justify-center", round ? "rounded-full" : "rounded-[12px]")}>{drawer[imageField] ? <img src={drawer[imageField]} alt="" className="w-full h-full object-cover" /> : <ImagePlus className={cn("w-6 h-6", sub)} />}</div>
                <div className="space-y-1.5">
                  <label className={cn(btnGhost, "cursor-pointer")}><ImagePlus className="w-3.5 h-3.5" /> Upload<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0], prefix, (url) => setDrawer((d) => ({ ...d, [imageField]: url })))} /></label>
                  <input value={drawer[imageField] || ""} onChange={(e) => setDrawer((d) => ({ ...d, [imageField]: e.target.value }))} className={cn(inpCls, "h-8 text-xs w-64 max-w-full")} placeholder="or paste image URL" />
                </div>
              </div>
            </div>
            <div><label className={labelCls}>Name *</label><input value={drawer.name} onChange={(e) => setDrawer((d) => ({ ...d, name: e.target.value }))} className={inpCls} /></div>
            {hasCategory && <div><label className={labelCls}>Linked Category (optional — sets the link)</label><select value={drawer.linked_category_id || ""} onChange={(e) => setDrawer((d) => ({ ...d, linked_category_id: e.target.value }))} className={inpCls}><option value="">— None —</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
            {hasBrand && <div><label className={labelCls}>Linked Brand (optional)</label><select value={drawer.linked_brand_id || ""} onChange={(e) => setDrawer((d) => ({ ...d, linked_brand_id: e.target.value }))} className={inpCls}><option value="">— None —</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>}
            <div><label className={labelCls}>Link URL {hasCategory ? "(used if no category linked)" : ""}</label><input value={drawer.link_url || ""} onChange={(e) => setDrawer((d) => ({ ...d, link_url: e.target.value }))} className={inpCls} placeholder="/category/men" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Order</label><input type="number" value={drawer.sort_order} onChange={(e) => setDrawer((d) => ({ ...d, sort_order: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Status</label><select value={drawer.is_active ? "1" : "0"} onChange={(e) => setDrawer((d) => ({ ...d, is_active: e.target.value === "1" }))} className={inpCls}><option value="1">Active</option><option value="0">Hidden</option></select></div>
            </div>
            <button onClick={save} disabled={busy || !drawer.name} className={cn(btnPrimary, "w-full justify-center h-10")}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
          </div>
        </div>
      )}
      {confirm && <ConfirmModal styles={styles} name={confirm.name} onCancel={() => setConfirm(null)} onConfirm={() => { confirm.onConfirm(); setConfirm(null); }} />}
    </div>
  );
}

/* ============ Hero banner editor (banners @ location=men_hero) ============ */
function HeroEditor({ styles, authed, sb, showToast, uploadImage }) {
  const { p, brd, txt, sub, hover, inpCls, labelCls, cardCls, btnGhost, btnPrimary, divide } = styles;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);

  const load = useCallback(async () => {
    try { const { data } = await sb().from("banners").select("*").eq("location", "men_hero").order("priority", { ascending: false }); setRows(data || []); }
    catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const empty = () => ({ _new: true, name: "", description: "", cta_label: "SHOP NOW", link_url: "/category/men", image_desktop: "", image_mobile: "", is_active: true });

  const save = async () => {
    const d = drawer;
    if (!d.name) { showToast("Title is required", "error"); return; }
    setBusy(true);
    try {
      const supabase = await authed();
      const payload = { name: d.name, location: "men_hero", description: d.description || null, cta_label: d.cta_label || null, link_url: d.link_url || null, image_desktop: d.image_desktop || null, image_mobile: d.image_mobile || null, is_active: !!d.is_active, status: d.is_active ? "active" : "inactive" };
      if (d._new) { const { error } = await supabase.from("banners").insert(payload); if (error) throw error; }
      else { const { error } = await supabase.from("banners").update(payload).eq("id", d.id); if (error) throw error; }
      showToast("Saved"); setDrawer(null); load();
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(false); }
  };
  const remove = async (id) => { try { const s = await authed(); const { error } = await s.from("banners").delete().eq("id", id); if (error) throw error; showToast("Deleted"); load(); } catch (e) { showToast(e.message, "error"); } };
  const toggle = async (r) => { try { const s = await authed(); await s.from("banners").update({ is_active: !r.is_active, status: !r.is_active ? "active" : "inactive" }).eq("id", r.id); load(); } catch (e) { showToast(e.message, "error"); } };
  // reorder: higher priority = earlier. Assign n..1 descending.
  const persistOrder = async (ordered) => { setRows(ordered); try { const s = await authed(); await Promise.all(ordered.map((r, i) => s.from("banners").update({ priority: ordered.length - i }).eq("id", r.id))); } catch (e) { showToast(e.message, "error"); load(); } };
  const move = (idx, dir) => { const next = [...rows]; const j = idx + dir; if (j < 0 || j >= next.length) return; [next[idx], next[j]] = [next[j], next[idx]]; persistOrder(next); };
  const onDrop = (idx) => { if (dragIdx === null || dragIdx === idx) return; const next = [...rows]; const [m] = next.splice(dragIdx, 1); next.splice(idx, 0, m); setDragIdx(null); persistOrder(next); };

  if (loading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-20 animate-pulse", p, brd)} />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={cn("text-sm font-bold", txt)}>Hero Banners <span className={cn("font-normal", sub)}>· slider · {rows.length} banner(s)</span></p>
        <button onClick={() => setDrawer(empty())} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add Banner</button>
      </div>
      <div className={cn(cardCls, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className={cn("border-b text-left", brd, sub)}>{["", "Preview", "Title", "Link", "Order", "Status", ""].map((h, i) => <th key={i} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className={cn("divide-y", divide)}>
              {rows.length === 0 ? <tr><td colSpan={7} className={cn("px-4 py-10 text-center", sub)}>No banners yet. Click “Add Banner”.</td></tr> : rows.map((r, idx) => (
                <tr key={r.id} draggable onDragStart={() => setDragIdx(idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(idx)} className={cn(hover, dragIdx === idx && "opacity-50")}>
                  <td className="px-2 py-2.5 cursor-grab active:cursor-grabbing"><GripVertical className={cn("w-4 h-4", sub)} /></td>
                  <td className="px-3 py-2.5"><div className="w-20 h-11 rounded-[8px] overflow-hidden bg-[#f4f5f7]">{(r.image_desktop || r.image_mobile) && <img src={r.image_desktop || r.image_mobile} alt="" className="w-full h-full object-cover" />}</div></td>
                  <td className="px-3 py-2.5"><span className={cn("font-bold", txt)}>{r.name}</span></td>
                  <td className="px-3 py-2.5"><span className={cn("text-xs", sub)}>{r.link_url || "—"}</span></td>
                  <td className="px-3 py-2.5"><div className="flex items-center gap-1"><button onClick={() => move(idx, -1)} className={cn("p-1 rounded", hover, sub)}><ArrowUp className="w-3.5 h-3.5" /></button><button onClick={() => move(idx, 1)} className={cn("p-1 rounded", hover, sub)}><ArrowDown className="w-3.5 h-3.5" /></button></div></td>
                  <td className="px-3 py-2.5"><button onClick={() => toggle(r)} className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: r.is_active ? "#16a34a1a" : "#8a929c1a", color: r.is_active ? "#16a34a" : "#8a929c" }}>{r.is_active ? "active" : "hidden"}</button></td>
                  <td className="px-3 py-2.5"><div className="flex items-center gap-1"><button onClick={() => setDrawer({ ...r })} className={cn("p-1.5 rounded-lg", hover, sub)}><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => setConfirm({ name: r.name, onConfirm: () => remove(r.id) })} className={cn("p-1.5 rounded-lg text-red-500", hover)}><Trash2 className="w-3.5 h-3.5" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDrawer(null)}>
          <div className={cn("w-full max-w-lg h-full overflow-y-auto border-l p-5 space-y-4", p, brd)} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className={cn("text-base font-extrabold", txt)}>{drawer._new ? "Add Banner" : "Edit Banner"}</p><button onClick={() => setDrawer(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            {[["image_desktop", "Desktop Image", "hero-desktop"], ["image_mobile", "Mobile Image", "hero-mobile"]].map(([field, lab, pref]) => (
              <div key={field}>
                <label className={labelCls}>{lab}</label>
                <div className="flex items-center gap-3">
                  <div className="w-28 h-16 rounded-[10px] overflow-hidden ring-1 ring-black/10 bg-[#f4f5f7] shrink-0 flex items-center justify-center">{drawer[field] ? <img src={drawer[field]} alt="" className="w-full h-full object-cover" /> : <ImageIcon className={cn("w-5 h-5", sub)} />}</div>
                  <div className="space-y-1.5">
                    <label className={cn(btnGhost, "cursor-pointer")}><ImagePlus className="w-3.5 h-3.5" /> Upload<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0], pref, (url) => setDrawer((d) => ({ ...d, [field]: url })))} /></label>
                    <input value={drawer[field] || ""} onChange={(e) => setDrawer((d) => ({ ...d, [field]: e.target.value }))} className={cn(inpCls, "h-8 text-xs w-64 max-w-full")} placeholder="or paste URL" />
                  </div>
                </div>
              </div>
            ))}
            <div><label className={labelCls}>Title *</label><input value={drawer.name} onChange={(e) => setDrawer((d) => ({ ...d, name: e.target.value }))} className={inpCls} placeholder="MEN'S COLLECTION" /></div>
            <div><label className={labelCls}>Subtitle</label><input value={drawer.description || ""} onChange={(e) => setDrawer((d) => ({ ...d, description: e.target.value }))} className={inpCls} placeholder="Up to 70% off" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Button Label</label><input value={drawer.cta_label || ""} onChange={(e) => setDrawer((d) => ({ ...d, cta_label: e.target.value }))} className={inpCls} placeholder="SHOP NOW" /></div>
              <div><label className={labelCls}>Status</label><select value={drawer.is_active ? "1" : "0"} onChange={(e) => setDrawer((d) => ({ ...d, is_active: e.target.value === "1" }))} className={inpCls}><option value="1">Active</option><option value="0">Hidden</option></select></div>
            </div>
            <div><label className={labelCls}>Link URL</label><input value={drawer.link_url || ""} onChange={(e) => setDrawer((d) => ({ ...d, link_url: e.target.value }))} className={inpCls} placeholder="/category/men" /></div>
            <button onClick={save} disabled={busy || !drawer.name} className={cn(btnPrimary, "w-full justify-center h-10")}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
          </div>
        </div>
      )}
      {confirm && <ConfirmModal styles={styles} name={confirm.name} onCancel={() => setConfirm(null)} onConfirm={() => { confirm.onConfirm(); setConfirm(null); }} />}
    </div>
  );
}

/* ============ Display settings + SEO ============ */
const ORDER_KEYS = ["hero", "collections", "shop_category", "new_arrivals", "flash_sale", "super_deals", "best_sellers", "brands", "recommended"];
function SettingsPanel({ styles, authed, sb, showToast }) {
  const { p, brd, txt, sub, hover, inpCls, labelCls, cardCls, btnPrimary, divide } = styles;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState(null);

  const load = useCallback(async () => { try { const { data } = await sb().from("men_page_settings").select("*").eq("id", "men").maybeSingle(); setS(data || {}); } catch (e) { showToast(e.message, "error"); } finally { setLoading(false); } }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const order = (Array.isArray(s?.section_order) && s.section_order.length ? s.section_order : ORDER_KEYS);
  const moveOrder = (idx, dir) => { const next = [...order]; const j = idx + dir; if (j < 0 || j >= next.length) return; [next[idx], next[j]] = [next[j], next[idx]]; setS((x) => ({ ...x, section_order: next })); };

  const save = async () => {
    setBusy(true);
    try {
      const supabase = await authed();
      const payload = {
        show_hero: s.show_hero !== false, show_collections: s.show_collections !== false, show_shop_category: s.show_shop_category !== false,
        show_new_arrivals: s.show_new_arrivals !== false, show_flash_sale: s.show_flash_sale !== false, show_super_deals: s.show_super_deals !== false,
        show_best_sellers: s.show_best_sellers !== false, show_brands: s.show_brands !== false, show_recommended: s.show_recommended !== false,
        new_arrivals_count: Number(s.new_arrivals_count) || 8, best_sellers_count: Number(s.best_sellers_count) || 8,
        recommended_count: Number(s.recommended_count) || 8, super_deals_count: Number(s.super_deals_count) || 8,
        section_order: order,
        seo_title: s.seo_title || null, seo_description: s.seo_description || null, seo_slug: s.seo_slug || "men",
        og_image: s.og_image || null, seo_keywords: s.seo_keywords || null, canonical: s.canonical || null,
      };
      const { error } = await supabase.from("men_page_settings").update(payload).eq("id", "men");
      if (error) throw error;
      showToast("Settings saved"); load();
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(false); }
  };

  if (loading || !s) return <div className={cn("rounded-[16px] border h-40 animate-pulse", p, brd)} />;

  const visMap = { hero: "show_hero", collections: "show_collections", shop_category: "show_shop_category", new_arrivals: "show_new_arrivals", flash_sale: "show_flash_sale", super_deals: "show_super_deals", best_sellers: "show_best_sellers", brands: "show_brands", recommended: "show_recommended" };

  return (
    <div className="space-y-4">
      {/* Section order + visibility */}
      <div className={cn(cardCls, "p-4")}>
        <p className={cn("text-sm font-bold mb-3", txt)}>Sections — order & visibility</p>
        <div className={cn("rounded-[12px] border divide-y", brd, divide)}>
          {order.map((key, idx) => {
            const vk = visMap[key]; const on = s[vk] !== false;
            return (
              <div key={key} className="flex items-center gap-2 px-3 py-2.5">
                <span className={cn("text-xs font-bold w-5 text-center", sub)}>{idx + 1}</span>
                <span className={cn("flex-1 text-sm font-semibold", txt)}>{SECTION_LABELS[key]}</span>
                <button onClick={() => moveOrder(idx, -1)} className={cn("p-1 rounded", hover, sub)}><ArrowUp className="w-4 h-4" /></button>
                <button onClick={() => moveOrder(idx, 1)} className={cn("p-1 rounded", hover, sub)}><ArrowDown className="w-4 h-4" /></button>
                <button onClick={() => setS((x) => ({ ...x, [vk]: !on }))} className={cn("p-1.5 rounded-lg", hover)} title={on ? "Visible" : "Hidden"}>{on ? <Eye className="w-4 h-4 text-[#16a34a]" /> : <EyeOff className="w-4 h-4 text-[#8a929c]" />}</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Product counts */}
      <div className={cn(cardCls, "p-4")}>
        <p className={cn("text-sm font-bold mb-3", txt)}>Product counts</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[["New Arrivals", "new_arrivals_count"], ["Super Deals", "super_deals_count"], ["Best Sellers", "best_sellers_count"], ["Recommended", "recommended_count"]].map(([lab, k]) => (
            <div key={k}><label className={labelCls}>{lab}</label><input type="number" min="1" max="24" value={s[k] ?? 8} onChange={(e) => setS((x) => ({ ...x, [k]: e.target.value }))} className={inpCls} /></div>
          ))}
        </div>
      </div>

      {/* SEO */}
      <div className={cn(cardCls, "p-4 space-y-3")}>
        <p className={cn("text-sm font-bold flex items-center gap-1.5", txt)}><SearchIcon className="w-4 h-4" /> SEO</p>
        <div><label className={labelCls}>Meta Title</label><input value={s.seo_title || ""} onChange={(e) => setS((x) => ({ ...x, seo_title: e.target.value }))} className={inpCls} placeholder="Men's Fashion & Sneakers | Atlanta Sneakers" /></div>
        <div><label className={labelCls}>Meta Description</label><textarea value={s.seo_description || ""} onChange={(e) => setS((x) => ({ ...x, seo_description: e.target.value }))} className={cn(inpCls, "h-20 py-2 resize-none")} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Slug</label><input value={s.seo_slug || "men"} onChange={(e) => setS((x) => ({ ...x, seo_slug: e.target.value }))} className={inpCls} /></div>
          <div><label className={labelCls}>Canonical URL</label><input value={s.canonical || ""} onChange={(e) => setS((x) => ({ ...x, canonical: e.target.value }))} className={inpCls} placeholder="https://…/men" /></div>
        </div>
        <div><label className={labelCls}>Keywords</label><input value={s.seo_keywords || ""} onChange={(e) => setS((x) => ({ ...x, seo_keywords: e.target.value }))} className={inpCls} placeholder="men, streetwear, sneakers" /></div>
        <div><label className={labelCls}>OG Image URL</label><input value={s.og_image || ""} onChange={(e) => setS((x) => ({ ...x, og_image: e.target.value }))} className={inpCls} /></div>
      </div>

      <button onClick={save} disabled={busy} className={cn(btnPrimary, "h-10 px-5")}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Settings</button>
    </div>
  );
}

function ConfirmModal({ styles, name, onCancel, onConfirm }) {
  const { p, brd, txt, sub, btnGhost } = styles;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={onCancel}>
      <div className={cn("w-full max-w-sm rounded-[18px] border p-5 space-y-3", p, brd)} onClick={(e) => e.stopPropagation()}>
        <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><AlertTriangle className="w-5 h-5 text-red-500" /> Delete?</p>
        <p className={cn("text-sm", sub)}>“{name}” will be permanently removed.</p>
        <div className="flex gap-2 justify-end"><button onClick={onCancel} className={btnGhost}>Cancel</button><button onClick={onConfirm} className="h-9 px-4 rounded-[10px] text-white text-xs font-bold bg-red-500 hover:bg-red-600">Delete</button></div>
      </div>
    </div>
  );
}
