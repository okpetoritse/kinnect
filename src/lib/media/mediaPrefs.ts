const PREFS_KEY = "kinnect_media_prefs";
const SAVED_KEY = "kinnect_saved_media";

export type MediaPrefs = {
  autoSavePhotos: boolean;
  autoSaveVideos: boolean;
  autoDownloadWifi: boolean;
  autoDownloadMobile: boolean;
};

export const DEFAULT_PREFS: MediaPrefs = {
  autoSavePhotos: false,
  autoSaveVideos: false,
  autoDownloadWifi: true,
  autoDownloadMobile: true,
};

export function getMediaPrefs(): MediaPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setMediaPrefs(prefs: MediaPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

function getSavedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function isSaved(url: string) {
  return getSavedSet().has(url);
}

export function markSaved(url: string) {
  const set = getSavedSet();
  set.add(url);
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(set).slice(-500)));
  } catch {}
}

// Decides whether media should load automatically on the current connection.
// navigator.connection.type is only exposed on Android Chrome; elsewhere we
// can't tell Wi-Fi from mobile data, so we allow loading if either is enabled.
export function shouldAutoDownload(): boolean {
  const prefs = getMediaPrefs();
  const type = (navigator as any).connection?.type as string | undefined;
  if (type === "wifi" || type === "ethernet") return prefs.autoDownloadWifi;
  if (type === "cellular") return prefs.autoDownloadMobile;
  return prefs.autoDownloadWifi || prefs.autoDownloadMobile;
}

export async function saveToDevice(url: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    return true;
  } catch {
    return false;
  }
}