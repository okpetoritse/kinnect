"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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