"use client";

import { useRef, useState } from "react";
import { logGoalProgress } from "../../actions";
import { uploadMedia } from "@/lib/media/uploadMedia";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import styles from "./page.module.css";

export default function LogProgressForm({
  communityId,
  currentPercent,
  milestoneThresholds,
}: {
  communityId: string;
  currentPercent: number;
  milestoneThresholds: number[];
}) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [celebration, setCelebration] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;

    let mediaUrl: string | undefined;
    let mediaType: "image" | "video" | undefined;

    if (mediaFile) {
      const result = await uploadMedia("goal-progress", communityId, mediaFile);
      if (result.url) {
        mediaUrl = result.url;
        mediaType = result.type;
      }
    }

    const result = await logGoalProgress(
      communityId,
      Number(value),
      note,
      mediaUrl,
      mediaType
    );

    if (result.success && typeof result.newPercent === "number") {
      const justCrossed = milestoneThresholds.find(
        (t) => currentPercent < t && result.newPercent! >= t
      );
      if (justCrossed) {
        setCelebration(
          justCrossed === 100
            ? "🎉 You reached your goal!"
            : `🎉 You just crossed ${justCrossed}%!`
        );
      }
    }

    setValue("");
    setNote("");
    setMediaFile(null);
    router.refresh();
  }

  return (
    <>
      <form className={styles.logForm} onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: "none" }}
          onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
        />
        <div className={styles.logTopRow}>
          <button
            type="button"
            className={styles.mediaAttachBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera size={16} />
          </button>
          <input
            className={styles.logInput}
            type="number"
            placeholder="New value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </div>
        <input
          className={styles.logInput}
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className={styles.logBtn} type="submit">
          Save progress
        </button>
      </form>
      {mediaFile && (
        <div className={styles.mediaPreview}>📎 {mediaFile.name} attached</div>
      )}
      {celebration && <div className={styles.celebration}>{celebration}</div>}
    </>
  );
}