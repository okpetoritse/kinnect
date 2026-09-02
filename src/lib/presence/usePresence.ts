"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_INTERVAL_MS = 15000;
const STALE_AFTER_MS = 30000;

export function usePresence(currentUserId: string) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUserId) return;

    const supabase = createClient();
    const channel = supabase.channel("presence:online-users", {
      config: { presence: { key: currentUserId } },
    });

    function recomputeOnline() {
      const state = channel.presenceState();
      const now = Date.now();
      const fresh = new Set<string>();

      Object.entries(state).forEach(([userId, entries]: [string, any]) => {
        const latest = entries[0]?.online_at;
        if (latest && now - new Date(latest).getTime() < STALE_AFTER_MS) {
          fresh.add(userId);
        }
      });

      setOnlineIds(fresh);
    }

    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    async function trackPresence() {
      await channel.track({ online_at: new Date().toISOString() });
    }

    channel
      .on("presence", { event: "sync" }, recomputeOnline)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await trackPresence();
          heartbeatInterval = setInterval(trackPresence, HEARTBEAT_INTERVAL_MS);
        }
      });

    // Recompute periodically too, so a stale entry ages out of "online"
    // even if nobody else triggers a fresh sync event in the meantime.
    const stalenessCheck = setInterval(recomputeOnline, HEARTBEAT_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        trackPresence();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      clearInterval(stalenessCheck);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return onlineIds;
}