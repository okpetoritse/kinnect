"use client";

import { useEffect, useState } from "react";
import { getFriendsReelStatus, getReelEntries } from "@/app/reels/actions";
import Avatar from "@/components/Avatar";
import ReelViewer from "@/components/ReelViewer";
import styles from "./page.module.css";
import { getFriendsPaginated } from "./actions";
import FounderBadge from "@/components/FounderBadge";

type Friend = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  founding_number: number | null;
};



export default function FriendsList({
  friends: initialFriends,
  currentUserId,
  initialCursor,
}: {
  friends: Friend[];
  currentUserId: string;
  initialCursor: string | null;
}) {
  const [friends, setFriends] = useState(initialFriends);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<Record<string, { hasEntries: boolean; hasUnseenRecent: boolean }>>({});
  const [active, setActive] = useState<{
  ownerId: string;
  name: string;
  avatarUrl: string | null;
  entries: any[];
} | null>(null);

  useEffect(() => {
    getFriendsReelStatus().then(setStatus);
  }, []);


  async function handleLoadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    const { friends: more, nextCursor } = await getFriendsPaginated(cursor);
    setFriends((prev) => [...prev, ...(more as any)]);
    setCursor(nextCursor);
    setLoadingMore(false);
  }

  async function handleAvatarTap(friend: Friend) {
    const s = status[friend.id];
    if (!s?.hasEntries) return;

    const entries = await getReelEntries(friend.id);
    if (entries.length === 0) return;

    setActive({
  ownerId: friend.id,
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
                <div className={styles.name}>
  {friend.full_name || "Unnamed"}
  <FounderBadge number={friend.founding_number} />
</div>
                <div className={styles.email}>
                  {friend.username ? `@${friend.username}` : "No username set"}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {cursor && (
        <button
          className={styles.loadMoreBtn}
          onClick={handleLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}

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