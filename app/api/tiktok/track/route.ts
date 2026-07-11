// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

// First-party mirror of TikTok pixel events so the admin dashboard can show
// how many events were received. The pixel itself reports directly to TikTok.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_name, path, value, currency, content_id, session_id, user_id, metadata } = body;
    if (!event_name) return Response.json({ error: "event_name required" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    await supabase.from("tiktok_events").insert({
      event_name: String(event_name).slice(0, 60),
      path: path ? String(path).slice(0, 300) : null,
      value: value != null ? Number(value) : null,
      currency: currency || "USD",
      content_id: content_id ? String(content_id).slice(0, 100) : null,
      session_id: session_id ? String(session_id).slice(0, 64) : null,
      user_id: user_id || null,
      metadata: metadata || null,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false });
  }
}
