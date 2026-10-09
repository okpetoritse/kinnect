import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "./sendPush";

const ACTIVE_WINDOW_MS = 15000;

export function notifyNewMessage(senderId: string, receiverId: string, preview: string) {
  after(async () => {
    try {
      const admin = createAdminClient();
      const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();

      // Is the RECIPIENT looking at the chat with the SENDER right now?
      // active_chat_views is RLS-locked to each user's own row, so only the
      // admin client can read the recipient's row.
      const { data: viewing } = await admin
        .from("active_chat_views")
        .select("user_id")
        .eq("user_id", receiverId)
        .eq("chat_with_user_id", senderId)
        .gte("last_seen_at", since)
        .maybeSingle();

      if (viewing) return;

      const { data: sender } = await admin
        .from("profiles")
        .select("username")
        .eq("id", senderId)
        .maybeSingle();

      const title = sender?.username ? `@${sender.username}` : "New message";
      await sendPushToUser(receiverId, title, preview, `/messages/${senderId}`);
    } catch (err) {
      console.error("[PUSH] notifyNewMessage failed:", err);
    }
  });
}