"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

type CallState = "idle" | "calling" | "ringing" | "connected";

export function useDMCall(
  friendId: string,
  currentUserId: string,
  currentUserName: string
) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [callerName, setCallerName] = useState("");
  const [duration, setDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<any>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingOfferRef = useRef<any>(null);

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
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = document.createElement("audio");
        remoteAudioRef.current.autoplay = true;
        document.body.appendChild(remoteAudioRef.current);
      }
      remoteAudioRef.current.srcObject = event.streams[0];
    };

    pcRef.current = pc;
    return pc;
  }

  function startDurationTimer() {
    setDuration(0);
    durationTimerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }

  function stopDurationTimer() {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = null;
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(roomName());

    channel
      .on("broadcast", { event: "call-offer" }, async ({ payload }: any) => {
        if (payload.from === currentUserId) return;
        pendingOfferRef.current = payload.offer;
        setCallerName(payload.callerName);
        setCallState("ringing");
      })
      .on("broadcast", { event: "call-answer" }, async ({ payload }: any) => {
        if (payload.from === currentUserId) return;
        const pc = pcRef.current;
        if (pc && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
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
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.remove();
      remoteAudioRef.current = null;
    }
    stopDurationTimer();
    pendingOfferRef.current = null;
    setMuted(false);
  }

  async function startCall() {
    setCallState("calling");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    localStreamRef.current = stream;

    const pc = createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    channelRef.current?.send({
      type: "broadcast",
      event: "call-offer",
      payload: { from: currentUserId, callerName: currentUserName, offer },
    });
  }

  async function acceptCall() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    localStreamRef.current = stream;

    const pc = createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    channelRef.current?.send({
      type: "broadcast",
      event: "call-answer",
      payload: { from: currentUserId, answer },
    });

    setCallState("connected");
    startDurationTimer();
  }

  function declineCall() {
    channelRef.current?.send({
      type: "broadcast",
      event: "call-end",
      payload: { from: currentUserId },
    });
    cleanup();
    setCallState("idle");
  }

  function endCall() {
    channelRef.current?.send({
      type: "broadcast",
      event: "call-end",
      payload: { from: currentUserId },
    });
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
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    callState,
    callerName,
    muted,
    duration,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
  };
}