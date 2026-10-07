"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getFriendsWithActiveStories, getMyActiveStories, getStoryEntries } from "@/app/stories/actions";
import Avatar from "@/components/Avatar";
import StoryViewer from "@/components/StoryViewer";
import CreateStoryModal from "@/components/CreateStoryModal";
import styles from "./ActivityStrip.module.css";

function formatTimeLeft(expiresAt: string | null) {
  if (!expiresAt) return "";
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return "Expiring";
  const hours = Math.floor(msLeft / 3600000);
  if (hours >= 1) return `${hours}h left`;
  const mins = Math.floor(msLeft / 60000);
  return `${mins}m left`;
}

export default function ActivityStrip({
  currentUserId,
  myName,
  myAvatarUrl,
}: {
  currentUserId: string;
  myName: string;
  myAvatarUrl: string | null;
}) {
  const [friends, setFriends] = useState<any[]>([]);
  const [myStories, setMyStories] = useState<any[]>([]);
  const [viewing, setViewing] = useState<{ name: string; avatarUrl: string | null; ownerId: string; entries: any[] } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function refresh() {
    const [f, mine] = await Promise.all([getFriendsWithActiveStories(), getMyActiveStories()]);
    setFriends(f);
    setMyStories(mine);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleOpen(ownerId: string, name: string, avatarUrl: string | null) {
    const entries = await getStoryEntries(ownerId);
    if (entries.length === 0) return;
    setViewing({ name, avatarUrl, ownerId, entries });
  }

  const myEarliestExpiry = myStories.length > 0
    ? myStories.reduce((min, s) => (new Date(s.expires_at) < new Date(min) ? s.expires_at : min), myStories[0].expires_at)
    : null;

  return (
    <>
      <div className={styles.strip}>
        <div className={styles.item} onClick={() => setShowCreate(true)}>
          <div className={styles.addCircle}>
            <Plus size={22} />
          </div>
          <div className={styles.name}>Add story</div>
        </div>

        {myStories.length > 0 && (
          <div className={styles.item} onClick={() => handleOpen(currentUserId, "Your story", myAvatarUrl)}>
            <div className={styles.ring} style={{ background: "var(--border-subtle)" }}>
              <div className={styles.ringInner}>
                <Avatar name={myName} avatarUrl={myAvatarUrl} size={50} />
              </div>
            </div>
            <div className={styles.name}>You</div>
            <div className={styles.timeLeft}>{formatTimeLeft(myEarliestExpiry)}</div>
          </div>
        )}

        {friends.map((f) => (
          <div key={f.id} className={styles.item} onClick={() => handleOpen(f.id, f.name, f.avatarUrl)}>
            <div
              className={styles.ring}
              style={{
                background: f.hasUnseen
                  ? "linear-gradient(135deg, var(--coral), var(--amber))"
                  : "var(--border-subtle)",
              }}
            >
              <div className={styles.ringInner}>
                <Avatar name={f.name} avatarUrl={f.avatarUrl} size={50} />
              </div>
            </div>
            <div className={styles.name}>{f.name.split(" ")[0]}</div>
            <div className={styles.timeLeft}>{formatTimeLeft(f.expiresAt)}</div>
          </div>
        ))}
      </div>

      {viewing && (
        <StoryViewer
          name={viewing.name}
          avatarUrl={viewing.avatarUrl}
          ownerId={viewing.ownerId}
          entries={viewing.entries}
          currentUserId={currentUserId}
          onClose={() => {
            setViewing(null);
            refresh();
          }}
        />
      )}

      {showCreate && (
        <CreateStoryModal
          onClose={() => setShowCreate(false)}
          onPosted={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      )}
    </>
  );
}