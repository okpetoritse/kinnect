"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/home");
  return supabase;
}

export async function searchPromotable(query: string) {
  const supabase = await requireAdmin();

  const { data: posts } = await supabase
    .from("community_posts")
    .select("id, content, community_id, is_promoted, promoted_until, promo_region")
    .ilike("content", `%${query}%`)
    .limit(10);

  const { data: listings } = await supabase
    .from("marketplace_listings")
    .select("id, title, is_promoted, promoted_until, promo_region")
    .ilike("title", `%${query}%`)
    .limit(10);

  return {
    posts: (posts || []).map((p) => ({ ...p, type: "post" as const })),
    listings: (listings || []).map((l) => ({ ...l, type: "listing" as const })),
  };
}

export async function setPromotion(
  type: "post" | "listing",
  id: string,
  days: number,
  region: string | null
) {
  const supabase = await requireAdmin();
  const table = type === "post" ? "community_posts" : "marketplace_listings";

  const { error } = await supabase
    .from(table)
    .update({
      is_promoted: true,
      promoted_until: new Date(Date.now() + days * 86400000).toISOString(),
      promo_region: region,
    })
    .eq("id", id);

  return error ? { error: error.message } : { success: true };
}

export async function removePromotion(type: "post" | "listing", id: string) {
  const supabase = await requireAdmin();
  const table = type === "post" ? "community_posts" : "marketplace_listings";

  const { error } = await supabase
    .from(table)
    .update({ is_promoted: false, promoted_until: null, promo_region: null })
    .eq("id", id);

  return error ? { error: error.message } : { success: true };
}