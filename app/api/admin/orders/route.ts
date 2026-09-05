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
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = request.nextUrl;
  const section = searchParams.get("section") || "list";

  if (section === "kpis") {
    const { data: allOrders } = await safeQuery(
      async () => await supabase.from("orders").select("id, status, payment_status, total, created_at"),
      { data: null } as any
    );
    const orders = allOrders || [];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const totalOrders = orders.length;
    let todaysOrders = 0;
    let pendingOrders = 0;
    let paidOrders = 0;
    let processingOrders = 0;
    let shippedOrders = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    let refundedOrders = 0;
    let failedPayments = 0;
    let totalRevenue = 0;
    let revenueToday = 0;

    for (const o of orders) {
      const total = Number(o.total) || 0;
      totalRevenue += total;

      if (o.created_at >= todayISO) {
        todaysOrders++;
        revenueToday += total;
      }

      if (o.status === "pending") pendingOrders++;
      if (o.status === "confirmed") processingOrders++;
      if (o.status === "shipped") shippedOrders++;
      if (o.status === "delivered") deliveredOrders++;
      if (o.status === "cancelled") cancelledOrders++;

      if (o.payment_status === "paid") paidOrders++;
      if (o.payment_status === "refunded") refundedOrders++;
      if (o.payment_status === "failed") failedPayments++;
    }

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return Response.json({
      kpis: {
        totalOrders,
        todaysOrders,
        pendingOrders,
        paidOrders,
        processingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        refundedOrders,
        returnedOrders: 0,
        failedPayments,
        avgOrderValue,
        revenueToday,
        totalRevenue,
      },
    });
  }

  if (section === "list") {
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const paymentStatus = searchParams.get("payment_status") || "";
    const dateFrom = searchParams.get("date_from") || "";
    const dateTo = searchParams.get("date_to") || "";
    const paymentMethod = searchParams.get("payment_method") || "";
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const perPage = parseInt(searchParams.get("per_page") || "20");

    // Step 1: Query orders with items
    let query = supabase
      .from("orders")
      .select("*, items:order_items(id, product_id, variant_id, quantity, price, product:products(id, name, slug, images))");

    if (status) query = query.eq("status", status);
    if (paymentStatus) query = query.eq("payment_status", paymentStatus);
    if (paymentMethod) query = query.eq("payment_method", paymentMethod);
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo);
    if (search) query = query.ilike("order_number", `%${search}%`);

    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    const { data: allOrders } = await safeQuery(
      async () => await query,
      { data: null } as any
    );
    let orders = allOrders || [];

    // Step 2: Batch fetch profiles for user_ids
    const userIds = [...new Set(orders.map((o) => o.user_id).filter(Boolean))];
    let profilesMap: Record<string, any> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await safeQuery(
        async () => await supabase.from("profiles").select("id, full_name, email, avatar_url, points, role").in("id", userIds),
        { data: null } as any
      );
      for (const p of profiles || []) {
        profilesMap[p.id] = p;
      }
    }

    // Step 3: Merge customer data
    orders = orders.map((o) => ({
      ...o,
      customer: profilesMap[o.user_id] || null,
    }));

    // If searching by customer name/email, filter after merge
    if (search) {
      const s = search.toLowerCase();
      orders = orders.filter((o) =>
        (o.order_number && o.order_number.toLowerCase().includes(s)) ||
        (o.customer?.full_name && o.customer.full_name.toLowerCase().includes(s)) ||
        (o.customer?.email && o.customer.email.toLowerCase().includes(s))
      );
    }

    const total = orders.length;
    const start = (page - 1) * perPage;
    const paginated = orders.slice(start, start + perPage);

    return Response.json({ orders: paginated, total, page, per_page: perPage });
  }

  if (section === "detail") {
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    const { data: order } = await safeQuery(
      async () => await supabase
        .from("orders")
        .select("*, items:order_items(id, product_id, variant_id, quantity, price, product:products(id, name, slug, images, price), variant:product_variants(id, size, color, color_hex, sku))")
        .eq("id", id)
        .single(),
      { data: null } as any
    );

    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

    // Enrich each order item with its supplier/source identity — Product ID,
    // Variant ID, SKU and the exact supplier product URL — so Admin can open
    // "View Store" per item and place the CJ (or future supplier) order
    // manually. Never invented: only what was actually captured at import.
    const productIds = [...new Set((order.items || []).map((it) => it.product_id).filter(Boolean))];
    if (productIds.length) {
      const { data: supplierRows } = await safeQuery(
        async () => await supabase
          .from("supplier_products")
          .select("imported_product_id, supplier_id, external_id, supplier_url, raw")
          .in("imported_product_id", productIds)
          .eq("imported", true),
        { data: [] }
      );
      const supplierIds = [...new Set((supplierRows || []).map((sp) => sp.supplier_id).filter(Boolean))];
      let supplierNames = new Map();
      if (supplierIds.length) {
        const { data: supRows } = await safeQuery(
          async () => await supabase.from("suppliers").select("id, name").in("id", supplierIds),
          { data: [] }
        );
        supplierNames = new Map((supRows || []).map((s) => [s.id, s.name]));
      }
      const supplierByProduct = new Map((supplierRows || []).map((sp) => [sp.imported_product_id, sp]));
      order.items = (order.items || []).map((it) => {
        const sp = supplierByProduct.get(it.product_id);
        if (!sp) return { ...it, supplier: null };
        return {
          ...it,
          supplier: {
            supplier_id: sp.supplier_id,
            supplier_name: supplierNames.get(sp.supplier_id) || sp.supplier_id,
            supplier_product_id: sp.external_id || null,
            supplier_variant_id: it.variant?.sku && sp.raw?.variants
              ? (sp.raw.variants.find((v) => v.sku === it.variant.sku)?.vid
                || sp.raw.variants.find((v) => v.sku === it.variant.sku)?.variantId
                || null)
              : null,
            supplier_url: sp.supplier_url || null,
          },
        };
      });
    }

    // Fetch customer profile
    let customer = null;
    if (order.user_id) {
      const { data: profile } = await safeQuery(
        async () => await supabase.from("profiles").select("id, full_name, email, avatar_url, points, role").eq("id", order.user_id).single(),
        { data: null } as any
      );
      customer = profile;
    }

    // Fetch refunds safely
    const { data: refunds } = await safeQuery(
      async () => await supabase.from("refunds").select("*").eq("order_id", id),
      { data: null } as any
    );

    return Response.json({ order: { ...order, customer, refunds: refunds || [] } });
  }

  if (section === "export") {
    let query = supabase
      .from("orders")
      .select("*, items:order_items(id, product_id, variant_id, quantity, price, product:products(id, name, slug, images))");

    const status = searchParams.get("status") || "";
    const paymentStatus = searchParams.get("payment_status") || "";
    const dateFrom = searchParams.get("date_from") || "";
    const dateTo = searchParams.get("date_to") || "";
    const paymentMethod = searchParams.get("payment_method") || "";

    if (status) query = query.eq("status", status);
    if (paymentStatus) query = query.eq("payment_status", paymentStatus);
    if (paymentMethod) query = query.eq("payment_method", paymentMethod);
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo);

    query = query.order("created_at", { ascending: false });

    const { data: allOrders } = await safeQuery(
      async () => await query,
      { data: null } as any
    );
    let orders = allOrders || [];

    // Batch fetch profiles
    const userIds = [...new Set(orders.map((o) => o.user_id).filter(Boolean))];
    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await safeQuery(
        async () => await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", userIds),
        { data: null } as any
      );
      for (const p of profiles || []) {
        profilesMap[p.id] = p;
      }
    }

    orders = orders.map((o) => ({ ...o, customer: profilesMap[o.user_id] || null }));

    return Response.json({ orders });
  }

  return Response.json({ error: "Invalid section" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { customer_id, customer_email, items, shipping_address, notes, status, payment_status } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return Response.json({ error: "items array is required" }, { status: 400 });
  }

  // Resolve customer
  let userId = customer_id || null;
  if (!userId && customer_email) {
    const { data: profile } = await safeQuery(
      async () => await supabase.from("profiles").select("id").eq("email", customer_email).single(),
      { data: null } as any
    );
    if (profile) userId = profile.id;
  }

  // Calculate totals
  let subtotal = 0;
  for (const item of items) {
    subtotal += (Number(item.price) || 0) * (Number(item.quantity) || 1);
  }
  const shippingCost = Number(body.shipping_cost) || 0;
  const discount = Number(body.discount) || 0;
  const total = subtotal + shippingCost - discount;

  const orderNumber = `ATL-${Date.now()}`;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: userId,
      status: status || "pending",
      payment_status: payment_status || "pending",
      subtotal,
      shipping_cost: shippingCost,
      discount,
      total,
      shipping_address: shipping_address || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (orderError) return Response.json({ error: orderError.message }, { status: 500 });

  // Insert order items
  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    variant_id: item.variant_id || null,
    quantity: item.quantity || 1,
    price: item.price,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) return Response.json({ error: itemsError.message }, { status: 500 });

  return Response.json({ order }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  // Refunds must go through the single official refund flow (/api/refunds →
  // refundOrder), which performs a REAL Stripe refund. Never allow a plain status
  // write to mark an order "refunded" without money actually moving.
  if (updates.payment_status === "refunded") {
    return Response.json({ error: "Use the Refund action to issue a real refund — payment_status cannot be set to 'refunded' directly." }, { status: 400 });
  }

  const allowedFields = ["status", "payment_status", "shipping_address", "tracking_number", "carrier", "notes", "payment_method"];
  const filtered: Record<string, any> = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  // Manual fulfillment status — set only by an admin action here, never
  // fabricated by any automation. Restricted to the known manual-workflow
  // states so this can't be used to fake "submitted" (which would imply an
  // automatic supplier order was actually created).
  const MANUAL_FULFILLMENT_STATES = ["manual_pending", "manual_order_placed", "shipped", "delivered"];
  if (updates.fulfillment_status !== undefined) {
    if (!MANUAL_FULFILLMENT_STATES.includes(updates.fulfillment_status)) {
      return Response.json({ error: "Invalid fulfillment_status" }, { status: 400 });
    }
    filtered.fulfillment_status = updates.fulfillment_status;
  }

  if (Object.keys(filtered).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase.from("orders").update(filtered).eq("id", id).select().single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ order: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { ids, action } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "ids array is required" }, { status: 400 });
  }

  if (!action) {
    return Response.json({ error: "action is required" }, { status: 400 });
  }

  switch (action) {
    case "update_status": {
      const { status } = body;
      if (!status) return Response.json({ error: "status is required for update_status action" }, { status: 400 });
      const { error } = await supabase.from("orders").update({ status }).in("id", ids);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true, action: "update_status", count: ids.length });
    }
    case "export": {
      const { data: orders } = await safeQuery(
        async () => await supabase.from("orders").select("*, items:order_items(id, product_id, variant_id, quantity, price)").in("id", ids),
        { data: null } as any
      );
      return Response.json({ orders: orders || [] });
    }
    case "delete": {
      const { error: itemsError } = await supabase.from("order_items").delete().in("order_id", ids);
      if (itemsError) return Response.json({ error: itemsError.message }, { status: 500 });
      const { error } = await supabase.from("orders").delete().in("id", ids);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true, action: "delete", count: ids.length });
    }
    default:
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { id } = body;

  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  // Delete order items first
  const { error: itemsError } = await supabase.from("order_items").delete().eq("order_id", id);
  if (itemsError) return Response.json({ error: itemsError.message }, { status: 500 });

  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true });
}
