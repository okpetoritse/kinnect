"use server";

import { createClient } from "@/lib/supabase/server";

export async function getHomeData(userId: string) {
  const supabase = await createClient();

  // Recent conversations: latest message per friend
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("id, sender_id, receiver_id, content, image_url, sticker_id, created_at")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(50);

  const seenFriends = new Set<string>();
  const conversationPreviews: {
    friendId: string;
    lastMessage: string;
    createdAt: string;
  }[] = [];

  (recentMessages || []).forEach((msg) => {
    const friendId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
    if (seenFriends.has(friendId)) return;
    seenFriends.add(friendId);

    let preview = msg.content || "";
    if (msg.image_url) preview = "📷 Photo";
    if (msg.sticker_id) preview = "Sent a sticker";

    conversationPreviews.push({
      friendId,
      lastMessage: preview,
      createdAt: msg.created_at,
    });
  });

    const { data: unreadRows } = await supabase
    .from("messages")
    .select("sender_id")
    .eq("receiver_id", userId)
    .is("read_at", null);

  const unreadByFriend: Record<string, number> = {};
  (unreadRows || []).forEach((m) => {
    unreadByFriend[m.sender_id] = (unreadByFriend[m.sender_id] || 0) + 1;
  });

  const friendIds = conversationPreviews.map((c) => c.friendId);
  const { data: friendProfiles } =
    friendIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, founding_number")
          .in("id", friendIds)
      : { data: [] };

  const conversations = conversationPreviews.slice(0, 5).map((c) => ({
    ...c,
    name:
      friendProfiles?.find((p) => p.id === c.friendId)?.full_name || "Unknown",
    avatarUrl: friendProfiles?.find((p) => p.id === c.friendId)?.avatar_url || null,
    foundingNumber: friendProfiles?.find((p) => p.id === c.friendId)?.founding_number || null,
    unreadCount: unreadByFriend[c.friendId] || 0,
  }));

  // Communities the user belongs to
  const { data: memberRows } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("user_id", userId);

  const communityIds = (memberRows || []).map((m) => m.community_id);

  const { data: communities } =
    communityIds.length > 0
      ? await supabase
          .from("communities")
          .select("id, name, cover_color")
          .in("id", communityIds)
      : { data: [] };

  // Upcoming events you're going to
  const { data: rsvps } = await supabase
    .from("community_event_rsvps")
    .select("event_id")
    .eq("user_id", userId)
    .eq("status", "going");

  const eventIds = (rsvps || []).map((r) => r.event_id);

  const { data: events } =
    eventIds.length > 0
      ? await supabase
          .from("community_events")
          .select("id, title, event_date, community_id")
          .in("id", eventIds)
          .gte("event_date", new Date().toISOString())
          .order("event_date", { ascending: true })
          .limit(5)
      : { data: [] };

  // Pending friend requests count (for the Friends tab badge, if you want it later)
  const { count: pendingRequestsCount } = await supabase
    .from("friend_requests")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("status", "pending");

  return {
    conversations,
    communities: communities || [],
    events: events || [],
    pendingRequestsCount: pendingRequestsCount || 0,
  };
}