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
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 5 - mediaFiles.length);
    setMediaFiles((prev) => [...prev, ...files].slice(0, 5));
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;

    setUploading(true);
    const mediaItems: { url: string; type: "image" | "video" }[] = [];

    for (const file of mediaFiles) {
      const result = await uploadMedia("goal-progress", communityId, file);
      if (result.url && result.type) {
        mediaItems.push({ url: result.url, type: result.type });
      }
    }
    setUploading(false);

    const result = await logGoalProgress(communityId, Number(value), note, mediaItems);

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
    setMediaFiles([]);
    router.refresh();
  }

  return (
    <>
      <form className={styles.logForm} onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFilesPicked}
        />
        <div className={styles.logTopRow}>
          <button
            type="button"
            className={styles.mediaAttachBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={mediaFiles.length >= 5}
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
          placeholder="Note (optional) — tell the story"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className={styles.logBtn} type="submit" disabled={uploading}>
          {uploading ? "Uploading..." : "Save progress"}
        </button>
      </form>

      {mediaFiles.length > 0 && (
        <div className={styles.mediaPreviewRow}>
          {mediaFiles.map((f, i) => (
            <img
              key={i}
              src={URL.createObjectURL(f)}
              className={styles.mediaPreviewThumb}
              alt=""
            />
          ))}
        </div>
      )}

      {celebration && <div className={styles.celebration}>{celebration}</div>}
    </>
  );
}