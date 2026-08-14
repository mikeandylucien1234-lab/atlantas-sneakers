import { NextRequest } from "next/server";
import { syncOpenSupplierOrders, autopayCreatedOrders } from "@/lib/suppliers/engine";
import { retryPendingDispatches } from "@/lib/orders/fulfillment";
import { requirePermission } from "@/lib/rbac/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Automatic tracking sync. Schedule this URL (e.g. an o2switch cron every 30–60
// min) with the CRON_SECRET, and/or trigger it from the admin. It pulls the
// latest CJ status + tracking for every open order and writes it back to the
// customer orders — no manual step. Auth: matching CRON_SECRET header/query, or
// an authenticated admin with orders.manage.
async function authorize(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("key");
    if (provided && provided === secret) return true;
  }
  const auth = await requirePermission("orders.manage");
  return !!auth.ok;
}

async function run(request: NextRequest) {
  if (!(await authorize(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Production heartbeat — runs the whole automation in order, self-healing:
    // 1) Place any paid orders that haven't reached CJ yet (recover failures).
    const retried = await retryPendingDispatches(50);
    // 2) Auto-pay CJ orders that are created but unpaid (only if cj_auto_pay ON).
    const autopay = await autopayCreatedOrders({ supplierId: "cj", limit: 50 });
    // 3) Pull latest CJ status + tracking for placed orders → customer orders.
    const result = await syncOpenSupplierOrders({ supplierId: "cj", limit: 200 });
    return Response.json({
      ...result,
      dispatch_retried: retried.attempted,
      autopay_enabled: autopay.enabled, autopay_attempted: autopay.attempted, autopay_paid: autopay.paid,
    });
  } catch (err: any) {
    return Response.json({ error: err?.message || "sync failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) { return run(request); }
export async function POST(request: NextRequest) { return run(request); }
