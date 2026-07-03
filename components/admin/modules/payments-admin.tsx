"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  CreditCard,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";

type Payment = {
  id: string;
  order_id: string;
  gateway: string;
  amount: number;
  currency: string;
  status: string;
  transaction_id: string | null;
  created_at: string;
};

const statusColor: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  completed: { bg: "bg-[#dcfce7]", text: "text-[#16a34a]", darkBg: "bg-[#16a34a]/20", darkText: "text-[#4ade80]" },
  pending: { bg: "bg-[#fef9c3]", text: "text-[#ca8a04]", darkBg: "bg-[#ca8a04]/20", darkText: "text-[#facc15]" },
  processing: { bg: "bg-[#dbeafe]", text: "text-[#2563eb]", darkBg: "bg-[#2563eb]/20", darkText: "text-[#60a5fa]" },
  failed: { bg: "bg-[#fee2e2]", text: "text-[#ef4444]", darkBg: "bg-[#ef4444]/20", darkText: "text-[#f87171]" },
  refunded: { bg: "bg-[#f3e8ff]", text: "text-[#9333ea]", darkBg: "bg-[#9333ea]/20", darkText: "text-[#c084fc]" },
};

const gatewayLabel: Record<string, string> = {
  stripe: "Stripe",
  moncash: "MonCash",
  natcash: "NatCash",
  cod: "Cash on Delivery",
  bank_transfer: "Bank Transfer",
};

export function AdminPayments({ dark }: { dark: boolean }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gatewayFilter, setGatewayFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const perPage = 20;

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
    const supabase = createClient();
    let query = supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * perPage, (page + 1) * perPage - 1);

    if (gatewayFilter !== "all") query = query.eq("gateway", gatewayFilter);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (search) {
      const sanitized = search.replace(/[%_,()]/g, "");
      if (sanitized) query = query.or(`order_id.ilike.%${sanitized}%,transaction_id.ilike.%${sanitized}%`);
    }

    const { data, error: err } = await query;
    if (err) throw new Error(err.message);
    setPayments((data as unknown as Payment[]) ?? []);
    } catch (e: any) {
      setError(e.message ?? "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, [page, gatewayFilter, statusFilter]);

  const kpis = [
    { label: "Total Payments", value: payments.length, icon: CreditCard, color: "#2563eb" },
    { label: "Completed", value: payments.filter((p) => p.status === "completed").length, icon: CheckCircle2, color: "#16a34a" },
    { label: "Pending", value: payments.filter((p) => p.status === "pending").length, icon: Clock, color: "#ca8a04" },
    { label: "Failed", value: payments.filter((p) => p.status === "failed").length, icon: XCircle, color: "#ef4444" },
  ];

  const card = dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className={cn("rounded-[14px] border p-4", card)}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: k.color + "18" }}>
                <k.icon className="w-5 h-5" style={{ color: k.color }} />
              </div>
              <div>
                <p className={cn("text-[22px] font-extrabold", txt)}>{k.value}</p>
                <p className={cn("text-[12px]", sub)}>{k.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-[14px] border border-red-300 bg-red-50 p-4 text-sm text-red-600">
          {error}
          <button onClick={fetchPayments} className="ml-3 underline">Retry</button>
        </div>
      )}

      <div className={cn("rounded-[16px] border", card)}>
        <div className="p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between border-b border-inherit">
          <div className="flex gap-2 flex-wrap">
            {["all", "stripe", "moncash", "natcash", "cod", "bank_transfer"].map((g) => (
              <button
                key={g}
                onClick={() => { setGatewayFilter(g); setPage(0); }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors",
                  gatewayFilter === g
                    ? "bg-[#2563eb] text-white"
                    : dark ? "bg-[#1d242e] text-[#8b95a3] hover:bg-[#252c36]" : "bg-[#f0f2f5] text-[#5b6472] hover:bg-[#e5e7eb]"
                )}
              >
                {g === "all" ? "All" : gatewayLabel[g] ?? g}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <div className={cn("flex items-center gap-2 rounded-[10px] border px-3 py-2", inp)}>
              <Search className="w-4 h-4 opacity-50" />
              <input
                placeholder="Search order/txn ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchPayments()}
                className="bg-transparent outline-none text-[13px] w-[160px]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className={cn("rounded-[10px] border px-3 py-2 text-[13px]", inp)}
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <button onClick={fetchPayments} className="p-2 rounded-[10px] hover:bg-[#2563eb]/10">
              <RefreshCw className={cn("w-4 h-4", sub)} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={cn("border-b border-inherit text-[12px] font-semibold", sub)}>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Gateway</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Transaction ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className={cn("px-4 py-12 text-center text-[13px]", sub)}>Loading...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={7} className={cn("px-4 py-12 text-center text-[13px]", sub)}>No payments found</td></tr>
              ) : payments.map((p) => {
                const sc = statusColor[p.status] ?? statusColor.pending;
                return (
                  <tr key={p.id} className={cn("border-b border-inherit hover:bg-[#2563eb]/5 transition-colors text-[13px]", txt)}>
                    <td className="px-4 py-3 font-semibold">{p.order_id?.slice(0, 8)}...</td>
                    <td className="px-4 py-3">{gatewayLabel[p.gateway] ?? p.gateway}</td>
                    <td className="px-4 py-3 font-bold">{p.currency} {p.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2.5 py-1 rounded-full text-[11px] font-bold", dark ? sc.darkBg + " " + sc.darkText : sc.bg + " " + sc.text)}>
                        {p.status}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 font-mono text-[12px]", sub)}>{p.transaction_id ?? "—"}</td>
                    <td className={cn("px-4 py-3", sub)}>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelected(p)} className="p-1.5 rounded-lg hover:bg-[#2563eb]/10">
                        <Eye className="w-4 h-4 text-[#2563eb]" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-inherit">
          <p className={cn("text-[12px]", sub)}>Page {page + 1}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className={cn("p-1.5 rounded-lg", sub, page === 0 && "opacity-30")}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={payments.length < perPage} className={cn("p-1.5 rounded-lg", sub, payments.length < perPage && "opacity-30")}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div className={cn("w-full max-w-[480px] rounded-[16px] border p-6 mx-4", card)} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn("text-lg font-extrabold", txt)}>Payment Details</h2>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-[#ef4444]/10"><X className="w-5 h-5 text-[#ef4444]" /></button>
            </div>
            <div className="space-y-3 text-[13px]">
              {[
                ["Order", selected.order_id],
                ["Gateway", gatewayLabel[selected.gateway] ?? selected.gateway],
                ["Amount", `${selected.currency} ${selected.amount.toFixed(2)}`],
                ["Status", selected.status],
                ["Transaction ID", selected.transaction_id ?? "—"],
                ["Date", new Date(selected.created_at).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className={sub}>{label}</span>
                  <span className={cn("font-semibold", txt)}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
