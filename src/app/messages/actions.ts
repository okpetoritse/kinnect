"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendPushToUser } from "@/lib/notifications/sendPush";
import { notifyNewMessage } from "@/lib/notifications/notifyNewMessage";

export async function getMessages(friendId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("messages")
            .select("id, sender_id, receiver_id, content, image_url, video_url, sticker_id, audio_url, audio_duration, is_burst, listing_id, listing_title, listing_price, listing_currency, listing_image_url, ping_label, reply_to_id, reply_to_content, reply_to_sender_name, call_type, call_status, call_duration, read_at, created_at")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }


    if (error) {
    console.error("getMessages failed:", error);
    return [];
  }

 
  return data;
}

export async function sendMessage(
  friendId: string,
  content: string,
  replyTo?: {
  id: string;
  content: string;
  senderName: string;
  thumbnailUrl?: string | null;
}
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !content.trim()) return { error: "Invalid message" };

  const { data: blocked } = await supabase
    .from("blocked_users")
    .select("id")
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${friendId}),and(blocker_id.eq.${friendId},blocked_id.eq.${user.id})`
    )
    .maybeSingle();

  if (blocked) {
    return { error: "You can't message this user" };
  }

  const { data: friendship } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
    )
    .maybeSingle();

  const { data: listingConvo } = await supabase
    .from("messages")
    .select("id")
    .not("listing_id", "is", null)
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
    )
    .maybeSingle();

  if (!friendship && !listingConvo) {
    return { error: "You can only message friends, or reply about a listing" };
  }

  const { error } = await supabase.from("messages").insert({
  sender_id: user.id,
  receiver_id: friendId,
  content: content.trim(),
  reply_to_id: replyTo?.id || null,
  reply_to_content: replyTo?.content || null,
  reply_to_sender_name: replyTo?.senderName || null,
  reply_thumbnail_url: replyTo?.thumbnailUrl || null, // <--- Add this
});

  if (error) return { error: error.message };

  revalidatePath(`/messages/${friendId}`);

    notifyNewMessage(user.id, friendId, content.slice(0, 100));

  return { success: true };
}



export async function sendImageMessage(friendId: string, imageUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { data: blocked } = await supabase
    .from("blocked_users")
    .select("id")
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${friendId}),and(blocker_id.eq.${friendId},blocked_id.eq.${user.id})`
    )
    .maybeSingle();

  if (blocked) {
    return { error: "You can't message this user" };
  }

  const { data: friendship } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
    )
    .maybeSingle();

  const { data: listingConvo } = await supabase
    .from("messages")
    .select("id")
    .not("listing_id", "is", null)
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
    )
    .maybeSingle();

  if (!friendship && !listingConvo) {
    return { error: "You can only message friends, or reply about a listing" };
  }

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    image_url: imageUrl,
  });

  if (error) return { error: error.message };

  revalidatePath(`/messages/${friendId}`);
  notifyNewMessage(user.id, friendId, "📷 Photo");

  return { success: true };
}

  export async function sendVideoNote(friendId: string, videoUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    video_url: videoUrl,
  });

  if (error) return { error: error.message };
  revalidatePath(`/messages/${friendId}`);
  notifyNewMessage(user.id, friendId, "🎥 Video");
  return { success: true };
}

export async function sendStickerMessage(friendId: string, stickerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { data: blocked } = await supabase
    .from("blocked_users")
    .select("id")
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${friendId}),and(blocker_id.eq.${friendId},blocked_id.eq.${user.id})`
    )
    .maybeSingle();

  if (blocked) {
    return { error: "You can't message this user" };
  }

  const { data: friendship } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
    )
    .maybeSingle();

  const { data: listingConvo } = await supabase
    .from("messages")
    .select("id")
    .not("listing_id", "is", null)
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
    )
    .maybeSingle();

  if (!friendship && !listingConvo) {
    return { error: "You can only message friends, or reply about a listing" };
  }

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    sticker_id: stickerId,
  });

  if (error) return { error: error.message };

  revalidatePath(`/messages/${friendId}`);
  notifyNewMessage(user.id, friendId, "Sent a sticker");
  return { success: true };
}

export async function sendVoiceNoteMessage(friendId: string, audioUrl: string, durationSeconds: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { data: blocked } = await supabase
    .from("blocked_users")
    .select("id")
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${friendId}),and(blocker_id.eq.${friendId},blocked_id.eq.${user.id})`
    )
    .maybeSingle();

  if (blocked) {
    return { error: "You can't message this user" };
  }

  const { data: friendship } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
    )
    .maybeSingle();

  const { data: listingConvo } = await supabase
    .from("messages")
    .select("id")
    .not("listing_id", "is", null)
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
    )
    .maybeSingle();

  if (!friendship && !listingConvo) {
    return { error: "You can only message friends, or reply about a listing" };
  }

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    audio_url: audioUrl,
    audio_duration: durationSeconds,
  });

  if (error) return { error: error.message };

  revalidatePath(`/messages/${friendId}`);
  notifyNewMessage(user.id, friendId, "🎤 Voice message");
  return { success: true };
}

export async function markMessagesRead(friendId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", friendId)
    .eq("receiver_id", user.id)
    .is("read_at", null);
}
export async function getMessagesFriendsPaginated(cursor?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { friends: [], nextCursor: null };

  const PAGE_SIZE = 20;

  let request = supabase
    .from("friend_requests")
        .select(
      "id, created_at, sender_id, receiver_id, sender:profiles!friend_requests_sender_id_fkey(id, full_name, username, avatar_url, founding_number), receiver:profiles!friend_requests_receiver_id_fkey(id, full_name, username, avatar_url, founding_number)"
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

  const friendIds = friends.map((f: any) => f.id);
  const { data: recentMessages } = friendIds.length
    ? await supabase
        .from("messages")
        .select("sender_id, receiver_id, content, image_url, video_url, sticker_id, audio_url, ping_label, created_at")
        .or(
          friendIds
            .map((fid: string) => `and(sender_id.eq.${user.id},receiver_id.eq.${fid}),and(sender_id.eq.${fid},receiver_id.eq.${user.id})`)
            .join(",")
        )
        .order("created_at", { ascending: false })
    : { data: [] };

  const lastMessageByFriend: Record<string, { preview: string; time: string }> = {};
  (recentMessages || []).forEach((m: any) => {
    const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
    if (lastMessageByFriend[otherId]) return;

    let preview = m.content || "";
    if (m.image_url) preview = "📷 Photo";
    if (m.video_url) preview = "🎥 Video";
    if (m.sticker_id) preview = "Sent a sticker";
    if (m.audio_url) preview = "🎤 Voice message";
    if (m.ping_label) preview = m.ping_label;

    lastMessageByFriend[otherId] = { preview, time: m.created_at };
  });

  const friendsWithPreview = friends.map((f: any) => ({
    ...f,
    lastMessagePreview: lastMessageByFriend[f.id]?.preview || "",
    lastMessageTime: lastMessageByFriend[f.id]?.time || null,
  }));

  const sortedFriends = [...friendsWithPreview].sort((a: any, b: any) => {
    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return timeB - timeA;
  });

  const nextCursor = data.length === PAGE_SIZE ? data[data.length - 1].created_at : null;

  return { friends: sortedFriends, nextCursor };
}

export async function sendPing(friendId: string, pingLabel: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { data: blocked } = await supabase
    .from("blocked_users")
    .select("id")
    .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${friendId}),and(blocker_id.eq.${friendId},blocked_id.eq.${user.id})`)
    .maybeSingle();
  if (blocked) return { error: "You can't message this user" };

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    content: null,
    ping_label: pingLabel,
  });

  if (error) return { error: error.message };
  revalidatePath(`/messages/${friendId}`);
  notifyNewMessage(user.id, friendId, pingLabel);
  return { success: true };
}

export async function toggleMessageReaction(messageId: string, emoji: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id, emoji")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("message_reactions").delete().eq("id", existing.id);
    if (existing.emoji === emoji) return { removed: true };
  }

  await supabase.from("message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
  return { emoji };
}

export async function getMessageReactions(messageIds: string[]) {
  if (messageIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_reactions")
    .select("message_id, user_id, emoji")
    .in("message_id", messageIds);
  return data || [];
}

export async function sendVoiceBurst(friendId: string, audioUrl: string, durationSeconds: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    audio_url: audioUrl,
    audio_duration: durationSeconds,
    is_burst: true,
  });

  if (error) return { error: error.message };
  revalidatePath(`/messages/${friendId}`);
  notifyNewMessage(user.id, friendId, "💥 Voice burst");
  return { success: true };
}

export async function notifyIncomingCall(friendId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const name = user.user_metadata?.full_name || "Someone";
  await sendPushToUser(friendId, "Incoming call 📞", `${name} is calling you`, `/messages/${user.id}`);
}
export async function logCallMessage(
  friendId: string,
  callType: "audio" | "video",
  callStatus: "completed" | "missed" | "declined",
  duration: number
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    call_type: callType,
    call_status: callStatus,
    call_duration: duration,
  });

  if (error) return { error: error.message };
  revalidatePath(`/messages/${friendId}`);
  return { success: true };
}

export async function markChatActive(friendId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("active_chat_views").upsert(
    {
      user_id: user.id,
      chat_with_user_id: friendId,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,chat_with_user_id" }
  );
}
export async function sendMediaCollection(
  friendId: string,
  caption: string,
  mediaItems: { url: string; type: "image" | "video" }[],
  replyTo?: { id: string; content: string; senderName: string }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { data: friendship } = await supabase
    .from("friend_requests")
    .select("id")
    .eq("status", "accepted")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
    )
    .maybeSingle();

  if (!friendship) return { error: "You can only message friends" };

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      sender_id: user.id,
      receiver_id: friendId,
      content: caption || null,
      reply_to_id: replyTo?.id || null,
      reply_to_content: replyTo?.content || null,
      reply_to_sender_name: replyTo?.senderName || null,
    })
    .select("id")
    .single();

  if (error || !message) return { error: error?.message || "Could not send" };

  const { error: mediaError } = await supabase.from("message_media").insert(
    mediaItems.map((m, i) => ({
      message_id: message.id,
      media_url: m.url,
      media_type: m.type,
      position: i,
    }))
  );

  if (mediaError) return { error: mediaError.message };

  revalidatePath(`/messages/${friendId}`);
    notifyNewMessage(
    user.id,
    friendId,
    mediaItems.length === 1
      ? mediaItems[0].type === "video"
        ? "🎥 Video"
        : "📷 Photo"
      : `📷 ${mediaItems.length} photos & videos`
  );
  return { success: true, messageId: message.id };
}

export async function getMessageMediaBatch(messageIds: string[]) {
  if (messageIds.length === 0) return {};
  const supabase = await createClient();

  const { data } = await supabase
    .from("message_media")
    .select("message_id, media_url, media_type, position")
    .in("message_id", messageIds)
    .order("position", { ascending: true });

  const byMessage: Record<string, { url: string; type: "image" | "video" }[]> = {};
  (data || []).forEach((row) => {
    if (!byMessage[row.message_id]) byMessage[row.message_id] = [];
    byMessage[row.message_id].push({ url: row.media_url, type: row.media_type as any });
  });
  return byMessage;
}

export async function deleteMessage(messageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("sender_id", user.id);

  if (error) return { error: error.message };
  return { success: true };
}