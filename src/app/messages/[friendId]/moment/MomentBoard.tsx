"use client";

import { useRef, useState } from "react";
import { addMomentItem } from "../../moment-actions";
import { uploadMedia } from "@/lib/media/uploadMedia";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import VoiceNotePlayer from "../VoiceNotePlayer";
import { Camera, Video, StickyNote, Mic } from "lucide-react";
import styles from "./page.module.css";

type Item = {
  id: string;
  author_id: string;
  type: "photo" | "video" | "note" | "voice";
  content_text: string | null;
  media_url: string | null;
  media_duration: number | null;
  created_at: string;
  author: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

export default function MomentBoard({
  momentId,
  currentUserId,
  initialItems,
}: {
  momentId: string;
  currentUserId: string;
  initialItems: Item[];
}) {
  const [items, setItems] = useState(initialItems);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [recording, setRecording] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

 async function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>, type: "photo" | "video") {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    console.log("Uploading:", file.name, file.type, file.size);
    const result = await uploadMedia("shared-moments", momentId, file);
    console.log("Upload result:", result);

    if (!result.url) {
      alert(result.error || "Upload failed for an unknown reason");
      return;
    }

    await addMomentItem(momentId, type, { mediaUrl: result.url });

    const optimistic: Item = {
      id: `temp-${Date.now()}`,
      author_id: currentUserId,
      type,
      content_text: null,
      media_url: result.url,
      media_duration: null,
      created_at: new Date().toISOString(),
      author: null,
    };
    setItems((prev) => [optimistic, ...prev]);
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    await addMomentItem(momentId, "note", { contentText: noteText.trim() });

    const optimistic: Item = {
      id: `temp-${Date.now()}`,
      author_id: currentUserId,
      type: "note",
      content_text: noteText.trim(),
      media_url: null,
      media_duration: null,
      created_at: new Date().toISOString(),
      author: null,
    };
    setItems((prev) => [optimistic, ...prev]);
    setNoteText("");
    setShowNoteModal(false);
  }

  async function handleVoiceRecord() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      setRecording(true);

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const supabase = createClient();
        const filePath = `${currentUserId}/moment-${Date.now()}.webm`;
        const { error } = await supabase.storage.from("voice-notes").upload(filePath, blob);
        if (error) return;
        const { data: { publicUrl } } = supabase.storage.from("voice-notes").getPublicUrl(filePath);

        await addMomentItem(momentId, "voice", { mediaUrl: publicUrl, mediaDuration: 5 });

        const optimistic: Item = {
          id: `temp-${Date.now()}`,
          author_id: currentUserId,
          type: "voice",
          content_text: null,
          media_url: publicUrl,
          media_duration: 5,
          created_at: new Date().toISOString(),
          author: null,
        };
        setItems((prev) => [optimistic, ...prev]);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setTimeout(() => recorder.stop(), 5000);
    } catch (err) {
      console.error(err);
      setRecording(false);
    }
  }

  return (
    <>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleMediaSelect(e, "photo")}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={(e) => handleMediaSelect(e, "video")}
      />

      <div className={styles.addRow}>
        <button className={styles.addBtn} onClick={() => photoInputRef.current?.click()}>
          <Camera size={18} />
          Photo
        </button>
        <button className={styles.addBtn} onClick={() => videoInputRef.current?.click()}>
          <Video size={18} />
          Video
        </button>
        <button className={styles.addBtn} onClick={() => setShowNoteModal(true)}>
          <StickyNote size={18} />
          Note
        </button>
        <button className={styles.addBtn} onClick={handleVoiceRecord} disabled={recording}>
          <Mic size={18} />
          {recording ? "..." : "Voice"}
        </button>
      </div>

      <div className={styles.timeline}>
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className={styles.item}>
              <div className={styles.itemAuthor}>
                <Avatar
                  name={item.author?.full_name || (item.author_id === currentUserId ? "You" : "?")}
                  avatarUrl={item.author?.avatar_url}
                  size={26}
                />
                <div>
                  <div className={styles.itemAuthorName}>
                    {item.author_id === currentUserId ? "You" : item.author?.full_name || "Friend"}
                  </div>
                  <div className={styles.itemTime}>
                    {new Date(item.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </div>

              {item.type === "photo" && item.media_url && (
                <img src={item.media_url} className={styles.itemMedia} alt="" />
              )}
              {item.type === "video" && item.media_url && (
                <video src={item.media_url} controls className={styles.itemMedia} />
              )}
              {item.type === "voice" && item.media_url && (
                <VoiceNotePlayer
                  audioUrl={item.media_url}
                  duration={item.media_duration || 0}
                  isMine={false}
                />
              )}
              {item.type === "note" && (
                <div className={styles.itemNote}>{item.content_text}</div>
              )}
            </div>
          ))
        ) : (
          <p className={styles.empty}>
            Nothing here yet — add the first photo, note, or voice clip.
          </p>
        )}
      </div>

      {showNoteModal && (
        <div className={styles.noteModal} onClick={() => setShowNoteModal(false)}>
          <div className={styles.noteBox} onClick={(e) => e.stopPropagation()}>
            <textarea
              className={styles.noteTextarea}
              placeholder="Write something..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              autoFocus
            />
            <div className={styles.noteActions}>
              <button className={styles.noteCancel} onClick={() => setShowNoteModal(false)}>
                Cancel
              </button>
              <button className={styles.noteSave} onClick={handleSaveNote}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}