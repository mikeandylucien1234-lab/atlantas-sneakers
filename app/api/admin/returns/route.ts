// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function checkAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: profile } = await supabase
    .from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: "Forbidden", status: 403 };
  return { user, profile };
}

async function addEvent(supabase, return_id, event_type, title, description, actor) {
  await supabase.from("return_events").insert({ return_id, event_type, title, description, actor });
}

const RETURN_SELECT = `*,
  order:orders(id, order_number, total, subtotal, shipping_cost, payment_status, shipping_address, created_at),
  customer:profiles!return_requests_customer_id_fkey(id, full_name, email),
  agent:profiles!return_requests_agent_id_fkey(id, full_name, email),
  items:return_items(*, product:products(id, name, slug, images, price))`;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const sp = request.nextUrl.searchParams;
    const section = sp.get("section") || "list";

    if (section === "kpis") {
      const kpis = await safeQuery(async () => {
        const { data: returns } = await supabase
          .from("return_requests")
          .select("id, status, return_type, refund_amount, refund_status, fraud_score, created_at, resolved_at, deleted_at")
          .is("deleted_at", null);
        const rows = returns || [];
        const by = (s) => rows.filter(r => r.status === s).length;
        const resolved = rows.filter(r => r.resolved_at);
        const avgResolutionHours = resolved.length
          ? Math.round(resolved.reduce((sum, r) => sum + (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / 36e5, 0) / resolved.length)
          : 0;
        const refunded = rows.filter(r => r.refund_status === "completed");
        const refundAmount = refunded.reduce((s, r) => s + (Number(r.refund_amount) || 0), 0);
        const { count: ordersCount } = await supabase.from("orders").select("id", { count: "exact", head: true });

        return {
          total: rows.length,
          pending: by("pending"),
          approved: by("approved"),
          rejected: by("rejected"),
          awaiting_shipment: by("awaiting_shipment"),
          in_transit: by("in_transit"),
          received: by("received"),
          inspecting: by("inspecting"),
          refunded: by("refunded"),
          exchanged: by("exchanged"),
          closed: by("closed"),
          avgResolutionHours,
          refundAmount: Math.round(refundAmount * 100) / 100,
          exchangeRate: rows.length ? Math.round((rows.filter(r => r.return_type === "exchange").length / rows.length) * 100) : 0,
          returnRate: ordersCount ? Math.round((rows.length / ordersCount) * 100) : 0,
          fraudulent: rows.filter(r => (r.fraud_score || 0) >= 60).length,
        };
      }, { total: 0, pending: 0, approved: 0, rejected: 0, awaiting_shipment: 0, in_transit: 0, received: 0, inspecting: 0, refunded: 0, exchanged: 0, closed: 0, avgResolutionHours: 0, refundAmount: 0, exchangeRate: 0, returnRate: 0, fraudulent: 0 });
      return Response.json(kpis);
    }

    if (section === "list") {
      const page = parseInt(sp.get("page") || "1", 10);
      const per_page = parseInt(sp.get("per_page") || "20", 10);
      const search = sp.get("search");
      const status = sp.get("status");
      const reason = sp.get("reason");
      const return_type = sp.get("type");
      const warehouse = sp.get("warehouse");
      const archived = sp.get("archived");

      const result = await safeQuery(async () => {
        let query = supabase.from("return_requests").select(RETURN_SELECT, { count: "exact" }).is("deleted_at", null);
        if (archived === "true") query = query.eq("is_archived", true);
        else query = query.eq("is_archived", false);
        if (status) query = query.eq("status", status);
        if (reason) query = query.eq("reason", reason);
        if (return_type) query = query.eq("return_type", return_type);
        if (warehouse) query = query.eq("warehouse", warehouse);
        if (search) query = query.or(`return_number.ilike.%${search}%,tracking_number.ilike.%${search}%,carrier.ilike.%${search}%`);
        query = query.order("created_at", { ascending: false });
        const from = (page - 1) * per_page;
        query = query.range(from, from + per_page - 1);
        const { data, count } = await query;
        return { returns: data || [], total: count || 0, page, per_page, totalPages: Math.ceil((count || 0) / per_page) };
      }, { returns: [], total: 0, page, per_page, totalPages: 0 });
      return Response.json(result);
    }

    if (section === "detail") {
      const id = sp.get("id");
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const detail = await safeQuery(async () => {
        const [reqRes, eventsRes, messagesRes] = await Promise.all([
          supabase.from("return_requests").select(RETURN_SELECT).eq("id", id).single(),
          supabase.from("return_events").select("*").eq("return_id", id).order("created_at", { ascending: true }),
          supabase.from("return_messages").select("*").eq("return_id", id).order("created_at", { ascending: true }),
        ]);
        if (!reqRes.data) return null;
        // customer history for fraud context
        const { data: history } = await supabase
          .from("return_requests")
          .select("id, return_number, status, refund_amount, created_at")
          .eq("customer_id", reqRes.data.customer_id)
          .neq("id", id)
          .order("created_at", { ascending: false })
          .limit(10);
        return { ...reqRes.data, events: eventsRes.data || [], messages: messagesRes.data || [], customer_history: history || [] };
      }, null);
      if (!detail) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json(detail);
    }

    if (section === "reasons") {
      const reasons = await safeQuery(async () => {
        const { data } = await supabase.from("return_reasons").select("*").eq("is_active", true).order("sort");
        return data || [];
      }, []);
      return Response.json({ reasons });
    }

    if (section === "orders_lookup") {
      const q = sp.get("q") || "";
      const orders = await safeQuery(async () => {
        let query = supabase
          .from("orders")
          .select("id, order_number, total, status, created_at, user:profiles(id, full_name, email), items:order_items(id, product_id, variant_id, quantity, price, product:products(id, name, images), variant:product_variants(id, size, color, sku))")
          .order("created_at", { ascending: false })
          .limit(15);
        if (q) query = query.ilike("order_number", `%${q}%`);
        const { data } = await query;
        return data || [];
      }, []);
      return Response.json({ orders });
    }

    if (section === "analytics") {
      const analytics = await safeQuery(async () => {
        const { data: returns } = await supabase
          .from("return_requests")
          .select("id, status, reason, return_type, refund_amount, refund_status, carrier, fraud_score, customer_id, created_at, resolved_at, items:return_items(product_id, product_name, quantity)")
          .is("deleted_at", null);
        const rows = returns || [];

        const byReason = {};
        const byCarrier = {};
        const byProduct = {};
        const byMonth = {};
        rows.forEach(r => {
          byReason[r.reason] = (byReason[r.reason] || 0) + 1;
          if (r.carrier) byCarrier[r.carrier] = (byCarrier[r.carrier] || 0) + 1;
          const m = new Date(r.created_at).toISOString().slice(0, 7);
          byMonth[m] = (byMonth[m] || 0) + 1;
          (r.items || []).forEach(it => {
            const key = it.product_name || it.product_id;
            if (key) byProduct[key] = (byProduct[key] || 0) + (it.quantity || 1);
          });
        });

        // fraud: customers with 3+ returns
        const byCustomer = {};
        rows.forEach(r => { if (r.customer_id) byCustomer[r.customer_id] = (byCustomer[r.customer_id] || 0) + 1; });
        const highRiskCustomers = Object.values(byCustomer).filter(c => c >= 3).length;

        const refunds = rows.filter(r => r.refund_status === "completed");
        return {
          topReasons: Object.entries(byReason).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([reason, count]) => ({ reason, count })),
          topCarriers: Object.entries(byCarrier).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([carrier, count]) => ({ carrier, count })),
          mostReturnedProducts: Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([product, count]) => ({ product, count })),
          monthly: Object.entries(byMonth).sort().map(([month, count]) => ({ month, count })),
          totalRefunded: Math.round(refunds.reduce((s, r) => s + (Number(r.refund_amount) || 0), 0) * 100) / 100,
          refundCount: refunds.length,
          highRiskCustomers,
          flagged: rows.filter(r => (r.fraud_score || 0) >= 60).length,
        };
      }, { topReasons: [], topCarriers: [], mostReturnedProducts: [], monthly: [], totalRefunded: 0, refundCount: 0, highRiskCustomers: 0, flagged: 0 });
      return Response.json(analytics);
    }

    if (section === "export") {
      const data = await safeQuery(async () => {
        const { data: rows } = await supabase.from("return_requests").select(RETURN_SELECT).is("deleted_at", null).order("created_at", { ascending: false });
        return rows || [];
      }, []);
      return Response.json({ returns: data });
    }

    return Response.json({ error: "Invalid section" }, { status: 400 });
  } catch (error) {
    console.error("Returns API GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const actor = auth.profile?.full_name || auth.profile?.email || "Admin";

    const body = await request.json();
    const action = body.action || "create_return";

    if (action === "create_return") {
      const { order_id, customer_id, return_type, reason, description, items, refund_amount, warehouse } = body;
      if (!order_id || !reason) return Response.json({ error: "order_id and reason are required" }, { status: 400 });
      if (!items || !Array.isArray(items) || items.length === 0) return Response.json({ error: "At least one item is required" }, { status: 400 });

      // fraud scoring: prior returns from same customer
      let fraud_score = 0;
      const fraud_flags = [];
      if (customer_id) {
        const { count } = await supabase.from("return_requests").select("id", { count: "exact", head: true }).eq("customer_id", customer_id);
        if ((count || 0) >= 5) { fraud_score += 60; fraud_flags.push("excessive_returns"); }
        else if ((count || 0) >= 3) { fraud_score += 30; fraud_flags.push("frequent_returns"); }
        const { count: dup } = await supabase.from("return_requests").select("id", { count: "exact", head: true }).eq("order_id", order_id).is("deleted_at", null);
        if ((dup || 0) >= 1) { fraud_score += 40; fraud_flags.push("duplicate_request"); }
      }

      const return_number = `RET-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      const { data: ret, error } = await supabase.from("return_requests").insert({
        return_number, order_id, customer_id: customer_id || null,
        return_type: return_type || "refund", reason, description: description || null,
        refund_amount: refund_amount || 0, warehouse: warehouse || "main",
        fraud_score, fraud_flags,
      }).select().single();
      if (error) return Response.json({ error: error.message }, { status: 400 });

      const itemRows = items.map(it => ({
        return_id: ret.id, order_item_id: it.order_item_id || null,
        product_id: it.product_id || null, variant_id: it.variant_id || null,
        product_name: it.product_name || null, sku: it.sku || null,
        quantity: it.quantity || 1, unit_price: it.unit_price || 0,
      }));
      const { error: itemsError } = await supabase.from("return_items").insert(itemRows);
      if (itemsError) return Response.json({ error: itemsError.message }, { status: 400 });

      await addEvent(supabase, ret.id, "created", "Request Submitted", `Return created (${return_type || "refund"}) — reason: ${reason}`, actor);
      return Response.json(ret, { status: 201 });
    }

    if (action === "add_message") {
      const { return_id, message, is_internal } = body;
      if (!return_id || !message) return Response.json({ error: "return_id and message required" }, { status: 400 });
      const { data, error } = await supabase.from("return_messages").insert({
        return_id, sender_id: auth.user.id, sender_name: actor, sender_role: "admin",
        message, is_internal: !!is_internal,
      }).select().single();
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json(data, { status: 201 });
    }

    if (action === "generate_label") {
      const { return_id, carrier, tracking_number, warehouse } = body;
      if (!return_id) return Response.json({ error: "return_id required" }, { status: 400 });
      const tn = tracking_number || `RTN${Date.now().toString().slice(-10)}`;
      const labelUrl = `https://atlantassneakers.com/returns/label/${return_id}?tn=${encodeURIComponent(tn)}`;
      const { error } = await supabase.from("return_requests").update({
        carrier: carrier || null, tracking_number: tn, warehouse: warehouse || undefined,
        return_label_url: labelUrl, status: "awaiting_shipment", updated_at: new Date().toISOString(),
      }).eq("id", return_id);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      await addEvent(supabase, return_id, "label", "Return Label Generated", `Carrier: ${carrier || "N/A"} — Tracking: ${tn}`, actor);
      return Response.json({ success: true, tracking_number: tn, label_url: labelUrl });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Returns API POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const actor = auth.profile?.full_name || auth.profile?.email || "Admin";

    const body = await request.json();
    const { id, action } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    const { data: ret } = await supabase.from("return_requests").select("*, items:return_items(*)").eq("id", id).single();
    if (!ret) return Response.json({ error: "Return not found" }, { status: 404 });

    const now = new Date().toISOString();

    if (action === "approve") {
      await supabase.from("return_requests").update({ status: "approved", agent_id: auth.user.id, updated_at: now }).eq("id", id);
      await addEvent(supabase, id, "approved", "Return Approved", body.note || null, actor);
      return Response.json({ success: true });
    }

    if (action === "reject") {
      await supabase.from("return_requests").update({ status: "rejected", agent_id: auth.user.id, resolved_at: now, updated_at: now }).eq("id", id);
      await addEvent(supabase, id, "rejected", "Return Rejected", body.note || null, actor);
      return Response.json({ success: true });
    }

    if (action === "request_info") {
      await addEvent(supabase, id, "info_requested", "More Information Requested", body.note || null, actor);
      if (body.note) {
        await supabase.from("return_messages").insert({
          return_id: id, sender_id: auth.user.id, sender_name: actor, sender_role: "admin",
          message: body.note, is_internal: false,
        });
      }
      return Response.json({ success: true });
    }

    if (action === "update_status") {
      const allowed = ["pending", "approved", "rejected", "awaiting_shipment", "in_transit", "received", "inspecting", "refunded", "exchanged", "closed"];
      if (!allowed.includes(body.status)) return Response.json({ error: "Invalid status" }, { status: 400 });
      const patch = { status: body.status, updated_at: now };
      if (["refunded", "exchanged", "closed", "rejected"].includes(body.status)) patch.resolved_at = now;
      await supabase.from("return_requests").update(patch).eq("id", id);
      await addEvent(supabase, id, "status", `Status: ${body.status.replace(/_/g, " ")}`, body.note || null, actor);
      return Response.json({ success: true });
    }

    if (action === "assign") {
      const patch = { updated_at: now };
      if (body.agent_id !== undefined) patch.agent_id = body.agent_id;
      if (body.warehouse) patch.warehouse = body.warehouse;
      await supabase.from("return_requests").update(patch).eq("id", id);
      await addEvent(supabase, id, "assigned", "Assignment Updated", body.warehouse ? `Warehouse: ${body.warehouse}` : "Agent assigned", actor);
      return Response.json({ success: true });
    }

    if (action === "inspect") {
      const { condition, damage_report, missing_accessories, decision, notes, item_restocks } = body;
      const inspection = { condition, damage_report: damage_report || null, missing_accessories: missing_accessories || null, decision, notes: notes || null, inspected_at: now, inspector: actor };
      await supabase.from("return_requests").update({ inspection, status: decision === "rejected" ? "rejected" : "inspecting", updated_at: now, ...(decision === "rejected" ? { resolved_at: now } : {}) }).eq("id", id);

      // Restock approved items — update variant stock
      if (Array.isArray(item_restocks)) {
        for (const r of item_restocks) {
          const item = (ret.items || []).find(it => it.id === r.item_id);
          if (!item) continue;
          await supabase.from("return_items").update({ condition: r.condition || condition, restock: !!r.restock, restocked_at: r.restock ? now : null }).eq("id", r.item_id);
          if (r.restock && item.variant_id) {
            const { data: variant } = await supabase.from("product_variants").select("stock").eq("id", item.variant_id).single();
            if (variant) {
              await supabase.from("product_variants").update({ stock: (variant.stock || 0) + (item.quantity || 1) }).eq("id", item.variant_id);
            }
          }
        }
      }
      await addEvent(supabase, id, "inspected", "Inspection Completed", `Condition: ${condition} — Decision: ${decision}`, actor);
      return Response.json({ success: true });
    }

    if (action === "refund") {
      const amount = Number(body.amount) || Number(ret.refund_amount) || 0;
      if (amount <= 0) return Response.json({ error: "Refund amount must be greater than 0" }, { status: 400 });
      const method = body.method || "original";

      // Record refund against the order
      const { error: refundError } = await supabase.from("refunds").insert({
        order_id: ret.order_id, amount, type: "return",
        reason: `Return ${ret.return_number} — ${ret.reason}`, status: "completed", processed_at: now,
      });
      if (refundError) return Response.json({ error: refundError.message }, { status: 400 });

      await supabase.from("return_requests").update({
        refund_amount: amount, refund_method: method, refund_status: "completed",
        refund_shipping: !!body.refund_shipping, refund_tax: !!body.refund_tax,
        status: "refunded", resolved_at: now, updated_at: now,
      }).eq("id", id);
      await addEvent(supabase, id, "refunded", "Refund Processed", `$${amount.toFixed(2)} via ${method.replace(/_/g, " ")}`, actor);
      return Response.json({ success: true });
    }

    if (action === "exchange") {
      const { product_id, variant_id, price_difference } = body;
      if (!product_id) return Response.json({ error: "product_id required for exchange" }, { status: 400 });

      const { data: product } = await supabase.from("products").select("id, name, price").eq("id", product_id).single();
      if (!product) return Response.json({ error: "Exchange product not found" }, { status: 404 });

      // Create replacement order
      const orderNumber = `EX-${Date.now().toString(36).toUpperCase()}`;
      const diff = Number(price_difference) || 0;
      const { data: newOrder, error: orderError } = await supabase.from("orders").insert({
        order_number: orderNumber, user_id: ret.customer_id,
        status: "processing", payment_status: diff > 0 ? "pending" : "paid",
        subtotal: Number(product.price) || 0, shipping_cost: 0, discount: 0,
        total: Math.max(diff, 0),
        shipping_address: null,
      }).select().single();
      if (orderError) return Response.json({ error: orderError.message }, { status: 400 });

      await supabase.from("order_items").insert({
        order_id: newOrder.id, product_id, variant_id: variant_id || null,
        quantity: 1, price: Number(product.price) || 0,
      });

      // Decrement stock of the replacement variant
      if (variant_id) {
        const { data: variant } = await supabase.from("product_variants").select("stock").eq("id", variant_id).single();
        if (variant && (variant.stock || 0) > 0) {
          await supabase.from("product_variants").update({ stock: variant.stock - 1 }).eq("id", variant_id);
        }
      }

      await supabase.from("return_requests").update({
        exchange_product_id: product_id, exchange_variant_id: variant_id || null,
        exchange_order_id: newOrder.id, price_difference: diff,
        status: "exchanged", resolved_at: now, updated_at: now,
      }).eq("id", id);
      await addEvent(supabase, id, "exchanged", "Exchange Processed", `Replacement order ${orderNumber} created for ${product.name}`, actor);
      return Response.json({ success: true, exchange_order: newOrder });
    }

    if (action === "close") {
      await supabase.from("return_requests").update({ status: "closed", resolved_at: now, updated_at: now }).eq("id", id);
      await addEvent(supabase, id, "closed", "Case Closed", body.note || null, actor);
      return Response.json({ success: true });
    }

    if (action === "archive") {
      await supabase.from("return_requests").update({ is_archived: !ret.is_archived, updated_at: now }).eq("id", id);
      return Response.json({ success: true });
    }

    if (action === "update") {
      const allowed = ["description", "warehouse", "carrier", "tracking_number", "refund_amount", "return_type", "reason"];
      const patch = { updated_at: now };
      allowed.forEach(k => { if (body[k] !== undefined) patch[k] = body[k]; });
      const { error } = await supabase.from("return_requests").update(patch).eq("id", id);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Returns API PUT error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    const actor = auth.profile?.full_name || auth.profile?.email || "Admin";

    const body = await request.json();
    const { ids, action } = body;
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !action) {
      return Response.json({ error: "ids array and action required" }, { status: 400 });
    }
    const now = new Date().toISOString();

    if (action === "approve") {
      await supabase.from("return_requests").update({ status: "approved", agent_id: auth.user.id, updated_at: now }).in("id", ids).eq("status", "pending");
      for (const id of ids) await addEvent(supabase, id, "approved", "Return Approved", "Bulk approval", actor);
    } else if (action === "reject") {
      await supabase.from("return_requests").update({ status: "rejected", resolved_at: now, updated_at: now }).in("id", ids);
      for (const id of ids) await addEvent(supabase, id, "rejected", "Return Rejected", "Bulk rejection", actor);
    } else if (action === "archive") {
      await supabase.from("return_requests").update({ is_archived: true, updated_at: now }).in("id", ids);
    } else if (action === "restore") {
      await supabase.from("return_requests").update({ is_archived: false, deleted_at: null, updated_at: now }).in("id", ids);
    } else if (action === "delete") {
      await supabase.from("return_requests").update({ deleted_at: now, updated_at: now }).in("id", ids);
    } else if (action === "assign_warehouse") {
      await supabase.from("return_requests").update({ warehouse: body.warehouse || "main", updated_at: now }).in("id", ids);
    } else {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }
    return Response.json({ success: true, updated: ids.length });
  } catch (error) {
    console.error("Returns API PATCH error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const { id, hard } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400 });

    if (hard) {
      const { error } = await supabase.from("return_requests").delete().eq("id", id);
      if (error) return Response.json({ error: error.message }, { status: 400 });
    } else {
      const { error } = await supabase.from("return_requests").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("Returns API DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
