"use client";

import { useState } from "react";
import { createCommunity } from "../actions";
import styles from "./page.module.css";
import { PiggyBank, BookOpen, Dumbbell, Clock, Target } from "lucide-react";

const CATEGORIES = [
  { id: "savings", Icon: PiggyBank, label: "Savings" },
  { id: "reading", Icon: BookOpen, label: "Reading", unit: "books" },
  { id: "fitness", Icon: Dumbbell, label: "Fitness", unit: "kg" },
  { id: "study", Icon: Clock, label: "Study/Time", unit: "hours" },
  { id: "custom", Icon: Target, label: "Custom" },
];

const CURRENCIES = ["₦", "$", "£", "€", "R", "KSh", "GH₵"];

export default function NewCommunityForm() {
  const [isGoal, setIsGoal] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [currency, setCurrency] = useState("₦");
  const [customUnit, setCustomUnit] = useState("");

  const activeCategory = CATEGORIES.find((c) => c.id === category);
  const resolvedUnit =
    category === "savings" ? currency : category === "custom" ? customUnit : activeCategory?.unit || "";

  return (
    <form action={createCommunity}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="name">Community name</label>
        <input className={styles.input} id="name" name="name" required />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">Description</label>
        <textarea className={styles.textarea} id="description" name="description" />
      </div>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          name="isGoal"
          checked={isGoal}
          onChange={(e) => setIsGoal(e.target.checked)}
        />
        This is a goal-driven micro-community
      </label>

      {isGoal && (
        <>
          <p className={styles.goalExplainer}>
            Everyone tracks their own progress toward a similar goal — like a
            savings challenge or exam prep group — and can cheer each other on.
          </p>

          <label className={styles.label}>Goal category</label>
          <div className={styles.categoryGrid}>
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`${styles.categoryChip} ${category === c.id ? styles.categoryChipSelected : ""}`}
                onClick={() => setCategory(c.id)}
              >
                <c.Icon size={22} strokeWidth={2} color={category === c.id ? "var(--coral)" : "var(--text-secondary)"} />
                <span className={styles.categoryLabel}>{c.label}</span>
              </button>
            ))}
          </div>

          {category === "savings" && (
            <div className={styles.currencyRow}>
              {CURRENCIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`${styles.currencyChip} ${currency === c ? styles.currencyChipSelected : ""}`}
                  onClick={() => setCurrency(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {category === "custom" && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="customUnit">What are you measuring?</label>
              <input
                className={styles.input}
                id="customUnit"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                placeholder="e.g. steps, chapters, sales"
              />
            </div>
          )}

          {category && (
            <>
              <label className={styles.label}>Target</label>
              <div className={styles.targetInputWrap}>
                {resolvedUnit && <span className={styles.targetUnit}>{resolvedUnit}</span>}
                <input
                  className={styles.targetInput}
                  type="number"
                  name="goalTarget"
                  placeholder="e.g. 500000"
                  required
                />
              </div>
            </>
          )}

          <input type="hidden" name="goalMetricLabel" value={resolvedUnit} />
          <input type="hidden" name="goalCategory" value={category || ""} />

          <div className={styles.field}>
            <label className={styles.label} htmlFor="goalDeadline">Deadline (optional)</label>
            <input className={styles.input} id="goalDeadline" name="goalDeadline" type="date" />
          </div>
        </>
      )}

      <button className={styles.submit} type="submit">
        Create community
      </button>
    </form>
  );
}