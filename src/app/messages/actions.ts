"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendPushToUser } from "@/lib/notifications/sendPush";
import { notifyNewMessage } from "@/lib/notifications/notifyNewMessage";
import { assertCanMessage } from "@/lib/messaging/assertCanMessage";

export async function getMessages(friendId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("messages")
            .select(
  "id, sender_id, receiver_id, content, image_url, video_url, sticker_id, audio_url, audio_duration, is_burst, listing_id, listing_title, listing_price, listing_currency, listing_image_url, listing_business_id, listing_business_name, ping_label, reply_to_id, reply_to_content, reply_to_sender_name, call_type, call_status, call_duration, read_at, created_at"
)
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
  const text = content.trim();

  if (!text) {
    return { error: "Invalid message" };
  }

  const supabase = await createClient();

  const guard = await assertCanMessage(supabase, friendId);

  if (!guard.ok) {
    return { error: guard.error };
  }

  const { user } = guard;

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    content: text,
    reply_to_id: replyTo?.id || null,
    reply_to_content: replyTo?.content || null,
    reply_to_sender_name: replyTo?.senderName || null,
    reply_thumbnail_url: replyTo?.thumbnailUrl || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/messages/${friendId}`);

  notifyNewMessage(user.id, friendId, text.slice(0, 100));

  return { success: true };
}



export async function sendImageMessage(
  friendId: string,
  imageUrl: string
) {
  const supabase = await createClient();

  const guard = await assertCanMessage(supabase, friendId);

  if (!guard.ok) {
    return { error: guard.error };
  }

  const { user } = guard;

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    image_url: imageUrl,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/messages/${friendId}`);

  notifyNewMessage(user.id, friendId, "📷 Photo");

  return { success: true };
}

export async function sendVideoNote(
  friendId: string,
  videoUrl: string
) {
  const supabase = await createClient();

  const guard = await assertCanMessage(supabase, friendId);

  if (!guard.ok) {
    return { error: guard.error };
  }

  const { user } = guard;

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    video_url: videoUrl,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/messages/${friendId}`);
  notifyNewMessage(user.id, friendId, "🎥 Video");

  return { success: true };
}

export async function sendStickerMessage(
  friendId: string,
  stickerId: string
) {
  const supabase = await createClient();

  const guard = await assertCanMessage(supabase, friendId);

  if (!guard.ok) {
    return { error: guard.error };
  }

  const { user } = guard;

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    sticker_id: stickerId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/messages/${friendId}`);
  notifyNewMessage(user.id, friendId, "Sent a sticker");

  return { success: true };
}

export async function sendVoiceNoteMessage(
  friendId: string,
  audioUrl: string,
  durationSeconds: number
) {
  const supabase = await createClient();

  const guard = await assertCanMessage(supabase, friendId);

  if (!guard.ok) {
    return { error: guard.error };
  }

  const { user } = guard;

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    audio_url: audioUrl,
    audio_duration: durationSeconds,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/messages/${friendId}`);
  notifyNewMessage(user.id, friendId, "🎤 Voice message");

  return { success: true };
}

export async function markMessagesRead(friendId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return;

  const { error } = await supabase.rpc("mark_messages_read", {
    p_sender_id: friendId,
  });

  if (error) {
    console.error("[markMessagesRead] Failed:", error.message);
  }
}
type MessageInboxRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  founding_number: number | string | null;
  last_message_preview: string | null;
  last_message_time: string | null;
  unread_count: number | string | null;
  cursor_at: string;
};

export async function getMessagesFriendsPaginated(cursor?: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { friends: [], nextCursor: null };
  }

  const PAGE_SIZE = 20;
  let cursorAt: string | null = null;
  let cursorUserId: string | null = null;

  if (cursor) {
    const separator = cursor.lastIndexOf("|");

    if (separator === -1) {
      return { friends: [], nextCursor: null };
    }

    cursorAt = cursor.slice(0, separator);
    cursorUserId = cursor.slice(separator + 1);

    const cursorDate = new Date(cursorAt);

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      Number.isNaN(cursorDate.getTime()) ||
      !uuidPattern.test(cursorUserId)
    ) {
      return { friends: [], nextCursor: null };
    }
  }

  const rpcClient = supabase as unknown as {
    rpc: (
      name: string,
      args: {
        p_cursor_at: string | null;
        p_cursor_user_id: string | null;
        p_page_size: number;
      }
    ) => Promise<{
      data: MessageInboxRow[] | null;
      error: { message: string } | null;
    }>;
  };

  const { data, error } = await rpcClient.rpc(
    "get_my_message_inbox",
    {
      p_cursor_at: cursorAt,
      p_cursor_user_id: cursorUserId,
      p_page_size: PAGE_SIZE,
    }
  );

  if (error || !data) {
    console.error("Could not load unified message inbox:", error);

    return { friends: [], nextCursor: null };
  }

  const friends = data.map((row) => ({
    id: row.id,
    full_name: row.full_name,
    username: row.username,
    avatar_url: row.avatar_url,
    founding_number:
      row.founding_number == null
        ? null
        : Number(row.founding_number),
    lastMessagePreview: row.last_message_preview || "",
    lastMessageTime: row.last_message_time,
    unreadCount: Number(row.unread_count || 0),
  }));

  const lastRow = data[data.length - 1];

  const nextCursor =
    data.length === PAGE_SIZE && lastRow
      ? `${lastRow.cursor_at}|${lastRow.id}`
      : null;

  return { friends, nextCursor };
}

export async function sendPing(
  friendId: string,
  pingLabel: string
) {
  const supabase = await createClient();

  const guard = await assertCanMessage(supabase, friendId);

  if (!guard.ok) {
    return { error: guard.error };
  }

  const { user } = guard;

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    content: null,
    ping_label: pingLabel,
  });

  if (error) {
    return { error: error.message };
  }

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

export async function sendVoiceBurst(
  friendId: string,
  audioUrl: string,
  durationSeconds: number
) {
  const supabase = await createClient();

  const guard = await assertCanMessage(supabase, friendId);

  if (!guard.ok) {
    return { error: guard.error };
  }

  const { user } = guard;

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    audio_url: audioUrl,
    audio_duration: durationSeconds,
    is_burst: true,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/messages/${friendId}`);
  notifyNewMessage(user.id, friendId, "💥 Voice burst");

  return { success: true };
}

export async function notifyIncomingCall(friendId: string) {
  const supabase = await createClient();

  const guard = await assertCanMessage(supabase, friendId);

  if (!guard.ok) {
    return { error: guard.error };
  }

  const { user } = guard;

  const name = user.user_metadata?.full_name || "Someone";

  await sendPushToUser(
    friendId,
    "Incoming call 📞",
    `${name} is calling you`,
    `/messages/${user.id}`
  );

  return { success: true };
}

export async function logCallMessage(
  friendId: string,
  callType: "audio" | "video",
  callStatus: "completed" | "missed" | "declined",
  duration: number
) {
  const supabase = await createClient();

  const guard = await assertCanMessage(supabase, friendId);

  if (!guard.ok) {
    return { error: guard.error };
  }

  const { user } = guard;

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    call_type: callType,
    call_status: callStatus,
    call_duration: duration,
  });

  if (error) {
    return { error: error.message };
  }

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
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  }
) {
  const supabase = await createClient();

  const guard = await assertCanMessage(supabase, friendId);

  if (!guard.ok) {
    return { error: guard.error };
  }

  const { user } = guard;

  if (!mediaItems.length) {
    return { error: "No media selected" };
  }

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

  if (error || !message) {
    return { error: error?.message || "Could not send" };
  }

  const { error: mediaError } = await supabase
    .from("message_media")
    .insert(
      mediaItems.map((media, index) => ({
        message_id: message.id,
        media_url: media.url,
        media_type: media.type,
        position: index,
      }))
    );

  if (mediaError) {
    return { error: mediaError.message };
  }

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
  if (!byMessage[row.message_id]) {
    byMessage[row.message_id] = [];
  }

  if (row.media_type !== "image" && row.media_type !== "video") {
    return;
  }

  byMessage[row.message_id].push({
    url: row.media_url,
    type: row.media_type,
  });
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