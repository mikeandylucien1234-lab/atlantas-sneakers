// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import {
  Search, ChevronLeft, ChevronRight, Eye, Trash2,
  Download, RefreshCw, X, Loader2, SlidersHorizontal, ArrowUpDown,
  XCircle, CheckCircle2, Clock, Calendar, AlertTriangle,
  MessageSquare, Send, User, ShoppingCart, Package,
  ChevronDown, Plus, Flag, MoreHorizontal, Check,
  Mail, Phone, MapPin, Truck, CreditCard, FileText,
  Paperclip, Lock, Tag, ArrowRight, CircleDot, Inbox,
  Timer, TrendingUp, Users, Zap, BarChart3, Star,
  DollarSign, Shield, Globe, Heart, ChevronUp
} from "lucide-react";

type Props = { dark: boolean };
type SortKey = "created_at" | "priority" | "status" | "updated_at";
type SortOrder = "asc" | "desc";
type DetailTab = "conversation" | "customer" | "order" | "notes" | "timeline";

interface TicketKpis {
  totalTickets: number;
  openTickets: number;
  pendingTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  urgentTickets: number;
  todaysTickets: number;
  monthTickets: number;
}

interface TicketRow {
  id: string;
  user_id: string;
  order_id: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  description: string;
  created_at: string;
  updated_at: string;
  customer?: { id: string; full_name: string | null; email: string; avatar_url: string | null };
  agent?: { id: string; full_name: string | null; email: string } | null;
  message_count?: number;
  last_message_at?: string | null;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_internal: boolean;
  attachments: string[];
  created_at: string;
  sender?: { id: string; full_name: string | null; email: string; avatar_url: string | null; role: string };
}

const defaultKpis: TicketKpis = {
  totalTickets: 0, openTickets: 0, pendingTickets: 0, resolvedTickets: 0,
  closedTickets: 0, urgentTickets: 0, todaysTickets: 0, monthTickets: 0,
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: "#eaf1fb", text: "#2563eb" },
  pending: { bg: "#fdecdd", text: "#ea7317" },
  in_progress: { bg: "#efe9fd", text: "#7c3aed" },
  resolved: { bg: "#e8f7ee", text: "#16a34a" },
  closed: { bg: "#eef1f5", text: "#6b7280" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: "#eef1f5", text: "#6b7280" },
  medium: { bg: "#eaf1fb", text: "#2563eb" },
  high: { bg: "#fdecdd", text: "#ea7317" },
  urgent: { bg: "#fde8ec", text: "#ef4444" },
};

const CATEGORIES = ["all", "order_issue", "shipping", "payment", "refund", "return", "exchange", "product_quality", "technical", "account", "other"];
const STATUSES = ["all", "open", "pending", "in_progress", "resolved", "closed"];
const PRIORITIES = ["all", "low", "medium", "high", "urgent"];

const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
const fmtCurrency = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const timeAgo = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const categoryLabel = (c: string) => c.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export function AdminTickets({ dark }: Props) {
  const p = dark ? "bg-[#171c24]" : "bg-white";
  const brd = dark ? "border-[#252c36]" : "border-[#eef0f3]";
  const txt = dark ? "text-[#e7ebf0]" : "text-[#16181d]";
  const sub = dark ? "text-[#8b95a3]" : "text-[#8a929c]";
  const inp = dark ? "bg-[#1d242e] border-[#252c36] text-[#e7ebf0]" : "bg-[#f6f8fb] border-[#eef0f3] text-[#16181d]";
  const hover = dark ? "hover:bg-white/[.04]" : "hover:bg-black/[.02]";
  const selectCls = cn("h-[38px] rounded-[10px] border px-2.5 text-[13px] outline-none bg-transparent", brd, txt);

  const [kpis, setKpis] = useState<TicketKpis>(defaultKpis);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);

  const [detailTicket, setDetailTicket] = useState<TicketRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("conversation");
  const [detailData, setDetailData] = useState<Record<string, any> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [messages, setMessages] = useState<TicketMessage[]>([]);

  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [replySending, setReplySending] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubject, setCreateSubject] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createCategory, setCreateCategory] = useState("other");
  const [createPriority, setCreatePriority] = useState("medium");
  const [createEmail, setCreateEmail] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── FETCH ──
  const fetchKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const res = await fetch("/api/admin/tickets?section=kpis");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setKpis(data.kpis || data);
    } catch { /* silent */ } finally { setKpisLoading(false); }
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ section: "list", page: String(page), per_page: String(perPage), sort_by: sortKey, sort_order: sortOrder });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`/api/admin/tickets?${params}`);
      if (!res.ok) throw new Error("Failed to load tickets");
      const data = await res.json();
      setTickets(data.tickets || []);
      setTotal(data.total || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }, [page, perPage, search, statusFilter, priorityFilter, categoryFilter, dateFrom, dateTo, sortKey, sortOrder]);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);
  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleSearch = (v: string) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setSearch(v); setPage(1); }, 300);
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortOrder("desc"); }
    setPage(1);
  };

  const allSelected = tickets.length > 0 && tickets.every(t => selected.has(t.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(tickets.map(t => t.id)));
  };

  // ── DETAIL ──
  const openDetail = async (ticket: TicketRow) => {
    setDetailTicket(ticket);
    setDetailTab("conversation");
    setDetailLoading(true);
    setDetailData(null);
    setMessages([]);
    setReplyText("");
    try {
      const res = await fetch(`/api/admin/tickets?section=detail&id=${ticket.id}`);
      if (res.ok) {
        const d = await res.json();
        setDetailData(d.ticket || d);
        setMessages(d.ticket?.messages || d.messages || []);
      }
    } catch { /* silent */ } finally { setDetailLoading(false); }
  };

  useEffect(() => {
    if (messages.length > 0) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── SEND MESSAGE ──
  const handleSendMessage = async () => {
    if (!replyText.trim() || !detailTicket) return;
    setReplySending(true);
    try {
      const res = await fetch("/api/admin/tickets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: detailTicket.id, message: replyText, is_internal: isInternal }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      const data = await res.json();
      if (data.message) setMessages(prev => [...prev, data.message]);
      setReplyText("");
      showToast(isInternal ? "Internal note added" : "Reply sent");
      fetchTickets();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error", "error"); }
    finally { setReplySending(false); }
  };

  // ── STATUS / PRIORITY ──
  const handleUpdate = async (id: string, updates: Record<string, any>) => {
    try {
      const res = await fetch("/api/admin/tickets", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast("Ticket updated");
      fetchTickets();
      fetchKpis();
      if (detailData && detailData.id === id) setDetailData({ ...detailData, ...updates });
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error", "error"); }
  };

  // ── CREATE ──
  const handleCreate = async () => {
    if (!createSubject.trim()) { showToast("Subject is required", "error"); return; }
    setCreateSaving(true);
    try {
      const body: Record<string, any> = {
        subject: createSubject, description: createDesc,
        category: createCategory, priority: createPriority,
      };
      if (createEmail) body.user_email = createEmail;
      const res = await fetch("/api/admin/tickets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast("Ticket created");
      setCreateOpen(false);
      setCreateSubject(""); setCreateDesc(""); setCreateCategory("other"); setCreatePriority("medium"); setCreateEmail("");
      fetchTickets();
      fetchKpis();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error", "error"); }
    finally { setCreateSaving(false); }
  };

  // ── DELETE ──
  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} ticket(s)? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/admin/tickets", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`${ids.length} ticket(s) deleted`);
      setSelected(new Set());
      fetchTickets();
      fetchKpis();
      if (detailTicket && ids.includes(detailTicket.id)) setDetailTicket(null);
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error", "error"); }
  };

  // ── BULK ──
  const handleBulk = async (action: string, extra?: Record<string, any>) => {
    if (selected.size === 0) return;
    try {
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action, ...extra }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      showToast(`Bulk ${action} completed`);
      setSelected(new Set());
      setBulkMenuOpen(false);
      fetchTickets();
      fetchKpis();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error", "error"); }
  };

  // ── EXPORT ──
  const handleExport = async (format: "csv" | "json") => {
    try {
      const res = await fetch("/api/admin/tickets?section=export");
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      const items = data.tickets || [];
      if (items.length === 0) { showToast("No data to export", "info"); return; }
      if (format === "json") {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "tickets.json"; a.click(); URL.revokeObjectURL(url);
      } else {
        const flat = items.map((t: any) => ({
          id: t.id, subject: t.subject, category: t.category, priority: t.priority, status: t.status,
          customer: t.customer?.full_name || "", email: t.customer?.email || "",
          agent: t.agent?.full_name || "", messages: t.message_count || 0, created_at: t.created_at,
        }));
        const headers = Object.keys(flat[0]);
        const csv = [headers.join(","), ...flat.map((row: Record<string, unknown>) => headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "tickets.csv"; a.click(); URL.revokeObjectURL(url);
      }
      showToast(`Exported ${items.length} tickets`);
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Export failed", "error"); }
  };

  // ── KPI CONFIG ──
  const kpiCards = useMemo(() => [
    { label: "Total Tickets", value: fmt(kpis.totalTickets), icon: Inbox, color: "text-[#2563eb]", bg: dark ? "bg-[#2563eb]/10" : "bg-[#eaf1fb]" },
    { label: "Open", value: fmt(kpis.openTickets), icon: CircleDot, color: "text-[#2563eb]", bg: dark ? "bg-[#2563eb]/10" : "bg-[#eaf1fb]" },
    { label: "Pending", value: fmt(kpis.pendingTickets), icon: Clock, color: "text-[#ea7317]", bg: dark ? "bg-[#ea7317]/10" : "bg-[#fdecdd]" },
    { label: "Resolved", value: fmt(kpis.resolvedTickets), icon: CheckCircle2, color: "text-[#16a34a]", bg: dark ? "bg-[#16a34a]/10" : "bg-[#e8f7ee]" },
    { label: "Closed", value: fmt(kpis.closedTickets), icon: XCircle, color: "text-[#6b7280]", bg: dark ? "bg-[#6b7280]/10" : "bg-[#eef1f5]" },
    { label: "Urgent", value: fmt(kpis.urgentTickets), icon: Zap, color: "text-[#ef4444]", bg: dark ? "bg-[#ef4444]/10" : "bg-[#fde8ec]" },
    { label: "Today", value: fmt(kpis.todaysTickets), icon: Calendar, color: "text-[#7c3aed]", bg: dark ? "bg-[#7c3aed]/10" : "bg-[#efe9fd]" },
    { label: "This Month", value: fmt(kpis.monthTickets), icon: TrendingUp, color: "text-[#16a34a]", bg: dark ? "bg-[#16a34a]/10" : "bg-[#e8f7ee]" },
  ], [kpis, dark]);

  const hasActiveFilters = statusFilter !== "all" || priorityFilter !== "all" || categoryFilter !== "all" || dateFrom || dateTo;
  const clearFilters = () => { setStatusFilter("all"); setPriorityFilter("all"); setCategoryFilter("all"); setDateFrom(""); setDateTo(""); setPage(1); };

  return (
    <div className="space-y-5">
      {/* ──── HEADER ──── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={cn("text-[24px] font-extrabold tracking-tight", txt)}>Support Tickets</h1>
          <p className={cn("text-sm mt-0.5", sub)}>Manage all customer support requests from one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setCreateOpen(true)} className="h-[40px] px-4 rounded-[11px] bg-[#2563eb] text-white text-[13px] font-semibold flex items-center gap-2 hover:bg-[#1d4ed8] transition-colors">
            <Plus className="w-4 h-4" /> Create Ticket
          </button>
          <div className="relative group">
            <button className={cn("h-[40px] px-3 rounded-[11px] border text-[13px] font-semibold flex items-center gap-2 transition-colors", brd, txt, hover)}>
              <Download className="w-4 h-4" /> Export <ChevronDown className="w-3 h-3" />
            </button>
            <div className={cn("absolute right-0 top-full mt-1 z-50 rounded-[12px] border shadow-xl py-1 min-w-[140px] hidden group-hover:block", p, brd)}>
              <button onClick={() => handleExport("csv")} className={cn("w-full text-left px-3 py-2 text-[13px]", txt, hover)}>Export CSV</button>
              <button onClick={() => handleExport("json")} className={cn("w-full text-left px-3 py-2 text-[13px]", txt, hover)}>Export JSON</button>
            </div>
          </div>
          <button onClick={() => { fetchTickets(); fetchKpis(); }} className={cn("h-[40px] w-[40px] rounded-[11px] border flex items-center justify-center transition-colors", brd, txt, hover)}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ──── KPI DASHBOARD ──── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {kpiCards.map((k) => (
          <div key={k.label} className={cn("rounded-[14px] border p-4 transition-all hover:shadow-md", p, brd)}>
            {kpisLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className={cn("w-8 h-8 rounded-[10px]", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-6 w-12 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-3 w-16 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
              </div>
            ) : (
              <>
                <div className={cn("w-8 h-8 rounded-[10px] flex items-center justify-center mb-2", k.bg)}>
                  <k.icon className={cn("w-4 h-4", k.color)} />
                </div>
                <p className={cn("text-[20px] font-extrabold leading-tight", txt)}>{k.value}</p>
                <p className={cn("text-[11px] font-semibold mt-0.5", sub)}>{k.label}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ──── TOOLBAR ──── */}
      <div className={cn("rounded-[16px] border p-4 space-y-3", p, brd)}>
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn("flex items-center gap-2 h-[42px] px-3 rounded-[11px] border flex-1 min-w-[220px]", inp)}>
            <Search className="w-4 h-4 shrink-0 opacity-50" />
            <input onChange={(e) => handleSearch(e.target.value)} placeholder="Search by ticket ID, subject, customer..." className="bg-transparent outline-none w-full text-sm" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={cn("h-[42px] px-3 rounded-[11px] border text-[13px] font-semibold flex items-center gap-2 transition-colors", brd, txt, showFilters ? "bg-[#2563eb] text-white border-[#2563eb]" : hover)}>
            <SlidersHorizontal className="w-4 h-4" /> Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#ef4444]" />}
          </button>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-full text-[12px] font-semibold capitalize transition-colors",
                statusFilter === s ? "bg-[#2563eb] text-white" : dark ? "bg-[#1d242e] text-[#8b95a3] hover:bg-[#252c36]" : "bg-[#f6f8fb] text-[#8a929c] hover:bg-[#eef0f3]"
              )}
            >
              {s === "all" ? "All Tickets" : s.replace("_", " ")}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t", brd)}>
            <div>
              <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>Priority</label>
              <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }} className={selectCls + " w-full"}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p === "all" ? "All Priorities" : p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>Category</label>
              <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} className={selectCls + " w-full"}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c === "all" ? "All Categories" : categoryLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>From Date</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className={selectCls + " w-full"} />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>To Date</label>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className={selectCls + " w-full"} />
              </div>
              <button onClick={clearFilters} className={cn("h-[38px] px-3 rounded-[10px] border text-[13px] font-semibold flex items-center gap-1 shrink-0 transition-colors", brd, "text-[#ef4444] hover:bg-[#ef4444]/10")}>
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ──── BULK BAR ──── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-[14px] bg-[#2563eb] text-white text-sm font-semibold">
          <span>{selected.size} selected</span>
          <button onClick={() => handleBulk("close")} className="ml-auto px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs flex items-center gap-1"><Check className="w-3 h-3" /> Close</button>
          <button onClick={() => handleBulk("reopen")} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Reopen</button>
          <button onClick={() => handleExport("csv")} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs flex items-center gap-1"><Download className="w-3 h-3" /> Export</button>
          <button onClick={() => handleDelete(Array.from(selected))} className="px-3 py-1.5 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-xs flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
        </div>
      )}

      {/* ──── ERROR ──── */}
      {error && (
        <div className="rounded-[14px] border border-red-300 bg-red-50 p-4 text-sm text-red-600 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" /><span>{error}</span>
          <button onClick={fetchTickets} className="ml-auto underline text-sm font-semibold">Retry</button>
        </div>
      )}

      {/* ──── TABLE ──── */}
      <div className={cn("rounded-[16px] border overflow-hidden", p, brd)}>
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={cn("flex items-center gap-4 px-4 py-4 border-b", brd)}>
                <div className={cn("w-4 h-4 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-4 rounded flex-1", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} style={{ maxWidth: `${80 + i * 12}px` }} />
                <div className={cn("h-4 w-20 rounded hidden md:block", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
                <div className={cn("h-4 w-16 rounded", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={cn("border-b", brd)}>
                    <th className="w-10 p-3"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded" /></th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Subject</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Customer</th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Category</th>
                    <th onClick={() => handleSort("priority")} className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 cursor-pointer select-none", sub)}>
                      <span className="flex items-center gap-1">Priority <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th onClick={() => handleSort("status")} className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 cursor-pointer select-none", sub)}>
                      <span className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 hidden lg:table-cell", sub)}>Messages</th>
                    <th onClick={() => handleSort("created_at")} className={cn("text-left text-[11px] font-bold uppercase tracking-wider p-3 cursor-pointer select-none", sub)}>
                      <span className="flex items-center gap-1">Created <ArrowUpDown className="w-3 h-3" /></span>
                    </th>
                    <th className={cn("text-right text-[11px] font-bold uppercase tracking-wider p-3", sub)}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => {
                    const sc = STATUS_COLORS[t.status] || STATUS_COLORS.open;
                    const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium;
                    return (
                      <tr key={t.id} className={cn("border-b last:border-0 transition-colors", brd, hover)}>
                        <td className="p-3"><input type="checkbox" checked={selected.has(t.id)} onChange={() => setSelected(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })} className="rounded" /></td>
                        <td className="p-3">
                          <button onClick={() => openDetail(t)} className={cn("text-[13px] font-semibold hover:text-[#2563eb] transition-colors text-left", txt)}>
                            {t.subject}
                          </button>
                          <p className={cn("text-[11px] mt-0.5", sub)}>#{t.id.slice(0, 8)}</p>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#2563eb] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                              {t.customer?.avatar_url ? <img src={t.customer.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" /> : ((t.customer?.full_name || t.customer?.email || "?")[0] || "?").toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className={cn("text-[12px] font-semibold truncate", txt)}>{t.customer?.full_name || "—"}</p>
                              <p className={cn("text-[11px] truncate", sub)}>{t.customer?.email || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3"><span className={cn("text-[12px]", sub)}>{categoryLabel(t.category)}</span></td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold capitalize" style={{ background: pc.bg, color: pc.text }}>{t.priority}</span>
                        </td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold capitalize" style={{ background: sc.bg, color: sc.text }}>{t.status.replace("_", " ")}</span>
                        </td>
                        <td className={cn("p-3 hidden lg:table-cell", sub)}>
                          <span className="flex items-center gap-1 text-[12px]"><MessageSquare className="w-3 h-3" /> {t.message_count || 0}</span>
                        </td>
                        <td className={cn("p-3 text-[12px]", sub)}>{timeAgo(t.created_at)}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openDetail(t)} className="p-1.5 rounded-lg hover:bg-[#2563eb]/10 text-[#2563eb] transition-colors"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete([t.id])} className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-[#ef4444] transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {tickets.length === 0 && (
                    <tr><td colSpan={9} className={cn("p-12 text-center", sub)}>
                      <Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-semibold">No tickets found</p>
                      <p className="text-xs mt-1">All clear! No support requests match your criteria.</p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y" style={{ borderColor: dark ? "#252c36" : "#eef0f3" }}>
              {tickets.map((t) => {
                const sc = STATUS_COLORS[t.status] || STATUS_COLORS.open;
                const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium;
                return (
                  <div key={t.id} className={cn("p-4 transition-colors", hover)} onClick={() => openDetail(t)}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn("text-[13px] font-semibold truncate flex-1 mr-2", txt)}>{t.subject}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold capitalize shrink-0" style={{ background: sc.bg, color: sc.text }}>{t.status.replace("_", " ")}</span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn("text-[12px]", sub)}>{t.customer?.full_name || t.customer?.email || "—"}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold capitalize" style={{ background: pc.bg, color: pc.text }}>{t.priority}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-[11px]", sub)}>{categoryLabel(t.category)}</span>
                      <span className={cn("text-[11px]", sub)}>{timeAgo(t.created_at)}</span>
                    </div>
                  </div>
                );
              })}
              {tickets.length === 0 && (
                <div className={cn("p-8 text-center", sub)}>
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">No tickets found</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className={cn("flex items-center justify-between px-4 py-3 border-t", brd)}>
              <p className={cn("text-[12px]", sub)}>{total} ticket{total !== 1 ? "s" : ""} · Page {page} of {totalPages}</p>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30 transition-colors", hover)}><ChevronLeft className={cn("w-4 h-4", sub)} /></button>
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const pg = start + i;
                  if (pg > totalPages) return null;
                  return <button key={pg} onClick={() => setPage(pg)} className={cn("w-8 h-8 rounded-lg text-[12px] font-semibold transition-colors", pg === page ? "bg-[#2563eb] text-white" : cn(sub, hover))}>{pg}</button>;
                })}
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={cn("p-1.5 rounded-lg disabled:opacity-30 transition-colors", hover)}><ChevronRight className={cn("w-4 h-4", sub)} /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ──── DETAIL DRAWER ──── */}
      <Drawer open={!!detailTicket} onClose={() => setDetailTicket(null)} dark={dark} title={detailTicket ? `#${detailTicket.id.slice(0, 8)} — ${detailTicket.subject}` : ""} width="2xl">
        {detailTicket && (
          <div className="space-y-5">
            {/* Status/Priority bar */}
            <div className="flex flex-wrap items-center gap-2">
              <select value={(detailData || detailTicket).status} onChange={e => handleUpdate(detailTicket.id, { status: e.target.value })} className={cn("h-[34px] rounded-[8px] border px-2 text-[12px] font-semibold outline-none", inp)}>
                {["open", "pending", "in_progress", "resolved", "closed"].map(s => <option key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</option>)}
              </select>
              <select value={(detailData || detailTicket).priority} onChange={e => handleUpdate(detailTicket.id, { priority: e.target.value })} className={cn("h-[34px] rounded-[8px] border px-2 text-[12px] font-semibold outline-none", inp)}>
                {["low", "medium", "high", "urgent"].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
              <select value={(detailData || detailTicket).category} onChange={e => handleUpdate(detailTicket.id, { category: e.target.value })} className={cn("h-[34px] rounded-[8px] border px-2 text-[12px] font-semibold outline-none", inp)}>
                {CATEGORIES.filter(c => c !== "all").map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
              </select>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1">
              {(["conversation", "customer", "order", "notes", "timeline"] as DetailTab[]).map(tab => (
                <button key={tab} onClick={() => setDetailTab(tab)}
                  className={cn("px-3 py-1.5 rounded-full text-[12px] font-semibold capitalize transition-colors",
                    detailTab === tab ? "bg-[#2563eb] text-white" : dark ? "bg-[#1d242e] text-[#8b95a3] hover:bg-[#252c36]" : "bg-[#f6f8fb] text-[#8a929c] hover:bg-[#eef0f3]"
                  )}
                >{tab}</button>
              ))}
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" /></div>
            ) : (
              <>
                {/* CONVERSATION */}
                {detailTab === "conversation" && (
                  <div className="space-y-4">
                    {/* Initial description */}
                    <div className={cn("rounded-[14px] border p-4", p, brd)}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-[#2563eb] flex items-center justify-center text-[11px] font-bold text-white">
                          {((detailData || detailTicket).customer?.full_name || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className={cn("text-[13px] font-semibold", txt)}>{(detailData || detailTicket).customer?.full_name || "Customer"}</p>
                          <p className={cn("text-[10px]", sub)}>{new Date(detailTicket.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <p className={cn("text-[13px] leading-relaxed", txt)}>{(detailData || detailTicket).description || "No description."}</p>
                    </div>

                    {/* Messages */}
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                      {messages.map((msg) => {
                        const isAdmin = msg.sender?.role === "admin";
                        const isNote = msg.is_internal;
                        return (
                          <div key={msg.id} className={cn("rounded-[12px] p-3", isNote ? "border-l-4 border-l-[#f59e0b] " + (dark ? "bg-[#f59e0b]/5" : "bg-[#fef3c7]/50") : isAdmin ? (dark ? "bg-[#2563eb]/10" : "bg-[#eaf1fb]") : (dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]"))}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white", isAdmin ? "bg-[#2563eb]" : "bg-[#7c3aed]")}>
                                {(msg.sender?.full_name || "?")[0].toUpperCase()}
                              </div>
                              <span className={cn("text-[12px] font-semibold", txt)}>{msg.sender?.full_name || msg.sender?.email || "Agent"}</span>
                              {isNote && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#f59e0b]/20 text-[#f59e0b]">INTERNAL</span>}
                              <span className={cn("text-[10px] ml-auto", sub)}>{new Date(msg.created_at).toLocaleString()}</span>
                            </div>
                            <p className={cn("text-[13px] leading-relaxed", txt)}>{msg.message}</p>
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {msg.attachments.map((a: string, i: number) => (
                                  <a key={i} href={a} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-[#2563eb]/10 text-[#2563eb] hover:bg-[#2563eb]/20 transition-colors">
                                    <Paperclip className="w-3 h-3" /> Attachment {i + 1}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Reply box */}
                    <div className={cn("rounded-[14px] border p-3", p, brd)}>
                      <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => setIsInternal(false)} className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors", !isInternal ? "bg-[#2563eb] text-white" : dark ? "bg-[#1d242e] text-[#8b95a3]" : "bg-[#f6f8fb] text-[#8a929c]")}>Reply</button>
                        <button onClick={() => setIsInternal(true)} className={cn("px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors flex items-center gap-1", isInternal ? "bg-[#f59e0b] text-white" : dark ? "bg-[#1d242e] text-[#8b95a3]" : "bg-[#f6f8fb] text-[#8a929c]")}><Lock className="w-3 h-3" /> Internal Note</button>
                      </div>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={isInternal ? "Add an internal note..." : "Type your reply..."}
                        rows={3}
                        className={cn("w-full rounded-[10px] border px-3 py-2.5 text-[13px] outline-none resize-none transition-colors", inp, "focus:border-[#2563eb]")}
                        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSendMessage(); }}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className={cn("text-[11px]", sub)}>Ctrl+Enter to send</span>
                        <button
                          onClick={handleSendMessage}
                          disabled={replySending || !replyText.trim()}
                          className={cn("h-[36px] px-4 rounded-[10px] text-[13px] font-semibold flex items-center gap-2 transition-colors disabled:opacity-50", isInternal ? "bg-[#f59e0b] hover:bg-[#d97706] text-white" : "bg-[#2563eb] hover:bg-[#1d4ed8] text-white")}
                        >
                          {replySending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          {isInternal ? "Add Note" : "Send Reply"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* CUSTOMER */}
                {detailTab === "customer" && (() => {
                  const t = detailData || detailTicket;
                  const c = t.customer;
                  return (
                    <div className="space-y-4">
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-full bg-[#2563eb] flex items-center justify-center text-white font-bold text-lg">
                            {c?.avatar_url ? <img src={c.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" /> : ((c?.full_name || "?")[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <p className={cn("text-[16px] font-bold", txt)}>{c?.full_name || "—"}</p>
                            <p className={cn("text-[13px]", sub)}>{c?.email || "—"}</p>
                          </div>
                        </div>
                        {t.customer_stats && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                              <p className={cn("text-[11px] font-bold uppercase", sub)}>Orders</p>
                              <p className={cn("text-[18px] font-extrabold", txt)}>{t.customer_stats.order_count || 0}</p>
                            </div>
                            <div className={cn("rounded-[10px] p-3", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                              <p className={cn("text-[11px] font-bold uppercase", sub)}>Total Spent</p>
                              <p className={cn("text-[18px] font-extrabold", txt)}>{fmtCurrency(t.customer_stats.total_spent || 0)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ORDER */}
                {detailTab === "order" && (() => {
                  const t = detailData || detailTicket;
                  const order = t.order;
                  if (!order) return (
                    <div className={cn("rounded-[14px] border p-8 text-center", p, brd)}>
                      <ShoppingCart className={cn("w-8 h-8 mx-auto mb-2 opacity-30", sub)} />
                      <p className={cn("text-sm font-semibold", sub)}>No order linked to this ticket</p>
                    </div>
                  );
                  const osc = STATUS_COLORS[order.status] || STATUS_COLORS.open;
                  return (
                    <div className="space-y-4">
                      <div className={cn("rounded-[14px] border p-4", p, brd)}>
                        <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>Linked Order</p>
                        <div className="space-y-2 text-[13px]">
                          <div className="flex justify-between"><span className={sub}>Order #</span><span className={cn("font-bold", txt)}>{order.order_number}</span></div>
                          <div className="flex justify-between items-center"><span className={sub}>Status</span><span className="px-2.5 py-1 rounded-md text-[11px] font-bold capitalize" style={{ background: osc.bg, color: osc.text }}>{order.status}</span></div>
                          <div className="flex justify-between"><span className={sub}>Total</span><span className={cn("font-bold", txt)}>{fmtCurrency(order.total)}</span></div>
                          {order.tracking_number && <div className="flex justify-between"><span className={sub}>Tracking</span><span className={cn("font-semibold flex items-center gap-1", txt)}><Truck className="w-3 h-3" /> {order.tracking_number}</span></div>}
                          <div className="flex justify-between"><span className={sub}>Date</span><span className={sub}>{new Date(order.created_at).toLocaleDateString()}</span></div>
                        </div>
                      </div>
                      {order.items && order.items.length > 0 && (
                        <div className={cn("rounded-[14px] border p-4", p, brd)}>
                          <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-3", sub)}>Products ({order.items.length})</p>
                          <div className="space-y-2">
                            {order.items.map((item: any, i: number) => (
                              <div key={i} className={cn("flex items-center gap-3 rounded-[10px] p-2", dark ? "bg-[#1d242e]" : "bg-[#f6f8fb]")}>
                                <div className={cn("w-10 h-10 rounded-[8px] overflow-hidden shrink-0 flex items-center justify-center", dark ? "bg-[#252c36]" : "bg-white")}>
                                  {item.product?.images?.[0] ? <img src={item.product.images[0]} alt="" className="w-10 h-10 object-cover" /> : <Package className={cn("w-4 h-4", sub)} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-[12px] font-semibold truncate", txt)}>{item.product?.name || "Product"}</p>
                                  <p className={cn("text-[11px]", sub)}>Qty: {item.quantity} × {fmtCurrency(item.price)}</p>
                                </div>
                                <p className={cn("text-[13px] font-bold shrink-0", txt)}>{fmtCurrency(item.quantity * item.price)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* NOTES (internal) */}
                {detailTab === "notes" && (
                  <div className="space-y-3">
                    <p className={cn("text-[11px] font-bold uppercase tracking-wider", sub)}>Internal Notes</p>
                    {messages.filter(m => m.is_internal).length === 0 ? (
                      <div className={cn("rounded-[14px] border p-6 text-center", p, brd)}>
                        <Lock className={cn("w-6 h-6 mx-auto mb-2 opacity-30", sub)} />
                        <p className={cn("text-sm", sub)}>No internal notes yet</p>
                      </div>
                    ) : (
                      messages.filter(m => m.is_internal).map(msg => (
                        <div key={msg.id} className={cn("rounded-[12px] border-l-4 border-l-[#f59e0b] p-3", dark ? "bg-[#f59e0b]/5" : "bg-[#fef3c7]/50")}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-[12px] font-semibold", txt)}>{msg.sender?.full_name || "Agent"}</span>
                            <span className={cn("text-[10px] ml-auto", sub)}>{new Date(msg.created_at).toLocaleString()}</span>
                          </div>
                          <p className={cn("text-[13px]", txt)}>{msg.message}</p>
                        </div>
                      ))
                    )}
                    <div className={cn("rounded-[14px] border p-3 mt-3", p, brd)}>
                      <textarea
                        value={isInternal ? replyText : ""}
                        onChange={(e) => { setIsInternal(true); setReplyText(e.target.value); }}
                        placeholder="Add an internal note..."
                        rows={3}
                        className={cn("w-full rounded-[10px] border px-3 py-2.5 text-[13px] outline-none resize-none", inp, "focus:border-[#f59e0b]")}
                      />
                      <div className="flex justify-end mt-2">
                        <button onClick={() => { setIsInternal(true); handleSendMessage(); }} disabled={replySending || !replyText.trim()} className="h-[34px] px-3 rounded-[10px] bg-[#f59e0b] text-white text-[12px] font-semibold flex items-center gap-1.5 hover:bg-[#d97706] transition-colors disabled:opacity-50">
                          {replySending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />} Add Note
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TIMELINE */}
                {detailTab === "timeline" && (() => {
                  const t = detailData || detailTicket;
                  const events = [
                    { label: "Ticket Created", date: t.created_at, icon: Plus, color: "bg-[#2563eb]" },
                    ...messages.map(m => ({
                      label: m.is_internal ? "Internal note added" : (m.sender?.role === "admin" ? "Agent replied" : "Customer replied"),
                      date: m.created_at,
                      icon: m.is_internal ? Lock : MessageSquare,
                      color: m.is_internal ? "bg-[#f59e0b]" : m.sender?.role === "admin" ? "bg-[#2563eb]" : "bg-[#7c3aed]",
                    })),
                  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                  return (
                    <div className={cn("rounded-[14px] border p-4", p, brd)}>
                      <p className={cn("text-[11px] font-bold uppercase tracking-wider mb-4", sub)}>Timeline</p>
                      <div className="space-y-0">
                        {events.map((ev, i) => (
                          <div key={i} className="flex items-start gap-3 relative pb-5 last:pb-0">
                            {i < events.length - 1 && <div className={cn("absolute left-[13px] top-[26px] w-[2px] h-[calc(100%-14px)]", dark ? "bg-[#252c36]" : "bg-[#eef0f3]")} />}
                            <div className={cn("w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 z-10 text-white", ev.color)}>
                              <ev.icon className="w-3 h-3" />
                            </div>
                            <div className="pt-0.5">
                              <p className={cn("text-[13px] font-semibold", txt)}>{ev.label}</p>
                              <p className={cn("text-[11px]", sub)}>{new Date(ev.date).toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {/* Detail actions */}
            <div className={cn("flex flex-wrap gap-2 pt-3 border-t", brd)}>
              <button onClick={() => handleUpdate(detailTicket.id, { status: "resolved" })} className="h-[34px] px-3 rounded-[10px] bg-[#16a34a] text-white text-[12px] font-semibold flex items-center gap-1.5 hover:bg-[#15803d] transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
              </button>
              <button onClick={() => handleUpdate(detailTicket.id, { status: "closed" })} className={cn("h-[34px] px-3 rounded-[10px] border text-[12px] font-semibold flex items-center gap-1.5 transition-colors", brd, sub, hover)}>
                <XCircle className="w-3.5 h-3.5" /> Close
              </button>
              <button onClick={() => handleDelete([detailTicket.id])} className="h-[34px] px-3 rounded-[10px] border border-[#ef4444] text-[#ef4444] text-[12px] font-semibold flex items-center gap-1.5 hover:bg-[#ef4444]/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        )}
      </Drawer>

      {/* ──── CREATE DRAWER ──── */}
      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} dark={dark} title="Create Ticket" width="lg">
        <div className="space-y-4">
          <div>
            <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>Customer Email</label>
            <input value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="customer@example.com" className={cn("w-full h-[42px] rounded-[11px] border px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]")} />
          </div>
          <div>
            <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>Subject *</label>
            <input value={createSubject} onChange={e => setCreateSubject(e.target.value)} placeholder="Brief description of the issue" className={cn("w-full h-[42px] rounded-[11px] border px-3 text-sm outline-none transition-colors", inp, "focus:border-[#2563eb]")} />
          </div>
          <div>
            <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>Description</label>
            <textarea value={createDesc} onChange={e => setCreateDesc(e.target.value)} placeholder="Detailed description..." rows={5} className={cn("w-full rounded-[11px] border px-3 py-2.5 text-sm outline-none resize-none transition-colors", inp, "focus:border-[#2563eb]")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>Category</label>
              <select value={createCategory} onChange={e => setCreateCategory(e.target.value)} className={cn("w-full h-[42px] rounded-[11px] border px-3 text-sm outline-none", inp)}>
                {CATEGORIES.filter(c => c !== "all").map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <label className={cn("text-[11px] font-bold uppercase tracking-wider mb-1 block", sub)}>Priority</label>
              <select value={createPriority} onChange={e => setCreatePriority(e.target.value)} className={cn("w-full h-[42px] rounded-[11px] border px-3 text-sm outline-none", inp)}>
                {PRIORITIES.filter(p => p !== "all").map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button onClick={() => setCreateOpen(false)} className={cn("h-[42px] px-4 rounded-[11px] border text-[13px] font-semibold transition-colors", brd, txt, hover)}>Cancel</button>
            <button onClick={handleCreate} disabled={createSaving || !createSubject.trim()} className="h-[42px] px-4 rounded-[11px] bg-[#2563eb] text-white text-[13px] font-semibold flex items-center gap-2 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50">
              {createSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Ticket
            </button>
          </div>
        </div>
      </Drawer>

      {/* TOAST */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-[12px] text-sm font-semibold text-white shadow-lg animate-in slide-in-from-bottom-2 duration-200",
          toast.type === "success" && "bg-[#16a34a]", toast.type === "info" && "bg-[#2563eb]", toast.type === "error" && "bg-[#ef4444]"
        )}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
