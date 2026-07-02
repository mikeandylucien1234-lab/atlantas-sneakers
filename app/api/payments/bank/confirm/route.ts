import { NextRequest } from "next/server";
import { createPaymentRecord, updatePaymentStatus, logPaymentEvent, supabaseAdmin } from "@/lib/payments/payment-service";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId, amount, referenceNumber } = (await request.json()) as {
      orderId: string;
      amount: number;
      referenceNumber: string;
    };

    if (!orderId || !amount) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify order belongs to user and validate amount
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, total")
      .eq("id", orderId)
      .single();

    if (!order || order.user_id !== user.id) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    if (Math.abs(Number(order.total) - amount) > 0.01) {
      return Response.json({ error: "Amount mismatch" }, { status: 400 });
    }

    const paymentId = await createPaymentRecord({
      orderId,
      userId: user.id,
      amount: Number(order.total),
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
