"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function blockUser(targetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { error } = await supabase.from("blocked_users").insert({
    blocker_id: user.id,
    blocked_id: targetId,
  });

  if (error) return { error: error.message };

  revalidatePath("/messages");
  revalidatePath(`/messages/${targetId}`);
  return { success: true };
}

export async function unblockUser(targetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetId);

  if (error) return { error: error.message };

  revalidatePath(`/messages/${targetId}`);
  return { success: true };
}

export async function checkBlockStatus(otherUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { iBlockedThem: false, theyBlockedMe: false };

  const { data: iBlocked } = await supabase
    .from("blocked_users")
    .select("id")
    .eq("blocker_id", user.id)
    .eq("blocked_id", otherUserId)
    .maybeSingle();

  const { data: theyBlocked } = await supabase
    .from("blocked_users")
    .select("id")
    .eq("blocker_id", otherUserId)
    .eq("blocked_id", user.id)
    .maybeSingle();

  return {
    iBlockedThem: !!iBlocked,
    theyBlockedMe: !!theyBlocked,
  };
}

export async function reportUser(
  targetId: string,
  reason: string,
  details: string,
  messageId?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_user_id: targetId,
    reported_message_id: messageId || null,
    reason,
    details: details || null,
  });

  if (error) return { error: error.message };

  return { success: true };
}