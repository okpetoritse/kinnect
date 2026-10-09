"use client";

import { useEffect, useRef, useState } from "react";
import { X, Send, Camera, Video, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { guardedUpload, sanitizeFileName, MAX_UPLOAD_BYTES } from "@/lib/media/guardedUpload";
import styles from "./MediaComposer.module.css";

type MediaItem = { url: string; type: "image" | "video" };
type PendingItem = { file: File; previewUrl: string; type: "image" | "video" };
type SendResult = { success?: boolean; messageId?: string; error?: string };

const MAX_ITEMS = 10;

export default function MediaComposer({
  mode,
  send,
  onClose,
  onSent,
}: {
  mode: "camera" | "gallery";
  send: (caption: string, items: MediaItem[]) => Promise<SendResult>;
  onClose: () => void;
  onSent: (messageId: string, caption: string, items: MediaItem[]) => void;
}) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const galleryRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const itemsRef = useRef<PendingItem[]>([]);
  itemsRef.current = items;
  useEffect(() => {
    return () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
  }, []);

  const sources =
    mode === "camera"
      ? [
          { label: "Take photo", Icon: Camera, onClick: () => photoRef.current?.click() },
          { label: "Record video", Icon: Video, onClick: () => videoRef.current?.click() },
        ]
      : [
          {
            label: "Choose photos & videos",
            Icon: ImageIcon,
            onClick: () => galleryRef.current?.click(),
          },
        ];

  function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (picked.length === 0) return;

    const withinLimit = picked.filter((f) => f.size <= MAX_UPLOAD_BYTES);
    const tooBig = picked.length - withinLimit.length;
    const slots = MAX_ITEMS - items.length;

    const accepted: PendingItem[] = withinLimit.slice(0, slots).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith("video") ? "video" : "image",
    }));

    setItems((prev) => [...prev, ...accepted]);
    setError(
      tooBig > 0
        ? `${tooBig} file${tooBig > 1 ? "s were" : " was"} skipped — over the 50 MB limit.`
        : null
    );
  }

  function removeItem(index: number) {
    setItems((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSend() {
    if (items.length === 0 || uploading) return;
    setError(null);

    if (!navigator.onLine) {
      setError("You're offline. Connect to the internet, then tap Send.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const uploaded: MediaItem[] = [];

    for (let i = 0; i < items.length; i++) {
      setProgressLabel(`Uploading ${i + 1} of ${items.length}...`);
      const item = items[i];
      const filePath = `${Date.now()}-${i}-${sanitizeFileName(item.file.name)}`;

      try {
        const { error: uploadError } = await guardedUpload(
          supabase.storage
            .from("chat-images")
            .upload(filePath, item.file, { contentType: item.file.type || undefined })
        );
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("chat-images").getPublicUrl(filePath);
        uploaded.push({ url: publicUrl, type: item.type });
      } catch (err: any) {
        // Connection is gone — don't burn time trying the rest.
        if (err?.message === "offline") break;
      }
    }

    const failed = items.length - uploaded.length;

    if (uploaded.length === 0) {
      setUploading(false);
      setError("Couldn't upload — your connection dropped or is too slow. Your selection is kept; tap Send to retry.");
      return;
    }

    if (failed > 0) {
      const sendRest = confirm(`${failed} of ${items.length} couldn't upload. Send the other ${uploaded.length}?`);
      if (!sendRest) {
        setUploading(false);
        return;
      }
    }

    setProgressLabel("Sending...");
    const result = await send(caption, uploaded);
    setUploading(false);

    if (result.success && result.messageId) {
      onSent(result.messageId, caption, uploaded);
    } else {
      setError(result.error || "Couldn't send. Tap Send to try again.");
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-label={mode === "camera" ? "Camera" : "Gallery"}>
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close" disabled={uploading}>
          <X size={24} />
        </button>
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          {items.length > 0 ? `${items.length} selected` : mode === "camera" ? "Camera" : "Gallery"}
        </div>
        <div style={{ width: 24 }} />
      </div>

      <input ref={galleryRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={addFiles} />
      <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={addFiles} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" style={{ display: "none" }} onChange={addFiles} />

      <div className={styles.previewArea}>
        {uploading ? (
          <div className={styles.uploadProgress} role="status">{progressLabel}</div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            {sources.map(({ label, Icon, onClick }) => (
              <button key={label} className={styles.sourceBtn} onClick={onClick}>
                <Icon size={20} /> {label}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className={styles.previewGrid}>
              {items.map((item, i) => (
                <div key={item.previewUrl} className={styles.previewItem}>
                  {item.type === "video" ? (
                    <video
                      src={item.previewUrl}
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(e) => {
                        e.currentTarget.currentTime = 0.1;
                      }}
                    />
                  ) : (
                    <img src={item.previewUrl} alt="" />
                  )}
                  <button className={styles.removeBtn} onClick={() => removeItem(i)} aria-label="Remove">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            {items.length < MAX_ITEMS && (
              <div className={styles.sourceRow}>
                {sources.map(({ label, Icon, onClick }) => (
                  <button key={label} className={styles.sourceRowBtn} onClick={onClick}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {error && <div className={styles.errorBanner} role="alert">{error}</div>}

      {!uploading && items.length > 0 && (
        <div className={styles.footer}>
          <input
            className={styles.captionInput}
            placeholder="Add a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <button className={styles.sendBtn} onClick={handleSend} aria-label="Send">
            <Send size={18} />
          </button>
        </div>
      )}
    </div>
  );
}