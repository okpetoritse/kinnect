"use client";

import { useSyncExternalStore } from "react";
import { Bell, X } from "lucide-react";
import { ensurePushSubscription } from "@/lib/notifications/registerPushSubscription";
import { notifyPushEnvironmentChanged, usePushEnvironment } from "@/lib/notifications/usePushEnvironment";
import styles from "./NotificationPrompt.module.css";

const DISMISS_KEY = "notif_prompt_dismissed_at";
const REASK_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const DISMISS_CHANGE_EVENT = "kinnect:notification-prompt-dismissed";

function subscribeToDismissal(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(DISMISS_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(DISMISS_CHANGE_EVENT, onStoreChange);
  };
}

function getDismissedSnapshot() {
  if (typeof window === "undefined") return true;

  try {
    const timestamp = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return timestamp > 0 && Date.now() - timestamp < REASK_AFTER_MS;
  } catch {
    return false;
  }
}

function getDismissedServerSnapshot() {
  return true;
}

export default function NotificationPrompt() {
  const env = usePushEnvironment();

  const dismissed = useSyncExternalStore(
    subscribeToDismissal,
    getDismissedSnapshot,
    getDismissedServerSnapshot
  );

  async function handleEnable() {
    try {
      const result = await ensurePushSubscription(true);
      notifyPushEnvironmentChanged();

      if (!result.success) {
        window.alert(result.message);
      }
    } catch (error) {
      console.error("[PUSH] Enable notifications failed:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Could not enable Kinnect notifications."
      );
    }
  }

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (error) {
      console.warn("[PUSH] Could not save prompt dismissal:", error);
    }

    window.dispatchEvent(new Event(DISMISS_CHANGE_EVENT));
  }

  if (dismissed || (env !== "default" && env !== "ios-needs-install")) {
    return null;
  }

  return (
    <div className={styles.banner} role="region" aria-label="Notifications">
      <Bell size={16} />

      {env === "ios-needs-install" ? (
        <span className={styles.text}>
          To get notifications on iPhone, tap Share, then
          &quot;Add to Home Screen&quot;, and open Kinnect from there.
        </span>
      ) : (
        <>
          <span className={styles.text}>
            Turn on notifications for messages &amp; calls
          </span>
          <button className={styles.enableBtn} onClick={handleEnable}>
            Enable
          </button>
        </>
      )}

      <button
        className={styles.closeBtn}
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}