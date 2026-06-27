"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { HardDrive, Download, RotateCcw, Clock, CheckCircle2, Database, Package, Users, ShoppingCart, Image as ImageIcon, Settings } from "lucide-react";

type Props = { dark: boolean };

const BACKUP_HISTORY = [
  { id: "1", date: "Jun 27, 2026 03:00", type: "Automatic", size: "24.8 MB", status: "success" },
  { id: "2", date: "Jun 26, 2026 03:00", type: "Automatic", size: "24.6 MB", status: "success" },
  { id: "3", date: "Jun 25, 2026 14:22", type: "Manual", size: "24.5 MB", status: "success" },
  { id: "4", date: "Jun 25, 2026 03:00", type: "Automatic", size: "24.3 MB", status: "success" },
  { id: "5", date: "Jun 24, 2026 03:00", type: "Automatic", size: "24.1 MB", status: "failed" },
];

const CONTENTS = [
  { label: "Database", icon: Database, key: "db" },
  { label: "Products", icon: Package, key: "products" },
  { label: "Orders", icon: ShoppingCart, key: "orders" },
  { label: "Customers", icon: Users, key: "customers" },
  { label: "Media Files", icon: ImageIcon, key: "media" },
  { label: "Settings", icon: Settings, key: "settings" },
];

const FREQS = ["Every 6 hours", "Every 12 hours", "Daily", "Weekly", "Monthly"];

export function AdminBackup({ dark }: Props) {
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [freqIdx, setFreqIdx] = useState(2);
  const [contentToggles, setContentToggles] = useState<Record<string, boolean>>({ db: true, products: true, orders: true, customers: true, media: false, settings: true });

  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";

  const stats = [
    { label: "Last Backup", value: "Today 03:00", icon: Clock },
    { label: "Backup Size", value: "24.8 MB", icon: HardDrive },
    { label: "Success Rate", value: "96%", icon: CheckCircle2 },
    { label: "Next Scheduled", value: "Tomorrow 03:00", icon: Clock },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={cn("text-lg font-extrabold", txt)}>Backup & Restore</h2>
        <div className="flex gap-2">
          <button className="h-[42px] px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] flex items-center gap-2"><HardDrive className="w-4 h-4" /> Backup Now</button>
          <button className={cn("h-[42px] px-4 rounded-[11px] border text-sm font-semibold flex items-center gap-2", brd, txt)}><RotateCcw className="w-4 h-4" /> Restore</button>
          <button className={cn("h-[42px] px-4 rounded-[11px] border text-sm font-semibold flex items-center gap-2", brd, txt)}><Download className="w-4 h-4" /> Download</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={cn("rounded-[14px] border p-4", p, brd)}>
            <s.icon className={cn("w-5 h-5 mb-2", sub)} />
            <p className={cn("text-lg font-extrabold", txt)}>{s.value}</p>
            <p className={cn("text-[12px] font-semibold mt-1", sub)}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Auto Backup Config */}
      <div className={cn("rounded-[16px] border p-5", p, brd)}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={cn("text-sm font-bold", txt)}>Automatic Backup</h3>
            <p className={cn("text-xs mt-0.5", sub)}>Configure scheduled backups</p>
          </div>
          <span className={cn("px-2.5 py-1 rounded-md text-[11px] font-bold", autoEnabled ? "bg-[#e8f7ee] text-[#16a34a]" : "bg-[#eef1f5] text-[#6b7280]")}>{autoEnabled ? "Enabled" : "Disabled"}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={cn("text-sm", txt)}>Auto Backup</span>
              <button onClick={() => setAutoEnabled(!autoEnabled)} className={cn("w-10 h-6 rounded-full transition-colors relative", autoEnabled ? "bg-[#2563eb]" : dark ? "bg-[#252c36]" : "bg-[#d1d5db]")}>
                <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-transform", autoEnabled ? "left-5" : "left-1")} />
              </button>
            </div>
            <div>
              <label className={cn("text-xs font-semibold mb-1 block", sub)}>Frequency</label>
              <select value={freqIdx} onChange={(e) => setFreqIdx(Number(e.target.value))} className={cn("w-full h-[42px] rounded-[11px] border px-3 text-sm", dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]")}>
                {FREQS.map((f, i) => <option key={f} value={i}>{f}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={cn("p-2 rounded-lg", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}><span className={sub}>Timezone</span><p className={cn("font-semibold", txt)}>UTC</p></div>
              <div className={cn("p-2 rounded-lg", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}><span className={sub}>Last Run</span><p className={cn("font-semibold", txt)}>Today 03:00</p></div>
            </div>
          </div>
          <div>
            <p className={cn("text-xs font-semibold mb-2", sub)}>Storage Usage</p>
            <div className={cn("rounded-[12px] p-4 text-center", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
              <div className="w-24 h-24 rounded-full border-[8px] border-[#2563eb] mx-auto flex items-center justify-center" style={{ borderRightColor: dark ? "#252c36" : "#eef0f3", borderBottomColor: dark ? "#252c36" : "#eef0f3" }}>
                <span className={cn("text-lg font-extrabold", txt)}>34%</span>
              </div>
              <p className={cn("text-xs mt-3", sub)}>148 MB / 500 MB</p>
            </div>
          </div>
        </div>
      </div>

      {/* Backup Contents */}
      <div className={cn("rounded-[16px] border p-5", p, brd)}>
        <h3 className={cn("text-sm font-bold mb-3", txt)}>Backup Contents</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CONTENTS.map((c) => (
            <label key={c.key} className={cn("flex items-center gap-3 p-3 rounded-[12px] border cursor-pointer transition-colors", brd, contentToggles[c.key] ? "border-[#2563eb] bg-[#2563eb]/5" : "")}>
              <input type="checkbox" checked={contentToggles[c.key] ?? false} onChange={(e) => setContentToggles({ ...contentToggles, [c.key]: e.target.checked })} className="rounded" />
              <c.icon className={cn("w-4 h-4", contentToggles[c.key] ? "text-[#2563eb]" : sub)} />
              <span className={cn("text-sm font-medium", txt)}>{c.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* History */}
      <div className={cn("rounded-[16px] border overflow-hidden", p, brd)}>
        <div className="p-4"><h3 className={cn("text-sm font-bold", txt)}>Backup History</h3></div>
        <table className="w-full">
          <thead>
            <tr className={cn("border-b", brd)}>
              {["Date", "Type", "Size", "Status", "Actions"].map((h) => (
                <th key={h} className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BACKUP_HISTORY.map((b) => (
              <tr key={b.id} className={cn("border-b last:border-0", brd)}>
                <td className={cn("p-3 text-sm", txt)}>{b.date}</td>
                <td className={cn("p-3 text-sm", sub)}>{b.type}</td>
                <td className={cn("p-3 text-sm", sub)}>{b.size}</td>
                <td className="p-3">
                  <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-bold capitalize", b.status === "success" ? "bg-[#e8f7ee] text-[#16a34a]" : "bg-[#fde8ec] text-[#ef4444]")}>{b.status}</span>
                </td>
                <td className="p-3">
                  <button className="text-xs font-semibold text-[#2563eb] hover:underline mr-3">Download</button>
                  <button className="text-xs font-semibold text-[#2563eb] hover:underline">Restore</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
