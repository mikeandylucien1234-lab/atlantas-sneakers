// @ts-nocheck
import { NextRequest } from "next/server";
import { verifyApiKey, recordApiCall } from "@/lib/api-keys/verify";

// Public API health/auth check — requires a valid API key (no specific perm).
export async function GET(request: NextRequest) {
  const v = await verifyApiKey(request, null);
  if (v.error) return Response.json({ error: v.error }, { status: v.status });
  await recordApiCall({ ...v, request, statusCode: 200 });
  return Response.json({ ok: true, key_id: v.key.key_id, environment: v.key.environment, name: v.key.name, message: "Authenticated" });
}
