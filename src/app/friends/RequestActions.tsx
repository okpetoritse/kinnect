"use client";

import { respondToFriendRequest } from "./actions";
import styles from "./page.module.css";

export default function RequestActions({ requestId }: { requestId: string }) {
  return (
    <div className={styles.actions}>
      <button
        className={styles.acceptBtn}
        onClick={() => respondToFriendRequest(requestId, true)}
      >
        Accept
      </button>
      <button
        className={styles.declineBtn}
        onClick={() => respondToFriendRequest(requestId, false)}
      >
        Decline
      </button>
    </div>
  );
}