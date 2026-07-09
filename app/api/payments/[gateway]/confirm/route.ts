// @ts-nocheck
// Generic manual-payment confirmation for wizard-created gateways.
// Static routes (cod, bank, moncash, natcash) take precedence over this
// dynamic segment, so built-in flows are unaffected.
import { NextRequest } from "next/server";
import { createPaymentRecord, updatePaymentStatus, logPaymentEvent, supabaseAdmin } from "@/lib/payments/payment-service";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest, { params }) {
  try {
    const { gateway } = await params;
    const code = String(gateway || "").toLowerCase();

    // Only gateways registered and enabled in payment_settings are accepted
    const { data: gw } = await supabaseAdmin
      .from("payment_settings")
      .select("gateway, enabled, integration_type, display_name")
      .eq("gateway", code)
      .single();
    if (!gw) return Response.json({ error: "Unknown payment gateway" }, { status: 404 });
    if (!gw.enabled) return Response.json({ error: "This payment method is disabled" }, { status: 403 });
    if (gw.integration_type !== "manual") {
      return Response.json({ error: "This gateway requires its API integration route" }, { status: 400 });
    }

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
    if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { orderId, amount, reference } = await request.json();
    if (!orderId || !amount) return Response.json({ error: "Missing required fields" }, { status: 400 });

    const { data: order } = await supabaseAdmin
      .from("orders").select("id, user_id, total").eq("id", orderId).single();
    if (!order || order.user_id !== user.id) return Response.json({ error: "Order not found" }, { status: 404 });
    if (Math.abs(Number(order.total) - amount) > 0.01) {
      return Response.json({ error: "Amount mismatch" }, { status: 400 });
    }

    const paymentId = await createPaymentRecord({
      orderId, userId: user.id, amount: Number(order.total), currency: "USD", gateway: code,
    });

    await updatePaymentStatus(paymentId, "pending", {
      merchant_reference: reference ? String(reference).slice(0, 100) : `${code.toUpperCase()}-${orderId.slice(0, 8)}`,
    });

    await logPaymentEvent({
      paymentId, gateway: code, eventType: `${code}.confirmed`,
      request: { orderId, amount },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return Response.json({ paymentId, status: "pending" });
  } catch (err) {
    console.error("Generic gateway confirm error:", err);
    return Response.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
