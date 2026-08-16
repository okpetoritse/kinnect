"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { searchBusinesses } from "./actions";
import styles from "./page.module.css";

type Business = {
  id: string;
  name: string;
  category: string | null;
  logo_url: string | null;
  cover_color: string | null;
  location: string | null;
};

export default function BusinessSearch({ initial }: { initial: Business[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(initial);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const data = await searchBusinesses(query);
      setResults(data);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <>
      <input
        className={styles.searchInput}
        placeholder="Search businesses..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {results.length > 0 ? (
        results.map((b) => (
          <Link key={b.id} href={`/business/${b.id}`} className={styles.row}>
            <div
              className={styles.cover}
              style={{ background: b.cover_color || "#FF6F59" }}
            />
            <div>
              <div className={styles.name}>{b.name}</div>
              <div className={styles.meta}>
                {[b.category, b.location].filter(Boolean).join(" · ")}
              </div>
            </div>
          </Link>
        ))
      ) : (
        <p className={styles.empty}>No businesses found</p>
      )}
    </>
  );
}