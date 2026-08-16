"use client";

import { useState } from "react";
import { createCommunity } from "../actions";
import styles from "./page.module.css";

export default function NewCommunityForm() {
  const [isGoal, setIsGoal] = useState(false);

  return (
    <form action={createCommunity}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="name">
          Name
        </label>
        <input
          className={styles.input}
          id="name"
          name="name"
          type="text"
          placeholder="Frontend Developers Nigeria"
          required
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">
          Description
        </label>
        <textarea
          className={styles.textarea}
          id="description"
          name="description"
          placeholder="What's this community about?"
        />
      </div>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          name="isGoal"
          checked={isGoal}
          onChange={(e) => setIsGoal(e.target.checked)}
        />
        This is a goal-driven micro-community (e.g. "Save ₦500,000 in 6 months")
      </label>
      {isGoal && (
        <p className={styles.goalExplainer}>
          Everyone tracks their own progress toward a similar goal — like a
          savings challenge or exam prep group — and can cheer each other on.
        </p>
      )}

      {isGoal && (
        <div className={styles.goalFields}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="goalMetricLabel">
              Unit (what are you measuring?)
            </label>
            <input
              className={styles.input}
              id="goalMetricLabel"
              name="goalMetricLabel"
              type="text"
              placeholder="₦, kg, books, %"
            />
          </div>

          <div className={styles.goalFieldsRow}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label} htmlFor="goalTarget">
                Target
              </label>
              <input
                className={styles.input}
                id="goalTarget"
                name="goalTarget"
                type="number"
                placeholder="500000"
              />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label} htmlFor="goalDeadline">
                Deadline (optional)
              </label>
              <input
                className={styles.input}
                id="goalDeadline"
                name="goalDeadline"
                type="date"
              />
            </div>
          </div>
        </div>
      )}

      <button className={styles.submit} type="submit">
        Create community
      </button>
    </form>
  );
}