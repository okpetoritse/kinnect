import type { SupabaseClient, User } from "@supabase/supabase-js";

type GuardResult =
  | { ok: true; user: User }
  | { ok: false; error: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PERMISSION_CHECK_ERROR =
  "Could not verify messaging permissions. Please try again.";

export async function assertCanMessage(
  supabase: SupabaseClient,
  friendId: string,
): Promise<GuardResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Not logged in" };
  }

  if (!UUID_PATTERN.test(friendId) || user.id === friendId) {
    return { ok: false, error: "Invalid recipient" };
  }

  const { data: blocked, error: blockError } = await supabase.rpc(
    "is_blocked_with",
    { other: friendId },
  );

  if (blockError || typeof blocked !== "boolean") {
    return { ok: false, error: PERMISSION_CHECK_ERROR };
  }

  if (blocked) {
    return { ok: false, error: "You can't message this user" };
  }

  const pair = `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`;

  const { data: friendship, error: friendshipError } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("status", "accepted")
    .or(pair)
    .limit(1);

  if (friendshipError) {
    return { ok: false, error: PERMISSION_CHECK_ERROR };
  }

  if (friendship?.length) {
    return { ok: true, user };
  }

  // Find listing-card messages between these two users.
  const { data: listingMessages, error: listingMessagesError } =
    await supabase
      .from("messages")
      .select("listing_id, sender_id, receiver_id")
      .not("listing_id", "is", null)
      .or(pair)
      .limit(1000);

  if (listingMessagesError) {
    return { ok: false, error: PERMISSION_CHECK_ERROR };
  }

  const listingIds = Array.from(
    new Set(
      (listingMessages ?? [])
        .map((message) => message.listing_id)
        .filter(
          (id): id is string =>
            typeof id === "string" && id.length > 0,
        ),
    ),
  );

  if (listingIds.length === 0) {
    return {
      ok: false,
      error: "You can only message friends, or reply about a listing",
    };
  }

  const { data: listings, error: listingsError } = await supabase
    .from("marketplace_listings")
    .select("id, seller_id")
    .in("id", listingIds);

  if (listingsError) {
    return { ok: false, error: PERMISSION_CHECK_ERROR };
  }

  const sellerByListingId = new Map(
    (listings ?? []).map((listing) => [
      listing.id,
      listing.seller_id,
    ]),
  );

  const hasValidListingConversation = (listingMessages ?? []).some(
    (message) =>
      !!message.listing_id &&
      sellerByListingId.get(message.listing_id) === message.receiver_id,
  );

  if (!hasValidListingConversation) {
    return {
      ok: false,
      error: "You can only message friends, or reply about a listing",
    };
  }

  return { ok: true, user };
}