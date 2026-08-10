"use client";

import { useEffect, useState } from "react";
import styles from "./GifPicker.module.css";

type Gif = {
  id: string;
  url: string;
  previewUrl: string;
};

export default function GifPicker({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(q: string) {
    setLoading(true);
    const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
    const endpoint = q.trim()
      ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=20`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20`;

    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      setGifs(
        (data.data || []).map((g: any) => ({
          id: g.id,
          url: g.images.original.url,
          previewUrl: g.images.fixed_width_small.url,
        }))
      );
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    search("");
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") search(query);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <input
          className={styles.searchInput}
          placeholder="Search GIFs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className={styles.grid}>
          {loading ? (
            <p className={styles.status}>Loading...</p>
          ) : gifs.length > 0 ? (
            gifs.map((gif) => (
              <button
                key={gif.id}
                className={styles.gifBtn}
                onClick={() => onSelect(gif.url)}
              >
                <img src={gif.previewUrl} alt="" />
              </button>
            ))
          ) : (
            <p className={styles.status}>No results</p>
          )}
        </div>
      </div>
    </div>
  );
}