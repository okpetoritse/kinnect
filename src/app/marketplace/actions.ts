"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MARKETPLACE_CATEGORY_VALUES } from "@/lib/marketplace/categories";


export async function getListings(options?: {
  query?: string;
  category?: string;
  businessId?: string;
  cursor?: string;
  country?: string;
  allRegions?: boolean;
  sort?: "newest" | "price-low" | "price-high";
}) {
  const supabase = await createClient();
  const PAGE_SIZE = 20;

  const parsedOffset = options?.cursor
    ? Number.parseInt(options.cursor, 10)
    : 0;

  const offset =
    Number.isSafeInteger(parsedOffset) && parsedOffset >= 0
      ? Math.min(parsedOffset, 100000)
      : 0;

  const sort = options?.sort || "newest";

  let request = supabase
    .from("marketplace_listings")
    .select(
      `id, title, price, currency, category, location, image_urls,
       status, business_id, is_promoted, promoted_until,
       seller_country, created_at,
       seller:profiles!marketplace_listings_seller_id_fkey(id, full_name),
       business:business_profiles(id, name, verified)`
    )
    .eq("status", "active");

  // Search titles, descriptions and categories.
  const searchTerm = (options?.query || "")
    .trim()
    .replace(/[.,%()_*|\\"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (searchTerm) {
    request = request.or(
      `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`
    );
  }

  if (
    options?.category &&
    MARKETPLACE_CATEGORY_VALUES.includes(
      options.category as (typeof MARKETPLACE_CATEGORY_VALUES)[number]
    )
  ) {
    request = request.eq("category", options.category);
  }

  if (options?.businessId) {
    request = request.eq("business_id", options.businessId);
  }

  if (!options?.allRegions && options?.country) {
    request = request.eq("seller_country", options.country);
  }

  // Stable ordering makes offset pagination more predictable.
  if (sort === "price-low") {
    request = request
      .order("price", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  } else if (sort === "price-high") {
    request = request
      .order("price", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  } else {
    request = request
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  }

  const { data, error } = await request.range(
    offset,
    offset + PAGE_SIZE - 1
  );

  const now = Date.now();

const enrichedListings = (data || []).map((listing) => ({
  ...listing,
  is_sponsored: Boolean(
    listing.is_promoted &&
    listing.promoted_until &&
    new Date(listing.promoted_until).getTime() > now
  ),
}));

  if (error) {
    console.error("Could not load marketplace listings:", error);
    return { listings: [], nextCursor: null };
  }

  const listings = data || [];

  const nextCursor =
    listings.length === PAGE_SIZE
      ? String(offset + PAGE_SIZE)
      : null;

  return {
  listings: enrichedListings,
  nextCursor,
};
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
  redirect(
    `/marketplace/new?error=${encodeURIComponent("Title is required")}`
  );
}

if (
  !category ||
  !MARKETPLACE_CATEGORY_VALUES.includes(
    category as (typeof MARKETPLACE_CATEGORY_VALUES)[number]
  )
) {
  redirect(
    `/marketplace/new?error=${encodeURIComponent("Please choose a valid category")}`
  );
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not logged in" };
  }

  const { data, error } = await supabase
    .from("marketplace_listings")
    .update({ status: "sold" })
    .eq("id", id)
    .eq("seller_id", user.id)
    .select("id");

  if (error) {
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { error: "Listing not found or you do not have permission" };
  }

  revalidatePath(`/marketplace/${id}`);
  revalidatePath("/marketplace");

  return { success: true };
}

export async function deleteListing(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not logged in" };
  }

  const { data, error } = await supabase
    .from("marketplace_listings")
    .update({ status: "removed" })
    .eq("id", id)
    .eq("seller_id", user.id)
    .select("id");

  if (error) {
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { error: "Listing not found or you do not have permission" };
  }

  revalidatePath(`/marketplace/${id}`);
  revalidatePath("/marketplace");

  return { success: true };
}

export async function startListingConversation(listingId: string) {
  console.log("[LISTING] 1. Starting, listingId =", listingId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("[LISTING] 2. Current user =", user?.id);

  if (!user) redirect("/login");

  const { data: listing, error: listingError } = await supabase
    .from("marketplace_listings")
    .select("id, title, price, currency, image_urls, seller_id")
    .eq("id", listingId)
    .single();

  console.log("[LISTING] 3. Listing lookup:", { listing, listingError });

  if (listingError || !listing) {
    console.log("[LISTING] 4. FAILED — listing not found, redirecting to /marketplace");
    redirect("/marketplace");
  }

  if (listing!.seller_id === user!.id) {
    console.log("[LISTING] 4. You are the seller — redirecting to listing page");
    redirect(`/marketplace/${listingId}`);
  }

  const { data: blocked } = await supabase
    .from("blocked_users")
    .select("id")
    .or(
      `and(blocker_id.eq.${user!.id},blocked_id.eq.${listing!.seller_id}),and(blocker_id.eq.${listing!.seller_id},blocked_id.eq.${user!.id})`
    )
    .maybeSingle();

  console.log("[LISTING] 5. Block check:", blocked);

  if (blocked) redirect(`/marketplace/${listingId}?error=Cannot message this seller`);

  const { data: existing } = await supabase
    .from("messages")
    .select("id")
    .eq("sender_id", user!.id)
    .eq("receiver_id", listing!.seller_id)
    .eq("listing_id", listingId)
    .maybeSingle();

  console.log("[LISTING] 6. Existing conversation about this listing:", existing);

  if (!existing) {
    const insertPayload = {
      sender_id: user!.id,
      receiver_id: listing!.seller_id,
      content: null,
      listing_id: listing!.id,
      listing_title: listing!.title,
      listing_price: listing!.price,
      listing_currency: listing!.currency,
      listing_image_url: listing!.image_urls?.[0] || null,
    };

    console.log("[LISTING] 7. Inserting new listing-card message:", insertPayload);

    const { data: insertedRow, error: insertError } = await supabase
      .from("messages")
      .insert(insertPayload)
      .select()
      .single();

    console.log("[LISTING] 8. Insert result:", { insertedRow, insertError });

    if (insertError) {
      console.log("[LISTING] 9. FAILED — insert error, redirecting with error message");
      redirect(
        `/marketplace/${listingId}?error=${encodeURIComponent("Could not start conversation: " + insertError.message)}`
      );
    }
  } else {
    console.log("[LISTING] 7. Skipping insert — conversation already exists");
  }

  console.log("[LISTING] 10. SUCCESS — redirecting to /messages/" + listing!.seller_id);
  redirect(`/messages/${listing!.seller_id}`);
}