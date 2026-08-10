"use client";

import { useState } from "react";
import { setRsvp } from "../../actions";
import styles from "./page.module.css";

export default function RsvpButtons({
  eventId,
  initialStatus,
  goingCount,
}: {
  eventId: string;
  initialStatus: string | null;
  goingCount: number;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [count, setCount] = useState(goingCount);

  async function handleClick(newStatus: string) {
    const wasGoing = status === "going";
    const willBeGoing = newStatus === "going";

    setStatus(newStatus);
    if (wasGoing && !willBeGoing) setCount((c) => c - 1);
    if (!wasGoing && willBeGoing) setCount((c) => c + 1);

    await setRsvp(eventId, newStatus);
  }

  return (
    <>
      <div className={styles.rsvpRow}>
        <button
          className={`${styles.rsvpBtn} ${
            status === "going" ? styles.rsvpBtnActiveGoing : ""
          }`}
          onClick={() => handleClick("going")}
        >
          Going
        </button>
        <button
          className={`${styles.rsvpBtn} ${
            status === "maybe" ? styles.rsvpBtnActiveMaybe : ""
          }`}
          onClick={() => handleClick("maybe")}
        >
          Maybe
        </button>
        <button
          className={`${styles.rsvpBtn} ${
            status === "not_going" ? styles.rsvpBtnActiveNotGoing : ""
          }`}
          onClick={() => handleClick("not_going")}
        >
          Can&apos;t go
        </button>
      </div>
      <div className={styles.rsvpCount}>
        {count} going
      </div>
    </>
  );
}