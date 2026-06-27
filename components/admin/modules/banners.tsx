"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Edit3, Trash2, Image as ImageIcon } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";

type Banner = {
  id: string;
  title: string;
  location: string;
  image: string;
  link: string;
  status: "active" | "scheduled" | "inactive";
};

const LOCATIONS = [
  { id: "hero", label: "Hero Banner", size: "1920×600px" },
  { id: "category", label: "Category Headers", size: "1200×300px" },
  { id: "promo", label: "Promotional Strips", size: "1200×120px" },
  { id: "sidebar", label: "Sidebar Banners", size: "400×500px" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "#e8f7ee", text: "#16a34a" },
  scheduled: { bg: "#eaf1fb", text: "#2563eb" },
  inactive: { bg: "#eef1f5", text: "#6b7280" },
};

const MOCK_BANNERS: Banner[] = [
  { id: "1", title: "Summer Sale Hero", location: "hero", image: "", link: "/deals", status: "active" },
  { id: "2", title: "New Arrivals", location: "hero", image: "", link: "/new-arrivals", status: "active" },
  { id: "3", title: "Basketball Category", location: "category", image: "", link: "/category/basketball", status: "active" },
  { id: "4", title: "Free Shipping Strip", location: "promo", image: "", link: "/shop", status: "scheduled" },
  { id: "5", title: "Brand Spotlight", location: "sidebar", image: "", link: "/shop", status: "inactive" },
];

type Props = { dark: boolean };

export function AdminBanners({ dark }: Props) {
  const [banners, setBanners] = useState<Banner[]>(MOCK_BANNERS);
  const [editorBanner, setEditorBanner] = useState<Banner | null | undefined>(undefined);

  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inpCls = cn("w-full h-[46px] rounded-[11px] border-[1.5px] px-4 text-sm outline-none", dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]");

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("hero");
  const [image, setImage] = useState("");
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<"active" | "scheduled" | "inactive">("active");

  const openEditor = (banner: Banner | null) => {
    if (banner) {
      setTitle(banner.title); setLocation(banner.location);
      setImage(banner.image); setLink(banner.link); setStatus(banner.status);
    } else {
      setTitle(""); setLocation("hero"); setImage(""); setLink(""); setStatus("active");
    }
    setEditorBanner(banner);
  };

  const handleSave = () => {
    if (!title) return;
    if (editorBanner) {
      setBanners(banners.map((b) => b.id === editorBanner.id ? { ...b, title, location, image, link, status } : b));
    } else {
      setBanners([...banners, { id: String(Date.now()), title, location, image, link, status }]);
    }
    setEditorBanner(undefined);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Delete this banner?")) setBanners(banners.filter((b) => b.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn("text-lg font-extrabold", txt)}>Banners</h2>
          <p className={cn("text-sm", sub)}>Manage every banner across the storefront</p>
        </div>
        <button onClick={() => openEditor(null)} className="h-[42px] px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#1d4ed8]">
          <Plus className="w-4 h-4" /> Add New Banner
        </button>
      </div>

      {LOCATIONS.map((loc) => {
        const locBanners = banners.filter((b) => b.location === loc.id);
        return (
          <div key={loc.id} className={cn("rounded-[16px] border p-5", p, brd)}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={cn("text-sm font-bold", txt)}>{loc.label}</h3>
                <p className={cn("text-xs", sub)}>Recommended: {loc.size}</p>
              </div>
              <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", dark ? "bg-[#1d242e] text-[#8b95a3]" : "bg-[#f6f8fb] text-[#8a929c]")}>{locBanners.length} banner{locBanners.length !== 1 ? "s" : ""}</span>
            </div>
            {locBanners.length === 0 ? (
              <div className={cn("border border-dashed rounded-[12px] p-8 text-center", brd)}>
                <ImageIcon className={cn("w-8 h-8 mx-auto mb-2", sub)} />
                <p className={cn("text-sm", sub)}>No banners in this location</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {locBanners.map((b) => {
                  const sc = STATUS_COLORS[b.status];
                  return (
                    <div key={b.id} className={cn("border rounded-[12px] overflow-hidden", brd)}>
                      <div className={cn("h-32 flex items-center justify-center", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                        {b.image ? <img src={b.image} alt="" className="w-full h-full object-cover" /> : <ImageIcon className={cn("w-10 h-10", sub)} />}
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className={cn("text-sm font-semibold truncate", txt)}>{b.title}</p>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold capitalize" style={{ background: sc.bg, color: sc.text }}>{b.status}</span>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => openEditor(b)} className="text-xs font-semibold text-[#2563eb] hover:underline flex items-center gap-1"><Edit3 className="w-3 h-3" /> Edit</button>
                          <button onClick={() => handleDelete(b.id)} className="text-xs font-semibold text-[#ef4444] hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {editorBanner !== undefined && (
        <Drawer open onClose={() => setEditorBanner(undefined)} title={editorBanner ? "Edit Banner" : "Add Banner"} className="max-w-md">
          <div className="space-y-4">
            <div>
              <label className={cn("text-xs font-semibold mb-1.5 block", txt)}>Banner Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inpCls} placeholder="Summer Sale Hero" />
            </div>
            <div>
              <label className={cn("text-xs font-semibold mb-1.5 block", txt)}>Location</label>
              <select value={location} onChange={(e) => setLocation(e.target.value)} className={inpCls}>
                {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.label} ({l.size})</option>)}
              </select>
            </div>
            <div>
              <label className={cn("text-xs font-semibold mb-1.5 block", txt)}>Image URL</label>
              <input value={image} onChange={(e) => setImage(e.target.value)} className={inpCls} placeholder="https://..." />
            </div>
            <div>
              <label className={cn("text-xs font-semibold mb-1.5 block", txt)}>Link to Page</label>
              <input value={link} onChange={(e) => setLink(e.target.value)} className={inpCls} placeholder="/deals" />
            </div>
            <div>
              <label className={cn("text-xs font-semibold mb-1.5 block", txt)}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Banner["status"])} className={inpCls}>
                <option value="active">Active</option>
                <option value="scheduled">Scheduled</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button onClick={handleSave} className="w-full h-[46px] rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] mt-4">
              {editorBanner ? "Update Banner" : "Create Banner"}
            </button>
          </div>
        </Drawer>
      )}
    </div>
  );
}
