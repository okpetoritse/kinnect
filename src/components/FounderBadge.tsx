import styles from "./FounderBadge.module.css";

export default function FounderBadge({ number }: { number: number | null | undefined }) {
  if (!number) return null;
  return (
    <span className={styles.badge} title={`Kinnect Founding Member #${number}`}>
      🏛️ #{number}
    </span>
  );
}