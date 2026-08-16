"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCommunitiesList } from "./actions";
import styles from "./page.module.css";

type Community = {
  id: string;
  name: string;
  description: string | null;
  cover_color: string | null;
  created_at: string;
};

export default function CommunitiesList({
  initial,
  initialMemberCounts,
  initialCursor,
}: {
  initial: Community[];
  initialMemberCounts: Record<string, number>;
  initialCursor: string | null;
}) {
  const [query, setQuery] = useState("");
  const [communities, setCommunities] = useState(initial);
  const [memberCounts, setMemberCounts] = useState(initialMemberCounts);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const { communities: data, memberCounts: counts, nextCursor } =
        await getCommunitiesList(undefined, query);
      setCommunities(data);
      setMemberCounts(counts);
      setCursor(nextCursor);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function handleLoadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    const { communities: more, memberCounts: moreCounts, nextCursor } =
      await getCommunitiesList(cursor, query);
    setCommunities((prev) => [...prev, ...more]);
    setMemberCounts((prev) => ({ ...prev, ...moreCounts }));
    setCursor(nextCursor);
    setLoadingMore(false);
  }

  return (
    <>
      <input
        className={styles.searchInput}
        placeholder="Search communities..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {communities.length === 0 ? (
        <p className={styles.empty}>No communities found.</p>
      ) : (
        <>
          {communities.map((c) => (
            <Link key={c.id} href={`/communities/${c.id}`} className={styles.card}>
              <div className={styles.cardTop}>
                <div
                  className={styles.cover}
                  style={{ background: c.cover_color || "#FF6F59" }}
                />
                <div>
                  <div className={styles.name}>{c.name}</div>
                  <div className={styles.memberCount}>
                    {memberCounts[c.id] || 0} member
                    {(memberCounts[c.id] || 0) === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              {c.description && (
                <div className={styles.description}>{c.description}</div>
              )}
            </Link>
          ))}

          {cursor && (
            <button
              className={styles.loadMoreBtn}
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </>
      )}
    </>
  );
}