// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Megaphone, Plus, X, Loader2, Save, Trash2, ArrowUp, ArrowDown, Pencil, Eye, EyeOff, ExternalLink } from "lucide-react";

const ANIMATIONS = [
  ["fade", "Fade In / Out"], ["slide", "Slide"], ["bounce", "Bounce"], ["zoom", "Zoom"], ["pulse", "Pulse"],
  ["marquee_left", "Marquee → left (continuous)"], ["marquee_right", "Marquee → right (continuous)"],
];
const SPEEDS = [["very_slow", "Very slow"], ["slow", "Slow"], ["normal", "Normal"], ["fast", "Fast"], ["very_fast", "Very fast"]];
const ICONS = ["gift", "flash", "truck", "promotion", "percent", "star", "fire", "coupon", "none"];
const ICON_LABEL = { gift: "🎁 Gift", flash: "⚡ Flash", truck: "🚚 Delivery", promotion: "🏷️ Promotion", percent: "％ Percent", star: "⭐ Star", fire: "🔥 Fire", coupon: "🎟️ Coupon", none: "— None" };

export function AdminAnnouncementBar({ dark }: { dark: boolean }) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inpBg = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inpBg, "focus:border-[#2563eb]");
  const labelCls = cn("text-[12px] font-semibold mb-1.5 block", txt);
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnPrimary = "h-9 px-3 rounded-[10px] bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-1.5";
  const btnGhost = cn("h-9 px-3 rounded-[10px] text-xs font-semibold border flex items-center gap-1.5", brd, txt, hover);
  const divide = dark ? "divide-[#252c36]" : "divide-[#eef0f3]";

  const [toast, setToast] = useState(null);
  const showToast = (m, type = "success") => { setToast({ m, type }); setTimeout(() => setToast(null), 2800); };
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [rows, setRows] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [busy, setBusy] = useState(false);

  const sb = () => createClient();
  const authed = async () => { const s = sb(); const { data } = await s.auth.getSession(); if (!data?.session) throw new Error("Session expired — sign in again."); return s; };

  const load = useCallback(async () => {
    try {
      const [{ data: st }, { data: ann }] = await Promise.all([
        sb().from("announcement_settings").select("*").eq("id", "global").maybeSingle(),
        sb().from("announcements").select("*").order("sort_order"),
      ]);
      setSettings(st || { id: "global", enabled: true, animation: "fade", speed: "normal", bg_color: "#0a0b0d", text_color: "#e9ecf1", icon_color: "#5fd08a", link_color: "#7fb0ff" });
      setRows(ann || []);
    } catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setBusy(true);
    try { const s = await authed(); const { error } = await s.from("announcement_settings").update({ ...settings, updated_at: new Date().toISOString() }).eq("id", "global"); if (error) throw error; showToast("Settings saved"); }
    catch (e) { showToast(e.message, "error"); } finally { setBusy(false); }
  };

  const emptyAnn = () => ({ _new: true, text: "", icon: "gift", link_url: "", sort_order: rows.length + 1, is_active: true });
  const saveAnn = async () => {
    if (!drawer.text.trim()) { showToast("Text is required", "error"); return; }
    setBusy(true);
    try {
      const s = await authed();
      const payload = { text: drawer.text, icon: drawer.icon, link_url: drawer.link_url || null, sort_order: Number(drawer.sort_order) || 100, is_active: !!drawer.is_active };
      if (drawer._new) { const { error } = await s.from("announcements").insert(payload); if (error) throw error; }
      else { const { error } = await s.from("announcements").update(payload).eq("id", drawer.id); if (error) throw error; }
      showToast("Saved"); setDrawer(null); load();
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(false); }
  };
  const removeAnn = async (id) => { try { const s = await authed(); await s.from("announcements").delete().eq("id", id); showToast("Deleted"); load(); } catch (e) { showToast(e.message, "error"); } };
  const toggleAnn = async (r) => { try { const s = await authed(); await s.from("announcements").update({ is_active: !r.is_active }).eq("id", r.id); load(); } catch (e) { showToast(e.message, "error"); } };
  const move = async (idx, dir) => {
    const next = [...rows]; const j = idx + dir; if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]]; setRows(next);
    try { const s = await authed(); await Promise.all(next.map((r, i) => s.from("announcements").update({ sort_order: i + 1 }).eq("id", r.id))); } catch (e) { showToast(e.message, "error"); load(); }
  };

  const ColorField = ({ label, k }) => (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={settings[k]} onChange={e => setSettings(s => ({ ...s, [k]: e.target.value }))} className="w-10 h-[42px] rounded-[11px] border-0 bg-transparent cursor-pointer" />
        <input value={settings[k]} onChange={e => setSettings(s => ({ ...s, [k]: e.target.value }))} className={inpCls} />
      </div>
    </div>
  );

  if (loading || !settings) return <div className={cn("rounded-[16px] border h-48 animate-pulse", p, brd)} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em] flex items-center gap-2", txt)}><Megaphone className="w-5 h-5 text-[#2563eb]" /> Announcement Bar</h1>
        <p className={cn("text-xs mt-0.5", sub)}>The top strip of the site. Fully dynamic — colors, animation, speed, icons, links and multiple rotating messages.</p>
      </div>

      {/* Live preview */}
      <div className={cn(cardCls, "p-3")}>
        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-2", sub)}>Live preview</p>
        <div className="rounded-[10px] overflow-hidden" style={{ background: settings.bg_color }}>
          <div className="h-[40px] flex items-center justify-center text-[12.5px] font-semibold" style={{ color: settings.text_color }}>
            {rows[0] ? <span dangerouslySetInnerHTML={{ __html: rows[0].text }} /> : <span className={sub}>No announcements yet</span>}
          </div>
        </div>
      </div>

      {/* Global settings */}
      <div className={cn(cardCls, "p-4 space-y-3")}>
        <div className="flex items-center justify-between">
          <p className={cn("text-sm font-bold", txt)}>Display settings</p>
          <button onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))} className={cn("flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full", settings.enabled ? "bg-[#16a34a]/10 text-[#16a34a]" : "bg-[#8a929c]/10 text-[#8a929c]")}>
            {settings.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} {settings.enabled ? "Bar enabled" : "Bar hidden"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Animation</label><select value={settings.animation} onChange={e => setSettings(s => ({ ...s, animation: e.target.value }))} className={inpCls}>{ANIMATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className={labelCls}>Speed</label><select value={settings.speed} onChange={e => setSettings(s => ({ ...s, speed: e.target.value }))} className={inpCls}>{SPEEDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ColorField label="Background" k="bg_color" />
          <ColorField label="Text" k="text_color" />
          <ColorField label="Icons" k="icon_color" />
          <ColorField label="Links" k="link_color" />
        </div>
        <button onClick={saveSettings} disabled={busy} className={cn(btnPrimary, "h-10 px-5")}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save settings</button>
      </div>

      {/* Announcements list */}
      <div className={cn(cardCls, "overflow-hidden")}>
        <div className="flex items-center justify-between p-4">
          <p className={cn("text-sm font-bold", txt)}>Messages <span className={cn("font-normal", sub)}>· {rows.length} · rotate automatically</span></p>
          <button onClick={() => setDrawer(emptyAnn())} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add message</button>
        </div>
        <div className={cn("divide-y", divide)}>
          {rows.length === 0 ? <p className={cn("px-4 py-8 text-center text-xs", sub)}>No messages yet. Click “Add message”.</p> : rows.map((r, idx) => (
            <div key={r.id} className="flex items-center gap-2 px-4 py-3">
              <span className={cn("text-[11px] w-5 text-center font-bold", sub)}>{idx + 1}</span>
              <span className="text-lg">{ICON_LABEL[r.icon]?.split(" ")[0] || ""}</span>
              <span className={cn("flex-1 text-sm truncate", txt)} dangerouslySetInnerHTML={{ __html: r.text }} />
              {r.link_url && <ExternalLink className={cn("w-3.5 h-3.5", sub)} />}
              <button onClick={() => move(idx, -1)} className={cn("p-1 rounded", hover, sub)}><ArrowUp className="w-4 h-4" /></button>
              <button onClick={() => move(idx, 1)} className={cn("p-1 rounded", hover, sub)}><ArrowDown className="w-4 h-4" /></button>
              <button onClick={() => toggleAnn(r)} className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: r.is_active ? "#16a34a1a" : "#8a929c1a", color: r.is_active ? "#16a34a" : "#8a929c" }}>{r.is_active ? "active" : "hidden"}</button>
              <button onClick={() => setDrawer({ ...r })} className={cn("p-1.5 rounded-lg", hover, sub)}><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => removeAnn(r.id)} className={cn("p-1.5 rounded-lg text-red-500", hover)}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setDrawer(null)}>
          <div className={cn("w-full max-w-md h-full overflow-y-auto border-l p-5 space-y-4", p, brd)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className={cn("text-base font-extrabold", txt)}>{drawer._new ? "Add" : "Edit"} message</p><button onClick={() => setDrawer(null)} className={cn("p-1.5 rounded-lg", hover, sub)}><X className="w-4 h-4" /></button></div>
            <div><label className={labelCls}>Text (emojis + simple HTML ok) *</label><textarea rows={3} value={drawer.text} onChange={e => setDrawer(d => ({ ...d, text: e.target.value }))} className={cn("w-full rounded-[11px] border-[1.5px] px-3 py-2 text-sm", inpBg, "focus:border-[#2563eb]")} placeholder="🎁 New members get <b>$10 OFF</b> — CODE: WELCOME10" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Icon</label><select value={drawer.icon} onChange={e => setDrawer(d => ({ ...d, icon: e.target.value }))} className={inpCls}>{ICONS.map(i => <option key={i} value={i}>{ICON_LABEL[i]}</option>)}</select></div>
              <div><label className={labelCls}>Order</label><input type="number" value={drawer.sort_order} onChange={e => setDrawer(d => ({ ...d, sort_order: e.target.value }))} className={inpCls} /></div>
            </div>
            <div><label className={labelCls}>Link (category, product, page or URL — optional)</label><input value={drawer.link_url || ""} onChange={e => setDrawer(d => ({ ...d, link_url: e.target.value }))} className={inpCls} placeholder="/flash-sale" /></div>
            <div><label className={labelCls}>Status</label><select value={drawer.is_active ? "1" : "0"} onChange={e => setDrawer(d => ({ ...d, is_active: e.target.value === "1" }))} className={inpCls}><option value="1">Active</option><option value="0">Hidden</option></select></div>
            <button onClick={saveAnn} disabled={busy || !drawer.text.trim()} className={cn(btnPrimary, "w-full justify-center h-10")}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
          </div>
        </div>
      )}

      {toast && <div className={cn("fixed bottom-6 right-6 z-[130] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.m}</div>}
    </div>
  );
}
