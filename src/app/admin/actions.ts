"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
}

export async function searchPromotable(query: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: posts } = await admin
    .from("community_posts")
    .select("id, content, community_id, is_promoted, promoted_until, promo_region")
    .ilike("content", `%${query}%`)
    .limit(10);

  const { data: listings } = await admin
    .from("marketplace_listings")
    .select("id, title, image_urls, is_promoted, promoted_until, promo_region")
    .ilike("title", `%${query}%`)
    .limit(10);

  const { data: ads } = await admin
    .from("sponsored_ads")
    .select("id, title, image_url, video_url, is_active, ends_at, promo_region")
    .ilike("title", `%${query}%`)
    .limit(10);

  return {
    posts: (posts || []).map((p) => ({ ...p, type: "post" as const })),
    listings: (listings || []).map((l) => ({
      ...l,
      type: "listing" as const,
      image_url: l.image_urls?.[0] || null,
    })),
    ads: (ads || []).map((a) => ({
      ...a,
      type: "ad" as const,
      is_promoted: a.is_active,
      promoted_until: a.ends_at,
    })),
  };
}

export async function setPromotion(
  type: "post" | "listing",
  id: string,
  days: number,
  region: string | null
) {
  await requireAdmin();
  const admin = createAdminClient();
  const table = type === "post" ? "community_posts" : "marketplace_listings";

  const { error } = await admin
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
  await requireAdmin();
  const admin = createAdminClient();
  const table = type === "post" ? "community_posts" : "marketplace_listings";

  const { error } = await admin
    .from(table)
    .update({ is_promoted: false, promoted_until: null, promo_region: null })
    .eq("id", id);

  return error ? { error: error.message } : { success: true };
}

export async function createSponsoredAd(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const title = (formData.get("title") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  const imageUrl = (formData.get("imageUrl") as string) || null;
  const videoUrl = (formData.get("videoUrl") as string) || null;
  const linkUrl = (formData.get("linkUrl") as string)?.trim() || null;
  const sponsorName = (formData.get("sponsorName") as string)?.trim() || null;
  const region = (formData.get("region") as string) || null;
  const days = Number(formData.get("days")) || 7;

  if (!title) return { error: "Title is required" };

  const { error } = await admin.from("sponsored_ads").insert({
    title,
    body: body || null,
    image_url: imageUrl,
    video_url: videoUrl,
    link_url: linkUrl,
    sponsor_name: sponsorName,
    promo_region: region,
    ends_at: new Date(Date.now() + days * 86400000).toISOString(),
  });

  return error ? { error: error.message } : { success: true };
}

export async function getAllAds() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("sponsored_ads")
    .select("*")
    .order("created_at", { ascending: false });
  return data || [];
}

export async function deactivateAd(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("sponsored_ads").update({ is_active: false }).eq("id", id);
  return { success: true };
}