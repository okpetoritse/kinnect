"use client";

import { useRef, useState } from "react";
import { createListing } from "../actions";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type Business = { id: string; name: string };

export default function NewListingForm({ businesses }: { businesses: Business[] }) {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";
    setUploading(true);

    const supabase = createClient();
    const uploaded: string[] = [];

    for (const file of files.slice(0, 5)) {
      const filePath = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("marketplace").upload(filePath, file);
      if (!error) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("marketplace").getPublicUrl(filePath);
        uploaded.push(publicUrl);
      }
    }

    setImageUrls((prev) => [...prev, ...uploaded]);
    setUploading(false);
  }

  return (
    <form action={createListing}>
      <input type="hidden" name="imageUrls" value={JSON.stringify(imageUrls)} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleImageSelect}
      />
      <button
        type="button"
        className={styles.imageBtn}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? "Uploading..." : "📷 Add photos (up to 5)"}
      </button>

      {imageUrls.length > 0 && (
        <div className={styles.imagePreviewRow}>
          {imageUrls.map((url) => (
            <img key={url} src={url} className={styles.imagePreview} alt="" />
          ))}
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="title">
          Title
        </label>
        <input className={styles.input} id="title" name="title" required />
      </div>

      <div className={styles.row2}>
        <div className={styles.field} style={{ flex: 1 }}>
          <label className={styles.label} htmlFor="price">
            Price (₦)
          </label>
          <input className={styles.input} id="price" name="price" type="number" />
        </div>
        <div className={styles.field} style={{ flex: 1 }}>
          <label className={styles.label} htmlFor="category">
            Category
          </label>
          <input className={styles.input} id="category" name="category" />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="location">
          Location
        </label>
        <input className={styles.input} id="location" name="location" />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">
          Description
        </label>
        <textarea className={styles.textarea} id="description" name="description" />
      </div>

      {businesses.length > 0 && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="businessId">
            Post as
          </label>
          <select className={styles.select} id="businessId" name="businessId" defaultValue="">
            <option value="">Yourself (personal listing)</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (business catalog)
              </option>
            ))}
          </select>
        </div>
      )}

      <button className={styles.submit} type="submit">
        Post listing
      </button>
    </form>
  );
}