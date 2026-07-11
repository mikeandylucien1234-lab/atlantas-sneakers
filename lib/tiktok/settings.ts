import { createClient } from "@supabase/supabase-js";

export type TikTokSettings = {
  pixel_id?: string | null;
  connection_status?: string;
  pixel_events?: Record<string, boolean>;
};

export async function getTikTokSettings(): Promise<TikTokSettings | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { data } = await supabase.from("tiktok_settings").select("pixel_id, connection_status, pixel_events").eq("id", "global").single();
    return (data as TikTokSettings) || null;
  } catch {
    return null;
  }
}
