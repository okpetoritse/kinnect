"use server";

import { createClient } from "@/lib/supabase/server";
import { getRequestSiteOrigin } from "@/lib/notifications/requestSiteOrigin";

export async function saveSubscription(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const siteOrigin = await getRequestSiteOrigin();
  if (!siteOrigin) {
    return { error: "Could not determine the current site origin." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in" };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      site_origin: siteOrigin,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) return { error: error.message };
  return { success: true };
}

export async function removeSubscription(endpoint: string) {
  if (
    typeof endpoint !== "string" ||
    endpoint.length === 0 ||
    endpoint.length > 4096
  ) {
    return { error: "Invalid subscription endpoint" };
  }

  let parsedEndpoint: URL;

  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    return { error: "Invalid subscription endpoint" };
  }

  if (parsedEndpoint.protocol !== "https:") {
    return { error: "Invalid subscription endpoint" };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not logged in" };
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  if (error) {
    return { error: "Could not remove the notification subscription" };
  }

  return { success: true };
}