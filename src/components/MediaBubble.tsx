"use client";

import { useEffect, useState } from "react";
import { Play, Download } from "lucide-react";
import { shouldAutoDownload } from "@/lib/media/mediaPrefs";
import styles from "@/app/messages/[friendId]/page.module.css";

type Item = { url: string; type: "image" | "video" };

function formatDuration(s: number) {
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

function VideoTile({ url }: { url: string }) {
  const [duration, setDuration] = useState<number | null>(null);
  return (
    <>
      {/* #t=0.1 makes the browser show a real first frame as the thumbnail */}
      <video
        src={`${url}#t=0.1`}
        preload="metadata"
        muted
        playsInline
        className={styles.mediaSingle}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
      <div className={styles.mediaPlayOverlay}>
        <div className={styles.mediaPlayBtn}>
          <Play size={20} fill="white" />
        </div>
      </div>
      {duration !== null && <div className={styles.mediaDuration}>{formatDuration(duration)}</div>}
    </>
  );
}

export default function MediaBubble({
  items,
  caption,
  onOpen,
}: {
  items: Item[];
  caption?: string | null;
  onOpen: (index: number) => void;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [forced, setForced] = useState(false);

  useEffect(() => {
    setAllowed(shouldAutoDownload());
  }, []);

  if (items.length === 0) return null;

  // Before we know the connection/settings, hold space with a neutral skeleton
  // so nothing starts downloading prematurely and layout doesn't jump.
  if (allowed === null) {
    return <div className={`${styles.mediaBubble} ${styles.mediaSkeleton}`} aria-hidden="true" />;
  }

  if (!allowed && !forced) {
    const label =
      items.length > 1
        ? `${items.length} items`
        : items[0].type === "video"
        ? "Video"
        : "Photo";
    return (
      <div className={styles.mediaBubble}>
        <button
          className={styles.mediaPlaceholder}
          onClick={() => setForced(true)}
          aria-label={`Download ${label}`}
        >
          <Download size={22} />
          <span>{label}</span>
          <span className={styles.mediaPlaceholderHint}>Tap to download</span>
        </button>
        {caption && <div className={styles.mediaCaption}>{caption}</div>}
      </div>
    );
  }

  if (items.length === 1) {
    const item = items[0];
    return (
      <div className={styles.mediaBubble}>
        {item.type === "video" ? (
          <div
            className={styles.mediaVideoWrap}
            onClick={() => onOpen(0)}
            role="button"
            aria-label="Play video"
          >
            <VideoTile url={item.url} />
          </div>
        ) : (
          <img
            src={item.url}
            className={styles.mediaSingle}
            alt="Shared photo"
            loading="lazy"
            onClick={() => onOpen(0)}
          />
        )}
        {caption && <div className={styles.mediaCaption}>{caption}</div>}
      </div>
    );
  }

  const visible = items.slice(0, 4);
  const overflow = items.length - 4;
  const photoCount = items.filter((i) => i.type === "image").length;
  const videoCount = items.length - photoCount;
  const summary =
    videoCount === 0
      ? `${items.length} photos`
      : photoCount === 0
      ? `${items.length} videos`
      : `${items.length} items`;

  return (
    <div className={styles.mediaBubble}>
      <div className={styles.mediaGrid}>
        {visible.map((item, i) => (
          <div
            key={i}
            className={styles.mediaGridItem}
            onClick={() => onOpen(i)}
            role="button"
            aria-label={`Open ${item.type} ${i + 1} of ${items.length}`}
          >
            {item.type === "video" ? (
              <video src={`${item.url}#t=0.1`} preload="metadata" muted playsInline />
            ) : (
              <img src={item.url} alt="" loading="lazy" />
            )}
            {i === 3 && overflow > 0 && <div className={styles.mediaGridOverlay}>+{overflow}</div>}
          </div>
        ))}
      </div>
      <div className={styles.mediaSummary}>{summary}</div>
      {caption && <div className={styles.mediaCaption}>{caption}</div>}
    </div>
  );
}