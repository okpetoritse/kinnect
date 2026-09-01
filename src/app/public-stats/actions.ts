import { createAdminClient } from "@/lib/supabase/admin";
export async function getPublicUserCount() {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
  console.log("[COUNTER] count:", count, "error:", error);
  return count || 0;
}