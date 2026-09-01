"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CallState = "idle" | "calling" | "ringing" | "connected";
type CallStatus = "completed" | "missed" | "declined";

const ICE_SERVERS = [
  { urls: "stun:stun.relay.metered.ca:80" },
  {
    urls: "turn:global.relay.metered.ca:80",
    username: "3f50aae364ede758a395e1e8",
    credential: "ZKn1H9o3Tu/gHTdm",
  },
  {
    urls: "turn:global.relay.metered.ca:80?transport=tcp",
    username: "3f50aae364ede758a395e1e8",
    credential: "ZKn1H9o3Tu/gHTdm",
  },
  {
    urls: "turn:global.relay.metered.ca:443",
    username: "3f50aae364ede758a395e1e8",
    credential: "ZKn1H9o3Tu/gHTdm",
  },
  {
    urls: "turns:global.relay.metered.ca:443?transport=tcp",
    username: "3f50aae364ede758a395e1e8",
    credential: "ZKn1H9o3Tu/gHTdm",
  },
];

export function useDMCall(
  friendId: string,
  currentUserId: string,
  currentUserName: string,
  onCallEnded?: (type: "audio" | "video", status: CallStatus, duration: number) => void
) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [callerName, setCallerName] = useState("");
  const [duration, setDuration] = useState(0);
  const [isVideoCall, setIsVideoCall] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<any>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingOfferRef = useRef<any>(null);
  const wasConnectedRef = useRef(false);
  const durationRef = useRef(0);

  // DOM video elements are refs, not state — this is the key fix.
  // Refs never trigger a re-render or effect re-run, and .current is
  // always fresh when read inside async callbacks, so the signaling
  // channel below stays alive for the entire call instead of being
  // torn down and rebuilt whenever a <video> element mounts.
  const localVideoElRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoElRef = useRef<HTMLVideoElement | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setLocalVideoEl(el: HTMLVideoElement | null) {
    localVideoElRef.current = el;
  }
  function setRemoteVideoEl(el: HTMLVideoElement | null) {
    remoteVideoElRef.current = el;
  }

  function roomName() {
    return `call-${[currentUserId, friendId].sort().join("-")}`;
  }

  function createPeerConnection() {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.remove();
      remoteAudioRef.current = null;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({
          type: "broadcast",
          event: "call-ice",
          payload: { from: currentUserId, candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.track.kind === "video") {
        if (remoteVideoElRef.current) {
          remoteVideoElRef.current.srcObject = event.streams[0];
        }
      } else {
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = document.createElement("audio");
          remoteAudioRef.current.autoplay = true;
          document.body.appendChild(remoteAudioRef.current);
        }
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    pcRef.current = pc;
    return pc;
  }

  function startDurationTimer() {
    setDuration(0);
    durationRef.current = 0;
    durationTimerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration(durationRef.current);
    }, 1000);
  }

  function stopDurationTimer() {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = null;
  }

  // This effect now only depends on friendId/currentUserId — it subscribes
  // exactly once per conversation and never tears down mid-call.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(roomName());

    channel
      .on("broadcast", { event: "call-offer" }, async ({ payload }: any) => {
        if (payload.from === currentUserId) return;
        pendingOfferRef.current = payload.offer;
        setCallerName(payload.callerName);
        setIsVideoCall(!!payload.video);
        setCallState("ringing");
      })
            .on("broadcast", { event: "call-answer" }, async ({ payload }: any) => {
        if (payload.from === currentUserId) return;
        const pc = pcRef.current;
        if (pc && pc.signalingState === "have-local-offer") {
          if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          wasConnectedRef.current = true;
          setCallState("connected");
          startDurationTimer();
        }
      })
      .on("broadcast", { event: "call-ice" }, async ({ payload }: any) => {
        if (payload.from === currentUserId) return;
        try {
          if (pcRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
        } catch (err) {
          console.error(err);
        }
      })
      .on("broadcast", { event: "call-end" }, ({ payload }: any) => {
        if (payload.from === currentUserId) return;
        cleanup();
        setCallState("idle");
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId, currentUserId]);

  function cleanup() {
    localStreamRef.current?.getTracks().forEach((t) => {
      t.enabled = false;
      t.stop();
    });
    localStreamRef.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.remove();
      remoteAudioRef.current = null;
    }
    if (remoteVideoElRef.current) remoteVideoElRef.current.srcObject = null;
    if (localVideoElRef.current) localVideoElRef.current.srcObject = null;

    stopDurationTimer();
    pendingOfferRef.current = null;
    setMuted(false);
    wasConnectedRef.current = false;
  }

  async function getMedia(video: boolean) {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: video ? { facingMode: "user" } : false,
    });
  }

  async function startCall(video: boolean = false) {
    setCallState("calling");
    setIsVideoCall(video);
    wasConnectedRef.current = false;

    try {
      const stream = await getMedia(video);
      localStreamRef.current = stream;
      if (video && localVideoElRef.current) localVideoElRef.current.srcObject = stream;

      const pc = createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channelRef.current?.send({
        
        type: "broadcast",
        event: "call-offer",
        payload: { from: currentUserId, callerName: currentUserName, offer, video },
      });
    } catch (err) {
      console.error("startCall failed:", err);
      cleanup();
      setCallState("idle");
    }
  }

  async function acceptCall() {
    if (!pendingOfferRef.current) {
      console.error("No pending offer to accept");
      cleanup();
      setCallState("idle");
      return;
    }

    try {
      const stream = await getMedia(isVideoCall);
      localStreamRef.current = stream;
      if (isVideoCall && localVideoElRef.current) localVideoElRef.current.srcObject = stream;

      const pc = createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      channelRef.current?.send({
        type: "broadcast",
        event: "call-answer",
        payload: { from: currentUserId, answer },
      });

      wasConnectedRef.current = true;
      setCallState("connected");
      startDurationTimer();
        } catch (err: any) {
      console.error("acceptCall failed:", err);
      setCallError(err?.message || "Could not connect the call");
      cleanup();
      setCallState("idle");
    }
  }

  function declineCall() {
    channelRef.current?.send({
      type: "broadcast",
      event: "call-end",
      payload: { from: currentUserId },
    });
    onCallEnded?.(isVideoCall ? "video" : "audio", "declined", 0);
    cleanup();
    setCallState("idle");
  }

  function endCall() {
    channelRef.current?.send({
      type: "broadcast",
      event: "call-end",
      payload: { from: currentUserId },
    });
    const status: CallStatus = wasConnectedRef.current ? "completed" : "missed";
    onCallEnded?.(isVideoCall ? "video" : "audio", status, durationRef.current);
    cleanup();
    setCallState("idle");
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const newMuted = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !newMuted;
    });
    setMuted(newMuted);
  }

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && callState === "connected") {
        endCall();
      }
    }
    window.addEventListener("beforeunload", cleanup);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cleanup();
      window.removeEventListener("beforeunload", cleanup);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState]);

    return {
    callState,
    callerName,
    muted,
    duration,
    isVideoCall,
    callError,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    setLocalVideoEl,
    setRemoteVideoEl,
  };
}