"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import styles from "./InstallPrompt.module.css";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  async function handleInstall() {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <div className={styles.banner}>
      <Download size={16} />
      <span className={styles.text}>Install Kinnect for faster access</span>
      <button className={styles.installBtn} onClick={handleInstall}>
        Install
      </button>
      <button className={styles.closeBtn} onClick={() => setDismissed(true)}>
        <X size={14} />
      </button>
    </div>
  );
}