"use client";

import { useEffect, useState } from "react";
import { checkUsernameAvailable, setUsername } from "./actions";
import styles from "./page.module.css";

export default function UsernameEditor({
  initialUsername,
}: {
  initialUsername: string | null;
}) {
  const [value, setValue] = useState(initialUsername || "");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saved, setSaved] = useState(initialUsername);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const clean = value.trim().toLowerCase();
    if (!clean || clean === saved) {
      setStatus(null);
      return;
    }

    const timeout = setTimeout(async () => {
      const result = await checkUsernameAvailable(clean);
      setStatus({
        ok: result.available,
        msg: result.available ? "Available" : result.reason || "Unavailable",
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [value, saved]);

  async function handleSave() {
    setSaving(true);
    const result = await setUsername(value);
    setSaving(false);

    if (result.success) {
      setSaved(result.username || null);
      setStatus({ ok: true, msg: "Saved" });
    } else {
      setStatus({ ok: false, msg: result.error || "Could not save" });
    }
  }

  return (
    <div className={styles.usernameSection}>
      <div className={styles.usernameLabel}>Your username</div>
      {saved && (
        <div className={styles.currentUsername}>
          Share <strong>@{saved}</strong> with friends instead of your email
        </div>
      )}

      <div className={styles.usernameRow}>
        <div className={styles.usernameInputWrap}>
          <span className={styles.atSign}>@</span>
          <input
            className={styles.usernameInput}
            value={value}
            onChange={(e) =>
              setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
            }
            placeholder="yourname"
            maxLength={20}
          />
        </div>
        <button
          className={styles.usernameSaveBtn}
          onClick={handleSave}
          disabled={saving || !value || value === saved || status?.ok === false}
        >
          {saving ? "..." : "Save"}
        </button>
      </div>

      {status && (
        <div
          className={`${styles.usernameStatus} ${
            status.ok ? styles.usernameStatusOk : styles.usernameStatusErr
          }`}
        >
          {status.msg}
        </div>
      )}
    </div>
  );
}