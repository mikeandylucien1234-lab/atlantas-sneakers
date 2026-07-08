// @ts-nocheck
import { createClient } from "@/lib/supabase/server";

// Public: list enabled payment methods for checkout. No secrets exposed.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("payment_settings")
      .select("gateway, display_name, description, enabled, sandbox_mode, sort")
      .eq("enabled", true)
      .order("sort");
    return Response.json({ methods: data || [] });
  } catch (error) {
    console.error("Payment methods API error:", error);
    return Response.json({ methods: [] });
  }
}
