import { NextRequest } from "next/server";
import { refundOrder, supabaseAdmin } from "@/lib/payments/payment-service";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getAuthUser() {
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, amount, reason } = (await request.json()) as {
    orderId: string;
    amount?: number;
    reason?: string;
  };

  if (!orderId) {
    return Response.json({ error: "orderId is required" }, { status: 400 });
  }

  // Single official refund flow — performs a REAL Stripe refund for card orders.
  const result = await refundOrder(orderId, { amount, reason });
  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ success: true, refundId: result.refundId, amount: result.amount, type: result.type, manual: result.manual });
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const orderId = request.nextUrl.searchParams.get("orderId");

  let query = supabaseAdmin.from("refunds").select("*").order("created_at", { ascending: false });
  if (orderId) query = query.eq("order_id", orderId);

  const { data, error } = await query.limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ refunds: data });
}
