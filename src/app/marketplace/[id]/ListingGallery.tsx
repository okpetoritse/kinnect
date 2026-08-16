"use client";

import { useRef, useState } from "react";
import styles from "./page.module.css";

export default function ListingGallery({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setCurrent(index + 1);
  }

  if (images.length === 0) {
    return <div className={styles.placeholderImage}>📦</div>;
  }

  return (
    <div className={styles.galleryWrapper}>
      <div
        ref={scrollRef}
        className={styles.galleryScroll}
        onScroll={handleScroll}
      >
        {images.map((url) => (
          <img key={url} src={url} className={styles.galleryImage} alt="" />
        ))}
      </div>
      {images.length > 1 && (
        <div className={styles.galleryCounter}>
          {current}/{images.length}
        </div>
      )}
    </div>
  );
}