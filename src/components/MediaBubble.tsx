"use client";

import { Play } from "lucide-react";
import styles from "@/app/messages/[friendId]/page.module.css";

export default function MediaBubble({
  items,
  caption,
  onOpen,
}: {
  items: { url: string; type: "image" | "video" }[];
  caption?: string | null;
  onOpen: (index: number) => void;
}) {
  if (items.length === 0) return null;

  if (items.length === 1) {
    const item = items[0];
    return (
      <div className={styles.mediaBubble}>
        {item.type === "video" ? (
          <div className={styles.mediaVideoWrap} onClick={() => onOpen(0)}>
            <video src={item.url} className={styles.mediaSingle} muted />
            <div className={styles.mediaPlayOverlay}>
              <div className={styles.mediaPlayBtn}>
                <Play size={20} fill="white" />
              </div>
            </div>
          </div>
        ) : (
          <img src={item.url} className={styles.mediaSingle} alt="" onClick={() => onOpen(0)} />
        )}
        {caption && <div className={styles.mediaCaption}>{caption}</div>}
      </div>
    );
  }

  const visible = items.slice(0, 4);
  const overflow = items.length - 4;

  return (
    <div className={styles.mediaBubble}>
      <div className={styles.mediaGrid}>
        {visible.map((item, i) => (
          <div key={i} className={styles.mediaGridItem} onClick={() => onOpen(i)}>
            {item.type === "video" ? <video src={item.url} muted /> : <img src={item.url} alt="" />}
            {i === 3 && overflow > 0 && (
              <div className={styles.mediaGridOverlay}>+{overflow}</div>
            )}
          </div>
        ))}
      </div>
      {caption && <div className={styles.mediaCaption}>{caption}</div>}
    </div>
  );
}