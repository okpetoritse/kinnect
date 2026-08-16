"use client";

import { useState } from "react";
import { deleteAccount } from "./actions";
import styles from "./page.module.css";

export default function DeleteAccountButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await deleteAccount();
  }

  return (
    <>
      <button className={styles.deleteBtn} onClick={() => setShowConfirm(true)}>
        Delete account
      </button>

      {showConfirm && (
        <div className={styles.confirmOverlay} onClick={() => setShowConfirm(false)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmTitle}>Delete your account?</div>
            <div className={styles.confirmBody}>
              This permanently deletes your profile, messages, posts, and listings.
              This cannot be undone. Type <strong>DELETE</strong> to confirm.
            </div>
            <input
              className={styles.confirmInput}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
            />
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button
                className={styles.confirmDeleteBtn}
                onClick={handleDelete}
                disabled={confirmText !== "DELETE" || deleting}
              >
                {deleting ? "Deleting..." : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}