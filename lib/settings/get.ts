// @ts-nocheck
// Server-side settings + feature-flag readers with a short in-process cache.
// Any part of the app can gate behaviour on real, admin-managed configuration.
import { createClient as createAnon } from "@supabase/supabase-js";
import { defaultFor } from "./registry";

function anon() { return createAnon(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }); }
let _cache = { at: 0, settings: {}, flags: {} };
const TTL = 30000;

async function load() {
  if (Date.now() - _cache.at < TTL) return _cache;
  try {
    const sb = anon();
    const [{ data: s }, { data: f }] = await Promise.all([
      sb.from("system_settings").select("key, value"),
      sb.from("feature_flags").select("key, enabled"),
    ]);
    const settings = {}; (s || []).forEach(r => { settings[r.key] = r.value; });
    const flags = {}; (f || []).forEach(r => { flags[r.key] = r.enabled; });
    _cache = { at: Date.now(), settings, flags };
  } catch {}
  return _cache;
}

export async function getSetting(group, key) {
  const c = await load();
  const v = c.settings[`${group}.${key}`];
  return v !== undefined && v !== null ? v : defaultFor(group, key);
}
export async function getGroup(group) {
  const c = await load();
  const out = {};
  Object.entries(c.settings).forEach(([k, v]) => { if (k.startsWith(group + ".")) out[k.slice(group.length + 1)] = v; });
  return out;
}
export async function isFeatureEnabled(key) {
  const c = await load();
  return !!c.flags[key];
}
export function invalidateSettingsCache() { _cache.at = 0; }
