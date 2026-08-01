import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS. Only used inside Owner Vault server code,
// which is gated by isOwner(). Never exposed to the browser.
export const ovAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const PREMIUM_PLAN = { name: "Administrator Premium", price: 25, currency: "usd", days: 30 };

export type VaultData = {
  admins: any[];
  revenue: { today: number; week: number; month: number; year: number; total: number; activeCount: number; expiredCount: number; monthly: { label: string; total: number }[] };
  balance: { available: number; pending: number; withdrawn: number };
  withdrawals: any[];
};

function startOf(kind: "day" | "week" | "month" | "year"): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (kind === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (kind === "month") d.setDate(1);
  if (kind === "year") { d.setMonth(0); d.setDate(1); }
  return d.getTime();
}

export async function getVaultData(): Promise<VaultData> {
  const [{ data: admins }, { data: payments }, { data: withdrawals }] = await Promise.all([
    ovAdmin.from("owner_premium_admins").select("*").order("created_at", { ascending: false }),
    ovAdmin.from("owner_subscription_payments").select("*").eq("status", "paid").order("paid_at", { ascending: false }),
    ovAdmin.from("owner_withdrawals").select("*").order("created_at", { ascending: false }),
  ]);

  const pays = payments || [];
  const sum = (rows: any[]) => rows.reduce((s, p) => s + Number(p.amount || 0), 0);
  const since = (t: number) => pays.filter((p) => new Date(p.paid_at).getTime() >= t);

  const total = sum(pays);
  const adm  = admins || [];
  const activeCount = adm.filter((a) => a.status === "active").length;
  const expiredCount = adm.filter((a) => ["expired", "canceled", "past_due"].includes(a.status)).length;

  // last 12 months chart
  const monthly: { label: string; total: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = d.toLocaleString("en", { month: "short" });
    const t = pays.filter((p) => { const x = new Date(p.paid_at).getTime(); return x >= d.getTime() && x < next.getTime(); });
    monthly.push({ label, total: sum(t) });
  }

  // Settlement model mirroring the payment processor: a confirmed payment is
  // held ("pending") for a settlement window, then becomes "available" for a
  // MANUAL owner withdrawal. No automatic payout is ever performed.
  const SETTLEMENT_DAYS = 7;
  const cutoff = Date.now() - SETTLEMENT_DAYS * 24 * 3600 * 1000;
  const settled = sum(pays.filter((p) => new Date(p.paid_at).getTime() <= cutoff));
  const incomingPending = sum(pays.filter((p) => new Date(p.paid_at).getTime() > cutoff));

  const wds = withdrawals || [];
  const withdrawn = sum(wds.filter((w) => w.status === "completed"));
  const withdrawalsPending = sum(wds.filter((w) => w.status === "pending" || w.status === "processing"));
  const available = Math.max(0, settled - withdrawn - withdrawalsPending);
  const pending = incomingPending + withdrawalsPending;

  return {
    admins: adm,
    revenue: {
      today: sum(since(startOf("day"))),
      week: sum(since(startOf("week"))),
      month: sum(since(startOf("month"))),
      year: sum(since(startOf("year"))),
      total,
      activeCount,
      expiredCount,
      monthly,
    },
    balance: { available, pending, withdrawn },
    withdrawals: wds,
  };
}
