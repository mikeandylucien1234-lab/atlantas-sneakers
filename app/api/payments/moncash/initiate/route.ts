import { NextRequest } from "next/server";
import { createPaymentRecord, logPaymentEvent, supabaseAdmin } from "@/lib/payments/payment-service";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
        amount: Number(order.total),
        orderId: paymentId,
      }),
    });

    const paymentData = await paymentRes.json();

    await logPaymentEvent({
      paymentId,
      gateway: "moncash",
      eventType: "payment.initiated",
      request: { orderId, amount: Number(order.total), phone },
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
