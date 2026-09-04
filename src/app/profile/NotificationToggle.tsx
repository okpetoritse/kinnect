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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as any);
  }, []);

  async function handleEnable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setStatus(permission as any);

      if (permission !== "granted") {
        setBusy(false);
        return;
      }

      if (!("serviceWorker" in navigator)) {
        alert("This browser doesn't support service workers.");
        setBusy(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
      }

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        alert("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY — this needs to be set in Vercel.");
        setBusy(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const result = await saveSubscription(subscription.toJSON() as any);

      if (result?.error) {
        alert("Could not save subscription: " + result.error);
      } else {
        alert("Notifications connected successfully ✅");
      }
    } catch (err: any) {
      alert("Setup failed: " + (err?.message || String(err)));
      console.error("Notification setup error:", err);
    } finally {
      setBusy(false);
    }
  }

  if (status === "unsupported") return null;

  if (status === "denied") {
    return (
      <button className={styles.notifBtn} disabled style={{ color: "var(--coral)" }}>
        🔕 Notifications blocked — enable in your browser's site settings
      </button>
    );
  }

  return (
    <button className={styles.notifBtn} onClick={handleEnable} disabled={busy}>
      {busy
        ? "Connecting..."
        : status === "granted"
        ? "🔔 Notifications enabled — tap to reconnect"
        : "🔔 Turn on notifications"}
    </button>
  );
}