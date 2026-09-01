"use client";

import { useState } from "react";
import { getReelEntries } from "@/app/reels/actions";
import Avatar from "@/components/Avatar";
import ReelViewer from "@/components/ReelViewer";
import styles from "./page.module.css";

export default function LeaderboardRow({
  entry,
  rank,
  isMe,
}: {
  entry: any;
  rank: number;
  isMe: boolean;
}) {
  const [viewing, setViewing] = useState(false);
  const [reelEntries, setReelEntries] = useState<any[] | null>(null);

  async function handleOpen() {
    const items = await getReelEntries(entry.userId);
    if (items.length === 0) return;
    setReelEntries(items);
    setViewing(true);
  }

  return (
    <>
      <button className={styles.row} onClick={handleOpen} style={{ width: "100%", textAlign: "left" }}>
        <div className={styles.rankNum}>#{rank}</div>
        <Avatar name={entry.name} avatarUrl={entry.avatarUrl} size={36} />
        <div className={styles.body}>
          <div className={styles.memberName}>{isMe ? "You" : entry.name}</div>
          <div className={styles.memberBarTrack}>
            <div className={styles.memberBarFill} style={{ width: `${entry.percent}%` }} />
          </div>
          <div className={styles.memberBadges}>
            {entry.milestonesReached.map((t: number) => (
              <span key={t} className={styles.memberBadgeSmall}>🏅</span>
            ))}
          </div>
        </div>
        <div className={styles.memberPercent}>{entry.percent}%</div>
      </button>

      {viewing && reelEntries && (
        <ReelViewer
        ownerId={entry.userId}
canComment={false}
          name={entry.name}
          avatarUrl={entry.avatarUrl}
          entries={reelEntries}
          currentUserId={entry.userId}
          onClose={() => setViewing(false)}
        />
      )}
    </>
  );
}