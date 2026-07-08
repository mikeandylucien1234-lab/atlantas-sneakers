// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function checkAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: "Forbidden", status: 403 };
  return { user };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const { data } = await supabase.from("payment_settings").select("*").order("sort");

    // Env-configured status (booleans only — never expose values)
    const envStatus = {
      moncash: {
        client_id: !!process.env.MONCASH_CLIENT_ID,
        client_secret: !!process.env.MONCASH_CLIENT_SECRET,
        webhook_secret: !!process.env.MONCASH_WEBHOOK_SECRET,
        mode: process.env.MONCASH_MODE === "production" ? "production" : "sandbox",
      },
      natcash: {
        api_key: !!process.env.NATCASH_API_KEY,
        webhook_secret: !!process.env.NATCASH_WEBHOOK_SECRET,
        mode: process.env.NATCASH_MODE === "production" ? "production" : "sandbox",
      },
      stripe: {
        secret_key: !!process.env.STRIPE_SECRET_KEY,
        webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
        publishable_key: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      },
    };

    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://atlantassneakers.com";
    const webhookUrls = {
      moncash: `${base}/api/webhooks/moncash`,
      natcash: `${base}/api/webhooks/natcash`,
      stripe: `${base}/api/webhook`,
    };

    return Response.json({ settings: data || [], envStatus, webhookUrls });
  } catch (error) {
    console.error("Payment settings GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { gateway } = body;
    if (!gateway) return Response.json({ error: "gateway required" }, { status: 400 });

    const patch = { updated_at: new Date().toISOString() };
    ["enabled", "sandbox_mode", "merchant_id", "timeout_seconds", "retry_attempts", "display_name", "description"].forEach(k => {
      if (body[k] !== undefined) patch[k] = body[k];
    });

    const { error } = await supabase.from("payment_settings").update(patch).eq("gateway", gateway);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Payment settings PUT error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
