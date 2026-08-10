import styles from "./AppHeader.module.css";

export default function AppHeader() {
  return (
    <div className={styles.bar}>
      <div className={styles.logo}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          className={styles.mark}
        >
          <circle cx="8" cy="11" r="6.5" fill="var(--coral)" opacity="0.85" />
          <circle cx="14" cy="11" r="6.5" fill="var(--teal)" opacity="0.85" />
        </svg>
        <span className={styles.wordmark}>Kinnect</span>
      </div>
    </div>
  );
}