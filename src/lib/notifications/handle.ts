import type { SupabaseClient } from "@supabase/supabase-js";

// Notification text uses @username, never the full name.
export async function getHandle(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  return data?.username ? `@${data.username}` : "Someone";
}