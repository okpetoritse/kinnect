"use client";

import { useSyncExternalStore } from "react";
import {
  getPushEnvironment,
  type PushEnvironment,
} from "@/lib/notifications/pushEnv";

const PUSH_ENVIRONMENT_CHANGE_EVENT = "kinnect:push-environment-change";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("focus", onStoreChange);
  document.addEventListener("visibilitychange", onStoreChange);
  window.addEventListener(PUSH_ENVIRONMENT_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("focus", onStoreChange);
    document.removeEventListener("visibilitychange", onStoreChange);
    window.removeEventListener(PUSH_ENVIRONMENT_CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot(): PushEnvironment | null {
  if (typeof window === "undefined") return null;
  return getPushEnvironment();
}

function getServerSnapshot(): null {
  return null;
}

export function usePushEnvironment() {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
}

export function notifyPushEnvironmentChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PUSH_ENVIRONMENT_CHANGE_EVENT));
  }
}