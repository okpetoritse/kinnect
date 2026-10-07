"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { getFriendsWithActiveStories, getMyActiveStories, getStoryEntries } from "@/app/stories/actions";
import Avatar from "@/components/Avatar";
import StoryViewer from "@/components/StoryViewer";
import CreateStoryModal from "@/components/CreateStoryModal";
import styles from "@/app/home/page.module.css";

export default function StoryStrip({
  currentUserId,
  myName,
  myAvatarUrl,
}: {
  currentUserId: string;
  myName: string;
  myAvatarUrl: string | null;
}) {
  const [friends, setFriends] = useState<any[]>([]);
  const [myStoryCount, setMyStoryCount] = useState(0);
  const [viewing, setViewing] = useState<{ name: string; avatarUrl: string | null; ownerId: string; entries: any[] } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function refresh() {
    const [f, mine] = await Promise.all([getFriendsWithActiveStories(), getMyActiveStories()]);
    setFriends(f);
    setMyStoryCount(mine.length);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleOpen(ownerId: string, name: string, avatarUrl: string | null) {
    const entries = await getStoryEntries(ownerId);
    if (entries.length === 0) return;
    setViewing({ name, avatarUrl, ownerId, entries });
  }

  return (
    <>
      <div className={styles.storyStrip}>
        <div className={styles.storyItem} onClick={() => setShowCreate(true)}>
          <div className={styles.addStoryCircle}>
            <Plus size={22} />
          </div>
          <div className={styles.storyName}>Add story</div>
        </div>

        {myStoryCount > 0 && (
          <div className={styles.storyItem} onClick={() => handleOpen(currentUserId, "Your story", myAvatarUrl)}>
            <div className={styles.storyRing} style={{ background: "var(--border-subtle)" }}>
              <Avatar name={myName} avatarUrl={myAvatarUrl} size={48} />
            </div>
            <div className={styles.storyName}>You</div>
          </div>
        )}

        {friends.map((f) => (
          <div key={f.id} className={styles.storyItem} onClick={() => handleOpen(f.id, f.name, f.avatarUrl)}>
            <div className={`${styles.storyRing} ${f.hasUnseen ? styles.storyRingUnseen : styles.storyRingSeen}`}>
              <Avatar name={f.name} avatarUrl={f.avatarUrl} size={48} />
            </div>
            <div className={styles.storyName}>{f.name.split(" ")[0]}</div>
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