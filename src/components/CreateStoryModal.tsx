"use client";

import { useRef, useState } from "react";
import { createStory } from "@/app/stories/actions";
import { createClient } from "@/lib/supabase/client";
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
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const supabase = createClient();
    const filePath = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("stories").upload(filePath, file);

    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("stories").getPublicUrl(filePath);
      setMediaUrl(publicUrl);
      setMediaType(file.type.startsWith("video") ? "video" : "image");
    }
    setUploading(false);
  }

  async function handlePost() {
    const result = await createStory(text, mediaUrl, mediaType, color);
    if (result.success) onPosted();
    else alert(result.error);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
        <input ref={videoInputRef} type="file" accept="video/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
        <input ref={galleryInputRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFile} />

        {mediaUrl ? (
          mediaType === "video" ? (
            <video src={mediaUrl} controls style={{ width: "100%", borderRadius: 12, marginBottom: 12 }} />
          ) : (
            <img src={mediaUrl} style={{ width: "100%", borderRadius: 12, marginBottom: 12 }} alt="" />
          )
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
                  className={`${styles.colorSwatch} ${color === c ? styles.colorSwatchSelected : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </>
        )}

        {!mediaUrl && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button className={styles.attachBtn} style={{ flex: 1 }} onClick={() => photoInputRef.current?.click()} disabled={uploading}>
              📷 Take photo
            </button>
            <button className={styles.attachBtn} style={{ flex: 1 }} onClick={() => videoInputRef.current?.click()} disabled={uploading}>
              🎥 Record video
            </button>
          </div>
        )}
        <button className={styles.attachBtn} onClick={() => galleryInputRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading..." : mediaUrl ? "Change from gallery" : "🖼️ Choose from gallery"}
        </button>

        <button className={styles.postBtn} onClick={handlePost} disabled={uploading}>
          Post story
        </button>
      </div>
    </div>
  );
}