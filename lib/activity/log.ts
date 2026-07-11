// @ts-nocheck
// Operational activity writer. Business events (orders, products, customers,
// payments, reviews, coupons…) already surface automatically via the
// activity_stream view; use logActivity() for explicit ops events that aren't
// tied to a row insert (e.g. "Inventory updated", "Flash Deal started").
import { createClient as createAnon } from "@supabase/supabase-js";

function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }

export async function logActivity({ actor, module, activity_type, action, description, object_type, object_id, status = "success", priority = "low", ip, country, browser, device, meta }) {
  try {
    await svc().from("activities").insert({
      actor_id: actor?.id || null, actor_name: actor?.full_name || actor?.email || "System", actor_avatar: actor?.avatar_url || null,
      module, activity_type: activity_type || module, action, description,
      object_type, object_id: object_id ? String(object_id) : null, status, priority,
      ip_address: ip || null, country, browser, device, meta: meta || {},
    });
  } catch { /* activity logging must never break the request */ }
}
