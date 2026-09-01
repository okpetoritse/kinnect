"use client";

import { useEffect, useState } from "react";
import { getFriendsWithActiveReels, getReelEntries } from "@/app/reels/actions";
import Avatar from "@/components/Avatar";
import ReelViewer from "@/components/ReelViewer";
import styles from "./ReelStrip.module.css";

type FriendReel = {
  id: string;
  name: string;
  avatarUrl: string | null;
  hasUnseen: boolean;
};

export default function ReelStrip({ currentUserId }: { currentUserId: string }) {
  const [friends, setFriends] = useState<FriendReel[]>([]);
  const [active, setActive] = useState<{
  ownerId: string;
  name: string;
  avatarUrl: string | null;
  entries: any[];
} | null>(null);

  useEffect(() => {
    getFriendsWithActiveReels().then(setFriends);
  }, []);

  async function handleOpen(friend: FriendReel) {
    const entries = await getReelEntries(friend.id);
    if (entries.length === 0) return;
    setActive({
  ownerId: friend.id,
  name: friend.name,
  avatarUrl: friend.avatarUrl,
  entries,
});
    setFriends((prev) =>
      prev.map((f) => (f.id === friend.id ? { ...f, hasUnseen: false } : f))
    );
  }

  if (friends.length === 0) return null;

  return (
    <>
      <div className={styles.strip}>
        {friends.map((f) => (
          <button
            key={f.id}
            className={styles.item}
            onClick={() => handleOpen(f)}
          >
            <div className={`${styles.ring} ${!f.hasUnseen ? styles.ringSeen : ""}`}>
              <div className={styles.ringInner}>
                <Avatar name={f.name} avatarUrl={f.avatarUrl} size={52} />
              </div>
            </div>
            <div className={styles.name}>{f.name.split(" ")[0]}</div>
          </button>
        ))}
      </div>

      {active && (
                <ReelViewer
          name={active.name}
          avatarUrl={active.avatarUrl}
          ownerId={active.ownerId}
          entries={active.entries}
          currentUserId={currentUserId}
          canComment={true}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}