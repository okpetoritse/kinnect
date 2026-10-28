"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getPushEnvironment } from "@/lib/notifications/pushEnv";
import { ensurePushSubscription } from "@/lib/notifications/registerPushSubscription";

export default function PushSync() {
  const pathname = usePathname();

  useEffect(() => {
    if (getPushEnvironment() !== "granted") return;

    let active = true;

    void ensurePushSubscription()
      .then((result) => {
        if (
          active &&
          !result.success &&
          result.message !== "Sign in to connect notifications."
        ) {
          console.warn("[PUSH] Subscription sync did not complete:", result.message);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          console.error("[PUSH] Subscription sync failed:", error);
        }
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}