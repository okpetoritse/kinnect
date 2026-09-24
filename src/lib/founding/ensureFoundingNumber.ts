import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureFoundingNumber(supabase: SupabaseClient, userId: string) {
  await supabase.rpc("ensure_founding_number", { p_user_id: userId });
}