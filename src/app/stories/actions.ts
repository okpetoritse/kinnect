"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createStory(
  contentText: string | null,
  mediaUrl: string | null,
  mediaType: "image" | "video" | null,
  backgroundColor: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  if (!contentText?.trim() && !mediaUrl) {
    return { error: "A story needs either text or media" };
  }

  const { error } = await supabase.from("stories").insert({
    user_id: user.id,
    content_text: contentText?.trim() || null,
    media_url: mediaUrl,
    media_type: mediaType,
    background_color: backgroundColor,
  });

  if (error) return { error: error.message };
  revalidatePath("/home");
  return { success: true };
}

export async function getFriendsWithActiveStories() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date().toISOString();

  const { data: friendRows } = await supabase
    .from("friend_requests")
        .select(
      "sender_id, receiver_id, sender:profiles!friend_requests_sender_id_fkey(id, full_name, username, avatar_url), receiver:profiles!friend_requests_receiver_id_fkey(id, full_name, username, avatar_url)"
    )
    .eq("status", "accepted")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

  const friendMap = new Map<string, any>();
  (friendRows || []).forEach((row: any) => {
    const isSender = row.sender_id === user.id;
    const raw = isSender ? row.receiver : row.sender;
    const friend = Array.isArray(raw) ? raw[0] : raw;
    if (friend && !friendMap.has(friend.id)) friendMap.set(friend.id, friend);
  });
  const friends = Array.from(friendMap.values());
  const friendIds = friends.map((f) => f.id);
  if (friendIds.length === 0) return [];

  const { data: activeStories } = await supabase
    .from("stories")
    .select("id, user_id, created_at, expires_at")
    .in("user_id", friendIds)
    .gt("expires_at", now)
    .order("created_at", { ascending: false });

  if (!activeStories || activeStories.length === 0) return [];

  const storyIds = activeStories.map((s) => s.id);
  const { data: myViews } = await supabase
    .from("story_views")
    .select("story_id")
    .eq("viewer_id", user.id)
    .in("story_id", storyIds);

  const viewedSet = new Set((myViews || []).map((v) => v.story_id));

  const byFriend = new Map<string, { hasUnseen: boolean; earliestExpiry: string; latestCreated: string }>();
  activeStories.forEach((s) => {
    const existing = byFriend.get(s.user_id);
    const isUnseen = !viewedSet.has(s.id);
    if (!existing) {
      byFriend.set(s.user_id, { hasUnseen: isUnseen, earliestExpiry: s.expires_at, latestCreated: s.created_at });
    } else {
      if (isUnseen) existing.hasUnseen = true;
      if (new Date(s.expires_at) < new Date(existing.earliestExpiry)) existing.earliestExpiry = s.expires_at;
      if (new Date(s.created_at) > new Date(existing.latestCreated)) existing.latestCreated = s.created_at;
    }
  });

  return friends
    .filter((f) => byFriend.has(f.id))
    .map((f) => {
      const info = byFriend.get(f.id)!;
            return {
        id: f.id,
        name: f.username ? `@${f.username}` : f.full_name || "Unknown",
        avatarUrl: f.avatar_url,
        hasUnseen: info.hasUnseen,
        expiresAt: info.earliestExpiry,
        createdAt: info.latestCreated,
      };
    });
}

export async function getMyActiveStories() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("stories")
    .select("id, created_at, expires_at")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return data || [];
}

export async function getStoryEntries(targetUserId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from("stories")
    .select("id, content_text, media_url, media_type, background_color, created_at")
    .eq("user_id", targetUserId)
    .gt("expires_at", now)
    .order("created_at", { ascending: true });

  if (!data || data.length === 0) return [];

  const storyIds = data.map((s) => s.id);
  const { data: sparks } = await supabase
    .from("story_sparks")
    .select("story_id, user_id")
    .in("story_id", storyIds);

  return data.map((s) => ({
    ...s,
    sparkedUserIds: (sparks || []).filter((sp) => sp.story_id === s.id).map((sp) => sp.user_id),
  }));
}

export async function markStoryViewed(storyIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || storyIds.length === 0) return;

  await supabase
    .from("story_views")
    .upsert(
      storyIds.map((id) => ({ story_id: id, viewer_id: user.id })),
      { onConflict: "story_id,viewer_id" }
    );
}

export async function toggleStorySpark(storyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { data: existing } = await supabase
    .from("story_sparks")
    .select("story_id")
    .eq("story_id", storyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("story_sparks").delete().eq("story_id", storyId).eq("user_id", user.id);
    return { sparked: false };
  }

  await supabase.from("story_sparks").insert({ story_id: storyId, user_id: user.id });

  const { data: story } = await supabase.from("stories").select("user_id").eq("id", storyId).single();
  if (story && story.user_id !== user.id) {
    const name = user.user_metadata?.full_name || "Someone";
    const { sendPushToUser } = await import("@/lib/notifications/sendPush");
    sendPushToUser(story.user_id, "New reaction", `${name} reacted to your story`, "/home");
  }

  return { sparked: true };
}

export async function getStorySparkers(storyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("story_sparks")
    .select("user_id, profiles!story_sparks_user_id_fkey(full_name, username)")
    .eq("story_id", storyId);

  return (data || []).map((s: any) => {
    const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
    return profile?.username ? `@${profile.username}` : profile?.full_name || "Someone";
  });
}

export async function sendStoryReply(storyId: string, message: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { data: story } = await supabase
    .from("stories")
    .select("user_id, content_text, media_url, media_type")
    .eq("id", storyId)
    .single();

  if (!story || story.user_id === user.id) return { error: "Cannot reply to this" };

  const label = story.media_type === "video" ? "🎥 Video story" : story.media_url ? "📷 Photo story" : "Your story";

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: story.user_id,
    content: message,
    reply_to_content: story.content_text || label,
    reply_to_sender_name: "Your story",
    reply_thumbnail_url: story.media_type === "image" ? story.media_url : null,
  });

  return error ? { error: error.message } : { success: true };
}

export async function deleteStory(storyId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { error } = await supabase
    .from("stories")
    .delete()
    .eq("id", storyId)
    .eq("user_id", user.id);

  return error ? { error: error.message } : { success: true };
}