"use client";

import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import styles from "./LiveWaveform.module.css";

const BAR_COUNT = 22;
const SAMPLE_INTERVAL_MS = 70;
const FLOOR = 0.08;

function formatElapsed(seconds: number) {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function LiveWaveform({ stream }: { stream: MediaStream | null }) {
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(FLOOR));
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!stream) return;

    setLevels(Array(BAR_COUNT).fill(FLOOR));
    setElapsed(0);

    const startedAt = Date.now();
    const clock = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      return () => clearInterval(clock);
    }

    const ctx: AudioContext = new AudioCtx();
    ctx.resume().catch(() => {});

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    // Deliberately NOT connected to ctx.destination: we only measure the
    // signal. Connecting it would play your own voice back and cause feedback.
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);

    const sampler = setInterval(() => {
      let level: number;

      if (ctx.state !== "running") {
        // Some browsers keep the context suspended. Keep the bars gently alive
        // so the UI never looks frozen; recording itself is unaffected.
        level = 0.15 + Math.random() * 0.15;
      } else {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Speech RMS is typically 0.02-0.3. Scale and curve it so quiet
        // speech is still visible and loud speech doesn't just clip at max.
        level = Math.min(1, Math.pow(rms * 4, 0.7));
      }

      setLevels((prev) => [...prev.slice(1), Math.max(FLOOR, level)]);
    }, SAMPLE_INTERVAL_MS);

    return () => {
      clearInterval(sampler);
      clearInterval(clock);
      try {
        source.disconnect();
      } catch {}
      ctx.close().catch(() => {});
    };
  }, [stream]);

  return (
    <div className={styles.wrap} role="status" aria-label="Recording voice message">
      <div className={styles.micWrap}>
        <div className={styles.micPulse} />
        <div className={styles.mic}>
          <Mic size={15} />
        </div>
      </div>

      <div className={styles.bars} aria-hidden="true">
        {levels.map((level, i) => (
          <div key={i} className={styles.bar} style={{ height: `${4 + level * 24}px` }} />
        ))}
      </div>

      <div className={styles.time}>{formatElapsed(elapsed)}</div>
    </div>
  );
}