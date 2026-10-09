"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { saveSubscription } from "@/app/notifications/actions";
import { getPushEnvironment, urlBase64ToUint8Array, type PushEnvironment } from "@/lib/notifications/pushEnv";
import styles from "./NotificationPrompt.module.css";

const DISMISS_KEY = "notif_prompt_dismissed_at";
const REASK_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export default function NotificationPrompt() {
  const [env, setEnv] = useState<PushEnvironment | null>(null);
  const [dismissed, setDismissed] = useState(true);

  // Read browser state after mount so server and client render the same HTML.
  useEffect(() => {
    setEnv(getPushEnvironment());
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    setDismissed(Date.now() - at < REASK_AFTER_MS);
  }, []);

  async function handleEnable() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setEnv(getPushEnvironment());
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        }));
      await saveSubscription(subscription.toJSON() as any);
      setEnv("granted");
    } catch (err) {
      console.error("Enable notifications failed:", err);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  if (dismissed || (env !== "default" && env !== "ios-needs-install")) return null;

  return (
    <div className={styles.banner} role="region" aria-label="Notifications">
      <Bell size={16} />
      {env === "ios-needs-install" ? (
        <span className={styles.text}>
          To get notifications on iPhone, tap Share, then &quot;Add to Home Screen&quot;, and open Kinnect from there.
        </span>
      ) : (
        <>
          <span className={styles.text}>Turn on notifications for messages &amp; calls</span>
          <button className={styles.enableBtn} onClick={handleEnable}>
            Enable
          </button>
        </>
      )}
      <button className={styles.closeBtn} onClick={handleDismiss} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}