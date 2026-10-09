"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveSubscription } from "@/app/notifications/actions";
import { getPushEnvironment, urlBase64ToUint8Array } from "@/lib/notifications/pushEnv";

// If permission is already granted but the browser has no (or an expired)
// push subscription, quietly create one and save it. No prompt needed.
export default function PushSync() {
  const pathname = usePathname();

  useEffect(() => {
    if (getPushEnvironment() !== "granted") return;
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) return;

    let cancelled = false;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;
        if (sessionStorage.getItem("push_synced_user") === userId) return;

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
          });
        }
        if (cancelled) return;

        const result = await saveSubscription(subscription.toJSON() as any);
        if (!result?.error) sessionStorage.setItem("push_synced_user", userId);
      } catch (err) {
        console.error("Push sync failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}