"use client";

import { useEffect, useState } from "react";
import { saveSubscription } from "@/app/notifications/actions";
import styles from "./page.module.css";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function NotificationToggle() {
  const [status, setStatus] = useState<"unsupported" | "default" | "granted" | "denied">("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as any);
  }, []);

  async function handleEnable() {
    const permission = await Notification.requestPermission();
    setStatus(permission as any);

    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });

    await saveSubscription(subscription.toJSON() as any);
  }

  if (status === "unsupported") return null;

  if (status === "granted") {
    return <button className={styles.notifBtn} disabled>🔔 Notifications enabled</button>;
  }

  if (status === "denied") {
    return (
      <button className={styles.notifBtn} disabled style={{ color: "var(--coral)" }}>
        🔕 Notifications blocked — enable in your browser's site settings
      </button>
    );
  }

  return (
    <button className={styles.notifBtn} onClick={handleEnable}>
      🔔 Turn on notifications
    </button>
  );
}