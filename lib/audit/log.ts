// @ts-nocheck
// Central audit writer. audit_logs is immutable (DB trigger blocks UPDATE/DELETE).
// Any module can call logAudit() to record a rich, tamper-proof event. The Audit
// Center also aggregates every other log table via the audit_stream view, so most
// platform actions are already captured without extra wiring.
import { createClient as createAnon } from "@supabase/supabase-js";

function svc() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }

export async function logAudit({ actor, module, submodule, action, description, level = "information", object_type, object_id, old_value, new_value, ip, country, city, browser, os, device, api_endpoint, http_method, status_code, result = "ok", duration_ms, risk_level = "low", session_id, user_agent }) {
  try {
    await svc().from("audit_logs").insert({
      actor_id: actor?.id || null, actor_name: actor?.full_name || actor?.email || "System",
      module, submodule, action, description, level, entity: object_type, object_type, entity_id: object_id ? String(object_id) : null,
      old_value: old_value ?? null, new_value: new_value ?? null,
      ip_address: ip || null, country, city, browser, os, device, api_endpoint, http_method, status_code,
      result, duration_ms, risk_level, session_id: session_id || null, user_agent,
    });
  } catch { /* auditing must never break the request */ }
}
