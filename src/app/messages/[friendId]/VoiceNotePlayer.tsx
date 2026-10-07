"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { getWaveformPeaks } from "@/lib/audio/getWaveformPeaks";
import styles from "./VoiceNotePlayer.module.css";

const RING_RADIUS = 15;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function VoiceNotePlayer({
  audioUrl,
  duration,
  isMine,
  autoPlay = false,
}: {
  audioUrl: string;
  duration: number;
  isMine: boolean;
  autoPlay?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [peaks, setPeaks] = useState<number[]>(Array(32).fill(0.3));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    getWaveformPeaks(audioUrl, 32).then(setPeaks);
  }, [audioUrl]);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    audio.onended = () => {
      setPlaying(false);
      setProgress(0);
    };

    if (autoPlay) {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }

    return () => {
      audio.pause();
      audio.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  }

  const ringOffset = RING_CIRCUMFERENCE * (1 - progress);
  const displaySeconds = Math.round((1 - progress) * duration);

  return (
    <div className={styles.wrapper}>
      <div className={styles.playBtnWrap}>
        <svg width="36" height="36" className={styles.progressRing}>
          <circle cx="18" cy="18" r={RING_RADIUS} fill="none" stroke="var(--border-subtle)" strokeWidth="2" />
          <circle
            cx="18"
            cy="18"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--coral)"
            strokeWidth="2"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={ringOffset}
            strokeLinecap="round"
          />
        </svg>
        <button className={styles.playBtn} onClick={togglePlay}>
          {playing ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" style={{ marginLeft: 1 }} />}
        </button>
      </div>

      <div className={styles.waveform} onClick={handleSeek}>
        {peaks.map((p, i) => {
          const barPosition = i / peaks.length;
          const isPlayed = barPosition <= progress;
          return (
            <div
              key={i}
              className={`${styles.bar} ${isPlayed ? styles.barPlayed : ""} ${
                playing && isPlayed && barPosition > progress - 0.03 ? styles.barPulsing : ""
              }`}
              style={{ height: `${8 + p * 20}px` }}
            />
          );
        })}
      </div>

      <div className={styles.duration}>{playing ? `0:${displaySeconds.toString().padStart(2, "0")}` : `0:${duration.toString().padStart(2, "0")}`}</div>
    </div>
  );
}