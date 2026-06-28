import { NextRequest } from "next/server";
import { logPaymentEvent } from "@/lib/payments/payment-service";

const NATCASH_BASE = process.env.NATCASH_MODE === "production"
  ? "https://api.natcash.ht"
  : "https://sandbox.natcash.ht";

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference");
  if (!reference) {
    return Response.json({ error: "Missing reference" }, { status: 400 });
  }

  try {
    const res = await fetch(`${NATCASH_BASE}/api/v1/payments/${reference}`, {
      headers: {
        "X-Merchant-Id": process.env.NATCASH_MERCHANT_ID!,
        "X-Api-Key": process.env.NATCASH_API_KEY!,
      },
    });

    const data = await res.json();

    await logPaymentEvent({
      gateway: "natcash",
      eventType: "payment.verify",
      request: { reference },
      response: data,
      statusCode: res.status,
    });

    return Response.json({ transaction: data });
  } catch (err) {
    console.error("NatCash verify error:", err);
    return Response.json({ error: "Verification failed" }, { status: 500 });
  }
}
