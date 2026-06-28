import { NextRequest } from "next/server";
import { createPaymentRecord, logPaymentEvent } from "@/lib/payments/payment-service";

const MONCASH_BASE = process.env.MONCASH_MODE === "production"
  ? "https://moncashbutton.digicelhaiti.com"
  : "https://sandbox.moncashbutton.digicelhaiti.com";

async function getMoncashToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.MONCASH_CLIENT_ID}:${process.env.MONCASH_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${MONCASH_BASE}/Api/v1/Authenticate`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=read,write",
  });

  const data = await res.json();
  return data.access_token;
}

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
      gateway: "moncash",
    });

    const token = await getMoncashToken();

    const paymentRes = await fetch(`${MONCASH_BASE}/Api/v1/CreatePayment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        orderId: paymentId,
      }),
    });

    const paymentData = await paymentRes.json();

    await logPaymentEvent({
      paymentId,
      gateway: "moncash",
      eventType: "payment.initiated",
      request: { orderId, amount, phone },
      response: paymentData,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      statusCode: paymentRes.status,
      latencyMs: Date.now() - start,
    });

    if (!paymentRes.ok) {
      return Response.json({ error: "MonCash payment creation failed", details: paymentData }, { status: 502 });
    }

    const redirectUrl = paymentData.payment_token
      ? `${MONCASH_BASE}/Moncash-pay/Redirect?token=${paymentData.payment_token.token}`
      : null;

    return Response.json({
      paymentId,
      redirectUrl,
      token: paymentData.payment_token?.token,
    });
  } catch (err) {
    console.error("MonCash initiate error:", err);
    return Response.json({ error: "Failed to initiate MonCash payment" }, { status: 500 });
  }
}
