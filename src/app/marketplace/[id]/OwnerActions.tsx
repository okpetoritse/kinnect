
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  markListingSold,
  deleteListing,
  restoreListing,
} from "../actions";
import styles from "./page.module.css";

type ListingStatus = "active" | "sold" | "removed";

export default function OwnerActions({
  listingId,
  status,
}: {
  listingId: string;
  status: ListingStatus;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleMarkSold() {
    setBusy(true);
    setMessage("");

    try {
      const result = await markListingSold(listingId);

      if (result.error) {
        setMessage(result.error);
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    const confirmed = window.confirm(
      "Remove this listing from Marketplace? You can restore it later."
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage("");

    try {
      const result = await deleteListing(listingId);

      if (result.error) {
        setMessage(result.error);
        return;
      }

      router.push("/marketplace/my-listings?status=removed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setBusy(true);
    setMessage("");

    try {
      const result = await restoreListing(listingId);

      if (result.error) {
        setMessage(result.error);
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.actions}>
      <Link
        href={`/marketplace/${listingId}/edit`}
        className={styles.ownerBtn}
      >
        Edit listing
      </Link>

      {status === "active" && (
        <>
          <button
            className={styles.ownerBtn}
            onClick={handleMarkSold}
            disabled={busy}
          >
            {busy ? "Please wait..." : "Mark as sold"}
          </button>

          <button
            className={styles.ownerBtn}
            onClick={handleRemove}
            disabled={busy}
          >
            Remove
          </button>
        </>
      )}

      {status === "sold" && (
        <>
          <button
            className={styles.ownerBtn}
            onClick={handleRestore}
            disabled={busy}
          >
            {busy ? "Please wait..." : "Restore listing"}
          </button>

          <button
            className={styles.ownerBtn}
            onClick={handleRemove}
            disabled={busy}
          >
            Remove
          </button>
        </>
      )}

      {status === "removed" && (
        <button
          className={styles.ownerBtn}
          onClick={handleRestore}
          disabled={busy}
        >
          {busy ? "Please wait..." : "Restore listing"}
        </button>
      )}

      {message && (
        <p className={styles.ownerActionError} role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
