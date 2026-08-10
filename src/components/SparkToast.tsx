"use client";

import styles from "./SparkToast.module.css";

export default function SparkToast({ message }: { message: string }) {
  return <div className={styles.toast}>{message}</div>;
}