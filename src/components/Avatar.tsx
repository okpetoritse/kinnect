import styles from "./Avatar.module.css";

export default function Avatar({
  name,
  avatarUrl,
  size = 40,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: size * 0.4 };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={styles.avatarImage}
        style={style}
      />
    );
  }

  return (
    <div className={styles.avatarInitials} style={style}>
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}