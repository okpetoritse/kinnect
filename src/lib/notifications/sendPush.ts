import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configured = false;

function ensureConfigured() {
  if (configured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    console.warn("[PUSH] VAPID keys not configured — notifications disabled.");
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

  const supabase = createAdminClient();

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  console.log(`[PUSH] Looking up subscriptions for user ${userId}:`, {
    found: subs?.length || 0,
    error,
  });

  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const result = await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title, body, url })
        );
        console.log(`[PUSH] Sent successfully to endpoint ending in ...${sub.endpoint.slice(-12)}`, result.statusCode);
      } catch (err: any) {
        console.error(`[PUSH] FAILED to send to endpoint ending in ...${sub.endpoint.slice(-12)}:`, {
          statusCode: err.statusCode,
          message: err.body || err.message,
        });
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}