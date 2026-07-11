// @ts-nocheck
// Real "Test Connection" engine. Secrets are read ONLY from server env vars.
// For providers with a safe auth-check endpoint we perform a genuine round-trip
// and measure latency; otherwise we verify that the required env vars are present
// (config-presence) and say so honestly — never a fake "connected".

export function envPresent(envKeys = []) {
  if (!envKeys.length) return true;
  return envKeys.every((k) => !!process.env[k]);
}
export function anyEnvPresent(envKeys = []) {
  if (!envKeys.length) return true;
  return envKeys.some((k) => !!process.env[k]);
}

async function timed(fn) {
  const t = Date.now();
  try { const r = await fn(); return { ...r, latency: Date.now() - t }; }
  catch (e) { return { ok: false, message: e.message, latency: Date.now() - t }; }
}

const AC = () => AbortSignal.timeout(6000);

export async function testIntegration(id, envKeys = []) {
  // Live auth checks for providers we can safely probe
  switch (id) {
    case "resend": return timed(async () => { const k = process.env.RESEND_API_KEY; if (!k) return { ok: false, message: "RESEND_API_KEY not set" }; const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${k}` }, signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}`, apiVersion: "v1" }; });
    case "stripe": return timed(async () => { const k = process.env.STRIPE_SECRET_KEY; if (!k) return { ok: false, message: "STRIPE_SECRET_KEY not set" }; const r = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${k}` }, signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}`, apiVersion: r.headers.get("stripe-version") || "" }; });
    case "openai": return timed(async () => { const k = process.env.OPENAI_API_KEY; if (!k) return { ok: false, message: "OPENAI_API_KEY not set" }; const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${k}` }, signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }; });
    case "claude": return timed(async () => { const k = process.env.ANTHROPIC_API_KEY; if (!k) return { ok: false, message: "ANTHROPIC_API_KEY not set" }; const r = await fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": k, "anthropic-version": "2023-06-01" }, signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }; });
    case "mistral": return timed(async () => { const k = process.env.MISTRAL_API_KEY; if (!k) return { ok: false, message: "MISTRAL_API_KEY not set" }; const r = await fetch("https://api.mistral.ai/v1/models", { headers: { Authorization: `Bearer ${k}` }, signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }; });
    case "deepseek": return timed(async () => { const k = process.env.DEEPSEEK_API_KEY; if (!k) return { ok: false, message: "DEEPSEEK_API_KEY not set" }; const r = await fetch("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${k}` }, signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }; });
    case "gemini": return timed(async () => { const k = process.env.GEMINI_API_KEY; if (!k) return { ok: false, message: "GEMINI_API_KEY not set" }; const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${k}`, { signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }; });
    case "twilio": return timed(async () => { const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN; if (!sid || !tok) return { ok: false, message: "Twilio env not set" }; const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: { Authorization: "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64") }, signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }; });
    case "sendgrid": return timed(async () => { const k = process.env.SENDGRID_API_KEY; if (!k) return { ok: false, message: "SENDGRID_API_KEY not set" }; const r = await fetch("https://api.sendgrid.com/v3/scopes", { headers: { Authorization: `Bearer ${k}` }, signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }; });
    case "brevo": case "brevo_mkt": return timed(async () => { const k = process.env.BREVO_API_KEY; if (!k) return { ok: false, message: "BREVO_API_KEY not set" }; const r = await fetch("https://api.brevo.com/v3/account", { headers: { "api-key": k }, signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }; });
    case "mailchimp": return timed(async () => { const k = process.env.MAILCHIMP_API_KEY; if (!k) return { ok: false, message: "MAILCHIMP_API_KEY not set" }; const dc = k.split("-")[1]; if (!dc) return { ok: false, message: "Invalid key format" }; const r = await fetch(`https://${dc}.api.mailchimp.com/3.0/ping`, { headers: { Authorization: `Bearer ${k}` }, signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }; });
    case "hubspot": return timed(async () => { const k = process.env.HUBSPOT_ACCESS_TOKEN; if (!k) return { ok: false, message: "HUBSPOT_ACCESS_TOKEN not set" }; const r = await fetch("https://api.hubapi.com/account-info/v3/details", { headers: { Authorization: `Bearer ${k}` }, signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }; });
    case "telegram": return timed(async () => { const k = process.env.TELEGRAM_BOT_TOKEN; if (!k) return { ok: false, message: "TELEGRAM_BOT_TOKEN not set" }; const r = await fetch(`https://api.telegram.org/bot${k}/getMe`, { signal: AC() }); const d = await r.json(); return { ok: !!d.ok, message: d.ok ? `@${d.result?.username}` : d.description }; });
    case "easypost": return timed(async () => { const k = process.env.EASYPOST_API_KEY; if (!k) return { ok: false, message: "EASYPOST_API_KEY not set" }; const r = await fetch("https://api.easypost.com/v2/carrier_accounts", { headers: { Authorization: "Basic " + Buffer.from(`${k}:`).toString("base64") }, signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }; });
    case "shippo": return timed(async () => { const k = process.env.SHIPPO_API_TOKEN; if (!k) return { ok: false, message: "SHIPPO_API_TOKEN not set" }; const r = await fetch("https://api.goshippo.com/carrier_accounts/", { headers: { Authorization: `ShippoToken ${k}` }, signal: AC() }); return { ok: r.ok, message: r.ok ? "Authenticated" : `HTTP ${r.status}` }; });
    case "moncash": return timed(async () => { const id = process.env.MONCASH_CLIENT_ID, sec = process.env.MONCASH_CLIENT_SECRET; if (!id || !sec) return { ok: false, message: "MonCash env not set" }; const r = await fetch("https://sandbox.moncashbutton.digicelgroup.com/Api/oauth/token", { method: "POST", headers: { Authorization: "Basic " + Buffer.from(`${id}:${sec}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: "scope=read,write&grant_type=client_credentials", signal: AC() }); return { ok: r.ok, message: r.ok ? "OAuth OK" : `HTTP ${r.status}` }; });
    default: {
      // Config-presence check for providers without a safe probe endpoint.
      const present = envPresent(envKeys);
      return { ok: present, message: present ? "Credentials configured on server" : `Missing: ${envKeys.filter(k => !process.env[k]).join(", ") || "credentials"}`, latency: 0, configOnly: true };
    }
  }
}
