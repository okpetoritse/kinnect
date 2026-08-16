"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { saveSubscription } from "@/app/notifications/actions";
import styles from "./NotificationPrompt.module.css";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function NotificationPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "default") {
      const dismissed = localStorage.getItem("notif_prompt_dismissed");
      if (!dismissed) setShow(true);
    }
  }, []);

  async function handleEnable() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setShow(false);
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ),
    });

    await saveSubscription(subscription.toJSON() as any);
    setShow(false);
  }

  function handleDismiss() {
    localStorage.setItem("notif_prompt_dismissed", "true");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className={styles.banner}>
      <Bell size={16} />
      <span className={styles.text}>Turn on notifications for messages & calls</span>
      <button className={styles.enableBtn} onClick={handleEnable}>
        Enable
      </button>
      <button className={styles.closeBtn} onClick={handleDismiss}>
        <X size={14} />
      </button>
    </div>
  );
}