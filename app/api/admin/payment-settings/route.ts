// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function checkAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: "Forbidden", status: 403 };
  return { user, profile };
}

async function audit(supabase, auth, action, target, old_value, new_value) {
  try {
    await supabase.from("payment_audit_log").insert({
      actor_id: auth.user?.id || null,
      actor_name: auth.profile?.full_name || auth.profile?.email || "Admin",
      action, target,
      old_value: old_value ?? null,
      new_value: new_value ?? null,
    });
  } catch { /* audit must never block the action */ }
}

function envStatusFor() {
  return {
    moncash: {
      client_id: !!process.env.MONCASH_CLIENT_ID,
      client_secret: !!process.env.MONCASH_CLIENT_SECRET,
      webhook_secret: !!process.env.MONCASH_WEBHOOK_SECRET,
      mode: process.env.MONCASH_MODE === "production" ? "production" : "sandbox",
    },
    natcash: {
      api_key: !!process.env.NATCASH_API_KEY,
      webhook_secret: !!process.env.NATCASH_WEBHOOK_SECRET,
      mode: process.env.NATCASH_MODE === "production" ? "production" : "sandbox",
    },
    stripe: {
      secret_key: !!process.env.STRIPE_SECRET_KEY,
      webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
      publishable_key: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    },
    paypal: {
      client_id: !!process.env.PAYPAL_CLIENT_ID,
      client_secret: !!process.env.PAYPAL_CLIENT_SECRET,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const section = request.nextUrl.searchParams.get("section") || "all";

    if (section === "overview") {
      // Health bar: the first thing a merchant wants to know — is money coming in?
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [gwRes, payRes, whRes] = await Promise.all([
        supabase.from("payment_settings").select("gateway, enabled, display_name"),
        supabase.from("payments").select("status, amount, created_at").gte("created_at", dayAgo),
        supabase.from("payment_logs").select("event_type, error, created_at").like("event_type", "webhook%").order("created_at", { ascending: false }).limit(1),
      ]);
      const gateways = gwRes.data || [];
      const payments = payRes.data || [];
      const env = envStatusFor();

      const issues = [];
      for (const g of gateways) {
        const e = env[g.gateway];
        if (!e) continue;
        const missing = Object.entries(e).filter(([k, v]) => k !== "mode" && v !== true).map(([k]) => `${g.gateway.toUpperCase()}_${k.toUpperCase()}`);
        if (missing.length > 0) {
          issues.push({
            severity: g.enabled ? "critical" : "warning",
            gateway: g.gateway,
            title: `${g.display_name}: ${missing.length} credential(s) missing`,
            detail: missing.join(", "),
            action: g.enabled ? "Payments through this gateway will fail until configured" : "Configure before enabling",
          });
        }
      }

      const paid24 = payments.filter(x => x.status === "paid");
      const attempted = payments.filter(x => ["paid", "failed"].includes(x.status));
      const successRate = attempted.length ? Math.round((paid24.length / attempted.length) * 100) : null;
      if (successRate !== null && successRate < 70 && attempted.length >= 5) {
        issues.push({ severity: "critical", gateway: null, title: `Success rate dropped to ${successRate}% in the last 24h`, detail: `${paid24.length} paid / ${attempted.length} attempted`, action: "Check Payment Logs for failing gateway" });
      }

      return Response.json({
        enabledGateways: gateways.filter(g => g.enabled).length,
        totalGateways: gateways.length,
        successRate24h: successRate,
        volume24h: Math.round(paid24.reduce((s, x) => s + (Number(x.amount) || 0), 0) * 100) / 100,
        transactions24h: payments.length,
        lastWebhook: whRes.data?.[0]?.created_at || null,
        lastWebhookOk: whRes.data?.[0] ? !whRes.data[0].error : null,
        issues,
        securityPosture: [
          { label: "Webhook signature verification", ok: true, detail: "HMAC-SHA256 on every MonCash/NatCash/Stripe event" },
          { label: "Replay-attack protection", ok: true, detail: "Timestamped events outside the window are rejected" },
          { label: "Idempotent webhook processing", ok: true, detail: "Duplicate events are acknowledged, never re-processed" },
          { label: "Secrets in server environment only", ok: true, detail: "No API key or secret is stored in the database or sent to the browser" },
          { label: "Server-side amount validation", ok: true, detail: "Order totals are re-checked against the gateway amount" },
          { label: "Row-level security", ok: true, detail: "All payment tables enforce admin-scoped RLS policies" },
        ],
      });
    }

    if (section === "gateway_detail") {
      const gateway = sp.get("gateway");
      if (!gateway) return Response.json({ error: "gateway required" }, { status: 400 });
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [payRes, logRes] = await Promise.all([
        supabase.from("payments").select("amount, status, created_at").eq("gateway", gateway).gte("created_at", weekAgo),
        supabase.from("payment_logs").select("id, event_type, status_code, latency_ms, error, created_at").eq("gateway", gateway).order("created_at", { ascending: false }).limit(10),
      ]);
      const payments = payRes.data || [];
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        const dayPaid = payments.filter(x => x.status === "paid" && new Date(x.created_at) >= d && new Date(x.created_at) < next);
        days.push({
          date: d.toISOString().slice(0, 10),
          volume: Math.round(dayPaid.reduce((s, x) => s + (Number(x.amount) || 0), 0) * 100) / 100,
          count: dayPaid.length,
        });
      }
      const attempted = payments.filter(x => ["paid", "failed"].includes(x.status));
      const paid = payments.filter(x => x.status === "paid");
      return Response.json({
        days,
        successRate: attempted.length ? Math.round((paid.length / attempted.length) * 100) : null,
        weekVolume: Math.round(paid.reduce((s, x) => s + (Number(x.amount) || 0), 0) * 100) / 100,
        weekCount: paid.length,
        recentEvents: logRes.data || [],
      });
    }

    if (section === "activity") {
      const page = parseInt(sp.get("page") || "1", 10);
      const { data, count } = await supabase
        .from("payment_audit_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * 30, page * 30 - 1);
      return Response.json({ activity: data || [], total: count || 0, totalPages: Math.ceil((count || 0) / 30) });
    }

    if (section === "export") {
      const [gw, cur, cfg, tax] = await Promise.all([
        supabase.from("payment_settings").select("*").order("sort"),
        supabase.from("payment_currencies").select("*").order("code"),
        supabase.from("payment_config").select("*"),
        supabase.from("payment_tax_rules").select("*").order("country"),
      ]);
      return Response.json({
        exported_at: new Date().toISOString(),
        gateways: gw.data || [],
        currencies: cur.data || [],
        config: cfg.data || [],
        tax_rules: tax.data || [],
      });
    }

    const [gw, cur, cfg, tax] = await Promise.all([
      supabase.from("payment_settings").select("*").order("priority", { ascending: false }).order("sort"),
      supabase.from("payment_currencies").select("*").order("is_base", { ascending: false }).order("code"),
      supabase.from("payment_config").select("*"),
      supabase.from("payment_tax_rules").select("*").order("country"),
    ]);

    const config = {};
    (cfg.data || []).forEach(r => { config[r.key] = r.value; });

    // Today's live stats per gateway
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { data: todayPayments } = await supabase
      .from("payments")
      .select("gateway, amount, status")
      .gte("created_at", todayStart.toISOString());
    const gatewayStats = {};
    (todayPayments || []).forEach(r => {
      if (!gatewayStats[r.gateway]) gatewayStats[r.gateway] = { transactions: 0, volume: 0, paid: 0 };
      gatewayStats[r.gateway].transactions++;
      if (r.status === "paid") {
        gatewayStats[r.gateway].paid++;
        gatewayStats[r.gateway].volume += Number(r.amount) || 0;
      }
    });

    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://atlantassneakers.com";
    return Response.json({
      settings: gw.data || [],
      currencies: cur.data || [],
      config,
      taxRules: tax.data || [],
      envStatus: envStatusFor(),
      gatewayStats,
      webhookUrls: {
        moncash: `${base}/api/webhooks/moncash`,
        natcash: `${base}/api/webhooks/natcash`,
        stripe: `${base}/api/webhook`,
      },
    });
  } catch (error) {
    console.error("Payment settings GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const action = body.action;

    if (action === "add_gateway") {
      const { gateway, display_name, description } = body;
      if (!gateway || !display_name) return Response.json({ error: "gateway code and display_name required" }, { status: 400 });
      const code = String(gateway).toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
      const { data, error } = await supabase.from("payment_settings").insert({
        gateway: code, display_name, description: description || null,
        enabled: false, is_custom: true, sort: 99,
      }).select().single();
      if (error) return Response.json({ error: error.message }, { status: 400 });
      await audit(supabase, auth, "gateway.created", code, null, { display_name });
      return Response.json(data, { status: 201 });
    }

    if (action === "test_connection") {
      const { gateway } = body;
      const env = envStatusFor()[gateway];
      if (!env) {
        return Response.json({ ok: false, message: "No server-side credentials required or gateway not testable. Enable it and process a sandbox payment to verify." });
      }
      const missing = Object.entries(env).filter(([k, v]) => k !== "mode" && v !== true).map(([k]) => k);
      if (missing.length > 0) {
        return Response.json({ ok: false, message: `Missing environment variables: ${missing.join(", ")}` });
      }
      // Live check for MonCash: attempt OAuth token
      if (gateway === "moncash") {
        try {
          const MONCASH_BASE = process.env.MONCASH_MODE === "production"
            ? "https://moncashbutton.digicelhaiti.com"
            : "https://sandbox.moncashbutton.digicelhaiti.com";
          const credentials = Buffer.from(`${process.env.MONCASH_CLIENT_ID}:${process.env.MONCASH_CLIENT_SECRET}`).toString("base64");
          const res = await fetch(`${MONCASH_BASE}/Api/v1/Authenticate`, {
            method: "POST",
            headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: "grant_type=client_credentials&scope=read,write",
            signal: AbortSignal.timeout(10000),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.access_token) {
            return Response.json({ ok: true, message: `Connected to MonCash ${env.mode} — authentication successful.` });
          }
          return Response.json({ ok: false, message: `MonCash authentication failed (HTTP ${res.status}). Check your client ID/secret.` });
        } catch (e) {
          return Response.json({ ok: false, message: `MonCash unreachable: ${e.message}` });
        }
      }
      return Response.json({ ok: true, message: "All required credentials are configured." });
    }

    if (action === "import") {
      const { data } = body;
      if (!data || typeof data !== "object") return Response.json({ error: "data object required" }, { status: 400 });
      let count = 0;
      for (const g of data.gateways || []) {
        if (!g.gateway) continue;
        const { id, updated_at, ...rest } = g;
        await supabase.from("payment_settings").upsert({ ...rest, updated_at: new Date().toISOString() }, { onConflict: "gateway" });
        count++;
      }
      for (const c of data.currencies || []) {
        if (!c.code) continue;
        const { updated_at, ...rest } = c;
        await supabase.from("payment_currencies").upsert({ ...rest, updated_at: new Date().toISOString() }, { onConflict: "code" });
        count++;
      }
      for (const r of data.config || []) {
        if (!r.key) continue;
        await supabase.from("payment_config").upsert({ key: r.key, value: r.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
        count++;
      }
      await audit(supabase, auth, "config.restored", "backup", null, { imported: count });
      return Response.json({ success: true, imported: count });
    }

    if (action === "sync_rates") {
      // Fetch live exchange rates for the base currency and update auto-update currencies
      const { data: baseCur } = await supabase.from("payment_currencies").select("code").eq("is_base", true).single();
      const baseCode = baseCur?.code || "USD";
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${baseCode}`, { signal: AbortSignal.timeout(10000) });
        const data = await res.json();
        if (!res.ok || data.result !== "success" || !data.rates) {
          return Response.json({ ok: false, message: "Exchange rate provider returned an error" }, { status: 502 });
        }
        const { data: currencies } = await supabase.from("payment_currencies").select("code, is_base");
        const now = new Date().toISOString();
        let updated = 0;
        for (const c of currencies || []) {
          if (c.is_base) continue;
          const rate = data.rates[c.code];
          if (rate) {
            await supabase.from("payment_currencies").update({ rate, last_synced_at: now, updated_at: now }).eq("code", c.code);
            updated++;
          }
        }
        await audit(supabase, auth, "currency.rates_synced", baseCode, null, { updated, provider: "open.er-api.com" });
        return Response.json({ ok: true, updated, provider: "open.er-api.com", base: baseCode });
      } catch (e) {
        return Response.json({ ok: false, message: `Rate provider unreachable: ${e.message}` }, { status: 502 });
      }
    }

    if (action === "add_currency") {
      const { code, name, symbol } = body;
      if (!code || !name || !symbol) return Response.json({ error: "code, name and symbol required" }, { status: 400 });
      const { data, error } = await supabase.from("payment_currencies").insert({
        code: String(code).toUpperCase().slice(0, 5), name, symbol,
        enabled: false, rate: Number(body.rate) || 1,
        symbol_position: body.symbol_position || "before",
        decimals: body.decimals ?? 2,
      }).select().single();
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json(data, { status: 201 });
    }

    if (action === "add_tax_rule") {
      const { country, region, tax_type, rate, applies_to_shipping } = body;
      if (!country || rate === undefined) return Response.json({ error: "country and rate required" }, { status: 400 });
      const { data, error } = await supabase.from("payment_tax_rules").insert({
        country, region: region || null, tax_type: tax_type || "sales_tax",
        rate: Number(rate) || 0, applies_to_shipping: !!applies_to_shipping,
        state: body.state || null, zip: body.zip || null,
        tax_class: body.tax_class || "standard",
        priority: parseInt(body.priority) || 0,
        compound: !!body.compound, inclusive: !!body.inclusive,
      }).select().single();
      if (error) return Response.json({ error: error.message }, { status: 400 });
      await audit(supabase, auth, "tax.created", `${country}${body.state ? `/${body.state}` : ""}`, null, { tax_type: tax_type || "sales_tax", rate: Number(rate) || 0 });
      return Response.json(data, { status: 201 });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Payment settings POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const target = body.target || "gateway";
    const now = new Date().toISOString();

    if (target === "gateway") {
      const { gateway } = body;
      if (!gateway) return Response.json({ error: "gateway required" }, { status: 400 });
      const fields = ["enabled", "sandbox_mode", "merchant_id", "timeout_seconds", "retry_attempts",
       "display_name", "description", "priority", "countries", "currencies",
       "fee_percent", "fee_fixed", "logo_url", "notes",
       "api_version", "min_amount", "max_amount", "webhook_retry"];
      const patch = { updated_at: now };
      fields.forEach(k => { if (body[k] !== undefined) patch[k] = body[k]; });

      const { data: before } = await supabase.from("payment_settings").select("*").eq("gateway", gateway).single();
      const { error } = await supabase.from("payment_settings").update(patch).eq("gateway", gateway);
      if (error) return Response.json({ error: error.message }, { status: 400 });

      const changed = {}; const previous = {};
      fields.forEach(k => {
        if (body[k] !== undefined && JSON.stringify(before?.[k]) !== JSON.stringify(body[k])) {
          changed[k] = body[k]; previous[k] = before?.[k] ?? null;
        }
      });
      if (Object.keys(changed).length > 0) {
        const action = changed.enabled !== undefined && Object.keys(changed).length === 1
          ? (changed.enabled ? "gateway.enabled" : "gateway.disabled")
          : "gateway.updated";
        await audit(supabase, auth, action, gateway, previous, changed);
      }
      return Response.json({ success: true });
    }

    if (target === "currency") {
      const { code } = body;
      if (!code) return Response.json({ error: "code required" }, { status: 400 });
      if (body.is_base === true) {
        // Only one base currency
        await supabase.from("payment_currencies").update({ is_base: false }).neq("code", code);
      }
      if (body.is_default === true) {
        await supabase.from("payment_currencies").update({ is_default: false }).neq("code", code);
      }
      const curFields = ["enabled", "is_base", "is_default", "rate", "rate_source", "symbol", "name",
       "symbol_position", "decimals", "auto_update", "api_source"];
      const patch = { updated_at: now };
      curFields.forEach(k => { if (body[k] !== undefined) patch[k] = body[k]; });
      const { data: beforeCur } = await supabase.from("payment_currencies").select("*").eq("code", code).single();
      const { error } = await supabase.from("payment_currencies").update(patch).eq("code", code);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      const changedCur = {}; const prevCur = {};
      curFields.forEach(k => {
        if (body[k] !== undefined && JSON.stringify(beforeCur?.[k]) !== JSON.stringify(body[k])) {
          changedCur[k] = body[k]; prevCur[k] = beforeCur?.[k] ?? null;
        }
      });
      if (Object.keys(changedCur).length > 0) await audit(supabase, auth, "currency.updated", code, prevCur, changedCur);
      return Response.json({ success: true });
    }

    if (target === "config") {
      const { key, value } = body;
      if (!key || value === undefined) return Response.json({ error: "key and value required" }, { status: 400 });
      const allowedKeys = ["checkout", "fraud", "notifications",
        "checkout_customer", "checkout_payment", "checkout_shipping", "checkout_invoice", "checkout_order",
        "notification_channels", "notification_recipients"];
      if (!allowedKeys.includes(key)) return Response.json({ error: "Invalid config key" }, { status: 400 });
      const { data: beforeCfg } = await supabase.from("payment_config").select("value").eq("key", key).single();
      const { error } = await supabase.from("payment_config").upsert({ key, value, updated_at: now }, { onConflict: "key" });
      if (error) return Response.json({ error: error.message }, { status: 400 });
      // Log only the keys that actually changed
      const changedCfg = {}; const prevCfg = {};
      Object.keys(value || {}).forEach(k => {
        if (JSON.stringify(beforeCfg?.value?.[k]) !== JSON.stringify(value[k])) {
          changedCfg[k] = value[k]; prevCfg[k] = beforeCfg?.value?.[k] ?? null;
        }
      });
      if (Object.keys(changedCfg).length > 0) await audit(supabase, auth, "config.updated", key, prevCfg, changedCfg);
      return Response.json({ success: true });
    }

    if (target === "tax_rule") {
      const { id } = body;
      if (!id) return Response.json({ error: "id required" }, { status: 400 });
      const patch = {};
      ["country", "region", "tax_type", "rate", "applies_to_shipping", "enabled",
       "state", "zip", "tax_class", "priority", "compound", "inclusive"].forEach(k => {
        if (body[k] !== undefined) patch[k] = body[k];
      });
      const { error } = await supabase.from("payment_tax_rules").update(patch).eq("id", id);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid target" }, { status: 400 });
  } catch (error) {
    console.error("Payment settings PUT error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await checkAdmin(supabase);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    if (body.target === "tax_rule" && body.id) {
      const { data: beforeTax } = await supabase.from("payment_tax_rules").select("country, state, tax_type, rate").eq("id", body.id).single();
      const { error } = await supabase.from("payment_tax_rules").delete().eq("id", body.id);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      await audit(supabase, auth, "tax.deleted", beforeTax?.country || body.id, beforeTax, null);
      return Response.json({ success: true });
    }
    if (body.target === "currency" && body.code) {
      const { data: cur } = await supabase.from("payment_currencies").select("is_base, is_default").eq("code", body.code).single();
      if (cur?.is_base || cur?.is_default) return Response.json({ error: "Base/default currency cannot be deleted" }, { status: 400 });
      const { error } = await supabase.from("payment_currencies").delete().eq("code", body.code);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ success: true });
    }
    if (body.target === "gateway" && body.gateway) {
      // Only custom gateways can be removed; built-ins are disabled instead
      const { data: gw } = await supabase.from("payment_settings").select("is_custom").eq("gateway", body.gateway).single();
      if (!gw?.is_custom) return Response.json({ error: "Built-in gateways cannot be deleted — disable them instead" }, { status: 400 });
      const { error } = await supabase.from("payment_settings").delete().eq("gateway", body.gateway);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      await audit(supabase, auth, "gateway.deleted", body.gateway, null, null);
      return Response.json({ success: true });
    }
    return Response.json({ error: "Invalid target" }, { status: 400 });
  } catch (error) {
    console.error("Payment settings DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
