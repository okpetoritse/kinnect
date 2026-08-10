"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import styles from "./PageHeader.module.css";

export default function PageHeader({ title }: { title: string }) {
  const router = useRouter();

  return (
    <div className={styles.header}>
      <button className={styles.backBtn} onClick={() => router.back()}>
        <ArrowLeft size={18} />
      </button>
      <div className={styles.title}>{title}</div>
    </div>
  );
}