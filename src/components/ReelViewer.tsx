"use client";

import { useEffect, useRef, useState } from "react";
import { markReelViewed, toggleReelSpark } from "@/app/reels/actions";
import Avatar from "@/components/Avatar";
import SparkButton from "@/components/SparkButton";
import { X } from "lucide-react";
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
  entries,
  currentUserId,
  onClose,
}: {
  name: string;
  avatarUrl: string | null;
  entries: Entry[];
  currentUserId: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(entries.length - 1);
  const [progress, setProgress] = useState(0);
  const [sparks, setSparks] = useState<Record<string, string[]>>(
    Object.fromEntries(entries.map((e) => [e.id, e.sparkedUserIds]))
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    markReelViewed(entries.map((e) => e.entryId || e.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
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
  }, [index]);

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

  async function handleSpark(entryId: string) {
    const current = sparks[entryId] || [];
    const already = current.includes(currentUserId);
    const updated = already
      ? current.filter((id) => id !== currentUserId)
      : [...current, currentUserId];

    setSparks((prev) => ({ ...prev, [entryId]: updated }));
    await toggleReelSpark(entryId);
  }

  const entry = entries[index];
  if (!entry) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.segments}>
        {entries.map((e, i) => (
          <div key={e.id} className={styles.segment}>
            <div
              className={`${styles.segmentFill} ${
                i < index ? styles.segmentFillDone : ""
              }`}
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
            <video
              src={entry.media_url}
              className={styles.stageMedia}
              autoPlay
              muted
              playsInline
            />
          ) : (
            <img src={entry.media_url} className={styles.stageMedia} alt="" />
          )
        ) : (
          <div className={styles.fallbackCard}>
            <div className={styles.fallbackValue}>{entry.value}</div>
            {entry.note && <div className={styles.fallbackNote}>{entry.note}</div>}
          </div>
        )}

        {(entry.media_url || entry.note) && (
          <div className={styles.caption}>
            {entry.note || `New value logged: ${entry.value}`}
          </div>
        )}

        <div className={styles.tapZones}>
          <div className={styles.tapZone} onClick={goPrev} />
          <div className={styles.tapZone} onClick={goNext} />
        </div>
      </div>

      <div className={styles.footer}>
        <SparkButton
          sparked={(sparks[entry.entryId || entry.id] || []).includes(currentUserId)}
          count={(sparks[entry.entryId || entry.id] || []).length}
          onTap={() => handleSpark(entry.entryId || entry.id)}
        />
      </div>
    </div>
  );
}