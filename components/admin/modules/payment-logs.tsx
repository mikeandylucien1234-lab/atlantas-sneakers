"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { FileText, Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

type LogEntry = {
  id: string;
  payment_id: string | null;
  gateway: string;
  event_type: string;
  status_code: number | null;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
};

export function AdminPaymentLogs({ dark }: { dark: boolean }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [gatewayFilter, setGatewayFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const perPage = 30;

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
    const supabase = createClient();
    let query = supabase
      .from("payment_logs")
      .select("id,payment_id,gateway,event_type,status_code,latency_ms,error,created_at")
      .order("created_at", { ascending: false })
      .range(page * perPage, (page + 1) * perPage - 1);

    if (gatewayFilter !== "all") query = query.eq("gateway", gatewayFilter);

    const { data, error: err } = await query;
    if (err) throw new Error(err.message);
    setLogs((data as unknown as LogEntry[]) ?? []);
    } catch (e: any) {
      setError(e.message ?? "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [page, gatewayFilter]);

  const card = dark ? "bg-[#171c24] border-[#252c36]" : "bg-white border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";

  return (
    <div className="space-y-5">
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
                    : dark ? "bg-[#1d242e] text-[#8b95a3]" : "bg-[#f0f2f5] text-[#5b6472]"
                )}
              >
                {g === "all" ? "All Gateways" : g}
              </button>
            ))}
          </div>
          <button onClick={fetchLogs} className="p-2 rounded-[10px] hover:bg-[#2563eb]/10">
            <RefreshCw className={cn("w-4 h-4", sub)} />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 rounded-[14px] border border-red-300 bg-red-50 p-4 text-sm text-red-600">
            {error}
            <button onClick={fetchLogs} className="ml-3 underline">Retry</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={cn("border-b border-inherit text-[12px] font-semibold", sub)}>
                <th className="px-4 py-3">Gateway</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Latency</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className={cn("px-4 py-12 text-center text-[13px]", sub)}>Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className={cn("px-4 py-12 text-center text-[13px]", sub)}>No logs found</td></tr>
              ) : logs.map((l) => (
                <tr key={l.id} className={cn("border-b border-inherit text-[13px]", txt)}>
                  <td className="px-4 py-3 font-semibold">{l.gateway}</td>
                  <td className="px-4 py-3">{l.event_type}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[11px] font-bold",
                      l.status_code && l.status_code < 400
                        ? dark ? "bg-[#16a34a]/20 text-[#4ade80]" : "bg-[#dcfce7] text-[#16a34a]"
                        : dark ? "bg-[#ef4444]/20 text-[#f87171]" : "bg-[#fee2e2] text-[#ef4444]"
                    )}>
                      {l.status_code ?? "—"}
                    </span>
                  </td>
                  <td className={cn("px-4 py-3 font-mono text-[12px]", sub)}>{l.latency_ms ? `${l.latency_ms}ms` : "—"}</td>
                  <td className={cn("px-4 py-3 text-[12px] max-w-[200px] truncate", l.error ? "text-[#ef4444]" : sub)}>{l.error ?? "—"}</td>
                  <td className={cn("px-4 py-3", sub)}>{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-inherit">
          <p className={cn("text-[12px]", sub)}>Page {page + 1}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className={cn("p-1.5 rounded-lg", sub, page === 0 && "opacity-30")}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={logs.length < perPage} className={cn("p-1.5 rounded-lg", sub, logs.length < perPage && "opacity-30")}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
