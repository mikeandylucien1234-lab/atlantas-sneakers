// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const orderNumber = request.nextUrl.searchParams.get("order");
    if (!orderNumber) return Response.json({ error: "order parameter required" }, { status: 400 });

    const { data: order } = await supabase
      .from("orders")
      .select("*, items:order_items(*, product:products(name), variant:product_variants(size, color, sku)), user:profiles(full_name, email)")
      .eq("order_number", orderNumber)
      .single();
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

    // Owner or admin only
    if (order.user_id !== user.id) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!profile || profile.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: payment } = await supabase
      .from("payments")
      .select("gateway, transaction_id, status, currency, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const addr = order.shipping_address || {};
    const gatewayLabels = { stripe: "Credit/Debit Card", moncash: "MonCash", natcash: "NatCash", cod: "Cash on Delivery", bank_transfer: "Bank Transfer" };
    const currency = payment?.currency || "USD";
    const fmt = n => `${currency === "HTG" ? "HTG " : "$"}${(Number(n) || 0).toFixed(2)}`;
    const date = new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const rows = (order.items || []).map(it => `
      <tr>
        <td>${esc(it.product?.name || "Product")}${it.variant ? `<div class="muted">${esc([it.variant.size, it.variant.color].filter(Boolean).join(" / "))}${it.variant.sku ? ` — SKU ${esc(it.variant.sku)}` : ""}</div>` : ""}</td>
        <td class="num">${it.quantity}</td>
        <td class="num">${fmt(it.price)}</td>
        <td class="num">${fmt((Number(it.price) || 0) * (it.quantity || 1))}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice ${esc(order.order_number)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #16181d; background: #f4f6f9; padding: 32px 16px; }
  .sheet { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 24px rgba(16,24,40,.08); }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
  .brand span { color: #2563eb; }
  h1 { font-size: 15px; text-transform: uppercase; letter-spacing: .1em; color: #8a929c; }
  .meta { text-align: right; font-size: 13px; color: #5b6472; line-height: 1.7; }
  .meta b { color: #16181d; }
  .cols { display: flex; gap: 32px; margin-bottom: 28px; flex-wrap: wrap; }
  .col { flex: 1; min-width: 200px; }
  .col h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #8a929c; margin-bottom: 6px; }
  .col p { font-size: 13px; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #8a929c; padding: 10px 8px; border-bottom: 2px solid #eef0f3; }
  td { padding: 12px 8px; font-size: 13px; border-bottom: 1px solid #f2f4f7; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  th.num { text-align: right; }
  .muted { font-size: 11px; color: #8a929c; margin-top: 2px; }
  .totals { margin-left: auto; width: 260px; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 6px 8px; }
  .totals .grand { border-top: 2px solid #16181d; margin-top: 6px; padding-top: 10px; font-size: 16px; font-weight: 800; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; background: ${order.payment_status === "paid" ? "#dcfce7; color: #16a34a" : "#fef3c7; color: #b45309"}; }
  .foot { margin-top: 32px; padding-top: 20px; border-top: 1px solid #eef0f3; font-size: 11px; color: #8a929c; text-align: center; line-height: 1.8; }
  @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; border-radius: 0; } .noprint { display: none; } }
  .printbar { max-width: 720px; margin: 0 auto 16px; text-align: right; }
  .printbar button { background: #2563eb; color: #fff; border: 0; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; }
</style></head>
<body>
  <div class="printbar noprint"><button onclick="window.print()">Download / Print PDF</button></div>
  <div class="sheet">
    <div class="top">
      <div>
        <div class="brand">Atlanta<span>Sneakers</span></div>
        <p style="font-size:12px;color:#8a929c;margin-top:4px">atlantasneaker.com</p>
      </div>
      <div class="meta">
        <h1>Invoice</h1>
        <b>${esc(order.order_number)}</b><br>
        ${esc(date)}<br>
        <span class="badge">${order.payment_status === "paid" ? "PAID" : esc((order.payment_status || "pending").toUpperCase())}</span>
      </div>
    </div>
    <div class="cols">
      <div class="col">
        <h2>Billed To</h2>
        <p><b>${esc(order.user?.full_name || addr.name || "Customer")}</b><br>
        ${esc(order.user?.email || "")}<br>
        ${esc(addr.line1 || addr.address || "")}${addr.line2 ? `<br>${esc(addr.line2)}` : ""}<br>
        ${esc([addr.city, addr.state, addr.zip || addr.postal_code].filter(Boolean).join(", "))}<br>
        ${esc(addr.country || "")}${addr.phone ? `<br>${esc(addr.phone)}` : ""}</p>
      </div>
      <div class="col">
        <h2>Payment</h2>
        <p>Method: <b>${esc(gatewayLabels[payment?.gateway] || payment?.gateway || "—")}</b><br>
        Transaction: ${esc(payment?.transaction_id || "—")}<br>
        Status: ${esc(payment?.status || order.payment_status || "pending")}</p>
      </div>
    </div>
    <table>
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${fmt(order.subtotal)}</span></div>
      <div><span>Shipping</span><span>${fmt(order.shipping_cost)}</span></div>
      ${Number(order.discount) > 0 ? `<div><span>Discount</span><span>-${fmt(order.discount)}</span></div>` : ""}
      <div class="grand"><span>Total</span><span>${fmt(order.total)}</span></div>
    </div>
    <div class="foot">
      Thank you for shopping with Atlanta Sneakers.<br>
      This invoice was generated electronically and is valid without signature.
    </div>
  </div>
</body></html>`;

    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    console.error("Invoice API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
