"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Search, Download, ChevronLeft, ChevronRight, Eye, MoreHorizontal, Trash2 } from "lucide-react";
import { OrderDrawer } from "@/components/admin/drawers/order-drawer";
import type { Order } from "@/types";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fdecdd", text: "#ea7317" },
  confirmed: { bg: "#eaf1fb", text: "#2563eb" },
  shipped: { bg: "#efe9fd", text: "#7c3aed" },
  delivered: { bg: "#e8f7ee", text: "#16a34a" },
  cancelled: { bg: "#fde8ec", text: "#ef4444" },
  refunded: { bg: "#eef1f5", text: "#6b7280" },
};

const STATUSES = ["all", "pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"];
const PER_PAGE = 10;

type Props = { dark: boolean };

export function AdminOrders({ dark }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerOrder, setDrawerOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("orders")
        .select("*, items:order_items(*, product:products(name, slug, images))")
        .order("created_at", { ascending: false });
      if (err) throw new Error(err.message);
      setOrders((data as Order[]) ?? []);
    } catch (e: any) {
      setError(e.message ?? "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search && !o.order_number.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const avgOrder = orders.length ? revenue / orders.length : 0;

  const kpis = [
    { label: "Total Orders", value: String(orders.length) },
    { label: "Revenue", value: `$${revenue.toFixed(0)}` },
    { label: "Avg Order", value: `$${avgOrder.toFixed(2)}` },
    { label: "Pending", value: String(pendingCount) },
  ];

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === paginated.length) setSelected(new Set());
    else setSelected(new Set(paginated.map((o) => o.id)));
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    const supabase = createClient();
    await supabase.from("orders").update({ status }).eq("id", orderId);
    fetchOrders();
  };

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className={cn("rounded-[14px] border p-4", p, brd)}>
            <p className={cn("text-[22px] font-extrabold", txt)}>{k.value}</p>
            <p className={cn("text-[12px] font-semibold mt-1", sub)}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className={cn("rounded-[16px] border p-4", p, brd)}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className={cn("flex items-center gap-2 h-[42px] px-3 rounded-[11px] border flex-1 min-w-[200px]", inp)}>
            <Search className="w-4 h-4 shrink-0 opacity-50" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search orders..."
              className="bg-transparent outline-none w-full text-sm"
            />
          </div>
          <button className="h-[42px] px-4 rounded-[11px] bg-[#2563eb] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#1d4ed8] transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-[12px] font-semibold capitalize transition-colors",
                statusFilter === s
                  ? "bg-[#2563eb] text-white"
                  : dark ? "bg-[#1d242e] text-[#8b95a3] hover:bg-[#252c36]" : "bg-[#f6f8fb] text-[#8a929c] hover:bg-[#eef0f3]"
              )}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-[12px] bg-[#2563eb] text-white text-sm font-semibold">
          <span>{selected.size} selected</span>
          <button className="ml-auto px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs">Update Status</button>
          <button className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs">Export</button>
          <button className="px-3 py-1 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-xs flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-[14px] border border-red-300 bg-red-50 p-4 text-sm text-red-600">
          {error}
          <button onClick={fetchOrders} className="ml-3 underline">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className={cn("rounded-[16px] border overflow-hidden", p, brd)}>
        {loading ? (
          <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={cn("border-b", brd)}>
                    <th className="w-10 p-3"><input type="checkbox" checked={selected.size === paginated.length && paginated.length > 0} onChange={toggleAll} className="rounded" /></th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Order #</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Status</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Items</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Total</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Date</th>
                    <th className={cn("text-right text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((o) => {
                    const sc = STATUS_COLORS[o.status] ?? STATUS_COLORS.pending;
                    return (
                      <tr key={o.id} className={cn("border-b last:border-0 transition-colors", brd, dark ? "hover:bg-white/[.03]" : "hover:bg-black/[.02]")}>
                        <td className="p-3"><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} className="rounded" /></td>
                        <td className={cn("p-3 text-sm font-bold", txt)}>{o.order_number}</td>
                        <td className="p-3">
                          <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold capitalize" style={{ background: sc.bg, color: sc.text }}>{o.status}</span>
                        </td>
                        <td className={cn("p-3 text-sm", sub)}>{o.items?.length ?? 0}</td>
                        <td className={cn("p-3 text-sm font-bold", txt)}>${o.total.toFixed(2)}</td>
                        <td className={cn("p-3 text-sm", sub)}>{new Date(o.created_at).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => setDrawerOrder(o)} className="p-1.5 rounded-lg hover:bg-[#2563eb]/10 text-[#2563eb] transition-colors"><Eye className="w-4 h-4" /></button>
                          <button className={cn("p-1.5 rounded-lg transition-colors ml-1", dark ? "hover:bg-white/10 text-[#8b95a3]" : "hover:bg-black/5 text-[#8a929c]")}><MoreHorizontal className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {paginated.length === 0 && (
                    <tr><td colSpan={7} className={cn("p-8 text-center text-sm", sub)}>No orders found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[--brd]" style={{ "--brd": dark ? "#252c36" : "#eef0f3" } as React.CSSProperties}>
              {paginated.map((o) => {
                const sc = STATUS_COLORS[o.status] ?? STATUS_COLORS.pending;
                return (
                  <div key={o.id} className="p-4" onClick={() => setDrawerOrder(o)}>
                    <div className="flex justify-between items-start">
                      <p className={cn("text-sm font-bold", txt)}>{o.order_number}</p>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold capitalize" style={{ background: sc.bg, color: sc.text }}>{o.status}</span>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className={cn("text-xs", sub)}>{new Date(o.created_at).toLocaleDateString()}</span>
                      <span className={cn("text-sm font-bold", txt)}>${o.total.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className={cn("flex items-center justify-between px-4 py-3 border-t", brd)}>
              <p className={cn("text-xs", sub)}>
                {filtered.length} order{filtered.length !== 1 ? "s" : ""} · Page {page} of {totalPages}
              </p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30", dark ? "hover:bg-white/10" : "hover:bg-black/5")}><ChevronLeft className="w-4 h-4" /></button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30", dark ? "hover:bg-white/10" : "hover:bg-black/5")}><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        )}
      </div>

      <OrderDrawer dark={dark} order={drawerOrder} open={!!drawerOrder} onClose={() => setDrawerOrder(null)} onStatusChange={handleStatusChange} />
    </div>
  );
}
