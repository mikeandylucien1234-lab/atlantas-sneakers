import { NextRequest } from "next/server";
import { processRefund, supabaseAdmin } from "@/lib/payments/payment-service";
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

  const { paymentId, amount, reason, type } = (await request.json()) as {
    paymentId: string;
    amount: number;
    reason: string;
    type: "full" | "partial";
  };

  if (!paymentId || !amount) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const result = await processRefund(paymentId, amount, reason, type);
  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ success: true });
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
