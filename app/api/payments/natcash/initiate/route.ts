import { NextRequest } from "next/server";
import { createPaymentRecord, logPaymentEvent, supabaseAdmin } from "@/lib/payments/payment-service";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const NATCASH_BASE = process.env.NATCASH_MODE === "production"
  ? "https://api.natcash.ht"
  : "https://sandbox.natcash.ht";

export async function POST(request: NextRequest) {
  const start = Date.now();
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

    const body = await request.json();
    const { orderId, amount, phone } = body as {
      orderId: string;
      amount: number;
      phone: string;
    };

    if (!orderId || !amount || !phone) {
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
        amount: Number(order.total),
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
      request: { orderId, amount: Number(order.total), phone },
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
