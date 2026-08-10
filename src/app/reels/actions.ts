"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getFriendsWithActiveReels() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: friendRows } = await supabase
    .from("friend_requests")
    .select(
      "sender_id, receiver_id, sender:profiles!friend_requests_sender_id_fkey(id, full_name, avatar_url), receiver:profiles!friend_requests_receiver_id_fkey(id, full_name, avatar_url)"
    )
    .eq("status", "accepted")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

  const friendMap = new Map<string, any>();
  (friendRows || []).forEach((row: any) => {
    const isSender = row.sender_id === user.id;
    const rawFriend = isSender ? row.receiver : row.sender;
    const friend = Array.isArray(rawFriend) ? rawFriend[0] : rawFriend;
    if (friend && !friendMap.has(friend.id)) friendMap.set(friend.id, friend);
  });
  const friends = Array.from(friendMap.values());
  if (friends.length === 0) return [];

  const friendIds = friends.map((f) => f.id);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentEntries } = await supabase
    .from("community_goal_progress")
    .select("id, user_id, created_at")
    .in("user_id", friendIds)
    .gte("created_at", dayAgo)
    .order("created_at", { ascending: false });

  if (!recentEntries || recentEntries.length === 0) return [];

  const entryIds = recentEntries.map((e) => e.id);
  const { data: myViews } = await supabase
    .from("community_goal_progress_views")
    .select("entry_id")
    .eq("viewer_id", user.id)
    .in("entry_id", entryIds);

  const viewedSet = new Set((myViews || []).map((v) => v.entry_id));

  const byFriend = new Map<string, { hasUnseen: boolean; latest: string }>();
  recentEntries.forEach((e) => {
    const existing = byFriend.get(e.user_id);
    const isUnseen = !viewedSet.has(e.id);
    if (!existing) {
      byFriend.set(e.user_id, { hasUnseen: isUnseen, latest: e.created_at });
    } else if (isUnseen) {
      existing.hasUnseen = true;
    }
  });

  return friends
    .filter((f) => byFriend.has(f.id))
    .map((f) => ({
      id: f.id,
      name: f.full_name || "Unknown",
      avatarUrl: f.avatar_url,
      hasUnseen: byFriend.get(f.id)!.hasUnseen,
    }));
}

export async function getReelEntries(targetUserId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("community_goal_progress")
    .select("id, value, note, media_url, media_type, created_at, community_id")
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  const entryIds = data.map((e) => e.id);
  const { data: sparks } = entryIds.length
    ? await supabase
        .from("community_goal_progress_sparks")
        .select("entry_id, user_id")
        .in("entry_id", entryIds)
    : { data: [] };

  return data.map((entry) => ({
    ...entry,
    sparkedUserIds: (sparks || [])
      .filter((s) => s.entry_id === entry.id)
      .map((s) => s.user_id),
  }));
}

export async function markReelViewed(entryIds: string[]) {
  if (entryIds.length === 0) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const rows = entryIds.map((entry_id) => ({ entry_id, viewer_id: user.id }));
  await supabase.from("community_goal_progress_views").upsert(rows, {
    onConflict: "entry_id,viewer_id",
  });
}

export async function toggleReelSpark(entryId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { data: existing } = await supabase
    .from("community_goal_progress_sparks")
    .select("id")
    .eq("entry_id", entryId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("community_goal_progress_sparks")
      .delete()
      .eq("entry_id", entryId)
      .eq("user_id", user.id);
    return { sparked: false };
  }

  await supabase.from("community_goal_progress_sparks").insert({
    entry_id: entryId,
    user_id: user.id,
  });
  return { sparked: true };
}

export async function getFriendsReelStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return {};

  const { data: friendRows } = await supabase
    .from("friend_requests")
    .select("sender_id, receiver_id")
    .eq("status", "accepted")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

  const friendIds = (friendRows || []).map((row) =>
    row.sender_id === user.id ? row.receiver_id : row.sender_id
  );

  if (friendIds.length === 0) return {};

  const { data: allEntries } = await supabase
    .from("community_goal_progress")
    .select("id, user_id, created_at")
    .in("user_id", friendIds);

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentEntryIds = (allEntries || [])
    .filter((e) => new Date(e.created_at).getTime() >= dayAgo)
    .map((e) => e.id);

  const { data: myViews } = recentEntryIds.length
    ? await supabase
        .from("community_goal_progress_views")
        .select("entry_id")
        .eq("viewer_id", user.id)
        .in("entry_id", recentEntryIds)
    : { data: [] };

  const viewedSet = new Set((myViews || []).map((v) => v.entry_id));

  const status: Record<string, { hasEntries: boolean; hasUnseenRecent: boolean }> = {};
  friendIds.forEach((id) => {
    const entries = (allEntries || []).filter((e) => e.user_id === id);
    const recentUnseen = entries.some(
      (e) =>
        new Date(e.created_at).getTime() >= dayAgo && !viewedSet.has(e.id)
    );
    status[id] = { hasEntries: entries.length > 0, hasUnseenRecent: recentUnseen };
  });

  return status;
}