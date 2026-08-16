"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendPushToUser } from "@/lib/notifications/sendPush";

export async function searchUsers(query: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !query.trim()) return [];

  const { data: blocks } = await supabase
    .from("blocked_users")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

  const excludedIds = new Set<string>([user.id]);
  (blocks || []).forEach((b) => {
    excludedIds.add(b.blocker_id === user.id ? b.blocked_id : b.blocker_id);
  });

  const cleanQuery = query.trim().replace(/^@/, "");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .not("id", "in", `(${Array.from(excludedIds).join(",")})`)
    .or(`full_name.ilike.%${cleanQuery}%,username.ilike.%${cleanQuery}%`)
    .limit(10);

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function sendFriendRequest(receiverId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { count: recentCount } = await supabase
    .from("rate_limit_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("action_type", "friend_request")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if ((recentCount || 0) >= 30) {
    return { error: "You've sent a lot of friend requests recently. Please try again in a bit." };
  }

  // Block sending if a request already exists in either direction
  const { data: existing } = await supabase
    .from("friend_requests")
    .select("id")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`
    )
    .maybeSingle();

  if (existing) {
    return { error: "A friend request already exists between you two" };
  }

  const { error } = await supabase.from("friend_requests").insert({
    sender_id: user.id,
    receiver_id: receiverId,
  });

  if (error) return { error: error.message };

  revalidatePath("/friends");
  sendPushToUser(receiverId, "New friend request", "Someone wants to connect with you", "/friends");
  return { success: true };
}

export async function respondToFriendRequest(
  requestId: string,
  accept: boolean
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("friend_requests")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", requestId);

  if (error) return { error: error.message };

  revalidatePath("/friends");
  return { success: true };
}

export async function getFriendsPaginated(cursor?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { friends: [], nextCursor: null };

  const PAGE_SIZE = 20;

  let request = supabase
    .from("friend_requests")
    .select(
      "id, created_at, sender_id, receiver_id, sender:profiles!friend_requests_sender_id_fkey(id, full_name, username, avatar_url), receiver:profiles!friend_requests_receiver_id_fkey(id, full_name, username, avatar_url)"
    )
    .eq("status", "accepted")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    request = request.lt("created_at", cursor);
  }

  const { data, error } = await request;
  if (error || !data) {
    console.error(error);
    return { friends: [], nextCursor: null };
  }

  const friends = data.map((row: any) => {
    const isSender = row.sender_id === user.id;
    const raw = isSender ? row.receiver : row.sender;
    return Array.isArray(raw) ? raw[0] : raw;
  });

  const nextCursor = data.length === PAGE_SIZE ? data[data.length - 1].created_at : null;

  return { friends, nextCursor };
}