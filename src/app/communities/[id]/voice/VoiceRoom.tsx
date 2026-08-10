"use client";

import { useVoiceRoom } from "@/lib/webrtc/useVoiceRoom";
import styles from "./page.module.css";

export default function VoiceRoom({
  communityId,
  currentUserId,
  currentUserName,
}: {
  communityId: string;
  currentUserId: string;
  currentUserName: string;
}) {
  const { participants, joined, connecting, muted, joinRoom, leaveRoom, toggleMute } =
    useVoiceRoom(communityId, currentUserId, currentUserName);

  return (
    <div className={styles.content}>
      {!joined ? (
        <div className={styles.notJoined}>
          <div className={styles.roomIcon}>🎙</div>
          <p className={styles.notJoinedText}>
            Join the voice room to talk with other members live.
          </p>
          <button
            className={styles.joinBtn}
            onClick={joinRoom}
            disabled={connecting}
          >
            {connecting ? "Connecting..." : "Join voice room"}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {participants.map((p) => (
              <div key={p.id} className={styles.participant}>
                <div className={styles.participantAvatar}>
                  {p.name.charAt(0).toUpperCase()}
                  {p.muted && <div className={styles.mutedBadge}>🔇</div>}
                </div>
                <div className={styles.participantName}>
                  {p.id === currentUserId ? "You" : p.name}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.controls}>
            <button
              className={`${styles.controlBtn} ${
                muted ? styles.controlBtnMuted : ""
              }`}
              onClick={toggleMute}
            >
              {muted ? "🔇" : "🎙"}
            </button>
            <button
              className={`${styles.controlBtn} ${styles.leaveBtn}`}
              onClick={leaveRoom}
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}