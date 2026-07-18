// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Menu, Plus, X, Loader2, Save, Trash2, AlertTriangle, Smartphone,
  GripVertical, ArrowUp, ArrowDown, Eye, Pencil,
  LayoutGrid, User, Baby, Sparkles, Star, Tag, Flame, ShoppingBag, Heart,
  Zap, Gift, Percent, Shirt, Watch, Headphones, Package,
} from "lucide-react";

type Props = { dark: boolean };

// Icon name → component (kept in sync with components/layout/navbar.tsx)
const ICONS = {
  LayoutGrid, User, Baby, Sparkles, Star, Tag, Flame, ShoppingBag, Heart,
  Zap, Gift, Percent, Shirt, Watch, Headphones, Package,
};
const ICON_NAMES = Object.keys(ICONS);

export function AdminHomepageNavTabs({ dark }: Props) {
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
      const [{ data: nt }, { data: c }] = await Promise.all([
        sb().from("homepage_nav_tabs").select("*, category:categories(id,name,slug)").order("display_order"),
        sb().from("categories").select("id,name,slug").order("name"),
      ]);
      setRows(nt || []); setCats(c || []);
    } catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const authed = async () => {
    const supabase = sb();
    const { data } = await supabase.auth.getSession();
    if (!data?.session) throw new Error("Session expired — refresh and sign in again.");
    return supabase;
  };

  const empty = () => ({ _new: true, label: "", href: "", linked_category_id: "", icon: "", display_order: (rows.length + 1), status: "active", open_new_tab: false });

  // The URL a tab resolves to (linked category wins over the manual href).
  const resolvedHref = (r) => (r.category?.slug ? `/category/${r.category.slug}` : (r.href || "/shop"));

  const save = async () => {
    const d = drawer;
    if (!d.label) { showToast("Tab label is required", "error"); return; }
    if (!d.linked_category_id && !d.href) { showToast("Provide a link (URL) or a linked category", "error"); return; }
    setBusy(true);
    try {
      const supabase = await authed();
      const payload = {
        label: d.label, href: d.href || null, linked_category_id: d.linked_category_id || null,
        icon: d.icon || null, display_order: Number(d.display_order) || 100,
        status: d.status, open_new_tab: !!d.open_new_tab,
      };
      if (d._new) { const { error } = await supabase.from("homepage_nav_tabs").insert(payload); if (error) throw error; }
      else { const { error } = await supabase.from("homepage_nav_tabs").update(payload).eq("id", d.id); if (error) throw error; }
      showToast("Saved"); setDrawer(null); load();
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(false); }
  };

  const remove = async (id) => {
    try { const supabase = await authed(); const { error } = await supabase.from("homepage_nav_tabs").delete().eq("id", id); if (error) throw error; showToast("Deleted"); load(); }
    catch (e) { showToast(e.message, "error"); }
  };

  const toggleStatus = async (row) => {
    try { const supabase = await authed(); await supabase.from("homepage_nav_tabs").update({ status: row.status === "active" ? "inactive" : "active" }).eq("id", row.id); load(); }
    catch (e) { showToast(e.message, "error"); }
  };

  const persistOrder = async (ordered) => {
    setRows(ordered);
    try {
      const supabase = await authed();
      await Promise.all(ordered.map((r, i) => supabase.from("homepage_nav_tabs").update({ display_order: i + 1 }).eq("id", r.id)));
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

  const renderIcon = (name, cls) => { const I = ICONS[name]; return I ? <I className={cls} /> : null; };

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-14 animate-pulse", p, brd)} />)}</div>;

  const activeRows = rows.filter(r => r.status === "active");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Menu className="w-5 h-5 text-[#2563eb]" /> Homepage Category Tabs</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Manage the top navigation tabs (All, Men, Women…). Add, reorder, link to a category and enable/disable — changes go live instantly.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setPreview(true)} className={btnGhost}><Smartphone className="w-3.5 h-3.5" /> Mobile Preview</button>
          <button onClick={() => setDrawer(empty())} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add Tab</button>
        </div>
      </div>

      <div className={cn(cardCls, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className={cn("border-b text-left", brd, sub)}>
              {["", "Tab", "Links To", "Position", "Status", "Actions"].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className={cn("divide-y", divide)}>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className={cn("px-4 py-10 text-center", sub)}>No tabs yet. Click “Add Tab”.</td></tr>
              ) : rows.map((r, idx) => (
                <tr key={r.id} draggable onDragStart={() => setDragIdx(idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(idx)} className={cn(hover, dragIdx === idx && "opacity-50")}>
                  <td className="px-2 py-2.5 cursor-grab active:cursor-grabbing"><GripVertical className={cn("w-4 h-4", sub)} /></td>
                  <td className="px-3 py-2.5">
                    <span className={cn("font-bold inline-flex items-center gap-1.5", txt)}>{renderIcon(r.icon, "w-4 h-4 text-[#2563eb]")}{r.label}</span>
                  </td>
                  <td className="px-3 py-2.5"><span className={cn("text-xs", sub)}>{r.category?.name ? `Category: ${r.category.name}` : resolvedHref(r)}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <span className={cn("text-xs font-bold w-5 text-center", txt)}>{r.display_order}</span>
                      <button onClick={() => move(idx, -1)} className={cn("p-1 rounded", hover, sub)}><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => move(idx, 1)} className={cn("p-1 rounded", hover, sub)}><ArrowDown className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => toggleStatus(r)} className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: r.status === "active" ? "#16a34a1a" : "#8a929c1a", color: r.status === "active" ? "#16a34a" : "#8a929c" }}>{r.status === "active" ? "enabled" : "disabled"}</button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDrawer({ ...r })} className={cn("p-1.5 rounded-lg", hover, sub)}><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setConfirm({ title: "Delete tab?", message: `"${r.label}" will be removed from the navigation.`, onConfirm: () => remove(r.id) })} className={cn("p-1.5 rounded-lg text-red-500", hover)}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className={cn("text-[11px]", sub)}>Tip: drag rows (⋮) or use the arrows to reorder. A tab linked to a category always points to that category’s page.</p>

      {/* DRAWER */}
      {drawer && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDrawer(null)}>
          <div className={cn("w-full max-w-lg h-full overflow-y-auto border-l p-5 space-y-4", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className={cn("text-base font-extrabold", txt)}>{drawer._new ? "Add Tab" : "Edit Tab"}</p>
              <button onClick={() => setDrawer(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={labelCls}>Tab Label *</label><input value={drawer.label} onChange={e => setDrawer(d => ({ ...d, label: e.target.value }))} className={inpCls} placeholder="Men" /></div>

              <div className="col-span-2"><label className={labelCls}>Linked Category</label>
                <select value={drawer.linked_category_id || ""} onChange={e => setDrawer(d => ({ ...d, linked_category_id: e.target.value }))} className={inpCls}>
                  <option value="">— None (use custom URL below) —</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={labelCls}>Custom URL {drawer.linked_category_id ? "(overridden by linked category)" : ""}</label><input value={drawer.href || ""} onChange={e => setDrawer(d => ({ ...d, href: e.target.value }))} className={cn(inpCls, drawer.linked_category_id && "opacity-50")} disabled={!!drawer.linked_category_id} placeholder="/new-arrivals" /></div>

              <div className="col-span-2"><label className={labelCls}>Icon (optional)</label>
                <select value={drawer.icon || ""} onChange={e => setDrawer(d => ({ ...d, icon: e.target.value }))} className={inpCls}>
                  <option value="">— No icon —</option>
                  {ICON_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {drawer.icon && <div className={cn("mt-2 inline-flex items-center gap-1.5 text-sm font-semibold", txt)}>{renderIcon(drawer.icon, "w-4 h-4 text-[#2563eb]")} Preview</div>}
              </div>

              <div><label className={labelCls}>Display Order</label><input type="number" value={drawer.display_order} onChange={e => setDrawer(d => ({ ...d, display_order: e.target.value }))} className={inpCls} /></div>
              <div><label className={labelCls}>Status</label><select value={drawer.status} onChange={e => setDrawer(d => ({ ...d, status: e.target.value }))} className={inpCls}><option value="active">Enabled</option><option value="inactive">Disabled</option></select></div>
              <div className="col-span-2"><label className={labelCls}>Open Link</label><select value={drawer.open_new_tab ? "new" : "same"} onChange={e => setDrawer(d => ({ ...d, open_new_tab: e.target.value === "new" }))} className={inpCls}><option value="same">Same tab</option><option value="new">New tab</option></select></div>
            </div>

            <button onClick={save} disabled={busy || !drawer.label} className={cn(btnPrimary, "w-full justify-center h-10")}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {drawer._new ? "Add Tab" : "Save Changes"}</button>
          </div>
        </div>
      )}

      {/* MOBILE PREVIEW */}
      {preview && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50" onClick={() => setPreview(false)}>
          <div className={cn("w-full max-w-sm rounded-[18px] border p-5", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><Smartphone className="w-4 h-4" /> Mobile Preview</p><button onClick={() => setPreview(false)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            <div className="rounded-[18px] border bg-white overflow-hidden" style={{ borderColor: "#eef0f3" }}>
              <div className="px-4 py-3 border-b border-[#eef0f3] flex items-center justify-between">
                <span className="text-[15px] font-extrabold tracking-tight text-[#16181d]">ATLANTA<span className="text-[#2563eb]">SNEAKERS</span></span>
              </div>
              <nav className="flex items-center gap-[20px] px-4 py-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {activeRows.length === 0 ? <span className="text-xs text-[#8a929c]">No enabled tabs</span> : activeRows.map((r, i) => (
                  <span key={r.id} className={cn("shrink-0 inline-flex items-center gap-1.5 text-[14px] font-semibold whitespace-nowrap", i === 0 ? "text-[#2563eb] border-b-2 border-[#2563eb] pb-1" : "text-[#4b5563]")}>
                    {renderIcon(r.icon, "w-[15px] h-[15px]")}{r.label}
                  </span>
                ))}
              </nav>
            </div>
            <p className={cn("text-[11px] mt-3", sub)}>Live preview of the storefront navigation on mobile. Only enabled tabs are shown, in order.</p>
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
