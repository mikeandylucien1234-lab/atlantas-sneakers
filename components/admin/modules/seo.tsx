// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Search, RefreshCw, Save, Loader2, Plus, Trash2, ExternalLink, Download,
  Globe, Share2, Image as ImageIcon, Map, FileCode, ArrowRightLeft,
  Activity, BarChart3, CheckCircle2, XCircle, AlertTriangle, History,
  Gauge, Link2, Bot, Upload, Globe2, TrendingUp,
} from "lucide-react";

type Props = { dark: boolean };

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "global", label: "Global SEO", icon: Globe },
  { id: "social", label: "Social Sharing", icon: Share2 },
  { id: "icons", label: "Favicon & Icons", icon: ImageIcon },
  { id: "sitemap", label: "Sitemap", icon: Map },
  { id: "robots", label: "Robots.txt", icon: Bot },
  { id: "redirects", label: "Redirects", icon: ArrowRightLeft },
  { id: "analyzer", label: "SEO Analyzer", icon: Activity },
  { id: "integrations", label: "Google & Bing", icon: Globe2 },
];

function fmtDT(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }

export function AdminSeo({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const inpCls = cn("w-full h-[42px] rounded-[11px] border-[1.5px] px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]");
  const taCls = cn("w-full rounded-[11px] border-[1.5px] p-3 text-sm outline-none resize-y transition-colors", inp, "focus:border-[#2563eb]");
  const labelCls = cn("text-[12px] font-semibold mb-1.5 block", txt);
  const cardCls = cn("rounded-[16px] border", p, brd);
  const btnGhost = cn("h-10 px-4 rounded-[11px] text-sm font-semibold border transition-colors flex items-center gap-2", brd, txt, hover);

  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({});
  const [dash, setDash] = useState(null);
  const [redirects, setRedirects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [newRedirect, setNewRedirect] = useState({ from_path: "", to_path: "", redirect_type: "301", notes: "" });
  const [toast, setToast] = useState(null);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "") || (typeof window !== "undefined" ? window.location.origin : "");

  const showToast = useCallback((message, type = "success") => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); }, []);
  const setField = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, dRes, rRes] = await Promise.all([
        fetch("/api/admin/seo?section=settings"),
        fetch("/api/admin/seo?section=dashboard"),
        fetch("/api/admin/seo?section=redirects"),
      ]);
      if (sRes.ok) setSettings((await sRes.json()).settings || {});
      if (dRes.ok) setDash(await dRes.json());
      if (rRes.ok) setRedirects((await rRes.json()).redirects || []);
    } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveSettings = async (keys) => {
    setSaving(true);
    try {
      const payload = {};
      keys.forEach(k => { payload[k] = settings[k] ?? null; });
      const res = await fetch("/api/admin/seo", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        // Direct fallback if host blocks
        const supabase = createClient();
        const { error } = await supabase.from("seo_settings").upsert({ id: "global", ...payload, updated_at: new Date().toISOString() }, { onConflict: "id" });
        if (error) throw new Error(error.message);
      }
      showToast("Saved");
    } catch (e) { showToast(e.message || "Save failed", "error"); } finally { setSaving(false); }
  };

  const uploadIcon = async (field, file) => {
    if (!file.type.startsWith("image/")) { showToast("Choose an image", "error"); return; }
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const path = `seo/${field}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw new Error(error.message);
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      setField(field, pub.publicUrl);
      showToast("Uploaded — remember to Save");
    } catch (e) { showToast(e.message || "Upload failed", "error"); }
  };

  const addRedirect = async () => {
    if (!newRedirect.from_path.trim()) { showToast("From path is required", "error"); return; }
    try {
      const res = await fetch("/api/admin/seo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add_redirect", ...newRedirect }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setNewRedirect({ from_path: "", to_path: "", redirect_type: "301", notes: "" });
      showToast("Redirect added"); load();
    } catch (e) { showToast(e.message, "error"); }
  };
  const toggleRedirect = async (r) => {
    await fetch("/api/admin/seo", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, is_active: !r.is_active }) });
    load();
  };
  const deleteRedirect = async (id) => {
    await fetch(`/api/admin/seo?id=${id}`, { method: "DELETE" });
    showToast("Redirect removed"); load();
  };

  const generateSitemap = async () => {
    try {
      const res = await fetch("/api/admin/seo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate_sitemap" }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showToast(`Sitemap ready — ${d.urlCount} URLs`); load();
    } catch (e) { showToast(e.message, "error"); }
  };

  const previewTitle = (settings.global_meta_title || `${settings.site_name || "Atlanta Sneakers"} ${settings.separator || "|"} Premium Sneaker Marketplace`);

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("rounded-[16px] border h-24 animate-pulse", p, brd)} />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={cn("text-[20px] font-extrabold tracking-[-.02em]", txt)}>SEO Management Center</h1>
          <p className={cn("text-xs mt-0.5", sub)}>Manage all search engine optimization for Atlanta Sneakers from one place.</p>
        </div>
        <button onClick={load} className={btnGhost}><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      {/* TABS */}
      <div className={cn(cardCls, "p-1.5 flex gap-1 overflow-x-auto")}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("h-9 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors", tab === t.id ? "bg-[#2563eb] text-white" : cn(sub, hover))}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* DASHBOARD */}
      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            {/* Score gauge */}
            <div className={cn(cardCls, "p-5 flex flex-col items-center justify-center")}>
              <div className="relative w-36 h-36">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" className={dark ? "stroke-[#252c36]" : "stroke-[#eef0f3]"} />
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="10" strokeLinecap="round"
                    stroke={dash.score >= 80 ? "#16a34a" : dash.score >= 50 ? "#ea7317" : "#dc2626"}
                    strokeDasharray={`${(dash.score / 100) * 264} 264`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn("text-3xl font-extrabold", txt)}>{dash.score}</span>
                  <span className={cn("text-[10px] font-bold uppercase", sub)}>SEO Score</span>
                </div>
              </div>
              <p className={cn("text-xs mt-3 text-center", sub)}>{dash.score >= 80 ? "Excellent SEO health" : dash.score >= 50 ? "Room for improvement" : "Needs attention"}</p>
            </div>
            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                ["Indexable Pages", dash.indexablePages, CheckCircle2, "#16a34a"],
                ["Missing Meta Title", dash.missingTitle, AlertTriangle, dash.missingTitle ? "#dc2626" : "#16a34a"],
                ["Missing Description", dash.missingDescription, AlertTriangle, dash.missingDescription ? "#dc2626" : "#16a34a"],
                ["Pages With Errors", dash.pagesWithErrors, XCircle, dash.pagesWithErrors ? "#ea7317" : "#16a34a"],
                ["Duplicate URLs", dash.duplicateUrls, Link2, dash.duplicateUrls ? "#dc2626" : "#16a34a"],
                ["Total Indexable", dash.totalIndexable, BarChart3, "#2563eb"],
              ].map(([label, val, Icon, color]) => (
                <div key={label} className={cn(cardCls, "p-3.5")}>
                  <div className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-2" style={{ backgroundColor: `${color}1a` }}><Icon className="w-4 h-4" style={{ color }} /></div>
                  <p className={cn("text-[19px] font-extrabold", txt)}>{val}</p>
                  <p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Status + recent */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={cn(cardCls, "p-4")}>
              <p className={cn("text-xs font-bold uppercase tracking-wider mb-3", sub)}>Technical Status</p>
              <div className="space-y-2">
                {[
                  ["Sitemap", dash.lastSitemap ? `Generated ${fmtDT(dash.lastSitemap.created_at)} · ${dash.lastSitemap.url_count} URLs` : "Live at /sitemap.xml", true],
                  ["Robots.txt", "Served from your editable config", true],
                  ["Structured Data", "Organization + WebSite schema active", true],
                ].map(([label, detail, ok]) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div><p className={cn("text-xs font-bold", txt)}>{label}</p><p className={cn("text-[10px]", sub)}>{detail}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className={cn(cardCls, "p-4")}>
              <p className={cn("text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5", sub)}><History className="w-3.5 h-3.5" /> Recent SEO Changes</p>
              {(dash.recentChanges || []).length === 0 ? <p className={cn("text-xs", sub)}>No changes recorded yet.</p> : (
                <div className="space-y-1.5">
                  {dash.recentChanges.map((c, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className={cn("text-xs font-semibold capitalize", txt)}>{c.action.replace(/[._]/g, " ")}{c.target ? ` · ${c.target}` : ""}</span>
                      <span className={cn("text-[10px]", sub)}>{c.actor_name} · {fmtDT(c.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(dash.missingTitle > 0 || dash.duplicateUrls > 0) && (
            <div className={cn(cardCls, "p-4 border-amber-500/30 bg-amber-500/5 flex items-start gap-3")}>
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className={cn("text-sm font-bold", txt)}>SEO alerts</p>
                <p className={cn("text-xs mt-0.5", sub)}>{dash.missingTitle} item(s) missing a meta title, {dash.missingDescription} missing a description, {dash.duplicateUrls} duplicate slug(s). Open the SEO Analyzer tab for the full list.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GLOBAL */}
      {tab === "global" && (
        <div className={cn(cardCls, "p-5 space-y-4")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Site Name</label><input value={settings.site_name || ""} onChange={e => setField("site_name", e.target.value)} className={inpCls} placeholder="Atlanta Sneakers" /></div>
            <div><label className={labelCls}>Separator</label><input value={settings.separator || ""} onChange={e => setField("separator", e.target.value)} className={inpCls} placeholder="|" /></div>
          </div>
          <div>
            <div className="flex justify-between mb-1.5"><label className={cn("text-[12px] font-semibold", txt)}>Global Meta Title</label><span className={cn("text-[11px]", (settings.global_meta_title?.length || 0) > 60 ? "text-amber-500" : sub)}>{settings.global_meta_title?.length || 0}/60</span></div>
            <input value={settings.global_meta_title || ""} onChange={e => setField("global_meta_title", e.target.value)} className={inpCls} placeholder="Atlanta Sneakers | Premium Sneaker Marketplace" />
          </div>
          <div>
            <div className="flex justify-between mb-1.5"><label className={cn("text-[12px] font-semibold", txt)}>Global Meta Description</label><span className={cn("text-[11px]", (settings.global_meta_description?.length || 0) > 160 ? "text-amber-500" : sub)}>{settings.global_meta_description?.length || 0}/160</span></div>
            <textarea value={settings.global_meta_description || ""} onChange={e => setField("global_meta_description", e.target.value)} rows={3} className={taCls} placeholder="Shop 100% authentic sneakers..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Default Meta Keywords</label><input value={settings.default_keywords || ""} onChange={e => setField("default_keywords", e.target.value)} className={inpCls} placeholder="sneakers, shoes, nike, adidas" /></div>
            <div><label className={labelCls}>Canonical Base URL</label><input value={settings.canonical_base || ""} onChange={e => setField("canonical_base", e.target.value)} className={inpCls} placeholder="https://atlantassneakers.com" /></div>
          </div>
          {/* Google preview */}
          <div className={cn("rounded-[12px] border p-3", brd)}>
            <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-2", sub)}>Google Search Preview</p>
            <p className="text-[#1a0dab] text-[15px] font-medium truncate">{previewTitle}</p>
            <p className="text-[#006621] text-xs truncate">{settings.canonical_base || base || "atlantassneakers.com"}</p>
            <p className="text-[#545454] text-xs mt-0.5 line-clamp-2">{settings.global_meta_description || "Shop 100% authentic sneakers from Nike, Adidas, Jordan and more."}</p>
          </div>
          <button onClick={() => saveSettings(["site_name", "separator", "global_meta_title", "global_meta_description", "default_keywords", "canonical_base"])} disabled={saving} className="h-10 px-5 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Global SEO</button>
        </div>
      )}

      {/* SOCIAL */}
      {tab === "social" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={cn(cardCls, "p-5 space-y-4")}>
            <p className={cn("text-sm font-extrabold flex items-center gap-2", txt)}><Share2 className="w-4 h-4 text-[#2563eb]" /> Facebook / Open Graph</p>
            <div><label className={labelCls}>OG Title</label><input value={settings.og_title || ""} onChange={e => setField("og_title", e.target.value)} className={inpCls} /></div>
            <div><label className={labelCls}>OG Description</label><textarea value={settings.og_description || ""} onChange={e => setField("og_description", e.target.value)} rows={2} className={taCls} /></div>
            <div><label className={labelCls}>OG Image URL</label><input value={settings.og_image || ""} onChange={e => setField("og_image", e.target.value)} className={inpCls} placeholder="https://..." />{settings.og_image && <img src={settings.og_image} alt="" className="mt-2 rounded-[10px] max-h-32 object-cover" />}</div>
          </div>
          <div className={cn(cardCls, "p-5 space-y-4")}>
            <p className={cn("text-sm font-extrabold flex items-center gap-2", txt)}><Share2 className="w-4 h-4 text-[#2563eb]" /> Twitter / X Card</p>
            <div><label className={labelCls}>Card Type</label>
              <select value={settings.twitter_card || "summary_large_image"} onChange={e => setField("twitter_card", e.target.value)} className={inpCls}>
                <option value="summary_large_image">Summary Large Image</option><option value="summary">Summary</option>
              </select>
            </div>
            <div><label className={labelCls}>Twitter Title</label><input value={settings.twitter_title || ""} onChange={e => setField("twitter_title", e.target.value)} className={inpCls} /></div>
            <div><label className={labelCls}>Twitter Description</label><textarea value={settings.twitter_description || ""} onChange={e => setField("twitter_description", e.target.value)} rows={2} className={taCls} /></div>
            <div><label className={labelCls}>Twitter Image URL</label><input value={settings.twitter_image || ""} onChange={e => setField("twitter_image", e.target.value)} className={inpCls} placeholder="https://..." /></div>
          </div>
          <div className="lg:col-span-2">
            <button onClick={() => saveSettings(["og_title", "og_description", "og_image", "twitter_card", "twitter_title", "twitter_description", "twitter_image"])} disabled={saving} className="h-10 px-5 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Social Settings</button>
          </div>
        </div>
      )}

      {/* ICONS */}
      {tab === "icons" && (
        <div className={cn(cardCls, "p-5")}>
          <p className={cn("text-xs mb-4", sub)}>Upload your icons. Provide each size for best cross-device support (favicon 32×32, Apple Touch 180×180, Android 192×192, PWA 512×512).</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[["favicon_url", "Favicon", "32×32"], ["apple_touch_icon", "Apple Touch", "180×180"], ["android_icon", "Android Icon", "192×192"], ["pwa_icon", "PWA Icon", "512×512"]].map(([field, label, size]) => (
              <IconUpload key={field} dark={dark} label={label} size={size} value={settings[field]} onUpload={file => uploadIcon(field, file)} onClear={() => setField(field, "")} />
            ))}
          </div>
          <button onClick={() => saveSettings(["favicon_url", "apple_touch_icon", "android_icon", "pwa_icon"])} disabled={saving} className="mt-4 h-10 px-5 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Icons</button>
        </div>
      )}

      {/* SITEMAP */}
      {tab === "sitemap" && (
        <div className={cn(cardCls, "p-5 space-y-4")}>
          <div className="flex items-start gap-3">
            <Map className="w-5 h-5 text-[#2563eb] mt-0.5" />
            <div>
              <p className={cn("text-sm font-extrabold", txt)}>Dynamic Sitemap</p>
              <p className={cn("text-xs mt-1", sub)}>Your sitemap is generated live from active products, categories and brands — it automatically reflects new, edited or removed content. It includes the homepage, shop, collections and all indexable entities.</p>
            </div>
          </div>
          {dash?.lastSitemap && <div className={cn("rounded-[10px] border p-3", brd)}><p className={cn("text-xs", sub)}>Last generation logged {fmtDT(dash.lastSitemap.created_at)} — <b className={txt}>{dash.lastSitemap.url_count} URLs</b></p></div>}
          <div className="flex flex-wrap gap-2">
            <button onClick={generateSitemap} className="h-10 px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Generate Sitemap</button>
            <a href={`${base}/sitemap.xml`} target="_blank" rel="noreferrer" className={btnGhost}><ExternalLink className="w-4 h-4" /> Preview Sitemap</a>
            <a href={`${base}/sitemap.xml`} download className={btnGhost}><Download className="w-4 h-4" /> Download</a>
          </div>
        </div>
      )}

      {/* ROBOTS */}
      {tab === "robots" && (
        <div className={cn(cardCls, "p-5 space-y-4")}>
          <div className="flex items-start gap-3">
            <Bot className="w-5 h-5 text-[#2563eb] mt-0.5" />
            <div><p className={cn("text-sm font-extrabold", txt)}>Robots.txt Editor</p><p className={cn("text-xs mt-1", sub)}>This is served live at <code className="font-mono">/robots.txt</code>. The sitemap link is appended automatically.</p></div>
          </div>
          <textarea value={settings.robots_txt || ""} onChange={e => setField("robots_txt", e.target.value)} rows={12} className={cn(taCls, "font-mono text-[13px]")} spellCheck={false} />
          {settings.robots_txt && !/user-agent/i.test(settings.robots_txt) && <p className="text-[11px] text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Missing a "User-agent:" line.</p>}
          <div className="flex gap-2">
            <button onClick={() => saveSettings(["robots_txt"])} disabled={saving} className="h-10 px-5 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Robots.txt</button>
            <a href={`${base}/robots.txt`} target="_blank" rel="noreferrer" className={btnGhost}><ExternalLink className="w-4 h-4" /> Preview</a>
          </div>
        </div>
      )}

      {/* REDIRECTS */}
      {tab === "redirects" && (
        <div className="space-y-4">
          <div className={cn(cardCls, "p-4")}>
            <p className={cn("text-sm font-extrabold mb-3", txt)}>Add Redirect</p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px_auto] gap-2 items-end">
              <div><label className={labelCls}>From Path</label><input value={newRedirect.from_path} onChange={e => setNewRedirect(r => ({ ...r, from_path: e.target.value }))} className={inpCls} placeholder="/old-url" /></div>
              <div><label className={labelCls}>To Path {newRedirect.redirect_type === "410" && "(n/a)"}</label><input value={newRedirect.to_path} onChange={e => setNewRedirect(r => ({ ...r, to_path: e.target.value }))} disabled={newRedirect.redirect_type === "410"} className={cn(inpCls, "disabled:opacity-50")} placeholder="/new-url" /></div>
              <div><label className={labelCls}>Type</label><select value={newRedirect.redirect_type} onChange={e => setNewRedirect(r => ({ ...r, redirect_type: e.target.value }))} className={inpCls}><option value="301">301</option><option value="302">302</option><option value="307">307</option><option value="410">410</option></select></div>
              <button onClick={addRedirect} className="h-[42px] px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add</button>
            </div>
          </div>
          <div className={cn(cardCls, "overflow-hidden")}>
            <table className="w-full text-sm">
              <thead><tr className={cn("border-b", brd)}>{["From", "To", "Type", "Hits", "Status", ""].map(h => <th key={h} className={cn("p-3 text-left text-[11px] font-bold uppercase tracking-wider", sub)}>{h}</th>)}</tr></thead>
              <tbody>
                {redirects.length === 0 ? <tr><td colSpan={6} className={cn("p-8 text-center text-xs", sub)}>No redirects configured.</td></tr> :
                  redirects.map(r => (
                    <tr key={r.id} className={cn("border-b last:border-0", brd)}>
                      <td className={cn("p-3 text-xs font-mono", txt)}>{r.from_path}</td>
                      <td className={cn("p-3 text-xs font-mono", sub)}>{r.redirect_type === 410 ? "— (Gone)" : r.to_path}</td>
                      <td className="p-3"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", r.redirect_type === 301 ? "bg-emerald-500/10 text-emerald-600" : r.redirect_type === 410 ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600")}>{r.redirect_type}</span></td>
                      <td className={cn("p-3 text-xs", sub)}>{r.hits}</td>
                      <td className="p-3"><button onClick={() => toggleRedirect(r)} className={cn("w-10 h-5 rounded-full transition-colors relative", r.is_active ? "bg-emerald-500" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}><span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform", r.is_active ? "translate-x-[22px]" : "translate-x-0.5")} /></button></td>
                      <td className="p-3"><button onClick={() => deleteRedirect(r.id)} className="w-7 h-7 rounded-[8px] flex items-center justify-center hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ANALYZER */}
      {tab === "analyzer" && dash && (
        <div className="space-y-4">
          {[
            ["Missing Meta Title", dash.issues?.noTitle, "#dc2626"],
            ["Missing Meta Description", dash.issues?.noDescription, "#ea7317"],
            ["Meta Title Length Issues", dash.issues?.titleLength, "#ca8a04"],
            ["Meta Description Length Issues", dash.issues?.descriptionLength, "#ca8a04"],
          ].map(([title, list, color]) => (
            <div key={title} className={cn(cardCls, "overflow-hidden")}>
              <div className={cn("px-4 py-3 border-b flex items-center justify-between", brd)}>
                <p className={cn("text-sm font-extrabold", txt)}>{title}</p>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: `${color}1a`, color }}>{(list || []).length}</span>
              </div>
              {(list || []).length === 0 ? <p className={cn("px-4 py-4 text-xs flex items-center gap-1.5", sub)}><CheckCircle2 className="w-4 h-4 text-emerald-500" /> No issues found.</p> : (
                <div className={cn("divide-y max-h-64 overflow-y-auto", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
                  {(list || []).slice(0, 50).map((it, i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between">
                      <span className={cn("text-xs font-semibold", txt)}>{it.name}</span>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full uppercase font-bold", dark ? "bg-[#252c36] text-[#8b95a3]" : "bg-[#f0f2f5] text-[#8a929c]")}>{it.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {(dash.issues?.duplicateSlugs || []).length > 0 && (
            <div className={cn(cardCls, "overflow-hidden")}>
              <div className={cn("px-4 py-3 border-b", brd)}><p className={cn("text-sm font-extrabold", txt)}>Duplicate Slugs</p></div>
              <div className={cn("divide-y", dark ? "divide-[#252c36]" : "divide-[#eef0f3]")}>
                {dash.issues.duplicateSlugs.map((d, i) => <div key={i} className="px-4 py-2 flex items-center justify-between"><span className={cn("text-xs font-mono", txt)}>{d.slug}</span><span className="text-[10px] text-red-500 font-bold">{d.count} uses</span></div>)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* INTEGRATIONS */}
      {tab === "integrations" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={cn(cardCls, "p-5 space-y-4")}>
            <p className={cn("text-sm font-extrabold flex items-center gap-2", txt)}><Globe2 className="w-4 h-4 text-[#4285f4]" /> Google</p>
            {[["google_verification", "Search Console Verification", "google-site-verification code"], ["google_analytics_id", "Google Analytics 4 (GA4) ID", "G-XXXXXXXXXX"], ["google_tag_manager_id", "Google Tag Manager ID", "GTM-XXXXXXX"], ["google_merchant_id", "Merchant Center ID", "1234567890"]].map(([field, label, ph]) => (
              <div key={field}><label className={labelCls}>{label}</label><input value={settings[field] || ""} onChange={e => setField(field, e.target.value)} className={inpCls} placeholder={ph} /></div>
            ))}
            <button onClick={() => saveSettings(["google_verification", "google_analytics_id", "google_tag_manager_id", "google_merchant_id"])} disabled={saving} className="h-10 px-5 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Google</button>
          </div>
          <div className={cn(cardCls, "p-5 space-y-4")}>
            <p className={cn("text-sm font-extrabold flex items-center gap-2", txt)}><TrendingUp className="w-4 h-4 text-[#008373]" /> Bing & IndexNow</p>
            {[["bing_verification", "Bing Webmaster Verification", "verification code"], ["indexnow_key", "IndexNow Key", "your-indexnow-key"]].map(([field, label, ph]) => (
              <div key={field}><label className={labelCls}>{label}</label><input value={settings[field] || ""} onChange={e => setField(field, e.target.value)} className={inpCls} placeholder={ph} /></div>
            ))}
            <p className={cn("text-[11px]", sub)}>Verification codes are injected into every page's &lt;head&gt; automatically. GA4 and GTM are loaded site-wide once saved.</p>
            <button onClick={() => saveSettings(["bing_verification", "indexnow_key"])} disabled={saving} className="h-10 px-5 rounded-[11px] bg-[#2563eb] text-white text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Bing</button>
          </div>
        </div>
      )}

      {toast && (
        <div className={cn("fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200", toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]")}>{toast.message}</div>
      )}
    </div>
  );
}

function IconUpload({ dark, label, size, value, onUpload, onClear }) {
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const surface = dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]";
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <p className={cn("text-[11px] font-bold mb-1.5", sub)}>{label} <span className="font-normal">· {size}</span></p>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={async e => { if (e.target.files?.[0]) { setBusy(true); await onUpload(e.target.files[0]); setBusy(false); e.target.value = ""; } }} />
      {value ? (
        <div className={cn("relative rounded-[12px] border overflow-hidden group flex items-center justify-center aspect-square", brd, surface)}>
          <img src={value} alt="" className="max-w-full max-h-full object-contain p-3" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
            <button onClick={() => ref.current?.click()} className="px-2 h-7 rounded-[7px] bg-white text-black text-[10px] font-bold">Replace</button>
            <button onClick={onClear} className="px-2 h-7 rounded-[7px] bg-red-500 text-white text-[10px] font-bold">Remove</button>
          </div>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()} className={cn("rounded-[12px] border-2 border-dashed aspect-square w-full flex flex-col items-center justify-center gap-1", brd)}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin text-[#2563eb]" /> : <Upload className={cn("w-5 h-5", sub)} />}
          <span className={cn("text-[10px] font-semibold", txt)}>{busy ? "Uploading…" : "Upload"}</span>
        </button>
      )}
    </div>
  );
}
