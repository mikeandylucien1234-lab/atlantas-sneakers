"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Share2, Plus, X, Loader2, Save, Trash2, AlertTriangle,
  GripVertical, ArrowUp, ArrowDown, Eye, Pencil, ImageIcon, Upload, ExternalLink,
} from "lucide-react";

type Props = { dark: boolean };

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"]);

// A network is "ready" (safe to save) only once it has a real name + a valid
// http(s) URL — never invented, never guessed. Same validation the storefront
// section relies on implicitly (it only ever renders what's actually saved).
function isValidUrl(u: string) {
  try { const p = new URL(u); return p.protocol === "http:" || p.protocol === "https:"; } catch { return false; }
}

export function AdminSocialMedia({ dark }: Props) {
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
  const [rows, setRows] = useState<any[]>([]);
  const [drawer, setDrawer] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlError, setUrlError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((m: string, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 3000); }, []);
  const sb = () => createClient();

  const load = useCallback(async () => {
    try {
      const { data, error } = await sb().from("social_networks").select("*").order("display_order");
      if (error) throw error;
      setRows(data || []);
    } catch (e: any) { showToast(e.message, "error"); } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const authed = async () => {
    const supabase = sb();
    const { data } = await supabase.auth.getSession();
    if (!data?.session) throw new Error("Session expired — refresh and sign in again.");
    return supabase;
  };

  const empty = () => ({ _new: true, name: "", logo_url: "", url: "", is_active: true, display_order: rows.length + 1 });

  const uploadLogo = async (file: File) => {
    setUrlError("");
    if (!ALLOWED_TYPES.has(file.type)) { showToast("Unsupported file type (use JPG, PNG, WebP, GIF, AVIF or SVG)", "error"); return; }
    if (file.size > 4 * 1024 * 1024) { showToast("Logo exceeds the 4MB limit", "error"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      fd.append("bucket", "banner-images");
      fd.append("folder", "social-icons");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.files?.[0]?.url) throw new Error(d.error || "Upload failed");
      setDrawer((cur: any) => ({ ...cur, logo_url: d.files[0].url }));
    } catch (e: any) { showToast(e.message, "error"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const save = async () => {
    const d = drawer;
    if (!d.name?.trim()) { showToast("Social Network Name is required", "error"); return; }
    if (!isValidUrl(d.url?.trim())) { setUrlError("Enter a valid URL, e.g. https://www.instagram.com/atlantasneakers"); return; }
    setUrlError("");
    setBusy(true);
    try {
      const supabase = await authed();
      const payload = {
        name: d.name.trim(), logo_url: d.logo_url || null, url: d.url.trim(),
        is_active: !!d.is_active, display_order: Number(d.display_order) || 100,
      };
      if (d._new) { const { error } = await supabase.from("social_networks").insert(payload); if (error) throw error; }
      else { const { error } = await supabase.from("social_networks").update(payload).eq("id", d.id); if (error) throw error; }
      showToast("Saved"); setDrawer(null); load();
    } catch (e: any) { showToast(e.message, "error"); } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { const supabase = await authed(); const { error } = await supabase.from("social_networks").delete().eq("id", id); if (error) throw error; showToast("Deleted"); load(); }
    catch (e: any) { showToast(e.message, "error"); }
  };

  const toggleActive = async (row: any) => {
    try { const supabase = await authed(); await supabase.from("social_networks").update({ is_active: !row.is_active }).eq("id", row.id); load(); }
    catch (e: any) { showToast(e.message, "error"); }
  };

  const persistOrder = async (ordered: any[]) => {
    setRows(ordered);
    try {
      const supabase = await authed();
      await Promise.all(ordered.map((r, i) => supabase.from("social_networks").update({ display_order: i + 1 }).eq("id", r.id)));
    } catch (e: any) { showToast(e.message, "error"); load(); }
  };
  const move = (idx: number, dir: number) => {
    const next = [...rows]; const j = idx + dir; if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]]; persistOrder(next);
  };
  const onDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...rows]; const [m] = next.splice(dragIdx, 1); next.splice(idx, 0, m); setDragIdx(null); persistOrder(next);
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-14 animate-pulse", p, brd)} />)}</div>;

  const activeRows = rows.filter(r => r.is_active);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Share2 className="w-5 h-5 text-[#2563eb]" /> Social Media</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Manage the official social network links shown on the storefront. Add, reorder, enable/disable — changes go live instantly. Add any new network (Discord, Pinterest, Threads…) without any code change.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setPreview(true)} className={btnGhost}><Eye className="w-3.5 h-3.5" /> Preview</button>
          <button onClick={() => setDrawer(empty())} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add Social Network</button>
        </div>
      </div>

      <div className={cn(cardCls, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className={cn("border-b text-left", brd, sub)}>
              {["", "Logo", "Network", "URL", "Order", "Status", "Actions"].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className={cn("divide-y", divide)}>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className={cn("px-4 py-10 text-center", sub)}>No social networks yet. Click “Add Social Network”.</td></tr>
              ) : rows.map((r, idx) => (
                <tr key={r.id} draggable onDragStart={() => setDragIdx(idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(idx)} className={cn(hover, dragIdx === idx && "opacity-50")}>
                  <td className="px-2 py-2.5 cursor-grab active:cursor-grabbing"><GripVertical className={cn("w-4 h-4", sub)} /></td>
                  <td className="px-3 py-2.5">
                    <div className={cn("w-9 h-9 rounded-[10px] border overflow-hidden flex items-center justify-center shrink-0", brd, dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                      {r.logo_url ? <img src={r.logo_url} alt="" className="w-full h-full object-contain p-1.5" /> : <ImageIcon className={cn("w-4 h-4", sub)} />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><span className={cn("font-bold", txt)}>{r.name}</span></td>
                  <td className="px-3 py-2.5"><a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2563eb] hover:underline inline-flex items-center gap-1 max-w-[220px] truncate">{r.url}<ExternalLink className="w-3 h-3 shrink-0" /></a></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <span className={cn("text-xs font-bold w-5 text-center", txt)}>{r.display_order}</span>
                      <button onClick={() => move(idx, -1)} className={cn("p-1 rounded", hover, sub)}><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => move(idx, 1)} className={cn("p-1 rounded", hover, sub)}><ArrowDown className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => toggleActive(r)} className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: r.is_active ? "#16a34a1a" : "#8a929c1a", color: r.is_active ? "#16a34a" : "#8a929c" }}>{r.is_active ? "active" : "inactive"}</button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDrawer({ ...r })} className={cn("p-1.5 rounded-lg", hover, sub)}><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setConfirm({ title: "Delete this social network?", message: `"${r.name}" will be permanently removed. This cannot be undone.`, onConfirm: () => remove(r.id) })} className={cn("p-1.5 rounded-lg text-red-500", hover)}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className={cn("text-[11px]", sub)}>Tip: drag rows (⋮) or use the arrows to reorder. Only "active" networks are shown to customers on the homepage.</p>

      {/* DRAWER — Add / Edit */}
      {drawer && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDrawer(null)}>
          <div className={cn("w-full max-w-lg h-full overflow-y-auto border-l p-5 space-y-4", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className={cn("text-base font-extrabold", txt)}>{drawer._new ? "Add Social Network" : "Edit Social Network"}</p>
              <button onClick={() => setDrawer(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>Logo</label>
                <div className="flex items-center gap-3">
                  <div className={cn("w-16 h-16 rounded-[12px] border-[1.5px] overflow-hidden flex items-center justify-center shrink-0", brd, dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                    {drawer.logo_url ? <img src={drawer.logo_url} alt="" className="w-full h-full object-contain p-2" /> : <ImageIcon className={cn("w-6 h-6", sub)} />}
                  </div>
                  <div className="flex-1">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={cn(btnGhost, "w-full justify-center")}>
                      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {uploading ? "Uploading…" : drawer.logo_url ? "Replace Logo" : "Upload Logo"}
                    </button>
                    <p className={cn("text-[10px] mt-1", sub)}>JPG, PNG, WebP, GIF, AVIF or SVG — up to 4MB. Displayed at a uniform size regardless of the original dimensions.</p>
                  </div>
                </div>
              </div>

              <div><label className={labelCls}>Social Network Name *</label><input value={drawer.name} onChange={e => setDrawer((d: any) => ({ ...d, name: e.target.value }))} className={inpCls} placeholder="Instagram" /></div>

              <div>
                <label className={labelCls}>Social Media URL *</label>
                <input value={drawer.url} onChange={e => { setDrawer((d: any) => ({ ...d, url: e.target.value })); setUrlError(""); }} className={cn(inpCls, urlError && "border-red-500")} placeholder="https://www.instagram.com/atlantasneakers" />
                {urlError && <p className="text-[11px] text-red-500 mt-1">{urlError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Display Order</label><input type="number" value={drawer.display_order} onChange={e => setDrawer((d: any) => ({ ...d, display_order: e.target.value }))} className={inpCls} /></div>
                <div><label className={labelCls}>Status</label><select value={drawer.is_active ? "active" : "inactive"} onChange={e => setDrawer((d: any) => ({ ...d, is_active: e.target.value === "active" }))} className={inpCls}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              </div>
            </div>

            <button onClick={save} disabled={busy || !drawer.name} className={cn(btnPrimary, "w-full justify-center h-10")}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {drawer._new ? "Add Social Network" : "Save Changes"}</button>
          </div>
        </div>
      )}

      {/* PREVIEW */}
      {preview && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50" onClick={() => setPreview(false)}>
          <div className={cn("w-full max-w-md rounded-[18px] border p-5", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><Eye className="w-4 h-4" /> Storefront Preview</p><button onClick={() => setPreview(false)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            <div className="rounded-[18px] border bg-white overflow-hidden p-6 text-center" style={{ borderColor: "#eef0f3" }}>
              <p className="text-[11px] font-extrabold tracking-[.14em] text-[#2563eb]">FOLLOW ATLANTA SNEAKERS</p>
              <p className="text-[13px] text-[#5b6472] mt-1 mb-4">Stay connected with us</p>
              {activeRows.length === 0 ? <span className="text-xs text-[#8a929c]">No active networks</span> : (
                <div className="flex flex-wrap justify-center gap-3">
                  {activeRows.map(r => (
                    <div key={r.id} className="flex flex-col items-center gap-1.5 w-16">
                      <div className="w-12 h-12 rounded-full border border-[#eef0f3] bg-[#f6f8fb] flex items-center justify-center overflow-hidden">
                        {r.logo_url ? <img src={r.logo_url} alt="" className="w-6 h-6 object-contain" /> : <Share2 className="w-5 h-5 text-[#2563eb]" />}
                      </div>
                      <span className="text-[10px] font-semibold text-[#16181d] truncate w-full text-center">{r.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className={cn("text-[11px] mt-3", sub)}>Live preview of the "Follow Atlanta Sneakers" section on the homepage. Only active networks are shown, in order.</p>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirm(null)}>
          <div className={cn("w-full max-w-sm rounded-[18px] border p-5 space-y-3", p, brd)} onClick={e => e.stopPropagation()}>
            <p className={cn("text-base font-extrabold flex items-center gap-2", txt)}><AlertTriangle className="w-5 h-5 text-red-500" /> {confirm.title}</p>
            <p className={cn("text-sm", sub)}>{confirm.message}</p>
            <div className="flex gap-2 justify-end"><button onClick={() => setConfirm(null)} className={btnGhost}>Cancel</button><button onClick={() => { confirm.onConfirm(); setConfirm(null); }} className="h-9 px-4 rounded-[10px] text-white text-xs font-bold bg-red-500 hover:bg-red-600">Delete</button></div>
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}
