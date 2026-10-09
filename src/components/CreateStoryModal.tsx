"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Video, Image as ImageIcon, X } from "lucide-react";
import { createStory } from "@/app/stories/actions";
import { createClient } from "@/lib/supabase/client";
import { guardedUpload, sanitizeFileName, MAX_UPLOAD_BYTES } from "@/lib/media/guardedUpload";
import styles from "./CreateStoryModal.module.css";

const COLORS = ["#FF6F59", "#F5A742", "#E85D8A", "#2A9D8F"];

export default function CreateStoryModal({
  onClose,
  onPosted,
}: {
  onClose: () => void;
  onPosted: () => void;
}) {
  const [text, setText] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isVideo = !!file && file.type.startsWith("video");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;

    if (picked.size > MAX_UPLOAD_BYTES) {
      setError("That file is over 50 MB. Pick a shorter clip.");
      return;
    }

    setError(null);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  function clearMedia() {
    setFile(null);
    setPreviewUrl(null);
  }

  async function handlePost() {
    if (posting) return;
    setError(null);

    if (!file && !text.trim()) {
      setError("Add a photo, a video, or some text first.");
      return;
    }
    if (file && !navigator.onLine) {
      setError("You're offline. Connect to the internet, then tap Post.");
      return;
    }

    setPosting(true);
    let mediaUrl: string | null = null;
    let mediaType: "image" | "video" | null = null;

    if (file) {
      try {
        const supabase = createClient();
        const filePath = `${Date.now()}-${sanitizeFileName(file.name)}`;
        const { error: uploadError } = await guardedUpload(
          supabase.storage
            .from("stories")
            .upload(filePath, file, { contentType: file.type || undefined })
        );
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("stories").getPublicUrl(filePath);
        mediaUrl = publicUrl;
        mediaType = isVideo ? "video" : "image";
      } catch {
        setPosting(false);
        setError("Upload failed — check your connection and try again. Your story is kept.");
        return;
      }
    }

    const result = await createStory(text, mediaUrl, mediaType, color);
    setPosting(false);

    if (result.success) onPosted();
    else setError(result.error || "Could not post your story.");
  }

  return (
    <div className={styles.overlay} onClick={posting ? undefined : onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Create story">
        <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
        <input ref={videoRef} type="file" accept="video/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
        <input ref={galleryRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFile} />

        {previewUrl ? (
          <>
            <div style={{ position: "relative", marginBottom: 12 }}>
              {isVideo ? (
                <video
                  src={previewUrl}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(e) => {
                    e.currentTarget.currentTime = 0.1;
                  }}
                  style={{ width: "100%", borderRadius: 12, display: "block", maxHeight: 320, background: "#000" }}
                />
              ) : (
                <img src={previewUrl} alt="" style={{ width: "100%", borderRadius: 12, display: "block", maxHeight: 320, objectFit: "cover" }} />
              )}
              <button
                onClick={clearMedia}
                aria-label="Remove media"
                style={{
                  position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(0,0,0,0.55)", color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X size={16} />
              </button>
            </div>
            <input
              className={styles.captionInput}
              placeholder="Add a caption..."
              value={text}
              maxLength={200}
              onChange={(e) => setText(e.target.value)}
            />
          </>
        ) : (
          <>
            <textarea
              className={styles.textarea}
              style={{ background: color }}
              placeholder="Write something..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className={styles.colorRow}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Background ${c}`}
                  className={`${styles.colorSwatch} ${color === c ? styles.colorSwatchSelected : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              <button className={styles.attachBtn} style={{ flex: 1, marginBottom: 0 }} onClick={() => photoRef.current?.click()}>
                <Camera size={14} style={{ verticalAlign: "middle" }} /> Photo
              </button>
              <button className={styles.attachBtn} style={{ flex: 1, marginBottom: 0 }} onClick={() => videoRef.current?.click()}>
                <Video size={14} style={{ verticalAlign: "middle" }} /> Video
              </button>
              <button className={styles.attachBtn} style={{ flex: 1, marginBottom: 0 }} onClick={() => galleryRef.current?.click()}>
                <ImageIcon size={14} style={{ verticalAlign: "middle" }} /> Gallery
              </button>
            </div>
          </>
        )}

        {error && <div className={styles.error} role="alert">{error}</div>}

        <button className={styles.postBtn} onClick={handlePost} disabled={posting}>
          {posting ? (file ? "Uploading..." : "Posting...") : "Post story"}
        </button>
      </div>
    </div>
  );
}