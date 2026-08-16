"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendPushToUser } from "@/lib/notifications/sendPush";

export async function getMessages(friendId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, receiver_id, content, image_url, sticker_id, audio_url, audio_duration, listing_id, listing_title, listing_price, listing_currency, listing_image_url, ping_label, is_burst, created_at")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}

export async function sendMessage(friendId: string, content: string) {
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
  });

  if (error) return { error: error.message };

  revalidatePath(`/messages/${friendId}`);
  sendPushToUser(friendId, "New message", content.slice(0, 100), `/messages/${user.id}`);
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