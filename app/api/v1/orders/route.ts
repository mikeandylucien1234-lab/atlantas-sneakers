// @ts-nocheck
import { NextRequest } from "next/server";
import { verifyApiKey, recordApiCall } from "@/lib/api-keys/verify";

// GET /api/v1/orders — real order data, gated by orders.read
export async function GET(request: NextRequest) {
  const v = await verifyApiKey(request, "orders.read");
  if (v.error) return Response.json({ error: v.error }, { status: v.status });
  const { s } = v;
  const limit = Math.min(100, parseInt(new URL(request.url).searchParams.get("limit") || "20", 10));
  const { data } = await s.from("orders").select("id, order_number, status, payment_status, total, created_at").order("created_at", { ascending: false }).limit(limit);
  const body = JSON.stringify({ data: data || [], count: (data || []).length });
  await recordApiCall({ ...v, request, statusCode: 200, bytes: body.length });
  return new Response(body, { headers: { "Content-Type": "application/json" } });
}
