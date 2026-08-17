import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

let configured = false;

function ensureConfigured() {
  if (configured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    console.warn("VAPID keys not configured — push notifications are disabled.");
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url: string = "/"
) {
  if (!ensureConfigured()) return;

  const supabase = await createClient();

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title, body, url })
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("Push failed:", err);
        }
      }
    })
  );
}