"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  sendMessage,
  sendImageMessage,
  sendStickerMessage,
  sendVoiceNoteMessage,
  markMessagesRead,
} from "../actions";
import {
  blockUser,
  unblockUser,
  checkBlockStatus,
  reportUser,
} from "../safety-actions";
import { createClient } from "@/lib/supabase/client";
import { usePresence } from "@/lib/presence/usePresence";
import { STICKERS, type StickerId } from "@/lib/stickers/stickers";
import Avatar from "@/components/Avatar";
import BackButton from "@/components/BackButton";
import GifPicker from "@/components/GifPicker";
import { useDMCall } from "@/lib/webrtc/useDMCall";
import VoiceNotePlayer from "./VoiceNotePlayer";
import styles from "./page.module.css";
import {
  Phone,
  MoreVertical,
  Plus,
  Camera,
  Image as ImageIcon,
  Smile,
  Mic,
  MicOff,
  Send,
  PhoneOff,
} from "lucide-react";

type Message = {
  id: string;
  sender_id: string;
  content: string | null;
  image_url?: string | null;
  sticker_id?: string | null;
  audio_url?: string | null;
  audio_duration?: number | null;
  created_at?: string;
};

const GROUP_GAP_MS = 5 * 60 * 1000;
const REPORT_REASONS = [
  { id: "spam", label: "Spam" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "inappropriate_content", label: "Inappropriate content" },
  { id: "fake_account", label: "Fake account" },
  { id: "other", label: "Other" },
];

function formatTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateDivider(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return "Today";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function ChatThread({
  friendId,
  friendName,
  friendAvatarUrl,
  currentUserId,
  initialMessages,
}: {
  friendId: string;
  friendName: string;
  friendAvatarUrl: string | null;
  currentUserId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.map((m) => ({
      ...m,
      created_at: m.created_at || new Date().toISOString(),
    }))
  );
  const [text, setText] = useState("");
  const [friendIsTyping, setFriendIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [reportModal, setReportModal] = useState<{ messageId?: string } | null>(
    null
  );
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [iBlockedThem, setIBlockedThem] = useState(false);
  const [theyBlockedMe, setTheyBlockedMe] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  const stopTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);

  const onlineIds = usePresence(currentUserId);
  const friendIsOnline = onlineIds.has(friendId);

  const {
    callState,
    callerName,
    muted: callMuted,
    duration: callDuration,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute: toggleCallMute,
  } = useDMCall(friendId, currentUserId, "You");

  function formatCallDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  useEffect(() => {
    markMessagesRead(friendId);
  }, [friendId]);

  useEffect(() => {
    checkBlockStatus(friendId).then(({ iBlockedThem, theyBlockedMe }) => {
      setIBlockedThem(iBlockedThem);
      setTheyBlockedMe(theyBlockedMe);
    });
  }, [friendId]);

  useEffect(() => {
    const supabase = createClient();
    const roomName = `chat-${[currentUserId, friendId].sort().join("-")}`;

    const channel = supabase
      .channel(roomName)
      .on("broadcast", { event: "new_message" }, (payload) => {
        const newMsg = payload.payload as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setFriendIsTyping(false);
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload.userId !== currentUserId) {
          setFriendIsTyping(true);
          if (stopTypingTimeoutRef.current)
            clearTimeout(stopTypingTimeoutRef.current);
          stopTypingTimeoutRef.current = setTimeout(() => {
            setFriendIsTyping(false);
          }, 3000);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (stopTypingTimeoutRef.current)
        clearTimeout(stopTypingTimeoutRef.current);
    };
  }, [currentUserId, friendId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, friendIsTyping, uploading]);

  const enriched = useMemo(() => {
    return messages.map((msg, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];

      const prevGap = prev?.created_at
        ? new Date(msg.created_at!).getTime() -
          new Date(prev.created_at).getTime()
        : Infinity;
      const nextGap = next?.created_at
        ? new Date(next.created_at).getTime() -
          new Date(msg.created_at!).getTime()
        : Infinity;

      const sameSenderAsPrev = prev?.sender_id === msg.sender_id;
      const sameSenderAsNext = next?.sender_id === msg.sender_id;

      const isFirstInGroup = !(sameSenderAsPrev && prevGap < GROUP_GAP_MS);
      const isLastInGroup = !(sameSenderAsNext && nextGap < GROUP_GAP_MS);

      const showDateDivider =
        !prev ||
        new Date(msg.created_at!).toDateString() !==
          new Date(prev.created_at!).toDateString();

      return { ...msg, isFirstInGroup, isLastInGroup, showDateDivider };
    });
  }, [messages]);

  function handleTextChange(value: string) {
    setText(value);
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId },
    });
  }

  async function handleSend() {
    const content = text.trim();
    if (!content) return;

    setText("");

    const newMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);

    channelRef.current?.send({
      type: "broadcast",
      event: "new_message",
      payload: newMsg,
    });

    await sendMessage(friendId, content);
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";
    setShowAttachMenu(false);
    setUploading(true);

    const supabase = createClient();
    const filePath = `${currentUserId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-images")
      .upload(filePath, file);

    if (uploadError) {
      console.error(uploadError);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("chat-images").getPublicUrl(filePath);

    const newMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      content: null,
      image_url: publicUrl,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);

    channelRef.current?.send({
      type: "broadcast",
      event: "new_message",
      payload: newMsg,
    });

    setUploading(false);
    await sendImageMessage(friendId, publicUrl);
  }

  async function handleGifSelect(gifUrl: string) {
    setShowGifPicker(false);

    const newMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      content: null,
      image_url: gifUrl,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);

    channelRef.current?.send({
      type: "broadcast",
      event: "new_message",
      payload: newMsg,
    });

    await sendImageMessage(friendId, gifUrl);
  }

  async function handleStickerSelect(stickerId: StickerId) {
    setShowStickers(false);

    const newMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      content: null,
      sticker_id: stickerId,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);

    channelRef.current?.send({
      type: "broadcast",
      event: "new_message",
      payload: newMsg,
    });

    await sendStickerMessage(friendId, stickerId);
  }

  async function handleStartRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recordingStartRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const durationSeconds = Math.round(
          (Date.now() - recordingStartRef.current) / 1000
        );

        if (durationSeconds < 1) return;

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const supabase = createClient();
        const filePath = `${currentUserId}/${Date.now()}.webm`;

        const { error: uploadError } = await supabase.storage
          .from("voice-notes")
          .upload(filePath, blob);

        if (uploadError) {
          console.error(uploadError);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("voice-notes").getPublicUrl(filePath);

        const newMsg: Message = {
          id: `temp-${Date.now()}`,
          sender_id: currentUserId,
          content: null,
          audio_url: publicUrl,
          audio_duration: durationSeconds,
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, newMsg]);

        channelRef.current?.send({
          type: "broadcast",
          event: "new_message",
          payload: newMsg,
        });

        await sendVoiceNoteMessage(friendId, publicUrl, durationSeconds);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
    } catch (err) {
      console.error("Microphone permission denied or unavailable", err);
    }
  }

  function handleStopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function handleBlock() {
    setShowMenu(false);
    const result = await blockUser(friendId);
    if (result.success) setIBlockedThem(true);
  }

  async function handleUnblock() {
    setShowMenu(false);
    const result = await unblockUser(friendId);
    if (result.success) setIBlockedThem(false);
  }

  async function handleSubmitReport() {
    await reportUser(
      friendId,
      reportReason,
      reportDetails,
      reportModal?.messageId
    );
    setReportModal(null);
    setReportDetails("");
    setReportReason("spam");
  }

  const isBlockedEitherWay = iBlockedThem || theyBlockedMe;

  return (
    <>
      <div className={styles.header}>
        <BackButton href="/messages" />
        <Avatar name={friendName} avatarUrl={friendAvatarUrl} size={36} />
        <div>
          <div className={styles.name}>{friendName}</div>
          <div className={styles.status}>
            <span
              className={`${styles.statusDot} ${
                friendIsOnline ? styles.statusDotOnline : ""
              }`}
            />
            {friendIsOnline ? "Active now" : "Offline"}
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.callBtn} onClick={startCall}>
            <Phone size={17} />
          </button>
          <button
            className={styles.menuBtn}
            onClick={() => setShowMenu((prev) => !prev)}
          >
            <MoreVertical size={18} />
          </button>
          {showMenu && (
            <div className={styles.dropdown}>
              <button
                className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                onClick={iBlockedThem ? handleUnblock : handleBlock}
              >
                {iBlockedThem ? "Unblock" : "Block"} {friendName}
              </button>
              <button
                className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                onClick={() => {
                  setShowMenu(false);
                  setReportModal({});
                }}
              >
                Report {friendName}
              </button>
            </div>
          )}
        </div>
      </div>

      {isBlockedEitherWay ? (
        <div className={styles.blockedBanner}>
          {iBlockedThem
            ? `You've blocked ${friendName}. Unblock them to continue this conversation.`
            : `You can't message ${friendName} right now.`}
        </div>
      ) : (
        <>
          <div className={styles.thread}>
            {enriched.length > 0 ? (
              enriched.map((msg) => {
                const isMine = msg.sender_id === currentUserId;

                return (
                  <div key={msg.id}>
                    {msg.showDateDivider && (
                      <div className={styles.dateDivider}>
                        {formatDateDivider(msg.created_at)}
                      </div>
                    )}

                    <div
                      className={`${styles.messageRow} ${
                        isMine ? styles.messageRowMine : ""
                      }`}
                      style={{
                        marginTop: msg.isFirstInGroup ? "12px" : "2px",
                      }}
                    >
                      {!isMine &&
                        (msg.isLastInGroup ? (
                          <Avatar
                            name={friendName}
                            avatarUrl={friendAvatarUrl}
                            size={26}
                          />
                        ) : (
                          <div className={styles.avatarSpacer} />
                        ))}

                      {msg.audio_url ? (
                        <VoiceNotePlayer
                          audioUrl={msg.audio_url}
                          duration={msg.audio_duration || 0}
                          isMine={isMine}
                        />
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
                          onDoubleClick={() =>
                            !isMine && setReportModal({ messageId: msg.id })
                          }
                        >
                          {msg.content}
                        </div>
                      )}
                    </div>

                    {msg.isLastInGroup && (
                      <div
                        className={`${styles.timestamp} ${
                          isMine
                            ? styles.timestampMine
                            : styles.timestampTheirs
                        }`}
                      >
                        {formatTime(msg.created_at)}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className={styles.empty}>Say hello 👋</p>
            )}
            {uploading && (
              <div className={`${styles.messageRow} ${styles.messageRowMine}`}>
                <div className={styles.uploadingBubble}>Uploading...</div>
              </div>
            )}
            {friendIsTyping && (
              <p className={styles.typingIndicator}>
                {friendName} is typing...
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          {showAttachMenu && (
            <div className={styles.attachMenu}>
              <button
                className={styles.attachOption}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera size={20} />
                <span>Camera</span>
              </button>
              <button
                className={styles.attachOption}
                onClick={() => galleryInputRef.current?.click()}
              >
                <ImageIcon size={20} />
                <span>Gallery</span>
              </button>
              <button
                className={styles.attachOption}
                onClick={() => {
                  setShowAttachMenu(false);
                  setShowGifPicker(true);
                }}
              >
                <span className={styles.gifLabel}>GIF</span>
                <span>GIF</span>
              </button>
              <button
                className={styles.attachOption}
                onClick={() => {
                  setShowAttachMenu(false);
                  setShowStickers(true);
                }}
              >
                <Smile size={20} />
                <span>Sticker</span>
              </button>
            </div>
          )}

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
              ref={cameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className={styles.imageInput}
              onChange={handleImageSelect}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className={styles.imageInput}
              onChange={handleImageSelect}
            />
            <button
              className={styles.imageBtn}
              onClick={() => setShowAttachMenu((prev) => !prev)}
            >
              <Plus size={20} />
            </button>

            {recording ? (
              <div className={styles.recordingIndicator}>
                <span className={styles.recordingDot} />
                Recording...
              </div>
            ) : (
              <input
                className={styles.input}
                placeholder="Message..."
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
            )}

            {text.trim() ? (
              <button className={styles.sendBtn} onClick={handleSend}>
                <Send size={17} />
              </button>
            ) : (
              <button
                className={`${styles.micBtn} ${
                  recording ? styles.micBtnRecording : ""
                }`}
                onMouseDown={handleStartRecording}
                onMouseUp={handleStopRecording}
                onMouseLeave={() => recording && handleStopRecording()}
                onTouchStart={handleStartRecording}
                onTouchEnd={handleStopRecording}
              >
                {recording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
          </div>
        </>
      )}

      {showGifPicker && (
        <GifPicker
          onSelect={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
        />
      )}

      {reportModal && (
        <div className={styles.modalOverlay} onClick={() => setReportModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>
              Report {reportModal.messageId ? "message" : friendName}
            </div>

            {REPORT_REASONS.map((r) => (
              <button
                key={r.id}
                className={`${styles.reasonOption} ${
                  reportReason === r.id ? styles.reasonOptionActive : ""
                }`}
                onClick={() => setReportReason(r.id)}
              >
                {r.label}
              </button>
            ))}

            <textarea
              className={styles.detailsInput}
              placeholder="Additional details (optional)"
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
            />

            <div className={styles.modalActions}>
              <button
                className={styles.modalCancel}
                onClick={() => setReportModal(null)}
              >
                Cancel
              </button>
              <button className={styles.modalSubmit} onClick={handleSubmitReport}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {callState !== "idle" && (
        <div className={styles.callOverlay}>
          <div className={styles.callAvatarLarge}>
            <Avatar name={friendName} avatarUrl={friendAvatarUrl} size={96} />
          </div>
          <div className={styles.callName}>
            {callState === "ringing" ? callerName : friendName}
          </div>
          <div className={styles.callStatus}>
            {callState === "calling" && "Calling..."}
            {callState === "ringing" && "Incoming call"}
            {callState === "connected" && formatCallDuration(callDuration)}
          </div>

          {callState === "ringing" ? (
            <div className={styles.callActions}>
              <button
                className={`${styles.callActionBtn} ${styles.callDeclineBtn}`}
                onClick={declineCall}
              >
                <PhoneOff size={22} />
              </button>
              <button
                className={`${styles.callActionBtn} ${styles.callAcceptBtn}`}
                onClick={acceptCall}
              >
                <Phone size={22} />
              </button>
            </div>
          ) : (
            <div className={styles.callControlsRow}>
              <button
                className={`${styles.callControlBtn} ${
                  callMuted ? styles.callControlBtnMuted : ""
                }`}
                onClick={toggleCallMute}
              >
                {callMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button
                className={`${styles.callActionBtn} ${styles.callDeclineBtn}`}
                onClick={endCall}
              >
                <PhoneOff size={22} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}