export type PushEnvironment =
  | "ios-needs-install"
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

// Browser-only: call inside an effect, never during server render.
export function getPushEnvironment(): PushEnvironment {
  const ua = navigator.userAgent;
  const isIos =
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;

  if (isIos && !standalone) return "ios-needs-install";

  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}