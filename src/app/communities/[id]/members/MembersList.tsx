"use client";

import { useState } from "react";
import { sendFriendRequest } from "@/app/friends/actions";
import Avatar from "@/components/Avatar";
import styles from "./page.module.css";
import FounderBadge from "@/components/FounderBadge";

type Member = {
  userId: string;
  profile: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    founding_number: number | null;
  };
  friendStatus: "none" | "pending" | "friends";
};

export default function MembersList({ members }: { members: Member[] }) {
  const [sentTo, setSentTo] = useState<string[]>([]);

  async function handleAdd(userId: string) {
    const result = await sendFriendRequest(userId);
    if (result.success) {
      setSentTo((prev) => [...prev, userId]);
    }
  }

  return (
    <div className={styles.list}>
      {members.map((m) => {
        const alreadySent = sentTo.includes(m.userId);
        const status = alreadySent ? "pending" : m.friendStatus;

        return (
          <div key={m.userId} className={styles.row}>
            <Avatar
              name={m.profile?.full_name || "?"}
              avatarUrl={m.profile?.avatar_url}
              size={40}
            />
            <div>
              <div className={styles.memberName}>
  {m.profile?.full_name || "Unnamed"}
  <FounderBadge number={m.profile?.founding_number} />
</div>
              <div className={styles.memberEmail}>
                {m.profile?.username ? `@${m.profile.username}` : "No username set"}
              </div>
            </div>

            {status === "friends" && (
              <span className={styles.friendsLabel}>Friends</span>
            )}
            {status === "pending" && (
              <span className={styles.pendingLabel}>Pending</span>
            )}
            {status === "none" && (
              <button
                className={styles.addBtn}
                onClick={() => handleAdd(m.userId)}
              >
                Add friend
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}