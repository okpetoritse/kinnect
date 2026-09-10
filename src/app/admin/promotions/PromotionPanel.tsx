"use client";

import { useState } from "react";
import { searchPromotable, setPromotion, removePromotion } from "../actions";
import styles from "./page.module.css";

const COUNTRIES = [
  "Nigeria", "Ghana", "Kenya", "South Africa", "Egypt", "United Kingdom",
  "United States", "Canada", "Germany", "France", "India", "United Arab Emirates",
];

export default function PromotionPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [config, setConfig] = useState<Record<string, { days: number; region: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const { posts, listings } = await searchPromotable(q);
    setResults([...posts, ...listings]);
  }

  function updateConfig(key: string, field: "days" | "region", value: any) {
    setConfig((prev) => ({
      ...prev,
      [key]: { days: prev[key]?.days ?? 7, region: prev[key]?.region ?? "", [field]: value },
    }));
  }

  async function handlePromote(item: any) {
    const key = `${item.type}-${item.id}`;
    setBusy(key);
    const cfg = config[key] || { days: 7, region: "" };
    await setPromotion(item.type, item.id, cfg.days, cfg.region || null);
    await handleSearch(query);
    setBusy(null);
  }

  async function handleRemove(item: any) {
    const key = `${item.type}-${item.id}`;
    setBusy(key);
    await removePromotion(item.type, item.id);
    await handleSearch(query);
    setBusy(null);
  }

  return (
    <div className={styles.wrapper}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, marginBottom: 16 }}>
        Promotions
      </h1>
      <input
        className={styles.searchInput}
        placeholder="Search posts or listings by title/content..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />

      {results.map((item) => {
        const key = `${item.type}-${item.id}`;
        const cfg = config[key] || { days: 7, region: "" };
        const isActive = item.is_promoted && item.promoted_until && new Date(item.promoted_until) > new Date();

        return (
          <div key={key} className={styles.card}>
            <div className={styles.cardType}>{item.type}</div>
            <div className={styles.cardTitle}>{item.title || item.content}</div>

            {isActive && (
              <div className={styles.activeStatus}>
                ✅ Promoted until {new Date(item.promoted_until).toLocaleDateString()}
                {item.promo_region ? ` · ${item.promo_region} only` : " · Worldwide"}
              </div>
            )}

            <div className={styles.controlsRow}>
              <select
                className={styles.select}
                value={cfg.region}
                onChange={(e) => updateConfig(key, "region", e.target.value)}
              >
                <option value="">🌍 Worldwide</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                className={styles.numberInput}
                type="number"
                min={1}
                value={cfg.days}
                onChange={(e) => updateConfig(key, "days", Number(e.target.value))}
                placeholder="Days"
              />
            </div>

            <button
              className={styles.promoteBtn}
              onClick={() => handlePromote(item)}
              disabled={busy === key}
            >
              {busy === key ? "..." : isActive ? "Update Promotion" : "Promote"}
            </button>

            {isActive && (
              <button
                className={styles.removeBtn}
                onClick={() => handleRemove(item)}
                disabled={busy === key}
                style={{ marginTop: 6 }}
              >
                Remove Promotion
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}