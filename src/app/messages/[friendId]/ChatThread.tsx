"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  toggleMessageReaction,
  getMessageReactions,
  sendMessage,
  sendImageMessage,
  sendStickerMessage,
  sendVoiceNoteMessage,
  markMessagesRead,
  sendVoiceBurst,
  sendPing,
  notifyIncomingCall,
  sendVideoNote,
  logCallMessage,
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
import Link from "next/link";
import styles from "./page.module.css";
import {
  Phone,
  Video,
  MoreVertical,
  Plus,
  Camera,
  Image as ImageIcon,
  Smile,
  Mic,
  MicOff,
  Send,
  PhoneOff,
  CornerUpLeft,
  BookHeart,
} from "lucide-react";

type Message = {
  id: string;
  is_burst?: boolean;
  sender_id: string;
  content: string | null;
  image_url?: string | null;
  video_url?: string | null;
  sticker_id?: string | null;
  audio_url?: string | null;
  audio_duration?: number | null;
  listing_id?: string | null;
  listing_title?: string | null;
  listing_price?: number | null;
  listing_currency?: string | null;
  listing_image_url?: string | null;
  ping_label?: string | null;
  reply_to_id?: string | null;
  reply_to_content?: string | null;
  reply_to_sender_name?: string | null;
  call_type?: "audio" | "video" | null;
  call_status?: "completed" | "missed" | "declined" | null;
  call_duration?: number | null;
  created_at?: string;
  reactions?: { userId: string; emoji: string }[];
};

const GROUP_GAP_MS = 5 * 60 * 1000;
const MAX_VIDEO_NOTE_SECONDS = 30;
const REPORT_REASONS = [
  { id: "spam", label: "Spam" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "inappropriate_content", label: "Inappropriate content" },
  { id: "fake_account", label: "Fake account" },
  { id: "other", label: "Other" },
];
const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "🙏", "🎉"];
const PINGS = [
  "👀 I'm here",
  "😂 I'm dying",
  "❤️ Thinking of you",
  "🫶 With you",
  "💤 About to sleep",
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

function formatCallDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<{
    id: string;
    content: string;
    senderName: string;
  } | null>(null);
  const [friendIsTyping, setFriendIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingBurst, setRecordingBurst] = useState(false);
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
  const [showPingMenu, setShowPingMenu] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoGalleryInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  const stopTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const burstChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onlineIds = usePresence(currentUserId);
  const friendIsOnline = onlineIds.has(friendId);

  async function handleCallEnded(
    type: "audio" | "video",
    status: "completed" | "missed" | "declined",
    duration: number
  ) {
    const newMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      content: null,
      call_type: type,
      call_status: status,
      call_duration: duration,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    channelRef.current?.send({ type: "broadcast", event: "new_message", payload: newMsg });
    await logCallMessage(friendId, type, status, duration);
  }

  const {
    callState,
    callError,
    callerName,
    muted: callMuted,
    duration: callDuration,
    isVideoCall,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute: toggleCallMute,
    setLocalVideoEl,
    setRemoteVideoEl,
  } = useDMCall(friendId, currentUserId, "You", handleCallEnded);

  function handleLongPressStart(msgId: string) {
    longPressTimerRef.current = setTimeout(() => setReactionPickerFor(msgId), 450);
  }
  function handleLongPressEnd() {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }

  useEffect(() => {
    markMessagesRead(friendId);
  }, [friendId]);

  useEffect(() => {
    async function loadReactions() {
      const ids = messages.map((m) => m.id).filter((id) => !id.startsWith("temp-"));
      if (ids.length === 0) return;
      const rows = await getMessageReactions(ids);
      const byMsg = new Map<string, { userId: string; emoji: string }[]>();
      rows.forEach((r) => {
        const list = byMsg.get(r.message_id) || [];
        list.push({ userId: r.user_id, emoji: r.emoji });
        byMsg.set(r.message_id, list);
      });
      setMessages((prev) =>
        prev.map((m) => ({ ...m, reactions: byMsg.get(m.id) || m.reactions }))
      );
    }
    loadReactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      .on("broadcast", { event: "reaction_update" }, (payload) => {
        const { messageId, reactions } = payload.payload as any;
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
        );
      })
      .on("broadcast", { event: "new_message" }, (payload) => {
        const newMsg = payload.payload as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
         setFriendIsTyping(false);
        if (newMsg.sender_id !== currentUserId) {
          markMessagesRead(friendId);
          setTimeout(() => markMessagesRead(friendId), 1500);
        }
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
      if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
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
        ? new Date(msg.created_at!).getTime() - new Date(prev.created_at).getTime()
        : Infinity;
      const nextGap = next?.created_at
        ? new Date(next.created_at).getTime() - new Date(msg.created_at!).getTime()
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

  async function handlePing(label: string) {
    setShowPingMenu(false);
    const newMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      content: null,
      ping_label: label,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    channelRef.current?.send({
      type: "broadcast",
      event: "new_message",
      payload: newMsg,
    });
    await sendPing(friendId, label);
  }

  async function handleReact(msg: Message, emoji: string) {
    setReactionPickerFor(null);
    const current = msg.reactions || [];
    const mine = current.find((r) => r.userId === currentUserId);
    const updated = mine
      ? current
          .filter((r) => r.userId !== currentUserId)
          .concat(mine.emoji === emoji ? [] : [{ userId: currentUserId, emoji }])
      : [...current, { userId: currentUserId, emoji }];

    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, reactions: updated } : m))
    );
    channelRef.current?.send({
      type: "broadcast",
      event: "reaction_update",
      payload: { messageId: msg.id, reactions: updated },
    });
    await toggleMessageReaction(msg.id, emoji);
  }

  function handleStartReply(msg: Message) {
    setReactionPickerFor(null);
    setReplyTarget({
      id: msg.id,
      content:
        msg.content ||
        (msg.image_url
          ? "📷 Photo"
          : msg.video_url
          ? "🎥 Video"
          : msg.audio_url
          ? "🎤 Voice message"
          : "Message"),
      senderName: msg.sender_id === currentUserId ? "You" : friendName,
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
      reply_to_content: replyTarget?.content || null,
      reply_to_sender_name: replyTarget?.senderName || null,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);

    channelRef.current?.send({
      type: "broadcast",
      event: "new_message",
      payload: newMsg,
    });

    await sendMessage(
      friendId,
      content,
      replyTarget
        ? { id: replyTarget.id, content: replyTarget.content, senderName: replyTarget.senderName }
        : undefined
    );
    setReplyTarget(null);
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

  async function handleVideoGallerySelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setShowAttachMenu(false);

    const objectUrl = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";

    const duration: number = await new Promise((resolve) => {
      probe.onloadedmetadata = () => resolve(probe.duration);
      probe.onerror = () => resolve(0);
      probe.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    if (duration > MAX_VIDEO_NOTE_SECONDS) {
      alert(`Please pick a video under ${MAX_VIDEO_NOTE_SECONDS} seconds.`);
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const filePath = `${currentUserId}/vidnote-${Date.now()}-${file.name}`;

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
      video_url: publicUrl,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    channelRef.current?.send({
      type: "broadcast",
      event: "new_message",
      payload: newMsg,
    });

    setUploading(false);
    await sendVideoNote(friendId, publicUrl);
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

  async function handleBurst() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      burstChunksRef.current = [];
      setRecordingBurst(true);

      recorder.ondataavailable = (e) => burstChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecordingBurst(false);
        const blob = new Blob(burstChunksRef.current, { type: "audio/webm" });
        const supabase = createClient();
        const filePath = `${currentUserId}/burst-${Date.now()}.webm`;
        const { error } = await supabase.storage.from("voice-notes").upload(filePath, blob);
        if (error) return;
        const {
          data: { publicUrl },
        } = supabase.storage.from("voice-notes").getPublicUrl(filePath);

        const newMsg: Message = {
          id: `temp-${Date.now()}`,
          sender_id: currentUserId,
          content: null,
          audio_url: publicUrl,
          audio_duration: 3,
          is_burst: true,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, newMsg]);
        channelRef.current?.send({
          type: "broadcast",
          event: "new_message",
          payload: newMsg,
        });
        await sendVoiceBurst(friendId, publicUrl, 3);
      };

      recorder.start();
      setTimeout(() => recorder.stop(), 3000);
    } catch (err) {
      console.error(err);
      setRecordingBurst(false);
    }
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
    await reportUser(friendId, reportReason, reportDetails, reportModal?.messageId);
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
          <Link href={`/messages/${friendId}/moment`} className={styles.callBtn}>
            <BookHeart size={17} />
          </Link>
          <button
            className={styles.callBtn}
            onClick={() => {
              startCall(true);
              notifyIncomingCall(friendId);
            }}
          >
            <Video size={17} />
          </button>
          <button
            className={styles.callBtn}
            onClick={() => {
              startCall(false);
              notifyIncomingCall(friendId);
            }}
          >
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
                      style={{ marginTop: msg.isFirstInGroup ? "12px" : "2px" }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setReactionPickerFor(msg.id);
                      }}
                      onTouchStart={() => handleLongPressStart(msg.id)}
                      onTouchEnd={handleLongPressEnd}
                    >
                      {!isMine &&
                        (msg.isLastInGroup ? (
                          <Avatar name={friendName} avatarUrl={friendAvatarUrl} size={26} />
                        ) : (
                          <div className={styles.avatarSpacer} />
                        ))}

                      {msg.call_status ? (
                        <div className={styles.callLogPill}>
                          {msg.call_type === "video" ? "🎥" : "📞"}{" "}
                          {msg.call_status === "completed"
                            ? `${msg.call_type === "video" ? "Video" : "Voice"} call · ${formatCallDuration(
                                msg.call_duration || 0
                              )}`
                            : msg.call_status === "declined"
                            ? isMine
                              ? "Call declined"
                              : "You declined"
                            : isMine
                            ? "No answer"
                            : "Missed call"}
                        </div>
                      ) : msg.ping_label ? (
                        <div className={styles.pingPill}>{msg.ping_label}</div>
                      ) : msg.listing_id ? (
                        <Link
                          href={`/marketplace/${msg.listing_id}`}
                          className={styles.listingCard}
                        >
                          {msg.listing_image_url ? (
                            <img
                              src={msg.listing_image_url}
                              className={styles.listingCardImage}
                              alt=""
                            />
                          ) : (
                            <div className={styles.listingCardImagePlaceholder}>📦</div>
                          )}
                          <div>
                            <div className={styles.listingCardLabel}>Asking about</div>
                            <div className={styles.listingCardTitle}>{msg.listing_title}</div>
                            {msg.listing_price != null && (
                              <div className={styles.listingCardPrice}>
                                {msg.listing_currency || "₦"}
                                {msg.listing_price.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </Link>
                      ) : msg.video_url ? (
                        <div className={styles.videoNoteBubble}>
                          <video src={msg.video_url} controls />
                        </div>
                      ) : msg.audio_url ? (
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
                          className={`${styles.bubble} ${isMine ? styles.bubbleMine : ""}`}
                          onDoubleClick={() =>
                            !isMine && setReportModal({ messageId: msg.id })
                          }
                        >
                          {msg.reply_to_content && (
                            <div className={styles.quotedMessage}>
                              <span className={styles.quotedMessageName}>
                                {msg.reply_to_sender_name}
                              </span>
                              <span className={styles.quotedMessageText}>
                                {msg.reply_to_content}
                              </span>
                            </div>
                          )}
                          {msg.content}
                        </div>
                      )}
                    </div>

                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className={isMine ? styles.timestampMine : styles.timestampTheirs}>
                        {Object.entries(
                          msg.reactions.reduce((acc: any, r) => {
                            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([emoji, count]) => (
                          <span key={emoji} className={styles.reactionBadge}>
                            {emoji} {count as number}
                          </span>
                        ))}
                      </div>
                    )}

                    {reactionPickerFor === msg.id && (
                      <div className={styles.actionMenu}>
                        {REACTION_EMOJIS.map((e) => (
                          <button
                            key={e}
                            className={styles.reactionOption}
                            onClick={() => handleReact(msg, e)}
                          >
                            {e}
                          </button>
                        ))}
                        <div className={styles.actionDivider} />
                        <button className={styles.replyIconBtn} onClick={() => handleStartReply(msg)}>
                          <CornerUpLeft size={16} />
                        </button>
                      </div>
                    )}

                    {msg.isLastInGroup && (
                      <div
                        className={`${styles.timestamp} ${
                          isMine ? styles.timestampMine : styles.timestampTheirs
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
              <p className={styles.typingIndicator}>{friendName} is typing...</p>
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
                onClick={() => {
                  setShowAttachMenu(false);
                  handleBurst();
                }}
              >
                <span style={{ fontSize: 20 }}>💥</span>
                <span>Voice Burst</span>
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
                onClick={() => videoGalleryInputRef.current?.click()}
              >
                <Video size={20} />
                <span>Short Video</span>
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

          {replyTarget && (
            <div className={styles.replyPreview}>
              <div className={styles.replyPreviewBody}>
                <div className={styles.replyPreviewName}>
                  Replying to {replyTarget.senderName}
                </div>
                <div className={styles.replyPreviewText}>{replyTarget.content}</div>
              </div>
              <button className={styles.replyPreviewClose} onClick={() => setReplyTarget(null)}>
                ×
              </button>
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
            <input
              ref={videoGalleryInputRef}
              type="file"
              accept="video/*"
              className={styles.imageInput}
              onChange={handleVideoGallerySelect}
            />
            <button
              className={styles.imageBtn}
              onClick={() => setShowAttachMenu((prev) => !prev)}
            >
              <Plus size={20} />
            </button>
            <button
              className={styles.imageBtn}
              onClick={() => setShowPingMenu((p) => !p)}
            >
              👀
            </button>
            {showPingMenu && (
              <div className={styles.pingMenu}>
                {PINGS.map((p) => (
                  <button key={p} className={styles.pingOption} onClick={() => handlePing(p)}>
                    {p}
                  </button>
                ))}
              </div>
            )}

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
                className={`${styles.micBtn} ${recording ? styles.micBtnRecording : ""}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleStartRecording();
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  handleStopRecording();
                }}
                onPointerLeave={() => recording && handleStopRecording()}
                onPointerCancel={() => recording && handleStopRecording()}
              >
                {recording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
          </div>
        </>
      )}

      {showGifPicker && (
        <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
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
              <button className={styles.modalCancel} onClick={() => setReportModal(null)}>
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
          {isVideoCall && callState === "connected" ? (
            <div className={styles.videoStage}>
              <video ref={setRemoteVideoEl} className={styles.remoteVideo} autoPlay playsInline />
              <video ref={setLocalVideoEl} className={styles.localVideo} autoPlay playsInline muted />
            </div>
          ) : (
            <div className={styles.callAvatarLarge}>
              <Avatar name={friendName} avatarUrl={friendAvatarUrl} size={96} />
            </div>
          )}
          <div className={styles.callName}>
            {callState === "ringing" ? callerName : friendName}
          </div>
          <div className={styles.callStatus}>
            
            {callState === "calling" && "Calling..."}
            {callState === "ringing" && "Incoming call"}
            {callState === "connected" && formatCallDuration(callDuration)}
          </div>

          {callError && (
  <div
    style={{
      color: "var(--coral)",
      fontSize: 12,
      marginTop: 8,
      textAlign: "center",
    }}
  >
    {callError}
  </div>
)}

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