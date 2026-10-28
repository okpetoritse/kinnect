"use client";

import { createClient } from "@/lib/supabase/client";
import { saveSubscription } from "@/app/notifications/actions";
import {
  getPushEnvironment,
  urlBase64ToUint8Array,
} from "@/lib/notifications/pushEnv";

export type PushRegistrationResult =
  | { success: true }
  | { success: false; message: string };

type SubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

let registrationInFlight: Promise<PushRegistrationResult> | null = null;

export function ensurePushSubscription(
  requestPermission = false
): Promise<PushRegistrationResult> {
  if (registrationInFlight) return registrationInFlight;

  registrationInFlight = registerPushSubscription(requestPermission).finally(
    () => {
      registrationInFlight = null;
    }
  );

  return registrationInFlight;
}

async function registerPushSubscription(
  requestPermission: boolean
): Promise<PushRegistrationResult> {
  if (typeof window === "undefined") {
    return { success: false, message: "Notifications require a browser." };
  }

  const environment = getPushEnvironment();

  if (environment === "unsupported") {
    return {
      success: false,
      message: "This browser does not support Kinnect push notifications.",
    };
  }

  if (environment === "ios-needs-install") {
    return {
      success: false,
      message: "Install Kinnect on your iPhone Home Screen first.",
    };
  }

  if (!("Notification" in window)) {
    return {
      success: false,
      message: "Notifications are not supported in this browser.",
    };
  }

  let permission = Notification.permission;

  if (requestPermission && permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return {
      success: false,
      message:
        permission === "denied"
          ? "Notifications are blocked in your browser settings."
          : "Allow notifications to continue.",
    };
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return {
      success: false,
      message: "Kinnect notifications are not configured on this deployment.",
    };
  }

  const supabase = createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  const userId = session?.user.id;

  if (sessionError || !userId) {
    return {
      success: false,
      message: "Sign in to connect notifications.",
    };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const serialized = subscription.toJSON();

  if (
    !serialized.endpoint ||
    !serialized.keys?.p256dh ||
    !serialized.keys?.auth
  ) {
    return {
      success: false,
      message: "The browser returned an incomplete push subscription.",
    };
  }

  const payload: SubscriptionPayload = {
    endpoint: serialized.endpoint,
    keys: {
      p256dh: serialized.keys.p256dh,
      auth: serialized.keys.auth,
    },
  };

  const result = await saveSubscription(payload);

  if (result?.error) {
    return { success: false, message: result.error };
  }

  return { success: true };
}