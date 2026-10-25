"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type CallState = "idle" | "calling" | "ringing" | "connected";
type CallStatus = "completed" | "missed" | "declined";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.relay.metered.ca:80" },
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
  const [callError, setCallError] = useState<string | null>(null);

  const [speakerOn, setSpeakerOn] = useState(true);


  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const wasConnectedRef = useRef(false);
  const durationRef = useRef(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
const ringtoneSourceRef = useRef<AudioBufferSourceNode | null>(null);
const ringbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
const ringtoneBufferRef = useRef<AudioBuffer | null>(null);
const ringbackBufferRef = useRef<AudioBuffer | null>(null);

  // Read the live call state inside async/event callbacks without needing
  // to list callState as an effect dependency — this is what stops the
  // visibility/unload effect from tearing the call down mid-connection.
  const callStateRef = useRef<CallState>("idle");
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const localVideoElRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoElRef = useRef<HTMLVideoElement | null>(null);

  const setLocalVideoEl = useCallback((el: HTMLVideoElement | null) => {
  localVideoElRef.current = el;

  const stream = localStreamRef.current;
  if (el && stream && el.srcObject !== stream) {
    el.srcObject = stream;
  }
}, []);

const setRemoteVideoEl = useCallback((el: HTMLVideoElement | null) => {
  remoteVideoElRef.current = el;

  const stream = remoteStreamRef.current;
  if (el && stream && el.srcObject !== stream) {
    el.srcObject = stream;

    void el.play().catch((error: unknown) => {
      console.warn("[Call] Remote video playback could not start.", error);
    });
  }
}, []);

  function roomName() {
    return `call-${[currentUserId, friendId].sort().join("-")}`;
  }

  function getAudioCtx() {
  if (!audioCtxRef.current) {
    audioCtxRef.current = new AudioContext();
  }
  return audioCtxRef.current;
}

async function loadBuffer(
  url: string,
  cacheRef: React.MutableRefObject<AudioBuffer | null>
) {
  if (cacheRef.current) return cacheRef.current;
  const ctx = getAudioCtx();
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuffer);
  cacheRef.current = buffer;
  return buffer;
}

async function startRinging() {
  try {
    stopRinging(); // don't leave an old source running
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = await loadBuffer("/ringtone.mp3", ringtoneBufferRef);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(ctx.destination);
    source.start();
    ringtoneSourceRef.current = source;
  } catch (err) {
    console.error("Ringtone playback failed:", err);
  }
  if ("vibrate" in navigator) {
    navigator.vibrate([500, 300, 500, 300, 500, 300]);
  }
}

function stopRinging() {
  try {
    ringtoneSourceRef.current?.stop();
  } catch {
    // already stopped
  }
  ringtoneSourceRef.current = null;
  if ("vibrate" in navigator) navigator.vibrate(0);
}

async function startRingback() {
  try {
    stopRingback();
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = await loadBuffer("/ringback.mp3", ringbackBufferRef);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(ctx.destination);
    source.start();
    ringbackSourceRef.current = source;
  } catch (err) {
    console.error("Ringback playback failed:", err);
  }
}

function stopRingback() {
  try {
    ringbackSourceRef.current?.stop();
  } catch {
    // already stopped
  }
  ringbackSourceRef.current = null;
}

  async function loadCallIceServers(): Promise<RTCIceServer[]> {
  let response: Response;

  try {
    response = await fetch(
      `/api/turn-credentials?friendId=${encodeURIComponent(friendId)}`,
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }
    );
  } catch (error) {
    console.warn(
      "[TURN] Could not reach the credential endpoint; using the legacy ICE configuration.",
      error
    );

    return ICE_SERVERS as RTCIceServer[];
  }

  // Do not bypass an explicit authentication or permission rejection.
  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to start this call.");
  }

  // Keep the old call path available while server configuration is being tested.
  if (!response.ok) {
    console.warn(
      `[TURN] Credential endpoint returned ${response.status}; using the legacy ICE configuration.`
    );

    return ICE_SERVERS as RTCIceServer[];
  }

  try {
    const result: unknown = await response.json();

    if (!Array.isArray(result) || result.length === 0) {
      console.warn(
        "[TURN] Credential endpoint returned an invalid configuration; using the legacy ICE configuration."
      );

      return ICE_SERVERS as RTCIceServer[];
    }

    return result as RTCIceServer[];
  } catch (error) {
    console.warn(
      "[TURN] Could not parse the ICE configuration; using the legacy ICE configuration.",
      error
    );

    return ICE_SERVERS as RTCIceServer[];
  }
}

  async function flushPendingIceCandidates(
  pc: RTCPeerConnection
): Promise<void> {
  if (!pc.remoteDescription) return;

  const candidates = pendingIceCandidatesRef.current.splice(0);

  for (const candidate of candidates) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.warn("[Call] Could not add a queued ICE candidate.", error);
    }
  }
}

  async function createPeerConnection(): Promise<RTCPeerConnection> {
    const iceServers = await loadCallIceServers();
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.remove();
      remoteAudioRef.current = null;
    }
    remoteStreamRef.current = null;

    const pc = new RTCPeerConnection({ iceServers });

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
    const stream =
      event.streams[0] ?? new MediaStream([event.track]);

    remoteStreamRef.current = stream;

    const videoElement = remoteVideoElRef.current;

    if (videoElement && videoElement.srcObject !== stream) {
      videoElement.srcObject = stream;
    }

    if (videoElement) {
      void videoElement.play().catch((error: unknown) => {
        console.warn("[Call] Remote video playback was blocked.", error);
      });
    }

    return;
  }

  // Give the audio element only the remote audio track.
  // The video element will not need to play a second copy of the audio.
  const audioStream = new MediaStream([event.track]);

  if (!remoteAudioRef.current) {
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.muted = false;
    audio.volume = 1;
    audio.setAttribute("aria-hidden", "true");

    remoteAudioRef.current = audio;
    document.body.appendChild(audio);
  }

  const audioElement = remoteAudioRef.current;

  if (audioElement.srcObject !== audioStream) {
    audioElement.srcObject = audioStream;
  }

  void audioElement.play().catch((error: unknown) => {
    console.warn("[Call] Remote audio playback failed.", error);
    setCallError(
      "Call audio could not start. Check your device volume and audio permissions."
    );
  });
};

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        setCallError("Connection is unstable — this may be a network issue");
      } else if (pc.iceConnectionState === "connected") {
        setCallError(null);
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

  

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(roomName());

    channel
      .on("broadcast", { event: "call-offer" }, async ({ payload }) => {
        if (payload.from === currentUserId) return;
        pendingOfferRef.current = payload.offer;
        setCallerName(payload.callerName);
        setIsVideoCall(!!payload.video);
        setCallState("ringing");
        startRinging();
      })
      .on("broadcast", { event: "call-answer" }, async ({ payload }) => {
        if (payload.from === currentUserId) return;
        const pc = pcRef.current;
        if (pc && pc.signalingState === "have-local-offer") {
          if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
          stopRingback();
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          await flushPendingIceCandidates(pc);
          wasConnectedRef.current = true;
          setCallState("connected");
          startDurationTimer();
        }
      })
      .on("broadcast", { event: "call-ice" }, async ({ payload }) => {
  if (payload.from === currentUserId) return;

  const candidate = payload.candidate as RTCIceCandidateInit | null;
  if (!candidate) return;

  const pc = pcRef.current;

  // The recipient may still be answering, or the offer may not have arrived.
  // Preserve the candidate until a peer connection has a remote description.
  if (!pc || !pc.remoteDescription) {
    pendingIceCandidatesRef.current.push(candidate);
    return;
  }

  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.warn("[Call] Could not add a remote ICE candidate.", error);
  }
})
      .on("broadcast", { event: "call-end" }, ({ payload }) => {
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
    stopRinging();
    stopRingback();

    localStreamRef.current?.getTracks().forEach((t) => {
      t.enabled = false;
      t.stop();
    });
    localStreamRef.current = null;
    remoteStreamRef.current = null;

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
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    pendingOfferRef.current = null; pendingIceCandidatesRef.current = [];

    setMuted(false);
    wasConnectedRef.current = false;
  }

  async function getMedia(video: boolean) {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
      },
      video: video
        ? {
            facingMode: "user",
            width: { ideal: 480, max: 640 },
            height: { ideal: 640, max: 854 },
            frameRate: { ideal: 20, max: 24 },
          }
        : false,
    });
  }

  async function startCall(video: boolean = false) {
    setCallState("calling");
    setIsVideoCall(video);
    setCallError(null);
    wasConnectedRef.current = false;

    try {
      const stream = await getMedia(video);
      localStreamRef.current = stream;
      if (video && localVideoElRef.current) {
        localVideoElRef.current.srcObject = stream;
      }

      const pc = await createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channelRef.current?.send({
        type: "broadcast",
        event: "call-offer",
        payload: { from: currentUserId, callerName: currentUserName, offer, video },
      });

      startRingback();

      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = setTimeout(() => {
        channelRef.current?.send({
          type: "broadcast",
          event: "call-end",
          payload: { from: currentUserId },
        });
        onCallEnded?.(video ? "video" : "audio", "missed", 0);
        cleanup();
        setCallState("idle");
      }, 30000);
    } catch (err) {
  console.error("startCall failed:", err);
  setCallError(
    err instanceof Error ? err.message : "Could not start the call"
  );
      cleanup();
      setCallState("idle");
    }
  }

  async function acceptCall() {
    if (!pendingOfferRef.current) {
      console.error("No pending offer to accept");
      setCallError("This call is no longer available");
      cleanup();
      setCallState("idle");
      return;
    }

    try {
      stopRinging();

      const stream = await getMedia(isVideoCall);
      localStreamRef.current = stream;
      if (isVideoCall && localVideoElRef.current) {
        localVideoElRef.current.srcObject = stream;
      }

      const pc = await createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      await flushPendingIceCandidates(pc);
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
    } catch (err) {
  console.error("acceptCall failed:", err);
  setCallError(
    err instanceof Error ? err.message : "Could not connect the call"
  );
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


   function toggleSpeaker() {
    if (remoteAudioRef.current && "setSinkId" in remoteAudioRef.current) {
      const newState = !speakerOn;
      (
  remoteAudioRef.current as HTMLAudioElement & {
    setSinkId: (sinkId: string) => Promise<void>;
  }
)
  .setSinkId(newState ? "default" : "communications")
  .catch(() => {});
      setSpeakerOn(newState);
    } else {
      setSpeakerOn((prev) => !prev);
    }
  }


  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && callStateRef.current === "connected") {
        endCall();
      }
    }
    function handleBeforeUnload() {
      cleanup();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    callState,
    callerName,
    muted,
    duration,
    isVideoCall,
    callError,
    speakerOn,
    toggleSpeaker,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    setLocalVideoEl,
    setRemoteVideoEl,
  };
}