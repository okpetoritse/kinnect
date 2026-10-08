"use client";

import { useEffect, useState } from "react";
import BackButton from "@/components/BackButton";
import {
  DEFAULT_PREFS,
  getMediaPrefs,
  setMediaPrefs,
  type MediaPrefs,
} from "@/lib/media/mediaPrefs";
import styles from "./page.module.css";

const SAVE_OPTIONS: { key: keyof MediaPrefs; label: string; hint: string }[] = [
  {
    key: "autoSavePhotos",
    label: "Auto-save received photos",
    hint: "Saves a photo to your device when you open it. Off by default.",
  },
  {
    key: "autoSaveVideos",
    label: "Auto-save received videos",
    hint: "Saves a video to your device when you open it. Off by default.",
  },
];

const DOWNLOAD_OPTIONS: { key: keyof MediaPrefs; label: string; hint: string }[] = [
  {
    key: "autoDownloadWifi",
    label: "Auto-download on Wi-Fi",
    hint: "Photos and videos load automatically on Wi-Fi.",
  },
  {
    key: "autoDownloadMobile",
    label: "Auto-download on mobile data",
    hint: "Turn off to save data — media shows a tap-to-download tile instead.",
  },
];

export default function MediaSettingsPage() {
  const [prefs, setPrefs] = useState<MediaPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(getMediaPrefs());
  }, []);

  function toggle(key: keyof MediaPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setMediaPrefs(next);
  }

  function renderRow(opt: { key: keyof MediaPrefs; label: string; hint: string }) {
    const on = prefs[opt.key];
    return (
      <div key={opt.key} className={styles.row}>
        <div className={styles.rowText}>
          <div className={styles.rowLabel}>{opt.label}</div>
          <div className={styles.rowHint}>{opt.hint}</div>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label={opt.label}
          className={`${styles.switch} ${on ? styles.switchOn : ""}`}
          onClick={() => toggle(opt.key)}
        >
          <span className={styles.knob} />
        </button>
      </div>
    );
  }

  return (
    <main className={styles.wrapper}>
      <BackButton href="/profile" />
      <h1 className={styles.title}>Media &amp; Storage</h1>
      <p className={styles.intro}>
        Control how Kinnect handles photos and videos. These settings apply to this device only.
      </p>

      <div className={styles.group}>Saving</div>
      {SAVE_OPTIONS.map(renderRow)}

      <div className={styles.group}>Data usage</div>
      {DOWNLOAD_OPTIONS.map(renderRow)}
    </main>
  );
}