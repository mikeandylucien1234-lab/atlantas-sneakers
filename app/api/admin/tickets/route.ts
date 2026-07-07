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
    const { data: allTickets } = await safeQuery(
      async () => await supabase.from("tickets").select("*"),
      { data: null } as any
    );
    const tickets = allTickets || [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    return Response.json({
      kpis: {
        totalTickets: tickets.length,
        openTickets: tickets.filter((t) => t.status === "open").length,
        pendingTickets: tickets.filter((t) => t.status === "pending").length,
        inProgressTickets: tickets.filter((t) => t.status === "in_progress").length,
        resolvedTickets: tickets.filter((t) => t.status === "resolved").length,
        closedTickets: tickets.filter((t) => t.status === "closed").length,
        urgentTickets: tickets.filter((t) => t.priority === "urgent").length,
        todaysTickets: tickets.filter((t) => t.created_at >= todayStart).length,
        monthTickets: tickets.filter((t) => t.created_at >= monthStart).length,
      },
    });
  }

  if (section === "list" || section === "export") {
    const page = parseInt(searchParams.get("page") || "1");
    const per_page = section === "export" ? 10000 : parseInt(searchParams.get("per_page") || "25");
    const search = searchParams.get("search")?.toLowerCase() || "";
    const statusFilter = searchParams.get("status");
    const priorityFilter = searchParams.get("priority");
    const categoryFilter = searchParams.get("category");
    const assignedToFilter = searchParams.get("assigned_to");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") || "desc";

    let query = supabase.from("tickets").select("*");
    if (statusFilter) query = query.eq("status", statusFilter);
    if (priorityFilter) query = query.eq("priority", priorityFilter);
    if (categoryFilter) query = query.eq("category", categoryFilter);
    if (assignedToFilter) query = query.eq("assigned_to", assignedToFilter);
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo);

    const { data: rawTickets } = await safeQuery(
      async () => await query.order(sortBy, { ascending: sortOrder === "asc" }),
      { data: null } as any
    );
    let tickets = rawTickets || [];

    // Batch fetch profiles for user_ids and assigned_to
    const userIds = [...new Set(tickets.map((t) => t.user_id).filter(Boolean))];
    const agentIds = [...new Set(tickets.map((t) => t.assigned_to).filter(Boolean))];
    const allProfileIds = [...new Set([...userIds, ...agentIds])];

    const { data: profiles } = await safeQuery(
      async () => await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", allProfileIds.length ? allProfileIds : ["__none__"]),
      { data: null } as any
    );
    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

    // Batch fetch message counts
    const ticketIds = tickets.map((t) => t.id);
    const { data: messages } = await safeQuery(
      async () => await supabase.from("ticket_messages").select("ticket_id, created_at").in("ticket_id", ticketIds.length ? ticketIds : ["__none__"]),
      { data: null } as any
    );
    const msgByTicket: Record<string, { count: number; last: string | null }> = {};
    for (const m of messages || []) {
      if (!msgByTicket[m.ticket_id]) msgByTicket[m.ticket_id] = { count: 0, last: null };
      msgByTicket[m.ticket_id].count++;
      if (!msgByTicket[m.ticket_id].last || m.created_at > msgByTicket[m.ticket_id].last) {
        msgByTicket[m.ticket_id].last = m.created_at;
      }
    }

    let enriched = tickets.map((t) => ({
      ...t,
      customer: profileMap[t.user_id] || null,
      agent: t.assigned_to ? profileMap[t.assigned_to] || null : null,
      message_count: msgByTicket[t.id]?.count || 0,
      last_message_at: msgByTicket[t.id]?.last || null,
    }));

    if (search) {
      enriched = enriched.filter((t) => {
        const fields = [t.subject, t.description, t.customer?.full_name, t.customer?.email];
        return fields.some((f) => f && String(f).toLowerCase().includes(search));
      });
    }

    const total = enriched.length;
    if (section === "list") {
      const start = (page - 1) * per_page;
      enriched = enriched.slice(start, start + per_page);
    }

    return Response.json({ tickets: enriched, total, page, per_page });
  }

  if (section === "detail") {
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    const { data: ticket } = await safeQuery(
      async () => await supabase.from("tickets").select("*").eq("id", id).single(),
      { data: null } as any
    );
    if (!ticket) return Response.json({ error: "Ticket not found" }, { status: 404 });

    const { data: customer } = await safeQuery(
      async () => await supabase.from("profiles").select("id, full_name, email, avatar_url").eq("id", ticket.user_id).single(),
      { data: null } as any
    );
    const { data: agent } = ticket.assigned_to ? await safeQuery(
      async () => await supabase.from("profiles").select("id, full_name, email").eq("id", ticket.assigned_to).single(),
      { data: null } as any
    ) : { data: null };
    const { data: order } = ticket.order_id ? await safeQuery(
      async () => await supabase.from("orders").select("id, order_number, status, payment_status, total, shipping_address, tracking_number, created_at").eq("id", ticket.order_id).single(),
      { data: null } as any
    ) : { data: null };

    const { data: rawMessages } = await safeQuery(
      async () => await supabase.from("ticket_messages").select("*").eq("ticket_id", id).order("created_at", { ascending: true }),
      { data: null } as any
    );
    const msgs = rawMessages || [];
    const senderIds = [...new Set(msgs.map((m) => m.sender_id).filter(Boolean))];
    const { data: senderProfiles } = await safeQuery(
      async () => await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", senderIds.length ? senderIds : ["__none__"]),
      { data: null } as any
    );
    const senderMap = Object.fromEntries((senderProfiles || []).map((p) => [p.id, p]));
    const messagesWithSender = msgs.map((m) => ({ ...m, sender: senderMap[m.sender_id] || null }));

    return Response.json({
      ticket: { ...ticket, customer, agent, order, messages: messagesWithSender },
    });
  }

  if (section === "messages") {
    const ticketId = searchParams.get("ticket_id");
    if (!ticketId) return Response.json({ error: "Missing ticket_id" }, { status: 400 });

    const { data: rawMessages } = await safeQuery(
      async () => await supabase.from("ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
      { data: null } as any
    );
    const msgs = rawMessages || [];
    const senderIds = [...new Set(msgs.map((m) => m.sender_id).filter(Boolean))];
    const { data: senderProfiles } = await safeQuery(
      async () => await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", senderIds.length ? senderIds : ["__none__"]),
      { data: null } as any
    );
    const senderMap = Object.fromEntries((senderProfiles || []).map((p) => [p.id, p]));

    return Response.json({
      messages: msgs.map((m) => ({ ...m, sender: senderMap[m.sender_id] || null })),
    });
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

  // Add message to existing ticket
  if (body.ticket_id && body.message) {
    const { data: message } = await safeQuery(
      async () => await supabase.from("ticket_messages").insert({
        ticket_id: body.ticket_id,
        sender_id: auth.user.id,
        message: body.message,
        is_internal: body.is_internal || false,
        attachments: body.attachments || [],
      }).select().single(),
      { data: null } as any
    );

    await safeQuery(
      async () => await supabase.from("tickets").update({ updated_at: new Date().toISOString() }).eq("id", body.ticket_id),
      { data: null } as any
    );

    return Response.json({ message });
  }

  // Create new ticket
  if (body.subject) {
    let userId = body.user_id;
    if (!userId && body.user_email) {
      const { data: profile } = await safeQuery(
        async () => await supabase.from("profiles").select("id").eq("email", body.user_email).single(),
        { data: null } as any
      );
      userId = profile?.id;
    }
    if (!userId) return Response.json({ error: "User not found" }, { status: 400 });

    const now = new Date().toISOString();
    const { data: ticket } = await safeQuery(
      async () => await supabase.from("tickets").insert({
        user_id: userId,
        order_id: body.order_id || null,
        subject: body.subject,
        description: body.description || "",
        category: body.category || "other",
        priority: body.priority || "medium",
        status: "open",
        assigned_to: body.assigned_to || null,
        created_at: now,
        updated_at: now,
      }).select().single(),
      { data: null } as any
    );

    return Response.json({ ticket });
  }

  return Response.json({ error: "Invalid request body" }, { status: 400 });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const allowed = ["status", "priority", "category", "assigned_to", "subject", "description"];
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (updates[key] !== undefined) updateData[key] = updates[key];
  }

  const { data: ticket } = await safeQuery(
    async () => await supabase.from("tickets").update(updateData).eq("id", id).select().single(),
    { data: null } as any
  );

  return Response.json({ ticket });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { action, ids, ...extra } = body;
  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "Missing action or ids" }, { status: 400 });
  }

  if (action === "close") {
    await safeQuery(
      async () => await supabase.from("tickets").update({ status: "closed", updated_at: new Date().toISOString() }).in("id", ids),
      { data: null } as any
    );
  } else if (action === "reopen") {
    await safeQuery(
      async () => await supabase.from("tickets").update({ status: "open", updated_at: new Date().toISOString() }).in("id", ids),
      { data: null } as any
    );
  } else if (action === "assign") {
    await safeQuery(
      async () => await supabase.from("tickets").update({ assigned_to: extra.assigned_to, updated_at: new Date().toISOString() }).in("id", ids),
      { data: null } as any
    );
  } else if (action === "change_priority") {
    await safeQuery(
      async () => await supabase.from("tickets").update({ priority: extra.priority, updated_at: new Date().toISOString() }).in("id", ids),
      { data: null } as any
    );
  } else if (action === "delete") {
    await safeQuery(
      async () => await supabase.from("ticket_messages").delete().in("ticket_id", ids),
      { data: null } as any
    );
    await safeQuery(
      async () => await supabase.from("tickets").delete().in("id", ids),
      { data: null } as any
    );
  } else {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  return Response.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const auth = await checkAdmin(supabase);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const id = body.id;
  const ids = body.ids || (id ? [id] : []);
  if (ids.length === 0) {
    return Response.json({ error: "Missing id or ids" }, { status: 400 });
  }

  await safeQuery(
    async () => await supabase.from("ticket_messages").delete().in("ticket_id", ids),
    { data: null } as any
  );
  await safeQuery(
    async () => await supabase.from("tickets").delete().in("id", ids),
    { data: null } as any
  );

  return Response.json({ success: true });
}
