import { NextRequest } from "next/server";
import { getBazik } from "@/lib/payments/bazik";

export const runtime = "nodejs";

// Verify a Bazik payment status by order id.
export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get("orderId");
    if (!orderId) return Response.json({ error: "Missing orderId" }, { status: 400 });

    const bazik = getBazik();
    const status = await bazik.payments.verify(orderId);
    return Response.json({ status: status.status, details: status });
  } catch (err: any) {
    console.error("Bazik verify error:", err?.message || err);
    return Response.json({ error: err?.message || "Verification failed" }, { status: 502 });
  }
}
