"use client";

import { useEffect, useState } from "react";
import { getFriendsReelStatus, getReelEntries } from "@/app/reels/actions";
import Avatar from "@/components/Avatar";
import ReelViewer from "@/components/ReelViewer";
import styles from "./page.module.css";

type Friend = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function FriendsList({
  friends,
  currentUserId,
}: {
  friends: Friend[];
  currentUserId: string;
}) {
  const [status, setStatus] = useState<Record<string, { hasEntries: boolean; hasUnseenRecent: boolean }>>({});
  const [active, setActive] = useState<{
    name: string;
    avatarUrl: string | null;
    entries: any[];
  } | null>(null);

  useEffect(() => {
    getFriendsReelStatus().then(setStatus);
  }, []);

  async function handleAvatarTap(friend: Friend) {
    const s = status[friend.id];
    if (!s?.hasEntries) return;

    const entries = await getReelEntries(friend.id);
    if (entries.length === 0) return;

    setActive({
      name: friend.full_name || "Unknown",
      avatarUrl: friend.avatar_url,
      entries,
    });

    setStatus((prev) => ({
      ...prev,
      [friend.id]: { ...prev[friend.id], hasUnseenRecent: false },
    }));
  }

  if (friends.length === 0) {
    return <p className={styles.empty}>No friends yet</p>;
  }

  return (
    <>
      {friends.map((friend) => {
        const s = status[friend.id];
        const ringClass = s?.hasUnseenRecent
          ? styles.reelRingActive
          : s?.hasEntries
          ? styles.reelRingSeen
          : "";

        return (
          <div key={friend.id} className={styles.row}>
            <div className={styles.rowLeft}>
              <button
                className={`${styles.reelRing} ${ringClass}`}
                onClick={() => handleAvatarTap(friend)}
              >
                <Avatar
                  name={friend.full_name || "?"}
                  avatarUrl={friend.avatar_url}
                  size={40}
                />
              </button>
              <div>
                <div className={styles.name}>{friend.full_name || "Unnamed"}</div>
                <div className={styles.email}>
                  {friend.username ? `@${friend.username}` : "No username set"}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {active && (
        <ReelViewer
          name={active.name}
          avatarUrl={active.avatarUrl}
          entries={active.entries}
          currentUserId={currentUserId}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}