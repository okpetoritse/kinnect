"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MARKETPLACE_CATEGORY_VALUES } from "@/lib/marketplace/categories";
import { notifyNewMessage } from "@/lib/notifications/notifyNewMessage";

type MarketplaceServerClient = Awaited<ReturnType<typeof createClient>>;

const MAX_LISTING_IMAGES = 5;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_LOCATION_LENGTH = 120;

function getFormText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseListingImages(
  value: FormDataEntryValue | null
): string[] | null {
  if (typeof value !== "string") return null;

  try {
    const parsed: unknown = JSON.parse(value);

    if (
      !Array.isArray(parsed) ||
      parsed.length > MAX_LISTING_IMAGES ||
      !parsed.every(
        (item) => typeof item === "string" && item.length <= 2048
      )
    ) {
      return null;
    }

    const urls = parsed.map((item: string) => item.trim());

    if (urls.some((url) => !url)) return null;

    if (new Set(urls).size !== urls.length) return null;

    return urls;
  } catch {
    return null;
  }
}

function getMarketplaceObjectPath(
  supabase: MarketplaceServerClient,
  publicUrl: string
): string | null {
  try {
    const sampleUrl = supabase.storage
      .from("marketplace")
      .getPublicUrl("__validation__/probe.jpg").data.publicUrl;

    const expected = new URL(sampleUrl);
    const candidate = new URL(publicUrl);

    const marker = "/storage/v1/object/public/marketplace/";
    const markerIndex = expected.pathname.indexOf(marker);

    if (markerIndex === -1) return null;

    const expectedPrefix = expected.pathname.slice(
      0,
      markerIndex + marker.length
    );

    if (
      candidate.origin !== expected.origin ||
      !candidate.pathname.startsWith(expectedPrefix) ||
      candidate.search ||
      candidate.hash
    ) {
      return null;
    }

    const encodedPath = candidate.pathname.slice(expectedPrefix.length);

    const segments = encodedPath.split("/").map((segment) =>
      decodeURIComponent(segment)
    );

    if (
      segments.length < 1 ||
      segments.some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".." ||
          segment.includes("/") ||
          segment.includes("\\")
      )
    ) {
      return null;
    }

    const objectPath = segments.join("/");

    const canonicalUrl = new URL(
      supabase.storage
        .from("marketplace")
        .getPublicUrl(objectPath).data.publicUrl
    );

    if (
      canonicalUrl.origin !== candidate.origin ||
      canonicalUrl.pathname !== candidate.pathname
    ) {
      return null;
    }

    return objectPath;
  } catch {
    return null;
  }
}

function getOwnedMarketplaceImagePath(
  supabase: MarketplaceServerClient,
  publicUrl: string,
  userId: string
): string | null {
  const objectPath = getMarketplaceObjectPath(supabase, publicUrl);

  if (!objectPath) return null;

  const segments = objectPath.split("/");

  if (segments.length !== 2 || segments[0] !== userId) {
    return null;
  }

  return objectPath;
}

function isValidMarketplaceCategory(category: string): boolean {
  return MARKETPLACE_CATEGORY_VALUES.includes(
    category as (typeof MARKETPLACE_CATEGORY_VALUES)[number]
  );
}


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

export async function getMarketplaceDiscoveryData(country?: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const listingColumns =
    "id, title, price, currency, category, location, image_urls, is_promoted, promoted_until, seller_country, created_at";

  const localPromise = country
    ? supabase
        .from("marketplace_listings")
        .select(listingColumns)
        .eq("status", "active")
        .eq("seller_country", country)
        .order("created_at", { ascending: false })
        .limit(20)
    : Promise.resolve(null);

  const [featuredResult, localResult, businessResult] =
    await Promise.all([
      supabase
        .from("marketplace_listings")
        .select(listingColumns)
        .eq("status", "active")
        .eq("is_promoted", true)
        .gt("promoted_until", now)
        .order("created_at", { ascending: false })
        .limit(6),

      localPromise,

      supabase
        .from("business_profiles")
        .select(
          "id, name, category, logo_url, cover_color, location, verified, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  if (featuredResult.error) {
    console.error(
      "Could not load featured discoveries:",
      featuredResult.error
    );
  }

  if (localResult?.error) {
    console.error("Could not load local finds:", localResult.error);
  }

  if (businessResult.error) {
    console.error(
      "Could not load business highlights:",
      businessResult.error
    );
  }

  const featured = featuredResult.data || [];
  const featuredIds = new Set(featured.map((item) => item.id));

  const local = (localResult?.data || [])
    .filter((item) => !featuredIds.has(item.id))
    .slice(0, 6);

  return {
    featured,
    local,
    businesses: businessResult.data || [],
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


type MyListingStatus = "active" | "sold" | "removed";

const MY_LISTING_STATUSES: MyListingStatus[] = [
  "active",
  "sold",
  "removed",
];

export async function getMyListings(options?: {
  status?: string;
  businessId?: string;
  page?: number;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const emptyResult = {
    listings: [],
    counts: { active: 0, sold: 0, removed: 0 },
    total: 0,
    page: 1,
    pageSize: 12,
    hasPrevious: false,
    hasNext: false,
  };

  if (authError || !user) return emptyResult;

  const selectedStatus = MY_LISTING_STATUSES.includes(
    options?.status as MyListingStatus
  )
    ? (options?.status as MyListingStatus)
    : undefined;

  const requestedPage = Number(options?.page ?? 1);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 100000)
      : 1;

  const PAGE_SIZE = 12;
  const offset = (page - 1) * PAGE_SIZE;

  // These counts cover all of the seller's listings,
  // regardless of the selected business filter.
  const [activeCount, soldCount, removedCount] = await Promise.all([
    supabase
      .from("marketplace_listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "active"),

    supabase
      .from("marketplace_listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "sold"),

    supabase
      .from("marketplace_listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "removed"),
  ]);

  let request = supabase
    .from("marketplace_listings")
    .select(
      `id, title, price, currency, category, location, image_urls,
       status, business_id, created_at,
       business:business_profiles(id, name)`
    , { count: "exact" })
    .eq("seller_id", user.id);

  if (selectedStatus) {
    request = request.eq("status", selectedStatus);
  }

  if (options?.businessId === "personal") {
    request = request.is("business_id", null);
  } else if (options?.businessId) {
    request = request.eq("business_id", options.businessId);
  }

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    console.error("Could not load the seller's listings:", error);
    return {
      ...emptyResult,
      page,
      counts: {
        active: activeCount.count ?? 0,
        sold: soldCount.count ?? 0,
        removed: removedCount.count ?? 0,
      },
    };
  }

  const listings = (data || []).map((listing) => ({
    ...listing,
    business: Array.isArray(listing.business)
      ? listing.business[0] ?? null
      : listing.business,
  }));

  const total = count ?? 0;

  return {
    listings,
    counts: {
      active: activeCount.count ?? 0,
      sold: soldCount.count ?? 0,
      removed: removedCount.count ?? 0,
    },
    total,
    page,
    pageSize: PAGE_SIZE,
    hasPrevious: page > 1,
    hasNext: offset + listings.length < total,
  };
}


export async function createListing(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const title = getFormText(formData, "title");
  const description = getFormText(formData, "description");
  const priceRaw = getFormText(formData, "price");
  const category = getFormText(formData, "category");
  const location = getFormText(formData, "location");
  const businessId = getFormText(formData, "businessId") || null;

  const imageUrls = parseListingImages(formData.get("imageUrls"));

  if (!title || title.length > MAX_TITLE_LENGTH) {
    redirect(
      `/marketplace/new?error=${encodeURIComponent(
        "Enter a title of no more than 120 characters."
      )}`
    );
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    redirect(
      `/marketplace/new?error=${encodeURIComponent(
        "The description cannot exceed 5,000 characters."
      )}`
    );
  }

  if (location.length > MAX_LOCATION_LENGTH) {
    redirect(
      `/marketplace/new?error=${encodeURIComponent(
        "The location cannot exceed 120 characters."
      )}`
    );
  }

  if (!isValidMarketplaceCategory(category)) {
    redirect(
      `/marketplace/new?error=${encodeURIComponent(
        "Please choose a valid category."
      )}`
    );
  }

  const price =
    priceRaw === ""
      ? null
      : Number(priceRaw);

  if (
    price !== null &&
    (!Number.isFinite(price) || price < 0 || price > 999999999999)
  ) {
    redirect(
      `/marketplace/new?error=${encodeURIComponent(
        "Enter a valid non-negative price."
      )}`
    );
  }

  if (!imageUrls) {
    redirect(
      `/marketplace/new?error=${encodeURIComponent(
        "The listing photos could not be validated. Please select them again."
      )}`
    );
  }

  for (const imageUrl of imageUrls) {
    if (!getOwnedMarketplaceImagePath(supabase, imageUrl, user.id)) {
      redirect(
        `/marketplace/new?error=${encodeURIComponent(
          "One or more photos do not belong to your account. Please upload them again."
        )}`
      );
    }
  }

  if (businessId) {
    const { data: ownedBusiness, error: businessCheckError } =
      await supabase
        .from("business_profiles")
        .select("id")
        .eq("id", businessId)
        .eq("owner_id", user.id)
        .maybeSingle();

    if (businessCheckError || !ownedBusiness) {
      redirect(
        `/marketplace/new?error=${encodeURIComponent(
          "You can only publish listings under a business you own."
        )}`
      );
    }
  }

  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("country")
    .eq("id", user.id)
    .maybeSingle();

  const { data: listing, error } = await supabase
    .from("marketplace_listings")
    .insert({
      seller_id: user.id,
      seller_country: sellerProfile?.country || null,
      business_id: businessId,
      title,
      description: description || null,
      price,
      category,
      location: location || null,
      image_urls: imageUrls,
    })
    .select("id")
    .single();

  if (error || !listing) {
    console.error("Could not create marketplace listing:", error);

    redirect(
      `/marketplace/new?error=${encodeURIComponent(
        "Could not create your listing. Please try again."
      )}`
    );
  }

  revalidatePath("/marketplace");
  revalidatePath("/marketplace/my-listings");

  if (businessId) {
    revalidatePath(`/business/${businessId}`);
  }

  redirect(`/marketplace/${listing.id}`);
}

export async function updateListing(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const listingId = getFormText(formData, "listingId");

  if (!listingId) redirect("/marketplace/my-listings");

  const editUrl = `/marketplace/${listingId}/edit`;

  const { data: currentListing, error: currentError } = await supabase
    .from("marketplace_listings")
    .select("id, seller_id, business_id, image_urls")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .maybeSingle();

  if (currentError || !currentListing) {
    redirect("/marketplace/my-listings");
  }

  const title = getFormText(formData, "title");
  const description = getFormText(formData, "description");
  const priceRaw = getFormText(formData, "price");
  const category = getFormText(formData, "category");
  const location = getFormText(formData, "location");
  const businessId = getFormText(formData, "businessId") || null;

  const imageUrls = parseListingImages(formData.get("imageUrls"));

  if (!title || title.length > MAX_TITLE_LENGTH) {
    redirect(
      `${editUrl}?error=${encodeURIComponent(
        "Enter a title of no more than 120 characters."
      )}`
    );
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    redirect(
      `${editUrl}?error=${encodeURIComponent(
        "The description cannot exceed 5,000 characters."
      )}`
    );
  }

  if (location.length > MAX_LOCATION_LENGTH) {
    redirect(
      `${editUrl}?error=${encodeURIComponent(
        "The location cannot exceed 120 characters."
      )}`
    );
  }

  if (!isValidMarketplaceCategory(category)) {
    redirect(
      `${editUrl}?error=${encodeURIComponent(
        "Please choose a valid category."
      )}`
    );
  }

  const price =
    priceRaw === ""
      ? null
      : Number(priceRaw);

  if (
    price !== null &&
    (!Number.isFinite(price) || price < 0 || price > 999999999999)
  ) {
    redirect(
      `${editUrl}?error=${encodeURIComponent(
        "Enter a valid non-negative price."
      )}`
    );
  }

  if (!imageUrls) {
    redirect(
      `${editUrl}?error=${encodeURIComponent(
        "The listing photos could not be validated."
      )}`
    );
  }

  const existingImages = Array.isArray(currentListing.image_urls)
    ? currentListing.image_urls
    : [];

  for (const imageUrl of imageUrls) {
    const isAlreadyAttached = existingImages.includes(imageUrl);
    const isNewOwnedImage = Boolean(
      getOwnedMarketplaceImagePath(supabase, imageUrl, user.id)
    );

    if (!isAlreadyAttached && !isNewOwnedImage) {
      redirect(
        `${editUrl}?error=${encodeURIComponent(
          "A new photo does not belong to your account. Please upload it again."
        )}`
      );
    }
  }

  if (businessId) {
    const { data: ownedBusiness, error: businessCheckError } =
      await supabase
        .from("business_profiles")
        .select("id")
        .eq("id", businessId)
        .eq("owner_id", user.id)
        .maybeSingle();

    if (businessCheckError || !ownedBusiness) {
      redirect(
        `${editUrl}?error=${encodeURIComponent(
          "You can only use a business profile you own."
        )}`
      );
    }
  }

  const { error: updateError } = await supabase
    .from("marketplace_listings")
    .update({
      title,
      description: description || null,
      price,
      category,
      location: location || null,
      business_id: businessId,
      image_urls: imageUrls,
    })
    .eq("id", listingId)
    .eq("seller_id", user.id);

  if (updateError) {
    console.error("Could not update marketplace listing:", updateError);

    redirect(
      `${editUrl}?error=${encodeURIComponent(
        "Could not save your changes. Please try again."
      )}`
    );
  }

  // Remove old photos only after the database update succeeds.
  // Legacy root-level images are deliberately not deleted because
  // their ownership cannot be established from their path.
  const removedImagePaths = existingImages
    .filter((url) => !imageUrls.includes(url))
    .map((url) =>
      getOwnedMarketplaceImagePath(supabase, url, user.id)
    )
    .filter((path): path is string => Boolean(path));

  if (removedImagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("marketplace")
      .remove(removedImagePaths);

    if (storageError) {
      console.error(
        "Listing saved, but some old Marketplace photos could not be deleted:",
        storageError
      );
    }
  }

  revalidatePath("/marketplace");
  revalidatePath("/marketplace/my-listings");
  revalidatePath(`/marketplace/${listingId}`);

  if (currentListing.business_id) {
    revalidatePath(`/business/${currentListing.business_id}`);
  }

  if (businessId && businessId !== currentListing.business_id) {
    revalidatePath(`/business/${businessId}`);
  }

  redirect(`/marketplace/${listingId}`);
}

export async function deleteMarketplaceImage(publicUrl: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in to remove this photo." };
  }

  const objectPath = getMarketplaceObjectPath(supabase, publicUrl);

  if (!objectPath) {
    return { error: "This is not a valid Marketplace photo." };
  }

  const segments = objectPath.split("/");

  if (segments[0] !== user.id) {
    return { error: "You can only delete photos belonging to your account." };
  }

  // Earlier uploads used the bucket root. We cannot safely delete
  // these legacy files based on their path, so leave them untouched.
  if (segments.length !== 2) {
    return { success: true, deleted: false };
  }

  const { error } = await supabase.storage
    .from("marketplace")
    .remove([objectPath]);

  if (error) {
    console.error("Could not delete Marketplace photo:", error);
    return { error: "The photo could not be deleted. Please try again." };
  }

  return { success: true, deleted: true };
}

export async function markListingSold(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not logged in." };
  }

  const { data, error } = await supabase
    .from("marketplace_listings")
    .update({ status: "sold" })
    .eq("id", id)
    .eq("seller_id", user.id)
    .eq("status", "active")
    .select("id, business_id")
    .maybeSingle();

  if (error) return { error: error.message };

  if (!data) {
    return {
      error: "This listing is not active or you do not own it.",
    };
  }

  revalidatePath(`/marketplace/${id}`);
  revalidatePath("/marketplace");
  revalidatePath("/marketplace/my-listings");

  if (data.business_id) {
    revalidatePath(`/business/${data.business_id}`);
  }

  return { success: true };
}

export async function deleteListing(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not logged in." };
  }

  const { data, error } = await supabase
    .from("marketplace_listings")
    .update({ status: "removed" })
    .eq("id", id)
    .eq("seller_id", user.id)
    .neq("status", "removed")
    .select("id, business_id")
    .maybeSingle();

  if (error) return { error: error.message };

  if (!data) {
    return {
      error: "This listing is already removed or you do not own it.",
    };
  }

  revalidatePath(`/marketplace/${id}`);
  revalidatePath("/marketplace");
  revalidatePath("/marketplace/my-listings");

  if (data.business_id) {
    revalidatePath(`/business/${data.business_id}`);
  }

  return { success: true };
}

export async function restoreListing(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not logged in." };
  }

  const { data, error } = await supabase
    .from("marketplace_listings")
    .update({ status: "active" })
    .eq("id", id)
    .eq("seller_id", user.id)
    .in("status", ["sold", "removed"])
    .select("id, business_id")
    .maybeSingle();

  if (error) return { error: error.message };

  if (!data) {
    return {
      error: "This listing cannot be restored or you do not own it.",
    };
  }

  revalidatePath(`/marketplace/${id}`);
  revalidatePath("/marketplace");
  revalidatePath("/marketplace/my-listings");

  if (data.business_id) {
    revalidatePath(`/business/${data.business_id}`);
  }

  return { success: true };
}

export async function startListingConversation(listingId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  // The RPC is created by our migration. The cast accommodates
  // projects whose generated Supabase TypeScript types haven't
  // been regenerated yet.
  const rpcClient = supabase as unknown as {
    rpc: (
      name: string,
      args: { p_listing_id: string }
    ) => Promise<{
      data: {
        message_id: string;
        seller_id: string;
        listing_title: string;
        created: boolean;
      }[] | null;
      error: { message: string } | null;
    }>;
  };

  const { data, error } = await rpcClient.rpc(
    "start_listing_conversation",
    { p_listing_id: listingId }
  );

  if (error || !data?.length) {
    console.error("Could not start Marketplace enquiry:", error);

    redirect(
      `/marketplace/${listingId}?error=${encodeURIComponent(
        "This listing is unavailable or the seller cannot be contacted."
      )}`
    );
  }

  const enquiry = data[0];

  // Only notify the seller when a new enquiry card was created.
  // Repeated clicks reuse the existing enquiry.
  if (enquiry.created) {
    notifyNewMessage(
      user.id,
      enquiry.seller_id,
      `Enquiry about ${enquiry.listing_title}`
    );
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${enquiry.seller_id}`);

  redirect(`/messages/${enquiry.seller_id}`);
}