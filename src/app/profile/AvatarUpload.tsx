"use client";

import { useRef, useState } from "react";
import { updateAvatar } from "./actions";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import styles from "./page.module.css";
import { Camera } from "lucide-react";

export default function AvatarUpload({
  userId,
  name,
  initialAvatarUrl,
}: {
  userId: string;
  name: string;
  initialAvatarUrl: string | null;
}) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);

    const supabase = createClient();
    const filePath = `${userId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file);

    if (uploadError) {
      console.error(uploadError);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    setAvatarUrl(publicUrl);
    setUploading(false);
    await updateAvatar(publicUrl);
  }

  return (
    <div className={styles.avatarWrapper}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={styles.fileInput}
        onChange={handleFileSelect}
      />
      <Avatar name={name} avatarUrl={avatarUrl} size={80} />
      <button
        className={styles.avatarUploadBtn}
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "…" : <Camera size={13} />}
      </button>
    </div>
  );
}