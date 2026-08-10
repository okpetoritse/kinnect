"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getMessages(friendId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, receiver_id, content, image_url, sticker_id, audio_url, audio_duration, created_at")
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

  const { error } = await supabase.from("messages").insert({
    sender_id: user.id,
    receiver_id: friendId,
    content: content.trim(),
  });

  if (error) return { error: error.message };

  revalidatePath(`/messages/${friendId}`);
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