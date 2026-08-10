"use client";

import { useRef, useState } from "react";
import styles from "./SparkButton.module.css";

export default function SparkButton({
  sparked,
  count,
  onTap,
  getTarget,
}: {
  sparked: boolean;
  count: number;
  onTap: () => void;
  getTarget?: () => HTMLElement | null;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [particle, setParticle] = useState<{
    left: number;
    top: number;
    dx: number;
    dy: number;
  } | null>(null);

  function handleClick() {
    if (!sparked && btnRef.current && getTarget) {
      const target = getTarget();
      if (target) {
        const btnRect = btnRef.current.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const startX = btnRect.left + btnRect.width / 2;
        const startY = btnRect.top + btnRect.height / 2;
        const endX = targetRect.left + targetRect.width / 2;
        const endY = targetRect.top + targetRect.height / 2;

        setParticle({
          left: startX,
          top: startY,
          dx: endX - startX,
          dy: endY - startY,
        });
        setTimeout(() => setParticle(null), 650);
      }
    }
    onTap();
  }

  return (
    <button
      ref={btnRef}
      className={`${styles.btn} ${sparked ? styles.btnSparked : ""}`}
      onClick={handleClick}
    >
      <span className={styles.icon}>✦</span>
      {count > 0 && <span className={styles.count}>{count}</span>}
      {particle && (
        <span
          className={styles.travelParticle}
          style={
            {
              left: particle.left,
              top: particle.top,
              "--dx": `${particle.dx}px`,
              "--dy": `${particle.dy}px`,
            } as React.CSSProperties
          }
        >
          ✦
        </span>
      )}
    </button>
  );
}