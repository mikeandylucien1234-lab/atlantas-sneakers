import { NextRequest } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

// Receives Bazik payment status callbacks. Best-effort HMAC-SHA256 verification
// against the webhook signing secret (header name/scheme may vary — see note).
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const secret = process.env.BAZIK_WEBHOOK_SECRET;

  if (secret) {
    const sig =
      request.headers.get("x-bazik-signature") ||
      request.headers.get("bazik-signature") ||
      request.headers.get("x-signature") ||
      "";
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const ok =
      !!sig &&
      (() => {
        try {
          return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
        } catch {
          return false;
        }
      })();
    if (sig && !ok) {
      console.warn("Bazik webhook: signature mismatch");
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
    if (!sig) console.warn("Bazik webhook: no signature header present (accepting in test mode)");
  }

  let event: any = {};
  try { event = JSON.parse(raw); } catch {}
  console.log("Bazik webhook received:", event?.status ?? event?.event ?? "unknown", event?.orderId ?? event?.referenceId ?? "");

  // TODO: when wired to real orders, look up the payment by orderId/referenceId
  // and update its status (paid/failed) here.

  return Response.json({ received: true });
}
