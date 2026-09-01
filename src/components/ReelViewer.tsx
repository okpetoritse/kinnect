"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markReelViewed, toggleReelSpark, sendReelComment } from "@/app/reels/actions";
import Avatar from "@/components/Avatar";
import SparkButton from "@/components/SparkButton";
import { X, Send } from "lucide-react";
import styles from "./ReelViewer.module.css";

type Entry = {
  id: string;
  entryId?: string;
  value: number;
  note: string | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
  created_at: string;
  sparkedUserIds: string[];
};

const SLIDE_DURATION_MS = 5000;

export default function ReelViewer({
  name,
  avatarUrl,
  ownerId,
  entries,
  currentUserId,
  canComment = false,
  onClose,
}: {
  name: string;
  avatarUrl: string | null;
  ownerId: string;
  entries: Entry[];
  currentUserId: string;
  canComment?: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(entries.length - 1);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sparks, setSparks] = useState<Record<string, string[]>>(
    Object.fromEntries(entries.map((e) => [e.entryId || e.id, e.sparkedUserIds || []]))
  );
  const [commentText, setCommentText] = useState("");
  const [commentSent, setCommentSent] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const isOwnReel = currentUserId === ownerId;

  useEffect(() => {
    markReelViewed(entries.map((e) => e.entryId || e.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused) return;
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);

    const step = 100 / (SLIDE_DURATION_MS / 100);
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p + step >= 100) {
          goNext();
          return 0;
        }
        return p + step;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused]);

  function goNext() {
    if (index >= entries.length - 1) {
      setTimeout(() => onClose(), 0);
    } else {
      setIndex((i) => i + 1);
    }
  }

  function goPrev() {
    if (index > 0) setIndex((i) => i - 1);
  }

  const entry = entries[index];
  if (!entry) return null;

  const entryKey = entry.entryId || entry.id;

  async function handleSpark() {
    const current = sparks[entryKey] || [];
    const already = current.includes(currentUserId);
    const updated = already
      ? current.filter((id) => id !== currentUserId)
      : [...current, currentUserId];

    setSparks((prev) => ({ ...prev, [entryKey]: updated }));
    await toggleReelSpark(entryKey);
  }

  async function handleSendComment() {
    const message = commentText.trim();
    if (!message) return;

    setCommentError(null);
    const result = await sendReelComment(entryKey, message);

    if (result.error) {
      setCommentError(result.error);
      return;
    }

    setCommentText("");
    setCommentSent(true);
    setPaused(false);
    setTimeout(() => setCommentSent(false), 2000);
  }

  const sparkedByMe = (sparks[entryKey] || []).includes(currentUserId);
  const sparkCount = (sparks[entryKey] || []).length;

  return (
    <div className={styles.overlay}>
      <div className={styles.segments}>
        {entries.map((e, i) => (
          <div key={e.id} className={styles.segment}>
            <div
              className={`${styles.segmentFill} ${i < index ? styles.segmentFillDone : ""}`}
              style={i === index ? { width: `${progress}%` } : undefined}
            />
          </div>
        ))}
      </div>

      <div className={styles.header}>
        <Avatar name={name} avatarUrl={avatarUrl} size={30} />
        <div className={styles.headerName}>{name}</div>
        <div className={styles.headerTime}>
          {new Date(entry.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={22} />
        </button>
      </div>

      <div className={styles.stage}>
        {entry.media_url ? (
          entry.media_type === "video" ? (
            <video src={entry.media_url} className={styles.stageMedia} autoPlay muted playsInline />
          ) : (
            <img src={entry.media_url} className={styles.stageMedia} alt="" />
          )
        ) : (
          <div className={styles.fallbackCard}>
            <div className={styles.fallbackValue}>{entry.value}</div>
            {entry.note && <div className={styles.fallbackNote}>{entry.note}</div>}
          </div>
        )}

        {entry.media_url && entry.note && (
          <div className={styles.caption}>{entry.note}</div>
        )}

        {sparkCount > 0 && (
          <div className={styles.sparkCountBadge}>
            ✦ {sparkCount} {sparkCount === 1 ? "spark" : "sparks"}
          </div>
        )}

        <div className={styles.tapZones}>
          <div
            className={styles.tapZone}
            onClick={goPrev}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          />
          <div
            className={styles.tapZone}
            onClick={goNext}
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          />
        </div>
      </div>

      <div className={styles.footer}>
                {!isOwnReel && canComment && (
          <div className={styles.commentRow} onClick={(e) => e.stopPropagation()}>
            <input
              className={styles.commentInput}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onFocus={() => setPaused(true)}
              onBlur={() => {
                if (!commentText.trim()) setPaused(false);
              }}
              placeholder={commentSent ? "Sent ✓" : "Comment (sends to their DMs)..."}
              onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
            />
            <button className={styles.commentSendBtn} onClick={handleSendComment}>
              <Send size={15} />
            </button>
          </div>
        )}
        {commentError && <div className={styles.commentError}>{commentError}</div>}

        <SparkButton sparked={sparkedByMe} count={sparkCount} onTap={handleSpark} />
      </div>
    </div>
  );
}