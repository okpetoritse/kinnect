"use client";

import { useRef, useState } from "react";
import { X, Plus, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sendMediaCollection } from "@/app/messages/actions";
import styles from "./MediaComposer.module.css";

type PendingItem = { file: File; previewUrl: string; type: "image" | "video" };

export default function MediaComposer({
  friendId,
  onClose,
  onSent,
}: {
  friendId: string;
  onClose: () => void;
  onSent: (messageId: string, caption: string, mediaItems: { url: string; type: "image" | "video" }[]) => void;
}) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 10 - items.length);
    const newItems: PendingItem[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith("video") ? "video" : "image",
    }));
    setItems((prev) => [...prev, ...newItems].slice(0, 10));
    e.target.value = "";
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSend() {
    if (items.length === 0) return;
    setUploading(true);

    const supabase = createClient();
    const uploaded: { url: string; type: "image" | "video" }[] = [];

    for (let i = 0; i < items.length; i++) {
      setProgressLabel(`Uploading ${i + 1} of ${items.length}...`);
      const item = items[i];
      const filePath = `${Date.now()}-${i}-${item.file.name}`;
      const { error } = await supabase.storage.from("chat-images").upload(filePath, item.file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("chat-images").getPublicUrl(filePath);
        uploaded.push({ url: publicUrl, type: item.type });
      }
    }

    setProgressLabel("Sending...");
    const result = await sendMediaCollection(friendId, caption, uploaded);

    setUploading(false);
    if (result.success && result.messageId) {
      onSent(result.messageId, caption, uploaded);
    } else {
      alert(result.error || "Could not send");
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={24} />
        </button>
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          {items.length > 0 ? `${items.length} selected` : "Add media"}
        </div>
        <div style={{ width: 24 }} />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFilesPicked}
      />

      <div className={styles.previewArea}>
        {uploading ? (
          <div className={styles.uploadProgress}>{progressLabel}</div>
        ) : (
          <div className={styles.previewGrid}>
            {items.map((item, i) => (
              <div key={i} className={styles.previewItem}>
                {item.type === "video" ? (
                  <video src={item.previewUrl} />
                ) : (
                  <img src={item.previewUrl} alt="" />
                )}
                <button className={styles.removeBtn} onClick={() => removeItem(i)}>
                  <X size={12} />
                </button>
              </div>
            ))}
            {items.length < 10 && (
              <button className={styles.addMoreBtn} onClick={() => inputRef.current?.click()}>
                <Plus size={24} />
              </button>
            )}
          </div>
        )}
      </div>

      {!uploading && items.length > 0 && (
        <div className={styles.footer}>
          <input
            className={styles.captionInput}
            placeholder="Add a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <button className={styles.sendBtn} onClick={handleSend} disabled={items.length === 0}>
            <Send size={18} />
          </button>
        </div>
      )}
    </div>
  );
}