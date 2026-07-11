// @ts-nocheck
import { NextRequest } from "next/server";
import { verifyApiKey, recordApiCall, hasPermission } from "@/lib/api-keys/verify";

// GET /api/v1/products — real product data, gated by products.read
export async function GET(request: NextRequest) {
  const v = await verifyApiKey(request, "products.read");
  if (v.error) return Response.json({ error: v.error }, { status: v.status });
  const { s, key } = v;
  const limit = Math.min(100, parseInt(new URL(request.url).searchParams.get("limit") || "20", 10));
  const { data } = await s.from("products").select("id, name, slug, price, status, created_at").eq("status", "active").order("created_at", { ascending: false }).limit(limit);
  const body = JSON.stringify({ data: data || [], count: (data || []).length });
  await recordApiCall({ ...v, request, statusCode: 200, bytes: body.length });
  return new Response(body, { headers: { "Content-Type": "application/json" } });
}

// POST /api/v1/products — create a product, gated by products.write
export async function POST(request: NextRequest) {
  const v = await verifyApiKey(request, "products.write");
  if (v.error) return Response.json({ error: v.error }, { status: v.status });
  const { s } = v;
  const b = await request.json().catch(() => ({}));
  if (!b.name) { await recordApiCall({ ...v, request, statusCode: 400 }); return Response.json({ error: "name required" }, { status: 400 }); }
  const slug = (b.slug || b.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data, error } = await s.from("products").insert({ name: b.name, slug, price: b.price || 0, status: b.status || "draft" }).select("id, name, slug").single();
  if (error) { await recordApiCall({ ...v, request, statusCode: 500 }); return Response.json({ error: error.message }, { status: 500 }); }
  await recordApiCall({ ...v, request, statusCode: 201 });
  return Response.json({ data }, { status: 201 });
}
