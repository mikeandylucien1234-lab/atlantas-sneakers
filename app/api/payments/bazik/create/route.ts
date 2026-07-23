import { NextRequest } from "next/server";
import { getBazik } from "@/lib/payments/bazik";

export const runtime = "nodejs";

// Create a MonCash (My Cash) payment via Bazik and return the checkout redirect URL.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount);
    if (!amount || amount <= 0) {
      return Response.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (amount > 75000) {
      return Response.json({ error: "MonCash maximum is 75,000 HTG per payment." }, { status: 400 });
    }

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";
    const referenceId = body.referenceId || `TEST-${Date.now()}`;

    const bazik = getBazik();
    const payment = await bazik.payments.create({
      gdes: amount,
      successUrl: `${origin}/payment/success?ref=${referenceId}`,
      errorUrl: `${origin}/payment/failed?ref=${referenceId}`,
      description: body.description || "Atlanta Sneakers order",
      referenceId,
      customerFirstName: body.firstName || "Test",
      customerLastName: body.lastName || "Customer",
      customerEmail: body.email || undefined,
      webhookUrl: `${origin}/api/webhooks/bazik`,
    });

    return Response.json({ redirectUrl: payment.redirectUrl, orderId: payment.orderId });
  } catch (err: any) {
    console.error("Bazik create error:", err?.message || err);
    return Response.json({ error: err?.message || "Payment creation failed" }, { status: 502 });
  }
}
