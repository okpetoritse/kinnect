"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import styles from "./page.module.css";

type Friend = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function MessagesList({
  friends,
  currentUserId,
  initialUnreadCounts,
}: {
  friends: Friend[];
  currentUserId: string;
  initialUnreadCounts: Record<string, number>;
}) {
  const [unreadCounts, setUnreadCounts] = useState(initialUnreadCounts);

  useEffect(() => {
    let mounted = true;

    async function refreshCounts() {
      const supabase = createClient();
      const { data: unreadRows } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("receiver_id", currentUserId)
        .is("read_at", null);

      const counts: Record<string, number> = {};
      (unreadRows || []).forEach((m) => {
        counts[m.sender_id] = (counts[m.sender_id] || 0) + 1;
      });

      if (mounted) setUnreadCounts(counts);
    }

    refreshCounts();
    const interval = setInterval(refreshCounts, 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [currentUserId]);

  if (friends.length === 0) {
    return (
      <p className={styles.empty}>
        Add some friends first to start messaging.
      </p>
    );
  }

  return (
    <>
      {friends.map((friend) => {
        const unread = unreadCounts[friend.id] || 0;
        return (
          <Link
            key={friend.id}
            href={`/messages/${friend.id}`}
            className={styles.row}
          >
            <Avatar
              name={friend.full_name || "?"}
              avatarUrl={friend.avatar_url}
              size={40}
            />
            <div>
              <div className={styles.name}>{friend.full_name || "Unnamed"}</div>
              <div className={styles.email}>
                {friend.username ? `@${friend.username}` : "No username set"}
              </div>
            </div>
            {unread > 0 && (
              <div className={styles.unreadBadge}>{unread}</div>
            )}
          </Link>
        );
      })}
    </>
  );
}