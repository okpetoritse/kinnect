"use client";

import { useEffect, useRef, useState } from "react";
import { markStoryViewed, toggleStorySpark, getStorySparkers, sendStoryReply, deleteStory } from "@/app/stories/actions";
import Avatar from "@/components/Avatar";
import SparkButton from "@/components/SparkButton";
import { X, Send, Trash2 } from "lucide-react";
import styles from "./StoryViewer.module.css";

const IMAGE_DURATION_MS = 5000;

export default function StoryViewer({
  name,
  avatarUrl,
  ownerId,
  entries,
  currentUserId,
  onClose,
}: {
  name: string;
  avatarUrl: string | null;
  ownerId: string;
  entries: any[];
  currentUserId: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sparks, setSparks] = useState<Record<string, string[]>>(
    Object.fromEntries(entries.map((e) => [e.id, e.sparkedUserIds || []]))
  );
  const [sparkerNames, setSparkerNames] = useState<string[]>([]);
  const [replyText, setReplyText] = useState("");
  const [replySent, setReplySent] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isOwn = currentUserId === ownerId;
  const entry = entries[index];
  const isVideo = entry?.media_type === "video";

  useEffect(() => {
    markStoryViewed(entries.map((e) => e.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isOwn && entry) {
      getStorySparkers(entry.id).then(setSparkerNames);
    }
  }, [entry, isOwn]);

  // Image slides: fixed 5s timer. Video slides: progress tracks the video's
  // own real playback position via onTimeUpdate below, no fixed timer here.
  useEffect(() => {
    if (isVideo) return;
    if (paused) return;

    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);

    const step = 100 / (IMAGE_DURATION_MS / 100);
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
  }, [index, paused, isVideo]);

  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    if (paused) videoRef.current.pause();
    else videoRef.current.play().catch(() => {});
  }, [paused, isVideo, index]);

  function handleVideoTimeUpdate() {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  }

  function goNext() {
    if (index >= entries.length - 1) {
      setTimeout(() => onClose(), 0);
    } else {
      setIndex((i) => i + 1);
      setProgress(0);
    }
  }

  function goPrev() {
    if (index > 0) {
      setIndex((i) => i - 1);
      setProgress(0);
    }
  }

  if (!entry) return null;

  async function handleSpark() {
    const current = sparks[entry.id] || [];
    const already = current.includes(currentUserId);
    const updated = already ? current.filter((id) => id !== currentUserId) : [...current, currentUserId];
    setSparks((prev) => ({ ...prev, [entry.id]: updated }));
    await toggleStorySpark(entry.id);
  }

  async function handleSendReply() {
    const msg = replyText.trim();
    if (!msg) return;
    const result = await sendStoryReply(entry.id, msg);
    if (result.success) {
      setReplyText("");
      setReplySent(true);
      setPaused(false);
      setTimeout(() => setReplySent(false), 2000);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this story?")) return;
    const result = await deleteStory(entry.id);
    if (result.success) {
      if (entries.length === 1) {
        onClose();
      } else {
        goNext();
      }
    }
  }

  const sparkCount = (sparks[entry.id] || []).length;
  const sparkedByMe = (sparks[entry.id] || []).includes(currentUserId);

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
        {isOwn && (
          <button className={styles.closeBtn} onClick={handleDelete} style={{ marginLeft: "auto" }}>
            <Trash2 size={18} />
          </button>
        )}
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={22} />
        </button>
      </div>

      <div className={styles.stage}>
        {entry.media_url ? (
          isVideo ? (
            <video
              ref={videoRef}
              src={entry.media_url}
              className={styles.stageMedia}
              autoPlay
              playsInline
              onEnded={goNext}
              onTimeUpdate={handleVideoTimeUpdate}
            />
          ) : (
            <img src={entry.media_url} className={styles.stageMedia} alt="" />
          )
        ) : (
          <div className={styles.fallbackCard} style={{ background: entry.background_color }}>
            <div style={{ fontSize: 22, color: "white", fontWeight: 700, textAlign: "center", padding: 20 }}>
              {entry.content_text}
            </div>
          </div>
        )}

        {/* {entry.media_url && entry.content_text && (
          <div className={styles.caption}>{entry.content_text}</div>
        )} */}

        {isOwn && sparkerNames.length > 0 && (
          <div className={styles.sparkCountBadge}>
            ✦ Sparked by: {sparkerNames.join(", ")}
          </div>
        )}

        <div className={styles.tapZones}>
          <div className={styles.tapZone} onClick={goPrev} />
          <div className={styles.tapZone} onClick={goNext} />
        </div>
      </div>

      <div className={styles.footer}>
        {!isOwn && (
          <div className={styles.commentRow} onClick={(e) => e.stopPropagation()}>
            <input
              className={styles.commentInput}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onFocus={() => setPaused(true)}
              onBlur={() => !replyText.trim() && setPaused(false)}
              placeholder={replySent ? "Sent ✓" : "Reply (sends to their DMs)..."}
              onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
            />
            <button className={styles.commentSendBtn} onClick={handleSendReply}>
              <Send size={15} />
            </button>
          </div>
        )}

        {!isOwn && <SparkButton sparked={sparkedByMe} count={sparkCount} onTap={handleSpark} />}
      </div>
    </div>
  );
}