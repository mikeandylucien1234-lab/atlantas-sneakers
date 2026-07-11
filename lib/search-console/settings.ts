import { createClient } from "@supabase/supabase-js";

export type SearchConsoleSettings = {
  id?: string;
  google_account?: string;
  property_url?: string;
  property_type?: string;
  verification_method?: string;
  verification_status?: string;
  verification_token?: string;
  google_client_id?: string;
  connection_status?: string;
  auto_sync?: boolean;
  sync_interval_minutes?: number;
  last_synced_at?: string;
  last_error?: string;
  meta?: Record<string, unknown>;
};

// Server-side reader used by the layout to inject the verification meta tag
// managed from the Search Console module (falls back to SEO settings).
export async function getSearchConsoleSettings(): Promise<SearchConsoleSettings | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { data } = await supabase
      .from("search_console_settings")
      .select("verification_token, verification_method, verification_status, property_url, connection_status")
      .eq("id", "global")
      .single();
    return (data as SearchConsoleSettings) || null;
  } catch {
    return null;
  }
}
