"use client";

import { useEffect, useState } from "react";
import { saveSubscription } from "@/app/notifications/actions";
import { getPushEnvironment, urlBase64ToUint8Array, type PushEnvironment } from "@/lib/notifications/pushEnv";
import styles from "./page.module.css";

export default function NotificationToggle() {
  const [env, setEnv] = useState<PushEnvironment | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnv(getPushEnvironment());
  }, []);

  async function handleEnable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEnv(getPushEnvironment());
        return;
      }

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        alert("Notifications aren't configured yet.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const result = await saveSubscription(subscription.toJSON() as any);
      if (result?.error) alert("Could not save subscription: " + result.error);
      else {
        setEnv("granted");
        alert("Notifications connected ✅");
      }
    } catch (err: any) {
      alert("Setup failed: " + (err?.message || String(err)));
    } finally {
      setBusy(false);
    }
  }

  if (env === null) return null;

  if (env === "ios-needs-install") {
    return (
      <div className={styles.notifBtn} style={{ lineHeight: 1.5 }}>
        🔔 On iPhone, notifications only work from the installed app. Tap Share, then &quot;Add to Home Screen&quot;, and open Kinnect from there.
      </div>
    );
  }

  if (env === "unsupported") {
    return (
      <div className={styles.notifBtn} style={{ lineHeight: 1.5 }}>
        🔕 This browser doesn&apos;t support notifications. Try Chrome on Android, or install Kinnect to your home screen.
      </div>
    );
  }

  if (env === "denied") {
    return (
      <button className={styles.notifBtn} disabled style={{ color: "var(--coral)" }}>
        🔕 Notifications blocked — enable them in your browser&apos;s site settings
      </button>
    );
  }

  return (
    <button className={styles.notifBtn} onClick={handleEnable} disabled={busy}>
      {busy
        ? "Connecting..."
        : env === "granted"
        ? "🔔 Notifications enabled — tap to reconnect"
        : "🔔 Turn on notifications"}
    </button>
  );
}