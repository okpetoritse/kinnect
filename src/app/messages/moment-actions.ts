"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function getOrCreateMoment(friendId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [userA, userB] = sortedPair(user.id, friendId);

  const { data: existing } = await supabase
    .from("shared_moments")
    .select("id, title, created_at")
    .eq("user_a", userA)
    .eq("user_b", userB)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("shared_moments")
    .insert({ user_a: userA, user_b: userB })
    .select("id, title, created_at")
    .single();

  if (error) {
    console.error(error);
    return null;
  }
  return created;
}

export async function getMomentItems(momentId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shared_moment_items")
    .select("id, author_id, type, content_text, media_url, media_duration, created_at, author:profiles!shared_moment_items_author_id_fkey(id, full_name, avatar_url)")
    .eq("moment_id", momentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  return data.map((item: any) => ({
    ...item,
    author: Array.isArray(item.author) ? item.author[0] : item.author,
  }));
}

export async function addMomentItem(
  momentId: string,
  type: "photo" | "video" | "note" | "voice",
  data: { contentText?: string; mediaUrl?: string; mediaDuration?: number }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { error } = await supabase.from("shared_moment_items").insert({
    moment_id: momentId,
    author_id: user.id,
    type,
    content_text: data.contentText || null,
    media_url: data.mediaUrl || null,
    media_duration: data.mediaDuration || null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/messages`);
  return { success: true };
}