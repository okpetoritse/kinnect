import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestSiteOrigin } from "@/lib/notifications/requestSiteOrigin";

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
  url: string = "/",
  tag?: string,
  extra?: Record<string, unknown>
) {
  if (!ensureConfigured()) return;

  const siteOrigin = await getRequestSiteOrigin();
  if (!siteOrigin) {
    console.error("[PUSH] Could not determine request origin; skipping delivery.");
    return;
  }

  const supabase = createAdminClient();

  const { data: matchingSubs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .eq("site_origin", siteOrigin);

  if (error) {
    console.error(`[PUSH] Subscription lookup failed for user ${userId}:`, error);
    return;
  }

  let subs = matchingSubs ?? [];

  // Temporary compatibility for subscriptions created before site_origin existed.
  // Only the canonical Production deployment may use unclassified legacy rows.
  if (siteOrigin === "https://kinnect-mu.vercel.app") {
    const { data: legacySubs, error: legacyError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId)
      .is("site_origin", null);

    if (legacyError) {
      console.error("[PUSH] Legacy subscription lookup failed:", legacyError);
    } else {
      const uniqueSubs = new Map(
        [...subs, ...(legacySubs ?? [])].map((sub) => [sub.id, sub])
      );
      subs = [...uniqueSubs.values()];
    }
  }

  console.log(`[PUSH] Looking up subscriptions for user ${userId}:`, {
    found: subs.length,
  });

  if (subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const result = await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title, body, url, ...(tag ? { tag } : {}), ...(extra ?? {}) })
        );
        console.log(`[PUSH] Sent successfully to endpoint ending in ...${sub.endpoint.slice(-12)}`, result.statusCode);
      } catch (err: unknown) {
        const pushError = err as { statusCode?: number; body?: unknown; message?: string };
        console.error(`[PUSH] FAILED to send to endpoint ending in ...${sub.endpoint.slice(-12)}:`, {
          statusCode: pushError.statusCode,
          message: pushError.body ?? pushError.message ?? String(err),
        });
        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}