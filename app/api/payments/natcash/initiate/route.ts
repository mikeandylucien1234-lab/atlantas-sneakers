import { NextRequest } from "next/server";
import { createPaymentRecord, logPaymentEvent } from "@/lib/payments/payment-service";

const NATCASH_BASE = process.env.NATCASH_MODE === "production"
  ? "https://api.natcash.ht"
  : "https://sandbox.natcash.ht";

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    const body = await request.json();
    const { orderId, userId, amount, phone } = body as {
      orderId: string;
      userId: string | null;
      amount: number;
      phone: string;
    };

    if (!orderId || !amount || !phone) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const paymentId = await createPaymentRecord({
      orderId,
      userId,
      amount,
      currency: "HTG",
      gateway: "natcash",
    });

    const paymentRes = await fetch(`${NATCASH_BASE}/api/v1/payments`, {
      method: "POST",
      headers: {
        "X-Merchant-Id": process.env.NATCASH_MERCHANT_ID!,
        "X-Api-Key": process.env.NATCASH_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        merchant_id: process.env.NATCASH_MERCHANT_ID,
        amount,
        currency: "HTG",
        phone,
        reference: paymentId,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/natcash`,
      }),
    });

    const paymentData = await paymentRes.json();

    await logPaymentEvent({
      paymentId,
      gateway: "natcash",
      eventType: "payment.initiated",
      request: { orderId, amount, phone },
      response: paymentData,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      statusCode: paymentRes.status,
      latencyMs: Date.now() - start,
    });

    if (!paymentRes.ok) {
      return Response.json({ error: "NatCash payment creation failed", details: paymentData }, { status: 502 });
    }

    return Response.json({
      paymentId,
      reference: paymentData.reference ?? paymentId,
      status: paymentData.status ?? "pending",
    });
  } catch (err) {
    console.error("NatCash initiate error:", err);
    return Response.json({ error: "Failed to initiate NatCash payment" }, { status: 500 });
  }
}
