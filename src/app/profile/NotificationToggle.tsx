"use client";

import { useState } from "react";
import { ensurePushSubscription } from "@/lib/notifications/registerPushSubscription";
import {
  notifyPushEnvironmentChanged,
  usePushEnvironment,
} from "@/lib/notifications/usePushEnvironment";
import styles from "./page.module.css";

export default function NotificationToggle() {
  const env = usePushEnvironment();
  const [busy, setBusy] = useState(false);

  async function handleEnable() {
    setBusy(true);

    try {
      const result = await ensurePushSubscription(true);
      notifyPushEnvironmentChanged();

      if (!result.success) {
        window.alert(result.message);
        return;
      }

      window.alert("Kinnect notifications are connected on this device.");
    } catch (error) {
      console.error("[PUSH] Notification setup failed:", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Could not connect Kinnect notifications."
      );
    } finally {
      setBusy(false);
    }
  }

  if (env === null) return null;

  if (env === "ios-needs-install") {
    return (
      <div className={styles.notifBtn} style={{ lineHeight: 1.5 }}>
        On iPhone, notifications require the installed app. Tap Share, then
        &quot;Add to Home Screen&quot;, and open Kinnect from there.
      </div>
    );
  }

  if (env === "unsupported") {
    return (
      <div className={styles.notifBtn} style={{ lineHeight: 1.5 }}>
        This browser doesn&apos;t support notifications. Try a supported
        browser or install Kinnect to your Home Screen.
      </div>
    );
  }

  if (env === "denied") {
    return (
      <button
        className={styles.notifBtn}
        disabled
        style={{ color: "var(--coral)" }}
      >
        Notifications are blocked. Enable them in your browser&apos;s site
        settings.
      </button>
    );
  }

  return (
    <button
      className={styles.notifBtn}
      onClick={handleEnable}
      disabled={busy}
    >
      {busy
        ? "Connecting..."
        : env === "granted"
          ? "Notifications enabled — tap to reconnect"
          : "Turn on notifications"}
    </button>
  );
}