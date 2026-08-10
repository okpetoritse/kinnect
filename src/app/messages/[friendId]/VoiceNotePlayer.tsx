"use client";

import { useRef, useState } from "react";
import styles from "./page.module.css";
import { Play, Pause } from "lucide-react";

export default function VoiceNotePlayer({
  audioUrl,
  duration,
  isMine,
}: {
  audioUrl: string;
  duration: number;
  isMine: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function togglePlay() {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  function handleTimeUpdate() {
    if (!audioRef.current || !duration) return;
    setProgress((audioRef.current.currentTime / duration) * 100);
  }

  function handleEnded() {
    setPlaying(false);
    setProgress(0);
  }

  return (
    <div
      className={`${styles.voiceNoteBubble} ${
        isMine ? styles.voiceNoteBubbleMine : ""
      }`}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      <button className={styles.voiceNotePlayBtn} onClick={togglePlay}>
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>
      <div className={styles.voiceNoteTrack}>
        <div
          className={styles.voiceNoteProgress}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className={styles.voiceNoteDuration}>{formatDuration(duration)}</div>
    </div>
  );
}