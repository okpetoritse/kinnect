"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  MoreVertical,
  CornerUpLeft,
  Smile,
  Download,
  Check,
  Share2,
  Forward,
  Copy,
  Trash2,
  Info,
  RotateCw,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import {
  getMessagesFriendsPaginated,
  sendMediaCollection,
} from "@/app/messages/actions";
import { getMediaPrefs, isSaved, markSaved, saveToDevice } from "@/lib/media/mediaPrefs";
import styles from "./MediaViewer.module.css";

type MediaItem = { url: string; type: "image" | "video" };
type Meta = { size?: number; width?: number; height?: number; duration?: number };

// Remembers already-downloaded images for the session so reopening is instant
// and never re-spends the user's data.
const imageCache = new Map<string, string>();

function filenameFor(item: MediaItem, i: number) {
  const ext = item.url.split("?")[0].split(".").pop() || (item.type === "video" ? "mp4" : "jpg");
  return `kinnect-${Date.now()}-${i + 1}.${ext}`;
}

function formatBytes(n?: number) {
  if (!n) return "Unknown";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(s?: number) {
  if (!s || !isFinite(s)) return "Unknown";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

function ViewerImage({ url, onMeta }: { url: string; onMeta: (m: Meta) => void }) {
  const [state, setState] = useState<"preparing" | "downloading" | "ready" | "failed">(
    imageCache.has(url) ? "ready" : "preparing"
  );
  const [pct, setPct] = useState(0);
  const [src, setSrc] = useState<string | null>(imageCache.get(url) || null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const cached = imageCache.get(url);
    if (cached) {
      setSrc(cached);
      setState("ready");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        setState("preparing");
        setPct(0);
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok || !res.body) throw new Error("bad response");

        const total = Number(res.headers.get("content-length")) || 0;
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        setState("downloading");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (total && !cancelled) setPct(Math.round((received / total) * 100));
        }

        const blob = new Blob(chunks as unknown as BlobPart[], {
          type: res.headers.get("content-type") || "image/jpeg",
        });
        const objectUrl = URL.createObjectURL(blob);
        imageCache.set(url, objectUrl);
        if (!cancelled) {
          setSrc(objectUrl);
          setState("ready");
          onMeta({ size: blob.size });
        }
      } catch (err: any) {
        if (!cancelled && err?.name !== "AbortError") setState("failed");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, retryKey]);

  return (
    <>
      {src && state === "ready" && (
        <img
          src={src}
          alt="Shared photo"
          className={styles.media}
          onLoad={(e) =>
            onMeta({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
          }
        />
      )}
      {state !== "ready" && (
        <div className={styles.status} role="status">
          {state === "failed" ? (
            <>
              <span>Couldn&apos;t load photo</span>
              <button className={styles.retryBtn} onClick={() => setRetryKey((k) => k + 1)}>
                <RotateCw size={14} /> Retry
              </button>
            </>
          ) : state === "downloading" ? (
            <span>Downloading{pct ? ` ${pct}%` : "…"}</span>
          ) : (
            <span>Preparing…</span>
          )}
        </div>
      )}
    </>
  );
}

function ViewerVideo({
  url,
  active,
  onMeta,
}: {
  url: string;
  active: boolean;
  onMeta: (m: Meta) => void;
}) {
  const [state, setState] = useState<"preparing" | "buffering" | "ready" | "failed">("preparing");
  const [retryKey, setRetryKey] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!active) ref.current?.pause();
  }, [active]);

  return (
    <>
      <video
        key={retryKey}
        ref={ref}
        src={url}
        controls
        playsInline
        preload={active ? "auto" : "none"}
        className={styles.media}
        aria-label="Shared video"
        onLoadStart={() => setState("preparing")}
        onWaiting={() => setState("buffering")}
        onCanPlay={() => setState("ready")}
        onPlaying={() => setState("ready")}
        onError={() => setState("failed")}
        onLoadedMetadata={(e) =>
          onMeta({
            duration: e.currentTarget.duration,
            width: e.currentTarget.videoWidth,
            height: e.currentTarget.videoHeight,
          })
        }
      />
      {state !== "ready" && (
        <div className={styles.status} role="status">
          {state === "failed" ? (
            <>
              <span>Couldn&apos;t load video</span>
              <button
                className={styles.retryBtn}
                onClick={() => {
                  setState("preparing");
                  setRetryKey((k) => k + 1);
                }}
              >
                <RotateCw size={14} /> Retry
              </button>
            </>
          ) : (
            <span>{state === "buffering" ? "Buffering…" : "Preparing…"}</span>
          )}
        </div>
      )}
    </>
  );
}

function ForwardSheet({
  items,
  caption,
  onClose,
  onDone,
}: {
  items: MediaItem[];
  caption: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [friends, setFriends] = useState<any[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    getMessagesFriendsPaginated().then((r) => setFriends(r.friends || []));
  }, []);

  async function forward(friendId: string) {
    setSendingId(friendId);
    const result = await sendMediaCollection(friendId, caption, items);
    setSendingId(null);
    if (result.success) onDone();
    else alert(result.error || "Could not forward");
  }

  return (
    <div className={styles.sheetBackdrop} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetTitle}>Forward to</div>
        {friends.length === 0 && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Loading…</div>}
        {friends.map((f) => (
          <button key={f.id} className={styles.sheetRow} onClick={() => forward(f.id)} disabled={sendingId !== null}>
            <Avatar name={f.full_name || "?"} avatarUrl={f.avatar_url} size={36} />
            <span>{f.username ? `@${f.username}` : f.full_name}</span>
            {sendingId === f.id && <span style={{ marginLeft: "auto", fontSize: 12 }}>Sending…</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MediaViewer({
  items,
  startIndex,
  caption,
  senderName,
  senderAvatarUrl,
  sentAt,
  isMine,
  reactionEmojis,
  onClose,
  onReply,
  onReact,
  onDelete,
}: {
  items: MediaItem[];
  startIndex: number;
  caption?: string | null;
  senderName: string;
  senderAvatarUrl: string | null;
  sentAt: string;
  isMine: boolean;
  reactionEmojis: string[];
  onClose: () => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onDelete: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [showMenu, setShowMenu] = useState(false);
  const [showReact, setShowReact] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<number, Meta>>({});
  const [, setSavedTick] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const item = items[index];

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  function updateMeta(i: number, m: Meta) {
    setMeta((prev) => ({ ...prev, [i]: { ...prev[i], ...m } }));
  }

  useEffect(() => {
    const el = sliderRef.current;
    if (el) el.scrollLeft = startIndex * el.clientWidth;
  }, [startIndex]);

  // "Auto-save" on the web can't happen silently in the background, so it
  // saves the item you actually open, once, if you've turned that on.
  useEffect(() => {
    if (isMine) return;
    const first = items[startIndex];
    if (!first) return;
    const prefs = getMediaPrefs();
    const wanted = first.type === "image" ? prefs.autoSavePhotos : prefs.autoSaveVideos;
    if (wanted && !isSaved(first.url)) {
      saveToDevice(first.url, filenameFor(first, startIndex)).then((ok) => {
        if (ok) {
          markSaved(first.url);
          setSavedTick((t) => t + 1);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the file size for the Details panel only when it's opened.
  useEffect(() => {
    if (!showDetails || meta[index]?.size) return;
    fetch(item.url, { method: "HEAD" })
      .then((r) => {
        const size = Number(r.headers.get("content-length")) || undefined;
        if (size) updateMeta(index, { size });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDetails, index]);

  function handleScroll() {
    const el = sliderRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== index) {
      setIndex(next);
      setShowReact(false);
    }
  }

  async function handleSave() {
    if (isSaved(item.url)) return;
    flash("Saving…");
    const ok = await saveToDevice(item.url, filenameFor(item, index));
    if (ok) {
      markSaved(item.url);
      setSavedTick((t) => t + 1);
      flash("Saved to Gallery ✓");
    } else {
      flash("Couldn't save — try again");
    }
  }

  async function handleShare() {
    setShowMenu(false);
    try {
      if (navigator.share) {
        try {
          const res = await fetch(item.url);
          const blob = await res.blob();
          const file = new File([blob], filenameFor(item, index), { type: blob.type });
          if ((navigator as any).canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text: caption || undefined });
            return;
          }
        } catch {}
        await navigator.share({ url: item.url, text: caption || undefined });
      } else {
        await navigator.clipboard.writeText(item.url);
        flash("Link copied");
      }
    } catch {
      // user cancelled the share sheet — nothing to do
    }
  }

  async function handleCopyCaption() {
    setShowMenu(false);
    if (!caption) return;
    await navigator.clipboard.writeText(caption);
    flash("Caption copied");
  }

  function handleDelete() {
    setShowMenu(false);
    if (confirm("Delete this message for everyone?")) onDelete();
  }

  const saved = isSaved(item.url);
  const m = meta[index] || {};

  return (
    <div className={styles.overlay} role="dialog" aria-label="Media viewer">
      <div className={styles.header}>
        <button className={styles.iconBtn} onClick={onClose} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <Avatar name={senderName} avatarUrl={senderAvatarUrl} size={32} />
        <div className={styles.who}>
          <div className={styles.whoName}>{senderName}</div>
          <div className={styles.whoTime}>
            {new Date(sentAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })}
          </div>
        </div>
        <div className={styles.menuWrap}>
          <button className={styles.iconBtn} onClick={() => setShowMenu((p) => !p)} aria-label="More options">
            <MoreVertical size={20} />
          </button>
          {showMenu && (
            <div className={styles.menu}>
              <button
                className={styles.menuItem}
                onClick={() => {
                  setShowMenu(false);
                  setShowForward(true);
                }}
              >
                <Forward size={16} /> Forward
              </button>
              {caption && (
                <button className={styles.menuItem} onClick={handleCopyCaption}>
                  <Copy size={16} /> Copy caption
                </button>
              )}
              <button
                className={styles.menuItem}
                onClick={() => {
                  setShowMenu(false);
                  setShowDetails(true);
                }}
              >
                <Info size={16} /> Details
              </button>
              {isMine && (
                <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleDelete}>
                  <Trash2 size={16} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {items.length > 1 && (
        <div className={styles.counter} aria-live="polite">
          {index + 1}/{items.length}
        </div>
      )}

      <div className={styles.slider} ref={sliderRef} onScroll={handleScroll}>
        {items.map((it, i) => (
          <div key={i} className={styles.slide}>
            {it.type === "video" ? (
              <ViewerVideo url={it.url} active={i === index} onMeta={(mm) => updateMeta(i, mm)} />
            ) : (
              <ViewerImage url={it.url} onMeta={(mm) => updateMeta(i, mm)} />
            )}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        {caption && <div className={styles.caption}>{caption}</div>}

        {showReact && (
          <div className={styles.reactRow}>
            {reactionEmojis.map((e) => (
              <button
                key={e}
                className={styles.reactBtn}
                aria-label={`React ${e}`}
                onClick={() => {
                  onReact(e);
                  setShowReact(false);
                  flash("Reaction sent");
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={() => setShowReact((p) => !p)} aria-label="React">
            <Smile size={22} />
            React
          </button>
          <button className={styles.actionBtn} onClick={onReply} aria-label="Reply">
            <CornerUpLeft size={22} />
            Reply
          </button>
          <button className={styles.actionBtn} onClick={handleShare} aria-label="Share">
            <Share2 size={22} />
            Share
          </button>
          <button className={styles.actionBtn} onClick={handleSave} aria-label="Save to gallery">
            {saved ? <Check size={22} /> : <Download size={22} />}
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>

      {showForward && (
        <ForwardSheet
          items={items}
          caption={caption || ""}
          onClose={() => setShowForward(false)}
          onDone={() => {
            setShowForward(false);
            flash("Forwarded");
          }}
        />
      )}

      {showDetails && (
        <div className={styles.sheetBackdrop} onClick={() => setShowDetails(false)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetTitle}>Details</div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Sender</span>
              <span>{senderName}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Date</span>
              <span>{new Date(sentAt).toLocaleString("en-US")}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Type</span>
              <span>{item.type === "video" ? "Video" : "Photo"}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Size</span>
              <span>{formatBytes(m.size)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Dimensions</span>
              <span>{m.width && m.height ? `${m.width} × ${m.height}` : "Unknown"}</span>
            </div>
            {item.type === "video" && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Duration</span>
                <span>{formatDuration(m.duration)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}