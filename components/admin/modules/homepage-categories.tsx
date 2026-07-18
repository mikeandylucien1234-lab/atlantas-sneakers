// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Grid3x3, Plus, X, Loader2, Save, Trash2, CheckCircle2, AlertTriangle,
  GripVertical, ArrowUp, ArrowDown, Eye, Pencil, ImagePlus, ExternalLink,
} from "lucide-react";

type Props = { dark: boolean };

const EXT = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp" };
const RADIUS_CLS = (r) => (r === "square" ? "rounded-[10px]" : r === "rounded" ? "rounded-[18px]" : "rounded-full");

export function AdminHomepageCategories({ dark }: Props) {
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

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [preview, setPreview] = useState(false);

  const showToast = useCallback((m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3000); }, []);
  const sb = () => createClient();

  const load = useCallback(async () => {
    try {
      const [{ data: hc }, { data: c }] = await Promise.all([
        sb().from("homepage_categories").select("*, category:categories(id,name,slug)").order("display_order"),
        sb().from("categories").select("id,name,slug").order("name"),
      ]);
      setRows(hc || []); setCats(c || []);
    } catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const authed = async () => {
    const supabase = sb();
    const { data } = await supabase.auth.getSession();
    if (!data?.session) throw new Error("Session expired — refresh and sign in again.");
    return supabase;
  };

  const empty = () => ({ _new: true, name: "", linked_category_id: "", image_url: "", alt_text: "", display_order: (rows.length + 1), status: "active", open_new_tab: false, border_radius: "circle", bg_color: "", show_on_homepage: true });

  const save = async () => {
    const d = drawer;
    if (!d.name) { showToast("Category name is required", "error"); return; }
    setBusy(true);
    try {
      const supabase = await authed();
      const payload = {
        name: d.name, linked_category_id: d.linked_category_id || null, image_url: d.image_url || null,
        alt_text: d.alt_text || null, display_order: Number(d.display_order) || 100, status: d.status,
        open_new_tab: !!d.open_new_tab, border_radius: d.border_radius, bg_color: d.bg_color || null,
        show_on_homepage: !!d.show_on_homepage,
      };
      if (d._new) { const { error } = await supabase.from("homepage_categories").insert(payload); if (error) throw error; }
      else { const { error } = await supabase.from("homepage_categories").update(payload).eq("id", d.id); if (error) throw error; }
      showToast("Saved"); setDrawer(null); load();
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(false); }
  };

  const remove = async (id) => {
    try { const supabase = await authed(); const { error } = await supabase.from("homepage_categories").delete().eq("id", id); if (error) throw error; showToast("Deleted"); load(); }
    catch (e) { showToast(e.message, "error"); }
  };

  const toggleStatus = async (row) => {
    try { const supabase = await authed(); await supabase.from("homepage_categories").update({ status: row.status === "active" ? "inactive" : "active" }).eq("id", row.id); load(); }
    catch (e) { showToast(e.message, "error"); }
  };

  // Persist a new order (array of ids) as display_order 1..n
  const persistOrder = async (ordered) => {
    setRows(ordered);
    try {
      const supabase = await authed();
      await Promise.all(ordered.map((r, i) => supabase.from("homepage_categories").update({ display_order: i + 1 }).eq("id", r.id)));
    } catch (e) { showToast(e.message, "error"); load(); }
  };
  const move = (idx, dir) => {
    const next = [...rows]; const j = idx + dir; if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]]; persistOrder(next);
  };
  const onDrop = (idx) => {
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...rows]; const [m] = next.splice(dragIdx, 1); next.splice(idx, 0, m); setDragIdx(null); persistOrder(next);
  };

  const uploadImage = async (file) => {
    if (!file) return;
    if (!EXT[file.type]) { showToast("Use JPG, PNG or WEBP", "error"); return; }
    setBusy(true);
    try {
      const supabase = await authed();
      const path = `homepage-categories/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[file.type]}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      setDrawer(d => ({ ...d, image_url: pub.publicUrl }));
      showToast("Image uploaded");
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(false); }
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-16 animate-pulse", p, brd)} />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Grid3x3 className="w-5 h-5 text-[#2563eb]" /> Shop by Category</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Manage the homepage category circles — image, name, linked category, order & status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setPreview(true)} className={btnGhost}><Eye className="w-3.5 h-3.5" /> Preview</button>
          <button onClick={() => setDrawer(empty())} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add Category</button>
        </div>
      </div>

      <div className={cn(cardCls, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className={cn("border-b text-left", brd, sub)}>
              {["", "Image", "Name", "Linked Category", "Position", "Status", "Actions"].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className={cn("divide-y", divide)}>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className={cn("px-4 py-10 text-center", sub)}>No categories yet. Click “Add Category”.</td></tr>
              ) : rows.map((r, idx) => (
                <tr key={r.id} draggable onDragStart={() => setDragIdx(idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(idx)} className={cn(hover, dragIdx === idx && "opacity-50")}>
                  <td className="px-2 py-2.5 cursor-grab active:cursor-grabbing"><GripVertical className={cn("w-4 h-4", sub)} /></td>
                  <td className="px-3 py-2.5">
                    <div className={cn("w-10 h-10 overflow-hidden ring-1 ring-black/5", RADIUS_CLS(r.border_radius))} style={{ background: r.bg_color || "#f4f5f7" }}>
                      {r.image_url && <img src={r.image_url} alt={r.alt_text || r.name} className="w-full h-full object-cover" />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><span className={cn("font-bold", txt)}>{r.name}</span></td>
                  <td className="px-3 py-2.5"><span className={cn("text-xs", sub)}>{r.category?.name || "—"}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <span className={cn("text-xs font-bold w-5 text-center", txt)}>{r.display_order}</span>
                      <button onClick={() => move(idx, -1)} className={cn("p-1 rounded", hover, sub)}><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => move(idx, 1)} className={cn("p-1 rounded", hover, sub)}><ArrowDown className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => toggleStatus(r)} className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: r.status === "active" ? "#16a34a1a" : "#8a929c1a", color: r.status === "active" ? "#16a34a" : "#8a929c" }}>{r.status}</button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDrawer({ ...r })} className={cn("p-1.5 rounded-lg", hover, sub)}><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setConfirm({ title: "Delete category?", message: `"${r.name}" will be removed from the homepage.`, onConfirm: () => remove(r.id) })} className={cn("p-1.5 rounded-lg text-red-500", hover)}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className={cn("text-[11px]", sub)}>Tip: drag rows (⋮) or use the arrows to reorder. Changes to the frontend are live after saving.</p>

      {/* DRAWER */}
      {drawer && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDrawer(null)}>
          <div className={cn("w-full max-w-lg h-full overflow-y-auto border-l p-5 space-y-4", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className={cn("text-base font-extrabold", txt)}>{drawer._new ? "Add Category" : "Edit Category"}</p>
              <button onClick={() => setDrawer(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button>
            </div>

            {/* Image + preview */}
            <div>
              <label className={labelCls}>Category Image (JPG / PNG / WEBP)</label>
              <div className="flex items-center gap-3">
                <div className={cn("w-20 h-20 overflow-hidden ring-1 ring-black/10 shrink-0", RADIUS_CLS(drawer.border_radius))} style={{ background: drawer.bg_color || "#f4f5f7" }}>
                  {drawer.image_url ? <img src={drawer.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImagePlus className={cn("w-6 h-6", sub)} /></div>}
                </div>
                <div className="space-y-1.5">
                  <label className={cn(btnGhost, "cursor-pointer")}>
                    <ImagePlus className="w-3.5 h-3.5" /> Upload
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0])} />
                  </label>
                  <input value={drawer.image_url || ""} onChange={e => setDrawer(d => ({ ...d, image_url: e.target.value }))} className={cn(inpCls, "h-8 text-xs w-64 max-w-full")} placeholder="or paste image URL" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={labelCls}>Category Name *</label><input value={drawer.name} onChange={e => setDrawer(d => ({ ...d, name: e.target.value }))} className={inpCls} placeholder="Hoodies" /></div>
              <div className="col-span-2"><label className={labelCls}>Linked Category</label>
                <select value={drawer.linked_category_id || ""} onChange={e => setDrawer(d => ({ ...d, linked_category_id: e.target.value }))} className={inpCls}>
                  <option value="">— None —</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={labelCls}>Alt Text (SEO)</label><input value={drawer.alt_text || ""} onChange={e => setDrawer(d => ({ ...d, alt_text: e.target.value }))} className={inpCls} placeholder="Hoodies category" /></div>
              <div><label className={labelCls}>Display Order</label><input type="number" value={drawer.display_order} onChange={e => setDrawer(d => ({ ...d, display_order: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Status</label><select value={drawer.status} onChange={e => setDrawer(d => ({ ...d, status: e.target.value }))} className={inpCls}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              <div><label className={labelCls}>Open Link</label><select value={drawer.open_new_tab ? "new" : "same"} onChange={e => setDrawer(d => ({ ...d, open_new_tab: e.target.value === "new" }))} className={inpCls}><option value="same">Same tab</option><option value="new">New tab</option></select></div>
              <div><label className={labelCls}>Border Radius</label><select value={drawer.border_radius} onChange={e => setDrawer(d => ({ ...d, border_radius: e.target.value }))} className={inpCls}><option value="circle">Circle</option><option value="rounded">Rounded</option><option value="square">Square</option></select></div>
              <div><label className={labelCls}>Background Color</label><div className="flex gap-2 items-center"><input type="color" value={drawer.bg_color || "#eef0f3"} onChange={e => setDrawer(d => ({ ...d, bg_color: e.target.value }))} className="w-10 h-[42px] rounded-[11px] border-0 bg-transparent" /><input value={drawer.bg_color || ""} onChange={e => setDrawer(d => ({ ...d, bg_color: e.target.value }))} className={inpCls} placeholder="optional" /></div></div>
              <label className={cn("col-span-2 flex items-center gap-2 text-sm cursor-pointer", txt)}><input type="checkbox" checked={drawer.show_on_homepage} onChange={e => setDrawer(d => ({ ...d, show_on_homepage: e.target.checked }))} /> Show on Homepage</label>
            </div>

            <button onClick={save} disabled={busy || !drawer.name} className={cn(btnPrimary, "w-full justify-center h-10")}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {drawer._new ? "Add Category" : "Save Changes"}</button>
          </div>
        </div>
      )}

      {/* PREVIEW */}
      {preview && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50" onClick={() => setPreview(false)}>
          <div className={cn("w-full max-w-3xl rounded-[18px] border p-5", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><p className={cn("text-base font-extrabold", txt)}>Homepage Preview</p><button onClick={() => setPreview(false)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {rows.filter(r => r.status === "active" && r.show_on_homepage).map(r => (
                <div key={r.id} className="flex flex-col items-center gap-2">
                  <div className={cn("w-[70px] aspect-square overflow-hidden ring-1 ring-black/5", RADIUS_CLS(r.border_radius))} style={{ background: r.bg_color || "#eef0f3" }}>{r.image_url && <img src={r.image_url} alt={r.alt_text || r.name} className="w-full h-full object-cover" />}</div>
                  <span className={cn("text-[12px] font-semibold text-center", txt)}>{r.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirm(null)}>
          <div className={cn("w-full max-w-sm rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><AlertTriangle className="w-5 h-5 text-red-500" /> {confirm.title}</p>
            <p className={cn("text-sm", sub)}>{confirm.message}</p>
            <div className="flex gap-2 justify-end"><button onClick={() => setConfirm(null)} className={btnGhost}>Cancel</button><button onClick={() => { confirm.onConfirm(); setConfirm(null); }} className="h-9 px-4 rounded-[10px] text-white text-xs font-bold bg-red-500 hover:bg-red-600">Confirm</button></div>
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}
