// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

async function checkAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: "Forbidden", status: 403 };
  return { user };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = request.nextUrl;
  const section = searchParams.get("section") || "shipments";

  if (section === "kpis") {
    const { data: shipments } = await safeQuery(async () => await supabase.from("shipments").select("*"), { data: null } as any);
    const rows = shipments || [];
    const pending = rows.filter(s => s.status === "pending");
    const processing = rows.filter(s => s.status === "processing");
    const shipped = rows.filter(s => s.status === "shipped");
    const delivered = rows.filter(s => s.status === "delivered");
    const returned = rows.filter(s => s.status === "returned");
    const cancelled = rows.filter(s => s.status === "cancelled");
    const totalCost = rows.reduce((s, r) => s + (r.shipping_cost || 0), 0);
    const avgCost = rows.length > 0 ? (totalCost / rows.length).toFixed(2) : "0";
    const deliveredWithTime = delivered.filter(d => d.delivered_at && d.shipped_at);
    const avgDays = deliveredWithTime.length > 0
      ? (deliveredWithTime.reduce((s, d) => s + ((new Date(d.delivered_at).getTime() - new Date(d.shipped_at).getTime()) / 86400000), 0) / deliveredWithTime.length).toFixed(1)
      : "0";
    const successRate = rows.length > 0 ? ((delivered.length / rows.length) * 100).toFixed(1) : "0";

    const carrierCounts: Record<string, number> = {};
    rows.forEach(r => { if (r.carrier) carrierCounts[r.carrier] = (carrierCounts[r.carrier] || 0) + 1; });
    const topCarrier = Object.entries(carrierCounts).sort((a, b) => b[1] - a[1])[0];

    return Response.json({
      totalShipments: rows.length, pending: pending.length, processing: processing.length,
      shipped: shipped.length, delivered: delivered.length, returned: returned.length,
      cancelled: cancelled.length, avgCost: parseFloat(avgCost), avgDeliveryDays: parseFloat(avgDays),
      shippingRevenue: totalCost, topCarrier: topCarrier?.[0] || "—",
      successRate: parseFloat(successRate),
    });
  }

  if (section === "shipments") {
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const carrier = searchParams.get("carrier") || "";
    const method = searchParams.get("method") || "";
    const country = searchParams.get("country") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortDir = searchParams.get("sortDir") || "desc";
    const offset = (page - 1) * limit;

    let query = supabase.from("shipments").select("*", { count: "exact" });
    if (search) query = query.or(`tracking_number.ilike.%${search}%,order_id.ilike.%${search}%,customer_name.ilike.%${search}%`);
    if (status) query = query.eq("status", status);
    if (carrier) query = query.eq("carrier", carrier);
    if (method) query = query.eq("shipping_method", method);
    if (country) query = query.eq("country", country);
    query = query.order(sortBy, { ascending: sortDir === "asc" });
    query = query.range(offset, offset + limit - 1);

    const { data, count } = await safeQuery(async () => await query, { data: null, count: 0 } as any);
    return Response.json({ rows: data || [], total: count || 0, page, limit });
  }

  if (section === "detail") {
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    const { data } = await safeQuery(async () => await supabase.from("shipments").select("*").eq("id", id).single(), { data: null } as any);
    if (!data) return Response.json({ error: "Not found" }, { status: 404 });
    const { data: events } = await safeQuery(async () => await supabase.from("shipment_events").select("*").eq("shipment_id", id).order("created_at", { ascending: false }), { data: null } as any);
    return Response.json({ ...data, events: events || [] });
  }

  if (section === "zones") {
    const { data } = await safeQuery(async () => await supabase.from("shipping_zones").select("*").order("name", { ascending: true }), { data: null } as any);
    return Response.json({ zones: data || [] });
  }

  if (section === "methods") {
    const { data } = await safeQuery(async () => await supabase.from("shipping_methods").select("*").order("name", { ascending: true }), { data: null } as any);
    return Response.json({ methods: data || [] });
  }

  if (section === "carriers") {
    const { data } = await safeQuery(async () => await supabase.from("shipping_carriers").select("*").order("name", { ascending: true }), { data: null } as any);
    return Response.json({ carriers: data || [] });
  }

  if (section === "rates") {
    const zone = searchParams.get("zone") || "";
    let query = supabase.from("shipping_rates").select("*").order("created_at", { ascending: false });
    if (zone) query = query.eq("zone_id", zone);
    const { data } = await safeQuery(async () => await query, { data: null } as any);
    return Response.json({ rates: data || [] });
  }

  if (section === "warehouses") {
    const { data } = await safeQuery(async () => await supabase.from("warehouses").select("*").order("name", { ascending: true }), { data: null } as any);
    return Response.json({ warehouses: data || [] });
  }

  if (section === "returns") {
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;
    let query = supabase.from("shipping_returns").select("*", { count: "exact" }).order("created_at", { ascending: false });
    query = query.range(offset, offset + limit - 1);
    const { data, count } = await safeQuery(async () => await query, { data: null, count: 0 } as any);
    return Response.json({ rows: data || [], total: count || 0, page, limit });
  }

  if (section === "analytics") {
    const { data: shipments } = await safeQuery(async () => await supabase.from("shipments").select("carrier, shipping_method, shipping_cost, status, shipped_at, delivered_at, country"), { data: null } as any);
    const rows = shipments || [];
    const byCarrier: Record<string, { count: number; cost: number; delivered: number }> = {};
    rows.forEach(r => {
      const c = r.carrier || "Unknown";
      if (!byCarrier[c]) byCarrier[c] = { count: 0, cost: 0, delivered: 0 };
      byCarrier[c].count++;
      byCarrier[c].cost += (r.shipping_cost || 0);
      if (r.status === "delivered") byCarrier[c].delivered++;
    });
    const byCountry: Record<string, number> = {};
    rows.forEach(r => { const c = r.country || "Unknown"; byCountry[c] = (byCountry[c] || 0) + 1; });
    const byMethod: Record<string, number> = {};
    rows.forEach(r => { const m = r.shipping_method || "Unknown"; byMethod[m] = (byMethod[m] || 0) + 1; });
    const delayed = rows.filter(r => r.status === "shipped" && r.estimated_delivery && new Date(r.estimated_delivery) < new Date());

    return Response.json({ byCarrier, byCountry, byMethod, delayedCount: delayed.length, totalShipments: rows.length });
  }

  if (section === "export") {
    const { data } = await safeQuery(async () => await supabase.from("shipments").select("*").order("created_at", { ascending: false }), { data: null } as any);
    return Response.json({ rows: data || [] });
  }

  return Response.json({ error: "Unknown section" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { action } = body;

  if (action === "create_zone") {
    const { name, countries, states, cities, zip_codes, priority, is_active } = body;
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    const { data } = await safeQuery(async () => await supabase.from("shipping_zones").insert({
      name, countries: countries || [], states: states || [], cities: cities || [],
      zip_codes: zip_codes || [], priority: priority || 0, is_active: is_active !== false,
      created_by: auth.user.id,
    }).select().single(), { data: null } as any);
    return Response.json({ success: true, zone: data });
  }

  if (action === "create_method") {
    const { name, type, description, is_active, min_order, max_order, min_weight,
      max_weight, base_cost, free_shipping_threshold, estimated_days } = body;
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    const { data } = await safeQuery(async () => await supabase.from("shipping_methods").insert({
      name, type: type || "flat_rate", description: description || null,
      is_active: is_active !== false, min_order: min_order || null,
      max_order: max_order || null, min_weight: min_weight || null,
      max_weight: max_weight || null, base_cost: base_cost || 0,
      free_shipping_threshold: free_shipping_threshold || null,
      estimated_days: estimated_days || null, created_by: auth.user.id,
    }).select().single(), { data: null } as any);
    return Response.json({ success: true, method: data });
  }

  if (action === "create_carrier") {
    const { name, code, logo, tracking_url, api_key, api_secret,
      is_active, estimated_days, description } = body;
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    const { data } = await safeQuery(async () => await supabase.from("shipping_carriers").insert({
      name, code: code || name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      logo: logo || null, tracking_url: tracking_url || null,
      api_key: api_key || null, api_secret: api_secret || null,
      is_active: is_active !== false, estimated_days: estimated_days || null,
      description: description || null, created_by: auth.user.id,
    }).select().single(), { data: null } as any);
    return Response.json({ success: true, carrier: data });
  }

  if (action === "create_rate") {
    const { zone_id, method_id, carrier_id, min_weight, max_weight,
      min_price, max_price, rate, rate_type } = body;
    const { data } = await safeQuery(async () => await supabase.from("shipping_rates").insert({
      zone_id: zone_id || null, method_id: method_id || null,
      carrier_id: carrier_id || null, min_weight: min_weight || null,
      max_weight: max_weight || null, min_price: min_price || null,
      max_price: max_price || null, rate: rate || 0,
      rate_type: rate_type || "fixed", created_by: auth.user.id,
    }).select().single(), { data: null } as any);
    return Response.json({ success: true, rate: data });
  }

  if (action === "create_warehouse") {
    const { name, address, city, state, country, zip_code, phone, email,
      is_active, is_default, type } = body;
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    const { data } = await safeQuery(async () => await supabase.from("warehouses").insert({
      name, address: address || null, city: city || null, state: state || null,
      country: country || null, zip_code: zip_code || null, phone: phone || null,
      email: email || null, is_active: is_active !== false,
      is_default: is_default || false, type: type || "main",
      created_by: auth.user.id,
    }).select().single(), { data: null } as any);
    return Response.json({ success: true, warehouse: data });
  }

  if (action === "add_event") {
    const { shipment_id, status, description, location } = body;
    if (!shipment_id) return Response.json({ error: "Missing shipment_id" }, { status: 400 });
    await safeQuery(async () => await supabase.from("shipment_events").insert({
      shipment_id, status: status || "update", description: description || null,
      location: location || null, created_by: auth.user.id,
    }), null);
    if (status) {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === "delivered") updates.delivered_at = new Date().toISOString();
      if (status === "shipped") updates.shipped_at = new Date().toISOString();
      await supabase.from("shipments").update(updates).eq("id", shipment_id);
    }
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { id, table, ...updates } = body;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
  updates.updated_at = new Date().toISOString();

  const t = table || "shipments";
  const allowed = ["shipments", "shipping_zones", "shipping_methods", "shipping_carriers", "shipping_rates", "warehouses"];
  if (!allowed.includes(t)) return Response.json({ error: "Invalid table" }, { status: 400 });

  const { error } = await supabase.from(t).update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { action, ids } = body;
  if (!ids?.length) return Response.json({ error: "No ids" }, { status: 400 });

  if (action === "update_status") {
    const { status } = body;
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === "delivered") updates.delivered_at = new Date().toISOString();
    if (status === "shipped") updates.shipped_at = new Date().toISOString();
    await supabase.from("shipments").update(updates).in("id", ids);
  } else if (action === "assign_carrier") {
    const { carrier } = body;
    await supabase.from("shipments").update({ carrier, updated_at: new Date().toISOString() }).in("id", ids);
  } else if (action === "delete") {
    await supabase.from("shipments").delete().in("id", ids);
  } else return Response.json({ error: "Unknown action" }, { status: 400 });

  return Response.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const id = request.nextUrl.searchParams.get("id");
  const table = request.nextUrl.searchParams.get("table") || "shipments";
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const allowed = ["shipments", "shipping_zones", "shipping_methods", "shipping_carriers", "shipping_rates", "warehouses"];
  if (!allowed.includes(table)) return Response.json({ error: "Invalid table" }, { status: 400 });

  await safeQuery(async () => await supabase.from(table).delete().eq("id", id), null);
  return Response.json({ success: true });
}
