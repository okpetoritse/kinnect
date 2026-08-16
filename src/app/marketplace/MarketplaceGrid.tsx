"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getListings } from "./actions";
import SponsoredBadge from "@/components/SponsoredBadge";
import styles from "./page.module.css";

type Listing = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  category: string | null;
  location: string | null;
  image_urls: string[];
  is_promoted?: boolean;
  promoted_until?: string | null;
  created_at: string;
};

export default function MarketplaceGrid({
  initial,
  initialCursor,
}: {
  initial: Listing[];
  initialCursor: string | null;
}) {
  const [query, setQuery] = useState("");
  const [listings, setListings] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const { listings: data, nextCursor } = await getListings({ query });
      setListings(data as any);
      setCursor(nextCursor);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function handleLoadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    const { listings: more, nextCursor } = await getListings({
      query,
      cursor,
    });
    setListings((prev) => [...prev, ...(more as any)]);
    setCursor(nextCursor);
    setLoadingMore(false);
  }

  return (
    <>
      <input
        className={styles.searchInput}
        placeholder="Search listings..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className={styles.grid}>
        {listings.length > 0 ? (
          listings.map((l) => (
            <Link key={l.id} href={`/marketplace/${l.id}`} className={styles.card}>
              {l.image_urls?.[0] ? (
                <img src={l.image_urls[0]} className={styles.cardImage} alt="" />
              ) : (
                <div className={styles.cardImagePlaceholder}>📦</div>
              )}
              <div className={styles.cardBody}>
                {l.is_promoted &&
                  l.promoted_until &&
                  new Date(l.promoted_until) > new Date() && <SponsoredBadge />}
                <div className={styles.cardTitle}>{l.title}</div>
                {l.price != null && (
                  <div className={styles.cardPrice}>
                    {l.currency || "₦"}
                    {l.price.toLocaleString()}
                  </div>
                )}
                <div className={styles.cardMeta}>
                  {[l.category, l.location].filter(Boolean).join(" · ")}
                </div>
              </div>
            </Link>
          ))
        ) : (
          <p className={styles.empty}>No listings found</p>
        )}

        {cursor && (
          <button
            className={styles.loadMoreBtn}
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </>
  );
}