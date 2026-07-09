// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function checkAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: "Forbidden", status: 403 };
  return { user };
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
      const patch = { updated_at: now };
      ["enabled", "sandbox_mode", "merchant_id", "timeout_seconds", "retry_attempts",
       "display_name", "description", "priority", "countries", "currencies",
       "fee_percent", "fee_fixed", "logo_url", "notes",
       "api_version", "min_amount", "max_amount", "webhook_retry"].forEach(k => {
        if (body[k] !== undefined) patch[k] = body[k];
      });
      const { error } = await supabase.from("payment_settings").update(patch).eq("gateway", gateway);
      if (error) return Response.json({ error: error.message }, { status: 400 });
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
      const patch = { updated_at: now };
      ["enabled", "is_base", "is_default", "rate", "rate_source", "symbol", "name",
       "symbol_position", "decimals", "auto_update", "api_source"].forEach(k => {
        if (body[k] !== undefined) patch[k] = body[k];
      });
      const { error } = await supabase.from("payment_currencies").update(patch).eq("code", code);
      if (error) return Response.json({ error: error.message }, { status: 400 });
      return Response.json({ success: true });
    }

    if (target === "config") {
      const { key, value } = body;
      if (!key || value === undefined) return Response.json({ error: "key and value required" }, { status: 400 });
      const allowedKeys = ["checkout", "fraud", "notifications",
        "checkout_customer", "checkout_payment", "checkout_shipping", "checkout_invoice", "checkout_order",
        "notification_channels", "notification_recipients"];
      if (!allowedKeys.includes(key)) return Response.json({ error: "Invalid config key" }, { status: 400 });
      const { error } = await supabase.from("payment_config").upsert({ key, value, updated_at: now }, { onConflict: "key" });
      if (error) return Response.json({ error: error.message }, { status: 400 });
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
      const { error } = await supabase.from("payment_tax_rules").delete().eq("id", body.id);
      if (error) return Response.json({ error: error.message }, { status: 400 });
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
      return Response.json({ success: true });
    }
    return Response.json({ error: "Invalid target" }, { status: 400 });
  } catch (error) {
    console.error("Payment settings DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
