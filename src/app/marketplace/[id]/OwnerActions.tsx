"use client";

import { useState } from "react";
import { markListingSold, deleteListing } from "../actions";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function OwnerActions({ listingId }: { listingId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleMarkSold() {
    setBusy(true);
    await markListingSold(listingId);
    router.refresh();
    setBusy(false);
  }

  async function handleRemove() {
    setBusy(true);
    await deleteListing(listingId);
    router.push("/marketplace");
  }

  return (
    <div className={styles.actions}>
      <button className={styles.ownerBtn} onClick={handleMarkSold} disabled={busy}>
        Mark as sold
      </button>
      <button className={styles.ownerBtn} onClick={handleRemove} disabled={busy}>
        Remove
      </button>
    </div>
  );
}