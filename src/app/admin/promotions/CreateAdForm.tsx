"use client";

import { useRef, useState } from "react";
import { createSponsoredAd } from "../actions";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

const COUNTRIES = [
  "Nigeria", "Ghana", "Kenya", "South Africa", "Egypt", "United Kingdom",
  "United States", "Canada", "Germany", "France", "India", "United Arab Emirates",
];

export default function CreateAdForm() {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const supabase = createClient();
    const filePath = `ads/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("marketplace").upload(filePath, file);

    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("marketplace").getPublicUrl(filePath);
      if (type === "image") setImageUrl(publicUrl);
      else setVideoUrl(publicUrl);
    }
    setUploading(false);
  }

  async function handleSubmit(formData: FormData) {
    formData.set("imageUrl", imageUrl);
    formData.set("videoUrl", videoUrl);
    const result = await createSponsoredAd(formData);
    if (result.success) {
      alert("Ad created successfully!");
      window.location.reload();
    } else {
      alert(result.error);
    }
  }

  return (
    <form action={handleSubmit} className={styles.card}>
      <div className={styles.cardType}>Create New Ad</div>

      <input className={styles.searchInput} name="title" placeholder="Ad title" required style={{ marginBottom: 8 }} />
      <textarea className={styles.searchInput} name="body" placeholder="Body text" style={{ marginBottom: 8, minHeight: 60 }} />
      <input className={styles.searchInput} name="sponsorName" placeholder="Sponsor/business name" style={{ marginBottom: 8 }} />
      <input className={styles.searchInput} name="linkUrl" placeholder="Link URL (optional)" style={{ marginBottom: 8 }} />

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileUpload(e, "image")} />
      <input ref={videoInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => handleFileUpload(e, "video")} />

      <div className={styles.controlsRow}>
        <button type="button" className={styles.select} onClick={() => fileInputRef.current?.click()}>
          {imageUrl ? "✅ Image added" : "📷 Add image"}
        </button>
        <button type="button" className={styles.select} onClick={() => videoInputRef.current?.click()}>
          {videoUrl ? "✅ Video added" : "🎥 Add video"}
        </button>
      </div>

      <div className={styles.controlsRow}>
        <select className={styles.select} name="region">
          <option value="">🌍 Worldwide</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={styles.numberInput} type="number" name="days" defaultValue={7} min={1} placeholder="Days" />
      </div>

      <button className={styles.promoteBtn} type="submit" disabled={uploading}>
        {uploading ? "Uploading..." : "Create Ad"}
      </button>
    </form>
  );
}