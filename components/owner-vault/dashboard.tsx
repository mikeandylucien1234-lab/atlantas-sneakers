"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Crown, DollarSign, Wallet, ArrowDownToLine, LogOut, Plus, Loader2, X,
  TrendingUp, Users, Ban, RefreshCw, Trash2, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (n: number) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (d?: string) => (d ? new Date(d).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const STATUS_COLORS: Record<string, string> = {
  active: "#16a34a", incomplete: "#f59e0b", past_due: "#ef4444", suspended: "#6b7280", canceled: "#6b7280", expired: "#ef4444",
};
const WITHDRAW_METHODS = [
  { id: "bank_account", label: "Bank account" },
  { id: "wire_transfer", label: "Wire transfer" },
  { id: "paypal", label: "PayPal" },
  { id: "cashapp", label: "Cash App" },
  { id: "moncash", label: "MonCash" },
  { id: "natcash", label: "NatCash" },
];

type Tab = "premium" | "revenue" | "balance" | "withdrawals";

export function OwnerVaultDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("premium");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/owner-vault/data", { cache: "no-store" });
    if (res.status === 403) { router.replace("/owner-vault/login"); return; }
    setData(await res.json());
    setLoading(false);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  const logout = async () => { await fetch("/api/owner-vault/logout", { method: "POST" }); router.replace("/owner-vault/login"); };

  const action = async (id: string, act: string) => {
    await fetch(`/api/owner-vault/premium/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: act }) });
    load();
  };
  const remove = async (id: string) => {
    await fetch(`/api/owner-vault/premium/${id}`, { method: "DELETE" });
    load();
  };

  if (loading || !data) {
    return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#2563eb]" /></div>;
  }

  const r = data.revenue, b = data.balance;

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#0f172a]"><Crown className="h-5 w-5 text-[#f5c518]" /></div>
          <div>
            <h1 className="text-[20px] font-extrabold tracking-[-.02em] text-[#16181d]">Owner Vault</h1>
            <p className="text-[12px] text-[#6b7280]">Private owner console</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 rounded-full border border-[#eef0f3] px-4 py-2 text-[13px] font-semibold text-[#6b7280] hover:bg-[#f7f8fa]"><LogOut className="h-4 w-4" /> Logout</button>
      </div>

      {/* Stat row */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Revenue (month)" value={fmt(r.month)} tint="#2563eb" />
        <Stat icon={TrendingUp} label="Revenue (total)" value={fmt(r.total)} tint="#16a34a" />
        <Stat icon={Users} label="Active subs" value={String(r.activeCount)} tint="#7c3aed" />
        <Stat icon={Wallet} label="Available" value={fmt(b.available)} tint="#0f172a" />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {([["premium", "Administrators Premium"], ["revenue", "Revenue"], ["balance", "Balance"], ["withdrawals", "Withdrawals"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("rounded-full px-4 py-2 text-[13px] font-bold transition", tab === id ? "bg-[#0f172a] text-white" : "border border-[#eef0f3] text-[#6b7280] hover:bg-[#f7f8fa]")}>{label}</button>
        ))}
      </div>

      {tab === "premium" && <PremiumTab admins={data.admins} onCreate={() => setShowCreate(true)} onAction={action} onRemove={remove} />}
      {tab === "revenue" && <RevenueTab r={r} />}
      {tab === "balance" && <BalanceTab b={b} withdrawals={data.withdrawals} onWithdraw={() => setShowWithdraw(true)} />}
      {tab === "withdrawals" && <WithdrawalsTab withdrawals={data.withdrawals} onWithdraw={() => setShowWithdraw(true)} reload={load} />}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
      {showWithdraw && <WithdrawModal available={b.available} onClose={() => setShowWithdraw(false)} onDone={() => { setShowWithdraw(false); load(); }} />}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tint }: any) {
  return (
    <div className="rounded-2xl border border-[#eef0f3] bg-white p-4">
      <div className="mb-2 grid h-9 w-9 place-items-center rounded-full" style={{ background: `${tint}1a` }}><Icon className="h-[18px] w-[18px]" style={{ color: tint }} /></div>
      <div className="text-[20px] font-extrabold text-[#16181d]">{value}</div>
      <div className="text-[12px] text-[#6b7280]">{label}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || "#6b7280";
  return <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize" style={{ background: `${c}1a`, color: c }}>{status.replace("_", " ")}</span>;
}

/* ---------- Premium admins ---------- */
function PremiumTab({ admins, onCreate, onAction, onRemove }: any) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[14px] font-bold text-[#16181d]">Administrators Premium <span className="font-normal text-[#6b7280]">· {admins.length}</span></p>
        <button onClick={onCreate} className="flex items-center gap-1.5 rounded-xl bg-[#2563eb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#1d4ed8]"><Plus className="h-4 w-4" /> Create subscription</button>
      </div>
      {admins.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e4e7eb] py-12 text-center text-[13px] text-[#9aa3ad]">No premium administrators yet.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {admins.map((a: any) => (
            <div key={a.id} className="rounded-2xl border border-[#eef0f3] bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#f4f5f7]">
                  {a.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={a.photo} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-[15px] font-bold text-[#9aa3ad]">{(a.name || a.email || "?").charAt(0).toUpperCase()}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-bold text-[#16181d]">{a.name || a.email}</span>
                    <StatusPill status={a.status} />
                  </div>
                  <div className="truncate text-[12px] text-[#6b7280]">{a.email}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-[12px]">
                <Info label="Plan" value={a.plan} />
                <Info label="Price" value={`${fmt(a.price)}/mo`} />
                <Info label="Joined" value={date(a.created_at)} />
                <Info label="Last payment" value={date(a.last_payment_at)} />
                <Info label="Next payment" value={date(a.next_payment_at)} />
                <Info label="Stripe" value={a.stripe_subscription_id ? a.stripe_subscription_id.slice(0, 14) + "…" : "—"} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.status !== "suspended" && a.status !== "canceled" && <Btn onClick={() => onAction(a.id, "suspend")} icon={Ban}>Suspend</Btn>}
                {(a.status === "suspended" || a.status === "past_due") && <Btn onClick={() => onAction(a.id, "reactivate")} icon={RefreshCw}>Reactivate</Btn>}
                {a.status !== "canceled" && <Btn onClick={() => onAction(a.id, "cancel")} icon={X}>Cancel</Btn>}
                <Btn onClick={() => onRemove(a.id)} icon={Trash2} danger>Remove</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
const Info = ({ label, value }: any) => (<div><span className="text-[#9aa3ad]">{label}: </span><span className="font-semibold text-[#16181d]">{value}</span></div>);
const Btn = ({ children, onClick, icon: Icon, danger }: any) => (
  <button onClick={onClick} className={cn("flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition", danger ? "border-red-200 text-red-500 hover:bg-red-50" : "border-[#eef0f3] text-[#6b7280] hover:bg-[#f7f8fa]")}><Icon className="h-3 w-3" /> {children}</button>
);

/* ---------- Revenue ---------- */
function RevenueTab({ r }: any) {
  const max = Math.max(1, ...r.monthly.map((m: any) => m.total));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["Today", r.today], ["This week", r.week], ["This month", r.month], ["This year", r.year], ["All time", r.total]].map(([l, v]: any) => (
          <div key={l} className="rounded-2xl border border-[#eef0f3] bg-white p-4"><div className="text-[12px] text-[#6b7280]">{l}</div><div className="mt-1 text-[18px] font-extrabold text-[#16181d]">{fmt(v)}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#eef0f3] bg-white p-4"><div className="text-[12px] text-[#6b7280]">Active subscribers</div><div className="mt-1 text-[22px] font-extrabold text-[#16a34a]">{r.activeCount}</div></div>
        <div className="rounded-2xl border border-[#eef0f3] bg-white p-4"><div className="text-[12px] text-[#6b7280]">Expired / failed</div><div className="mt-1 text-[22px] font-extrabold text-[#ef4444]">{r.expiredCount}</div></div>
      </div>
      <div className="rounded-2xl border border-[#eef0f3] bg-white p-5">
        <div className="mb-4 text-[14px] font-bold text-[#16181d]">Monthly revenue (12 months)</div>
        <div className="flex h-40 items-end gap-1.5">
          {r.monthly.map((m: any, i: number) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-end justify-center" style={{ height: "100%" }}>
                <div className="w-full max-w-[26px] rounded-t-md bg-[#2563eb] transition-all" style={{ height: `${Math.max(3, (m.total / max) * 100)}%` }} title={fmt(m.total)} />
              </div>
              <span className="text-[10px] text-[#9aa3ad]">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Balance ---------- */
function BalanceTab({ b, onWithdraw }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[linear-gradient(120deg,#0f172a,#1e293b)] p-5 text-white"><div className="text-[12px] text-white/70">Available balance</div><div className="mt-1 text-[26px] font-extrabold">{fmt(b.available)}</div></div>
        <div className="rounded-2xl border border-[#eef0f3] bg-white p-5"><div className="text-[12px] text-[#6b7280]">Pending</div><div className="mt-1 text-[22px] font-extrabold text-[#f59e0b]">{fmt(b.pending)}</div></div>
        <div className="rounded-2xl border border-[#eef0f3] bg-white p-5"><div className="text-[12px] text-[#6b7280]">Total withdrawn</div><div className="mt-1 text-[22px] font-extrabold text-[#16181d]">{fmt(b.withdrawn)}</div></div>
      </div>
      <button onClick={onWithdraw} className="flex items-center gap-2 rounded-xl bg-[#2563eb] px-5 py-3 text-[14px] font-bold text-white hover:bg-[#1d4ed8]"><ArrowDownToLine className="h-4 w-4" /> Withdraw funds</button>
    </div>
  );
}

/* ---------- Withdrawals ---------- */
function WithdrawalsTab({ withdrawals, onWithdraw, reload }: any) {
  const setStatus = async (id: string, status: string) => {
    await fetch("/api/owner-vault/withdrawals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    reload();
  };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[14px] font-bold text-[#16181d]">Withdrawals <span className="font-normal text-[#6b7280]">· {withdrawals.length}</span></p>
        <button onClick={onWithdraw} className="flex items-center gap-1.5 rounded-xl bg-[#2563eb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#1d4ed8]"><Plus className="h-4 w-4" /> New withdrawal</button>
      </div>
      {withdrawals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e4e7eb] py-12 text-center text-[13px] text-[#9aa3ad]">No withdrawals yet.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#eef0f3] bg-white">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-[#eef0f3] text-left text-[11px] uppercase tracking-wide text-[#9aa3ad]">{["Amount", "Method", "Destination", "Reference", "Date", "Status", ""].map((h) => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {withdrawals.map((w: any) => (
                <tr key={w.id} className="border-t border-[#f2f4f7]">
                  <td className="px-3 py-2.5 font-bold text-[#16181d]">{fmt(w.amount)}</td>
                  <td className="px-3 py-2.5 capitalize">{(WITHDRAW_METHODS.find((m) => m.id === w.method)?.label) || w.method}</td>
                  <td className="px-3 py-2.5 text-[#6b7280]">{w.destination || "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-[#6b7280]">{w.reference}</td>
                  <td className="px-3 py-2.5 text-[#6b7280]">{date(w.created_at)}</td>
                  <td className="px-3 py-2.5"><StatusPill status={w.status} /></td>
                  <td className="px-3 py-2.5">
                    {w.status === "pending" && <div className="flex gap-1"><button onClick={() => setStatus(w.id, "completed")} className="rounded-md bg-[#16a34a]/10 px-2 py-1 text-[11px] font-bold text-[#16a34a]">Mark paid</button></div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- Modals ---------- */
function CreateModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await fetch("/api/owner-vault/premium/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name, photo }) });
    const data = await res.json();
    if (!res.ok || !data.url) { setError(data.error || "Error"); setLoading(false); return; }
    window.location.href = data.url; // Stripe Checkout — card entered securely there
  };

  return (
    <Modal onClose={onClose} title="Create Administrator Premium">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email *"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="ov-input" /></Field>
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className="ov-input" /></Field>
        <Field label="Photo URL"><input value={photo} onChange={(e) => setPhoto(e.target.value)} className="ov-input" /></Field>
        <div className="rounded-xl bg-[#f7f8fa] p-3 text-[12px] text-[#6b7280]">Plan <b className="text-[#16181d]">Administrator Premium</b> · <b className="text-[#16181d]">$25.00/month</b>. The card is entered securely on Stripe — no card data is stored here.</div>
        {error && <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] font-semibold text-[#dc2626]">{error}</p>}
        <button disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] font-bold text-white disabled:opacity-60">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue to Stripe"}</button>
      </form>
    </Modal>
  );
}

function WithdrawModal({ available, onClose, onDone }: { available: number; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(WITHDRAW_METHODS[0].id);
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await fetch("/api/owner-vault/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(amount), method, destination, notes }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Error"); setLoading(false); return; }
    onDone();
  };

  return (
    <Modal onClose={onClose} title="Withdraw funds">
      <form onSubmit={submit} className="space-y-3">
        <div className="rounded-xl bg-[#0f172a] p-3 text-white"><span className="text-[12px] text-white/70">Available</span><div className="text-[20px] font-extrabold">{fmt(available)}</div></div>
        <Field label="Amount *"><input inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="ov-input" /></Field>
        <Field label="Destination method *">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="ov-input">{WITHDRAW_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
        </Field>
        <Field label="Destination details"><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Account no. / wallet / email" className="ov-input" /></Field>
        <Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className="ov-input" /></Field>
        {error && <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] font-semibold text-[#dc2626]">{error}</p>}
        <button disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] font-bold text-white disabled:opacity-60">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-4 w-4" /> Request withdrawal</>}</button>
      </form>
    </Modal>
  );
}

function Modal({ children, title, onClose }: any) {
  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[16px] font-extrabold text-[#16181d]">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-[#9aa3ad] hover:bg-[#f4f5f7]"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
      <style>{`.ov-input{height:44px;width:100%;border-radius:12px;border:1px solid #e4e7eb;background:#f7f8fa;padding:0 14px;font-size:14px;outline:none}.ov-input:focus{border-color:#2563eb}`}</style>
    </div>
  );
}

function Field({ label, children }: any) {
  return <label className="block"><span className="mb-1 block text-[12px] font-semibold text-[#6b7280]">{label}</span>{children}</label>;
}
