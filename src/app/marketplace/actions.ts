"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getListings(options?: {
  query?: string;
  category?: string;
  businessId?: string;
  cursor?: string;
  country?: string;
  allRegions?: boolean;
}) {
  const supabase = await createClient();
  const PAGE_SIZE = 20;

  let request = supabase
    .from("marketplace_listings")
    .select(
      "id, title, price, currency, category, location, image_urls, status, business_id, is_promoted, promoted_until, seller_country, created_at"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (options?.cursor) {
    request = request.lt("created_at", options.cursor);
  }
  if (options?.query) {
    request = request.ilike("title", `%${options.query}%`);
  }
  if (options?.category) {
    request = request.eq("category", options.category);
  }
  if (options?.businessId) {
    request = request.eq("business_id", options.businessId);
  }
  if (!options?.allRegions && options?.country) {
    request = request.eq("seller_country", options.country);
  }

  const { data, error } = await request;
  if (error) {
    console.error(error);
    return { listings: [], nextCursor: null };
  }

  const now = new Date();
  const isActivePromo = (l: any) =>
    l.is_promoted && l.promoted_until && new Date(l.promoted_until) > now;

  const promoted = data.filter(isActivePromo);
  const rest = data.filter((l) => !isActivePromo(l));
  const listings = [...promoted, ...rest];

  const nextCursor =
    data.length === PAGE_SIZE ? data[data.length - 1].created_at : null;

  return { listings, nextCursor };
}

export async function getListing(id: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("marketplace_listings")
    .select(
      "id, title, description, price, currency, category, location, image_urls, status, seller_id, business_id, created_at, seller:profiles!marketplace_listings_seller_id_fkey(id, full_name, avatar_url), business:business_profiles(id, name, verified)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  return {
    ...data,
    seller: Array.isArray(data.seller) ? data.seller[0] : data.seller,
    business: Array.isArray(data.business) ? data.business[0] : data.business,
  };
}

export async function getMyBusinesses() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("business_profiles")
    .select("id, name")
    .eq("owner_id", user.id);

  return data || [];
}

export async function createListing(formData: FormData) {
  const supabase = await createClient();
  const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) redirect("/login");

const { data: sellerProfile } = await supabase
  .from("profiles")
  .select("country")
  .eq("id", user.id)
  .single();

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const price = formData.get("price") as string;
  const category = (formData.get("category") as string)?.trim();
  const location = (formData.get("location") as string)?.trim();
  const businessId = (formData.get("businessId") as string) || null;
  const imageUrlsRaw = formData.get("imageUrls") as string;
  const imageUrls = imageUrlsRaw ? JSON.parse(imageUrlsRaw) : [];

  if (!title) {
    redirect(`/marketplace/new?error=${encodeURIComponent("Title is required")}`);
  }

  const { data: listing, error } = await supabase
    .from("marketplace_listings")
    .insert({
  seller_id: user.id,
  seller_country: sellerProfile?.country || null,
  business_id: businessId || null,
  title,
  description: description || null,
  price: price ? Number(price) : null,
  category: category || null,
  location: location || null,
  image_urls: imageUrls,
})
    .select()
    .single();

  if (error || !listing) {
    redirect(`/marketplace/new?error=${encodeURIComponent(error?.message || "Could not create listing")}`);
  }

  revalidatePath("/marketplace");
  redirect(`/marketplace/${listing!.id}`);
}

export async function markListingSold(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("marketplace_listings")
    .update({ status: "sold" })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/marketplace/${id}`);
  return { success: true };
}

export async function deleteListing(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("marketplace_listings")
    .update({ status: "removed" })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/marketplace");
  return { success: true };
}

export async function startListingConversation(listingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: listing } = await supabase
    .from("marketplace_listings")
    .select("id, title, price, currency, image_urls, seller_id")
    .eq("id", listingId)
    .single();

  if (!listing) redirect("/marketplace");
  if (listing.seller_id === user!.id) redirect(`/marketplace/${listingId}`);

  const { data: blocked } = await supabase
    .from("blocked_users")
    .select("id")
    .or(
      `and(blocker_id.eq.${user!.id},blocked_id.eq.${listing.seller_id}),and(blocker_id.eq.${listing.seller_id},blocked_id.eq.${user!.id})`
    )
    .maybeSingle();

  if (blocked) redirect(`/marketplace/${listingId}?error=Cannot message this seller`);

  // Reuse an existing listing-card message for this buyer+listing pair if one
  // already exists, instead of spamming a fresh card every time they tap the button
  const { data: existing } = await supabase
    .from("messages")
    .select("id")
    .eq("sender_id", user!.id)
    .eq("receiver_id", listing.seller_id)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("messages").insert({
      sender_id: user!.id,
      receiver_id: listing.seller_id,
      content: null,
      listing_id: listing.id,
      listing_title: listing.title,
      listing_price: listing.price,
      listing_currency: listing.currency,
      listing_image_url: listing.image_urls?.[0] || null,
    });
  }

  redirect(`/messages/${listing.seller_id}`);
}