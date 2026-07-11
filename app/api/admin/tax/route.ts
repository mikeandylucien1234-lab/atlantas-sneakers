// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { validateTaxRule } from "@/lib/tax/tax-engine";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function checkAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: "Forbidden", status: 403 };
  return { user, profile };
}

async function audit(supabase, auth, request, action, tax_rule_id, old_value, new_value) {
  try {
    await supabase.from("tax_logs").insert({
      tax_rule_id: tax_rule_id || null, action,
      actor_id: auth.user?.id || null,
      actor_name: auth.profile?.full_name || auth.profile?.email || "Admin",
      ip_address: request.headers.get("x-forwarded-for") || null,
      old_value: old_value ?? null, new_value: new_value ?? null,
    });
  } catch { /* audit must never block */ }
}

const EDITABLE = [
  "name", "tax_type", "value_type", "inclusive", "rate", "country", "state", "city",
  "postal_code", "applies_to", "target_category_ids", "target_brand_ids", "target_product_ids",
  "customer_type", "min_order", "max_order", "priority", "status",
  "start_date", "end_date", "internal_notes", "visible_description",
];

function sanitize(body) {
  const out = {};
  EDITABLE.forEach(k => { if (body[k] !== undefined) out[k] = body[k]; });
  if (out.rate !== undefined) out.rate = Number(out.rate) || 0;
  if (out.priority !== undefined) out.priority = parseInt(out.priority) || 0;
  if (out.min_order !== undefined) out.min_order = out.min_order === "" || out.min_order == null ? 0 : Number(out.min_order);
  if (out.max_order !== undefined) out.max_order = out.max_order === "" || out.max_order == null ? null : Number(out.max_order);
  ["state", "city", "postal_code", "start_date", "end_date", "internal_notes", "visible_description"].forEach(k => {
    if (out[k] === "") out[k] = null;
  });
  ["target_category_ids", "target_brand_ids", "target_product_ids"].forEach(k => {
    if (out[k] !== undefined && !Array.isArray(out[k])) out[k] = [];
  });
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const sp = request.nextUrl.searchParams;
    const section = sp.get("section") || "list";

    if (section === "kpis") {
      const kpis = await safeQuery(async () => {
        const { data: rules } = await supabase.from("tax_rules").select("id, status, country");
        const rows = rules || [];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

        const [{ data: todayOrders }, { data: monthOrders }] = await Promise.all([
          supabase.from("orders").select("tax_amount, created_at").gte("created_at", today.toISOString()),
          supabase.from("orders").select("tax_amount, created_at").gte("created_at", monthStart.toISOString()),
        ]);
        const sum = (arr) => (arr || []).reduce((s, o) => s + (Number(o.tax_amount) || 0), 0);

        return {
          total: rows.length,
          active: rows.filter(r => r.status === "active").length,
          inactive: rows.filter(r => r.status === "inactive").length,
          draft: rows.filter(r => r.status === "draft").length,
          collectedToday: Math.round(sum(todayOrders) * 100) / 100,
          collectedMonth: Math.round(sum(monthOrders) * 100) / 100,
          countriesConfigured: new Set(rows.map(r => r.country).filter(Boolean)).size,
        };
      }, { total: 0, active: 0, inactive: 0, draft: 0, collectedToday: 0, collectedMonth: 0, countriesConfigured: 0 });
      return Response.json(kpis);
    }

    if (section === "list") {
      const page = parseInt(sp.get("page") || "1", 10);
      const per_page = parseInt(sp.get("per_page") || "20", 10);
      const search = sp.get("search");
      const status = sp.get("status");
      const country = sp.get("country");
      const tax_type = sp.get("tax_type");
      const sort = sp.get("sort") || "priority";
      const order = sp.get("order") || "asc";

      const result = await safeQuery(async () => {
        let query = supabase.from("tax_rules").select("*", { count: "exact" });
        if (status) query = query.eq("status", status);
        if (country) query = query.eq("country", country);
        if (tax_type) query = query.eq("tax_type", tax_type);
        if (search) query = query.or(`name.ilike.%${search}%,country.ilike.%${search}%,state.ilike.%${search}%,city.ilike.%${search}%`);
        const sortCol = ["name", "country", "rate", "priority", "created_at", "status"].includes(sort) ? sort : "priority";
        query = query.order(sortCol, { ascending: order === "asc" });
        const from = (page - 1) * per_page;
        query = query.range(from, from + per_page - 1);
        const { data, count } = await query;
        return { rules: data || [], total: count || 0, page, per_page, totalPages: Math.ceil((count || 0) / per_page) };
      }, { rules: [], total: 0, page, per_page, totalPages: 0 });
      return Response.json(result);
    }

    if (section === "detail") {
      const id = sp.get("id");
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const detail = await safeQuery(async () => {
        const { data: rule } = await supabase.from("tax_rules").select("*").eq("id", id).single();
        if (!rule) return null;
        const { data: logs } = await supabase.from("tax_logs").select("*").eq("tax_rule_id", id).order("created_at", { ascending: false }).limit(30);
        return { ...rule, logs: logs || [] };
      }, null);
      if (!detail) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json(detail);
    }

    if (section === "countries") {
      const data = await safeQuery(async () => {
        const { data } = await supabase.from("tax_rules").select("country");
        return [...new Set((data || []).map(r => r.country).filter(Boolean))].sort();
      }, []);
      return Response.json({ countries: data });
    }

    if (section === "export") {
      const data = await safeQuery(async () => {
        const { data } = await supabase.from("tax_rules").select("*").order("priority");
        return data || [];
      }, []);
      return Response.json({ rules: data });
    }

    return Response.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Tax API GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();

    // Import (bulk create)
    if (body.action === "import" && Array.isArray(body.rules)) {
      let created = 0; const errors = [];
      for (const r of body.rules) {
        const err = validateTaxRule(r);
        if (err) { errors.push({ name: r.name, error: err }); continue; }
        const { error } = await supabase.from("tax_rules").insert({ ...sanitize(r), created_by: auth.user.id });
        if (error) errors.push({ name: r.name, error: error.message }); else created++;
      }
      await audit(supabase, auth, request, "created", null, null, { imported: created });
      return Response.json({ success: true, created, errors });
    }

    const err = validateTaxRule(body);
    if (err) return Response.json({ error: err }, { status: 400 });

    const record = { ...sanitize(body), created_by: auth.user.id };
    const { data, error } = await supabase.from("tax_rules").insert(record).select().single();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    await audit(supabase, auth, request, "created", data.id, null, record);
    return Response.json({ success: true, rule: data }, { status: 201 });
  } catch (error) {
    console.error("Tax API POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { id } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const merged = { ...body };
    const err = validateTaxRule(merged);
    if (err) return Response.json({ error: err }, { status: 400 });

    const { data: before } = await supabase.from("tax_rules").select("*").eq("id", id).single();
    const patch = { ...sanitize(body), updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("tax_rules").update(patch).eq("id", id).select().single();
    if (error) return Response.json({ error: error.message }, { status: 400 });

    // Audit the status transitions distinctly
    let action = "updated";
    if (before && patch.status && before.status !== patch.status) {
      if (patch.status === "active") action = "enabled";
      else if (patch.status === "inactive") action = "disabled";
    }
    await audit(supabase, auth, request, action, id, before, patch);
    return Response.json({ success: true, rule: data });
  } catch (error) {
    console.error("Tax API PUT error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { ids, action } = body;
    if (!ids?.length || !action) return Response.json({ error: "ids and action required" }, { status: 400 });
    const now = new Date().toISOString();

    if (action === "enable" || action === "disable") {
      const status = action === "enable" ? "active" : "inactive";
      await supabase.from("tax_rules").update({ status, updated_at: now }).in("id", ids);
      for (const id of ids) await audit(supabase, auth, request, action === "enable" ? "enabled" : "disabled", id, null, { status });
    } else if (action === "delete") {
      for (const id of ids) await audit(supabase, auth, request, "deleted", id, null, null);
      const { error } = await supabase.from("tax_rules").delete().in("id", ids);
      if (error) return Response.json({ error: error.message }, { status: 400 });
    } else if (action === "duplicate") {
      let count = 0;
      for (const id of ids) {
        const { data: orig } = await supabase.from("tax_rules").select("*").eq("id", id).single();
        if (!orig) continue;
        const { id: _i, created_at: _c, updated_at: _u, ...rest } = orig;
        const { data: dup } = await supabase.from("tax_rules").insert({ ...rest, name: `${rest.name} (Copy)`, status: "draft", created_by: auth.user.id }).select().single();
        if (dup) { await audit(supabase, auth, request, "duplicated", dup.id, null, { from: id }); count++; }
      }
      return Response.json({ success: true, duplicated: count });
    } else {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }
    return Response.json({ success: true, updated: ids.length });
  } catch (error) {
    console.error("Tax API PATCH error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const id = body.id || request.nextUrl.searchParams.get("id");
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    await audit(supabase, auth, request, "deleted", id, null, null);
    const { error } = await supabase.from("tax_rules").delete().eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Tax API DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
