import { NextRequest } from "next/server";
import { createPaymentRecord, updatePaymentStatus, logPaymentEvent } from "@/lib/payments/payment-service";

export async function POST(request: NextRequest) {
  try {
    const { orderId, userId, amount, referenceNumber } = (await request.json()) as {
      orderId: string;
      userId: string | null;
      amount: number;
      referenceNumber: string;
    };

    if (!orderId || !amount) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const paymentId = await createPaymentRecord({
      orderId,
      userId,
      amount,
      currency: "USD",
      gateway: "bank_transfer",
    });

    await updatePaymentStatus(paymentId, "processing", {
      merchant_reference: referenceNumber || `BT-${orderId.slice(0, 8)}`,
    });

    await logPaymentEvent({
      paymentId,
      gateway: "bank_transfer",
      eventType: "bank_transfer.submitted",
      request: { orderId, amount, referenceNumber },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return Response.json({ paymentId, status: "processing" });
  } catch (err) {
    console.error("Bank transfer confirm error:", err);
    return Response.json({ error: "Failed to confirm bank transfer" }, { status: 500 });
  }
}
