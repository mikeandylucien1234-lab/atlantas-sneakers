import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/payments/payment-service";

export async function GET(request: NextRequest) {
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
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const gateway = request.nextUrl.searchParams.get("gateway");
  const eventType = request.nextUrl.searchParams.get("eventType");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "100");

  let query = supabaseAdmin
    .from("payment_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (gateway) query = query.eq("gateway", gateway);
  if (eventType) query = query.eq("event_type", eventType);

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ logs: data });
}
