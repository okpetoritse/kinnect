"use client";

import { useState } from "react";
import { getReelEntries } from "@/app/reels/actions";
import Avatar from "@/components/Avatar";
import ReelViewer from "@/components/ReelViewer";
import styles from "./page.module.css";

export default function ActivityStrip({
  activity,
  currentUserId,
}: {
  activity: any[];
  currentUserId: string;
}) {
  const [viewing, setViewing] = useState<{ name: string; avatarUrl: string | null; ownerId: string; entries: any[] } | null>(null);

  async function handleOpen(item: any) {
    const entries = await getReelEntries(item.user_id);
    if (entries.length === 0) return;
    setViewing({
      name: item.profile?.full_name || "Someone",
      avatarUrl: item.profile?.avatar_url,
      ownerId: item.user_id,
      entries,
    });
  }

  if (activity.length === 0) return null;

  // Dedupe to one avatar per person, keeping their most recent entry
  const seen = new Set<string>();
  const unique = activity.filter((a) => {
    if (seen.has(a.user_id)) return false;
    seen.add(a.user_id);
    return true;
  });

  return (
    <>
      <div className={styles.activityStrip}>
        {unique.map((item) => (
          <div key={item.user_id} className={styles.activityItem} onClick={() => handleOpen(item)}>
            <Avatar name={item.profile?.full_name || "?"} avatarUrl={item.profile?.avatar_url} size={44} />
            <div className={styles.activityName}>
              {item.user_id === currentUserId ? "You" : (item.profile?.full_name?.split(" ")[0] || "Member")}
            </div>
          </div>
        ))}
      </div>

      {viewing && (
        <ReelViewer
          name={viewing.name}
          avatarUrl={viewing.avatarUrl}
          ownerId={viewing.ownerId}
          entries={viewing.entries}
          currentUserId={currentUserId}
          canComment={false}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}