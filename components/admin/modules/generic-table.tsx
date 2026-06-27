"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Search, Plus, ChevronLeft, ChevronRight, Edit3, Trash2, Check, X } from "lucide-react";

const PER_PAGE = 10;

type Props = {
  dark: boolean;
  moduleId: string;
  tableName: string;
  columns: string[];
};

export function AdminGenericTable({ dark, moduleId, tableName, columns }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addValues, setAddValues] = useState<Record<string, string>>({});

  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = cn("h-8 rounded-lg border px-2 text-xs w-full", dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]");
  const inpFull = cn("h-[42px] rounded-[11px] border px-3 text-sm w-full", dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase.from(tableName).select(
      tableName === "flash_deals" ? "*, product:products(name)" :
      tableName === "reviews" ? "*, profile:profiles(full_name), product:products(name)" :
      tableName === "product_variants" ? "*, product:products(name)" : "*"
    );

    if (tableName === "profiles" && moduleId === "customers") {
      query = query.eq("role", "customer");
    }
    if (tableName === "profiles" && moduleId === "staff") {
      query = query.eq("role", "admin");
    }

    const { data } = await query.order("created_at", { ascending: false }).limit(200);
    setRows((data as unknown as Record<string, unknown>[]) ?? []);
    setLoading(false);
  }, [tableName, moduleId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const displayName = (row: Record<string, unknown>, col: string): string => {
    const val = row[col];
    if (val === null || val === undefined) return "—";
    if (typeof val === "boolean") return val ? "Yes" : "No";
    if (typeof val === "object") {
      if (col === "product" && val && typeof val === "object" && "name" in val) return String((val as { name: string }).name);
      if (col === "profile" && val && typeof val === "object" && "full_name" in val) return String((val as { full_name: string }).full_name ?? "—");
      return JSON.stringify(val).slice(0, 40);
    }
    if (col.includes("created_at") || col.includes("ends_at") || col.includes("expires_at")) {
      return new Date(String(val)).toLocaleDateString();
    }
    return String(val);
  };

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return columns.some((c) => String(r[c] ?? "").toLowerCase().includes(q));
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleInlineSave = async (id: string) => {
    const supabase = createClient();
    await supabase.from(tableName).update(editValues).eq("id", id);
    setEditingId(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this record?")) return;
    const supabase = createClient();
    await supabase.from(tableName).delete().eq("id", id);
    fetchData();
  };

  const handleAdd = async () => {
    const supabase = createClient();
    const payload: Record<string, unknown> = {};
    columns.forEach((c) => {
      const v = addValues[c];
      if (!v) return;
      if (v === "true" || v === "false") payload[c] = v === "true";
      else if (!isNaN(Number(v)) && v !== "") payload[c] = Number(v);
      else payload[c] = v;
    });
    await supabase.from(tableName).insert(payload);
    setShowAdd(false);
    setAddValues({});
    fetchData();
  };

  const readOnlyModules = new Set(["loginhistory", "audit", "activity", "rewards"]);
  const canAdd = !readOnlyModules.has(moduleId) && !["profiles", "reviews"].includes(tableName);

  const title = moduleId.charAt(0).toUpperCase() + moduleId.slice(1).replace(/([A-Z])/g, " $1");

  return (
    <div className="space-y-4">
      <div className={cn("rounded-[14px] border p-4", p, brd)}>
        <p className={cn("text-[22px] font-extrabold", txt)}>{rows.length}</p>
        <p className={cn("text-[12px] font-semibold mt-1", sub)}>Total {title}</p>
      </div>

      <div className={cn("rounded-[16px] border p-4", p, brd)}>
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn("flex items-center gap-2 h-[42px] px-3 rounded-[11px] border flex-1 min-w-[200px]", dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]")}>
            <Search className="w-4 h-4 shrink-0 opacity-50" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={`Search ${title.toLowerCase()}...`} className="bg-transparent outline-none w-full text-sm" />
          </div>
          {canAdd && (
            <button onClick={() => setShowAdd(!showAdd)} className="h-[42px] px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#1d4ed8] transition-colors">
              <Plus className="w-4 h-4" /> Add
            </button>
          )}
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className={cn("rounded-[16px] border p-4 space-y-3", p, brd)}>
          <p className={cn("text-sm font-bold", txt)}>Add New Record</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {columns.filter((c) => c !== "created_at").map((c) => (
              <div key={c}>
                <label className={cn("text-xs font-semibold mb-1 block capitalize", sub)}>{c.replace(/_/g, " ")}</label>
                <input value={addValues[c] ?? ""} onChange={(e) => setAddValues({ ...addValues, [c]: e.target.value })} className={inpFull} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="h-[38px] px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8]">Save</button>
            <button onClick={() => setShowAdd(false)} className={cn("h-[38px] px-4 rounded-[11px] border text-sm font-semibold", brd, txt)}>Cancel</button>
          </div>
        </div>
      )}

      <div className={cn("rounded-[16px] border overflow-hidden", p, brd)}>
        {loading ? (
          <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={cn("border-b", brd)}>
                    {columns.map((c) => (
                      <th key={c} className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 capitalize", sub)}>{c.replace(/_/g, " ")}</th>
                    ))}
                    <th className={cn("text-right text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row) => {
                    const id = String(row.id ?? "");
                    const isEditing = editingId === id;
                    return (
                      <tr key={id} className={cn("border-b last:border-0 transition-colors", brd, dark ? "hover:bg-white/[.03]" : "hover:bg-black/[.02]")}>
                        {columns.map((c) => (
                          <td key={c} className="p-3">
                            {isEditing && c !== "created_at" ? (
                              <input value={String(editValues[c] ?? row[c] ?? "")} onChange={(e) => setEditValues({ ...editValues, [c]: e.target.value })} className={inp} />
                            ) : (
                              <span className={cn("text-sm", c === columns[0] ? cn("font-semibold", txt) : sub)}>{displayName(row, c)}</span>
                            )}
                          </td>
                        ))}
                        <td className="p-3 text-right whitespace-nowrap">
                          {isEditing ? (
                            <>
                              <button onClick={() => handleInlineSave(id)} className="p-1.5 rounded-lg hover:bg-[#16a34a]/10 text-[#16a34a]"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-[#ef4444] ml-1"><X className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <>
                              {!readOnlyModules.has(moduleId) && (
                                <button onClick={() => { setEditingId(id); setEditValues({}); }} className="p-1.5 rounded-lg hover:bg-[#2563eb]/10 text-[#2563eb]"><Edit3 className="w-4 h-4" /></button>
                              )}
                              {!readOnlyModules.has(moduleId) && (
                                <button onClick={() => handleDelete(id)} className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-[#ef4444] ml-1"><Trash2 className="w-4 h-4" /></button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {paginated.length === 0 && <tr><td colSpan={columns.length + 1} className={cn("p-8 text-center text-sm", sub)}>No records found.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className={cn("flex items-center justify-between px-4 py-3 border-t", brd)}>
              <p className={cn("text-xs", sub)}>{filtered.length} record{filtered.length !== 1 ? "s" : ""} · Page {page}/{totalPages}</p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30", dark ? "hover:bg-white/10" : "hover:bg-black/5")}><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30", dark ? "hover:bg-white/10" : "hover:bg-black/5")}><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
