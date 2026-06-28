import { NextRequest } from "next/server";
import { logPaymentEvent } from "@/lib/payments/payment-service";

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

export async function GET(request: NextRequest) {
  const transactionId = request.nextUrl.searchParams.get("transactionId");
  if (!transactionId) {
    return Response.json({ error: "Missing transactionId" }, { status: 400 });
  }

  try {
    const token = await getMoncashToken();
    const res = await fetch(
      `${MONCASH_BASE}/Api/v1/RetrieveTransactionPayment`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transactionId }),
      }
    );

    const data = await res.json();

    await logPaymentEvent({
      gateway: "moncash",
      eventType: "payment.verify",
      request: { transactionId },
      response: data,
      statusCode: res.status,
    });

    return Response.json({ transaction: data });
  } catch (err) {
    console.error("MonCash verify error:", err);
    return Response.json({ error: "Verification failed" }, { status: 500 });
  }
}
