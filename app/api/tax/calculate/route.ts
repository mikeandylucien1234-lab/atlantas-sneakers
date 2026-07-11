// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { calculateTaxes } from "@/lib/tax/tax-engine";

// Real-time tax calculation for checkout and order flows.
// Loads active tax rules and runs them through the shared engine so the math
// is never duplicated. Accessible to any authenticated visitor (reads only
// active public rules via RLS) — no rule internals beyond what the engine needs.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { country, state, city, postal_code, customer_type, items, subtotal } = body;

    if (!Array.isArray(items)) {
      return Response.json({ error: "items array is required" }, { status: 400 });
    }

    // Only active rules are loaded; the engine re-checks status and validity dates.
    const { data: rules } = await supabase
      .from("tax_rules")
      .select("*")
      .eq("status", "active");

    const result = calculateTaxes((rules || []) as never, {
      country, state, city, postal_code,
      customer_type: customer_type || "guest",
      items,
      subtotal,
    });

    return Response.json(result);
  } catch (error) {
    console.error("Tax calculate error:", error);
    // Never break checkout on tax failure — return zero tax
    return Response.json({ taxes: [], totalTax: 0, inclusiveTax: 0, taxableSubtotal: 0 });
  }
}
