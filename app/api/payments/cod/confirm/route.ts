import { NextRequest } from "next/server";
import { createPaymentRecord, updatePaymentStatus, logPaymentEvent } from "@/lib/payments/payment-service";

export async function POST(request: NextRequest) {
  try {
    const { orderId, userId, amount } = (await request.json()) as {
      orderId: string;
      userId: string | null;
      amount: number;
    };

    if (!orderId || !amount) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const paymentId = await createPaymentRecord({
      orderId,
      userId,
      amount,
      currency: "USD",
      gateway: "cod",
    });

    await updatePaymentStatus(paymentId, "pending", {
      merchant_reference: `COD-${orderId.slice(0, 8)}`,
    });

    await logPaymentEvent({
      paymentId,
      gateway: "cod",
      eventType: "cod.confirmed",
      request: { orderId, amount },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return Response.json({ paymentId, status: "pending" });
  } catch (err) {
    console.error("COD confirm error:", err);
    return Response.json({ error: "Failed to confirm COD" }, { status: 500 });
  }
}
