"use client";

import { useEffect, useRef, useState } from "react";
import {
  sendCommunityMessage,
  sendCommunityMediaMessage,
  sendCommunityStickerMessage,
} from "../../actions";
import { createClient } from "@/lib/supabase/client";
import { uploadMedia } from "@/lib/media/uploadMedia";
import { STICKERS, type StickerId } from "@/lib/stickers/stickers";
import Avatar from "@/components/Avatar";
import styles from "./page.module.css";
import { Smile, Image as ImageIcon, Send } from "lucide-react";
import { getMessageSparks, toggleMessageSpark } from "../../actions";
import SparkButton from "@/components/SparkButton";
import SparkToast from "@/components/SparkToast";


type Message = {
  id: string;
  sender_id: string;
  content: string;
  image_url?: string | null;
  video_url?: string | null;
  sticker_id?: string | null;
  created_at: string;
  sender?: { id: string; full_name: string | null } | null;
  sparkedUserIds?: string[];
};

export default function GroupChat({
  communityId,
  currentUserId,
  currentUserName,
  initialMessages,
}: {
  communityId: string;
  currentUserId: string;
  currentUserName: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [showStickers, setShowStickers] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const avatarRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`community-chat-${communityId}`)
      .on("broadcast", { event: "new_message" }, (payload) => {
        const newMsg = payload.payload as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .on("broadcast", { event: "msg_spark_update" }, (payload) => {
        const { messageId, sparkedUserIds, sparkerId, sparkerName, isAdding } =
          payload.payload as {
            messageId: string;
            sparkedUserIds: string[];
            sparkerId: string;
            sparkerName: string;
            isAdding: boolean;
          };

        setMessages((prev) => {
          const target = prev.find((m) => m.id === messageId);
          if (
            isAdding &&
            target?.sender_id === currentUserId &&
            sparkerId !== currentUserId
          ) {
            setToastMsg(`✦ ${sparkerName} sparked your message`);
            setTimeout(() => setToastMsg(null), 2600);
          }
          return prev.map((m) =>
            m.id === messageId ? { ...m, sparkedUserIds } : m
          );
        });
      })

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [communityId]);

  useEffect(() => {
    async function loadSparks() {
      const ids = messages.map((m) => m.id).filter((id) => !id.startsWith("temp-"));
      if (ids.length === 0) return;

      const sparks = await getMessageSparks(ids);
      const byMsg = new Map<string, string[]>();
      sparks.forEach((s) => {
        const list = byMsg.get(s.message_id) || [];
        list.push(s.user_id);
        byMsg.set(s.message_id, list);
      });

      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          sparkedUserIds: byMsg.get(m.id) || m.sparkedUserIds || [],
        }))
      );
    }
    loadSparks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, uploading]);

  async function handleSend() {
    const content = text.trim();
    if (!content) return;
    setText("");

    const newMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      sender: { id: currentUserId, full_name: currentUserName },
    };

    setMessages((prev) => [...prev, newMsg]);

    channelRef.current?.send({
      type: "broadcast",
      event: "new_message",
      payload: newMsg,
    });

    await sendCommunityMessage(communityId, content);
  }

  async function handleSparkTap(msg: Message) {
    const current = msg.sparkedUserIds || [];
    const alreadySparked = current.includes(currentUserId);
    const isAdding = !alreadySparked;

    const updated = isAdding
      ? [...current, currentUserId]
      : current.filter((id) => id !== currentUserId);

    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, sparkedUserIds: updated } : m))
    );

    channelRef.current?.send({
      type: "broadcast",
      event: "msg_spark_update",
      payload: {
        messageId: msg.id,
        sparkedUserIds: updated,
        sparkerId: currentUserId,
        sparkerName: currentUserName,
        isAdding,
      },
    });

    await toggleMessageSpark(msg.id);
  }

  async function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);

    const result = await uploadMedia("chat-images", communityId, file);

    if (result.error || !result.url) {
      console.error(result.error);
      setUploading(false);
      return;
    }

    const newMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      content: "",
      image_url: result.type === "image" ? result.url : null,
      video_url: result.type === "video" ? result.url : null,
      created_at: new Date().toISOString(),
      sender: { id: currentUserId, full_name: currentUserName },
    };

    setMessages((prev) => [...prev, newMsg]);

    channelRef.current?.send({
      type: "broadcast",
      event: "new_message",
      payload: newMsg,
    });

    setUploading(false);
    await sendCommunityMediaMessage(communityId, result.url, result.type!);
  }

  async function handleStickerSelect(stickerId: StickerId) {
    setShowStickers(false);

    const newMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      content: "",
      sticker_id: stickerId,
      created_at: new Date().toISOString(),
      sender: { id: currentUserId, full_name: currentUserName },
    };

    setMessages((prev) => [...prev, newMsg]);

    channelRef.current?.send({
      type: "broadcast",
      event: "new_message",
      payload: newMsg,
    });

    await sendCommunityStickerMessage(communityId, stickerId);
  }

  return (
    <>
      {toastMsg && <SparkToast message={toastMsg} />}
      <div className={styles.thread}>
        {messages.length > 0 ? (
          messages.map((msg, i) => {
            const isMine = msg.sender_id === currentUserId;
            const prev = messages[i - 1];
            const showName = !isMine && prev?.sender_id !== msg.sender_id;

            return (
              <div key={msg.id}>
                {showName && (
                  <div className={styles.senderName}>
                    {msg.sender?.full_name || "Unknown"}
                  </div>
                )}
                <div
                  className={`${styles.messageRow} ${
                    isMine ? styles.messageRowMine : ""
                  }`}
                >
                  {!isMine && (
                    <div ref={(el) => { avatarRefs.current[msg.id] = el; }}>
                      <Avatar name={msg.sender?.full_name || "?"} size={26} />
                    </div>
                  )}
                  {msg.video_url ? (
                    <div className={styles.videoBubble}>
                      <video src={msg.video_url} controls />
                    </div>
                  ) : msg.image_url ? (
                    <div className={styles.imageBubble}>
                      <img src={msg.image_url} alt="Shared image" />
                    </div>
                  ) : msg.sticker_id && STICKERS[msg.sticker_id] ? (
                    <div className={styles.stickerBubble}>
                      {STICKERS[msg.sticker_id]}
                    </div>
                  ) : (
                    <div
                      className={`${styles.bubble} ${
                        isMine ? styles.bubbleMine : ""
                      }`}
                    >
                      {msg.content}
                    </div>
                  )}
                </div>
                <div
                  className={`${styles.sparkRow} ${
                    isMine ? styles.sparkRowMine : ""
                  }`}
                >
                  <SparkButton
                    sparked={(msg.sparkedUserIds || []).includes(currentUserId)}
                    count={(msg.sparkedUserIds || []).length}
                    onTap={() => handleSparkTap(msg)}
                    getTarget={() => avatarRefs.current[msg.id]}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className={styles.empty}>No messages yet — say hello.</p>
        )}
        {uploading && (
          <div className={`${styles.messageRow} ${styles.messageRowMine}`}>
            Uploading...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showStickers && (
        <div className={styles.stickerPicker}>
          {Object.keys(STICKERS).map((id) => (
            <button
              key={id}
              className={styles.stickerOption}
              onClick={() => handleStickerSelect(id as StickerId)}
            >
              {STICKERS[id]}
            </button>
          ))}
        </div>
      )}

      <div className={styles.composer}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className={styles.imageInput}
          onChange={handleMediaSelect}
        />
        <button
          className={styles.imageBtn}
          onClick={() => setShowStickers((prev) => !prev)}
        >
          <Smile size={18} />
        </button>
        <button
          className={styles.imageBtn}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon size={18} />
        </button>
        <input
          className={styles.input}
          placeholder="Message the community..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button className={styles.sendBtn} onClick={handleSend}>
          <Send size={17} />
        </button>
      </div>
    </>
  );
}