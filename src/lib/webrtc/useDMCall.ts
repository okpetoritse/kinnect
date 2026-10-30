"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createCallInvitation, publishCallInvitation, updateCallInvitationStatus } from "@/app/messages/call-actions";

type CallState = "idle" | "calling" | "ringing" | "connected";
type CallStatus = "completed" | "missed" | "declined";
type PendingCallInvitation = {
  id: string;
  callerId: string;
  callType: "audio" | "video";
  callerName: string;
  offer: RTCSessionDescriptionInit;
  expiresAt: string;
};

function waitForIceGatheringComplete(
  pc: RTCPeerConnection,
  timeoutMs = 10_000
): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = { id: undefined as ReturnType<typeof setTimeout> | undefined };
    const finish = (error?: Error) => {
      if (timeout.id) clearTimeout(timeout.id);
      pc.removeEventListener("icegatheringstatechange", onStateChange);
      if (error) reject(error);
      else resolve();
    };
    const onStateChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    timeout.id = setTimeout(() => {
      finish(new Error("Network setup timed out while preparing the call. Please try again."));
    }, timeoutMs);
    pc.addEventListener("icegatheringstatechange", onStateChange);
    onStateChange();
  });
}

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
  const activeOutgoingCallRef = useRef<{
    callId: string;
    offer: RTCSessionDescriptionInit;
    video: boolean;
    callerName: string;
    candidates: RTCIceCandidateInit[];
  } | null>(null);
  const activeIncomingCallIdRef = useRef<string | null>(null);
  const localIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const wasConnectedRef = useRef(false);
  const durationRef = useRef(0);
  const startAttemptRef = useRef(0);

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
        const candidate = event.candidate.toJSON();
        localIceCandidatesRef.current.push(candidate);
        channelRef.current?.send({
          type: "broadcast",
          event: "call-ice",
          payload: { from: currentUserId, candidate },
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
    let channelSubscribed = false;
    let recoveryInterval: ReturnType<typeof setInterval> | null = null;
    let recoveryAttempts = 0;

    const stopRecoveryWindow = () => {
      if (recoveryInterval) clearInterval(recoveryInterval);
      recoveryInterval = null;
      recoveryAttempts = 0;
    };

    const requestCallRecovery = () => {
      if (!channelSubscribed || document.visibilityState !== "visible") return;

      void channel.send({
        type: "broadcast",
        event: "call-recover",
        payload: { from: currentUserId },
      });
    };

    const startRecoveryWindow = () => {
      if (!channelSubscribed || document.visibilityState !== "visible") return;

      stopRecoveryWindow();
      requestCallRecovery();

      recoveryInterval = setInterval(() => {
        if (!channelSubscribed || document.visibilityState !== "visible") return;

        recoveryAttempts += 1;
        requestCallRecovery();

        if (recoveryAttempts >= 6) stopRecoveryWindow();
      }, 1500);
    };

    document.addEventListener("visibilitychange", startRecoveryWindow);

    channel
      .on("broadcast", { event: "call-offer" }, async ({ payload }) => {
        if (payload.from === currentUserId) return;
        const incomingCallId = typeof payload.callId === "string" ? payload.callId : null;
        if (incomingCallId && incomingCallId === activeIncomingCallIdRef.current) return;
        stopRecoveryWindow();
        activeIncomingCallIdRef.current = incomingCallId;
        pendingOfferRef.current = payload.offer;
        setCallerName(payload.callerName);
        setIsVideoCall(!!payload.video);
        callStateRef.current = "ringing";
        setCallState("ringing");
        startRinging();
      })
      .on("broadcast", { event: "call-recover" }, ({ payload }) => {
        if (payload.from === currentUserId) return;

        const outgoing = activeOutgoingCallRef.current;
        const pc = pcRef.current;
        if (
          !outgoing ||
          wasConnectedRef.current ||
          !pc ||
          pc.signalingState !== "have-local-offer"
        ) {
          return;
        }

        channelRef.current?.send({
          type: "broadcast",
          event: "call-offer",
          payload: {
            from: currentUserId,
            callerName: outgoing.callerName,
            offer: outgoing.offer,
            video: outgoing.video,
            callId: outgoing.callId,
          },
        });

        for (const candidate of outgoing.candidates) {
          channelRef.current?.send({
            type: "broadcast",
            event: "call-ice",
            payload: { from: currentUserId, candidate },
          });
        }
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
        stopRecoveryWindow();
        cleanup();
        setCallState("idle");
      })
      .subscribe((status) => {
        channelSubscribed = status === "SUBSCRIBED";
        if (channelSubscribed) {
          startRecoveryWindow();
        } else {
          stopRecoveryWindow();
        }
      });

    channelRef.current = channel;

    return () => {
      document.removeEventListener("visibilitychange", startRecoveryWindow);
      channelSubscribed = false;
      stopRecoveryWindow();
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId, currentUserId]);

  function cleanup() {
    activeOutgoingCallRef.current = null;
    activeIncomingCallIdRef.current = null;
    localIceCandidatesRef.current = [];
    pendingOfferRef.current = null;
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
    if (callStateRef.current !== "idle") return;

    const attemptId = ++startAttemptRef.current;
    callStateRef.current = "calling";
    setCallState("calling");
    setIsVideoCall(video);
    setCallError(null);
    wasConnectedRef.current = false;
    activeOutgoingCallRef.current = null;
    activeIncomingCallIdRef.current = null;
    localIceCandidatesRef.current = [];

    let invitationId: string | null = null;

    try {
      const stream = await getMedia(video);
      if (attemptId !== startAttemptRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      localStreamRef.current = stream;
      if (video && localVideoElRef.current) {
        localVideoElRef.current.srcObject = stream;
      }

      const pc = await createPeerConnection();
      if (attemptId !== startAttemptRef.current) {
        pc.close();
        if (pcRef.current === pc) pcRef.current = null;
        return;
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);

      if (attemptId !== startAttemptRef.current) return;

      const localDescription = pc.localDescription;
      if (!localDescription?.sdp) {
        throw new Error("Could not prepare the call offer.");
      }

      const created = await createCallInvitation(
        friendId,
        video ? "video" : "audio"
      );

      if ("error" in created) throw new Error(created.error);
      invitationId = created.invitationId;

      if (attemptId !== startAttemptRef.current) {
        void updateCallInvitationStatus(invitationId, "cancelled");
        return;
      }

      const completeOffer: RTCSessionDescriptionInit = {
        type: "offer",
        sdp: localDescription.sdp,
      };

      const published = await publishCallInvitation(invitationId, {
        type: completeOffer.type,
        sdp: completeOffer.sdp,
      });

      if ("error" in published) throw new Error(published.error);

      if (attemptId !== startAttemptRef.current) {
        void updateCallInvitationStatus(invitationId, "cancelled");
        return;
      }

      // Keep the offer for the existing Realtime recovery mechanism too.
      activeOutgoingCallRef.current = {
        callId: invitationId,
        offer: completeOffer,
        video,
        callerName: created.callerName,
        candidates: [...localIceCandidatesRef.current],
      };

      channelRef.current?.send({
        type: "broadcast",
        event: "call-offer",
        payload: {
          from: currentUserId,
          callerName: created.callerName,
          offer: completeOffer,
          video,
          callId: invitationId,
        },
      });

      startRingback();

      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = setTimeout(() => {
        const callId = invitationId;
        if (callId) void updateCallInvitationStatus(callId, "missed");

        channelRef.current?.send({
          type: "broadcast",
          event: "call-end",
          payload: { from: currentUserId, callId },
        });

        onCallEnded?.(video ? "video" : "audio", "missed", 0);
        cleanup();
        callStateRef.current = "idle";
        setCallState("idle");
      }, 30_000);
    } catch (err) {
      if (invitationId) {
        void updateCallInvitationStatus(invitationId, "cancelled");
      }

      // A user cancellation should not surface as a call-start error.
      if (attemptId !== startAttemptRef.current) return;

      console.error("startCall failed:", err);
      setCallError(
        err instanceof Error ? err.message : "Could not start the call"
      );
      cleanup();
      callStateRef.current = "idle";
      setCallState("idle");
    }
  }

  async function acceptCall() {
    if (!pendingOfferRef.current) {
      console.error("No pending offer to accept");
      setCallError("This call is no longer available");
      cleanup();
      callStateRef.current = "idle";
      setCallState("idle");
      return;
    }

    const invitationId = activeIncomingCallIdRef.current;

    try {
      stopRinging();

      const stream = await getMedia(isVideoCall);
      localStreamRef.current = stream;
      if (isVideoCall && localVideoElRef.current) {
        localVideoElRef.current.srcObject = stream;
      }

      const pc = await createPeerConnection();
      await pc.setRemoteDescription(
        new RTCSessionDescription(pendingOfferRef.current)
      );
      await flushPendingIceCandidates(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (invitationId) {
        const result = await updateCallInvitationStatus(
          invitationId,
          "accepted"
        );
        if ("error" in result) throw new Error(result.error);
      }

      channelRef.current?.send({
        type: "broadcast",
        event: "call-answer",
        payload: { from: currentUserId, answer, callId: invitationId },
      });

      wasConnectedRef.current = true;
      callStateRef.current = "connected";
      setCallState("connected");
      startDurationTimer();
    } catch (err) {
      console.error("acceptCall failed:", err);
      setCallError(
        err instanceof Error ? err.message : "Could not connect the call"
      );
      cleanup();
      callStateRef.current = "idle";
      setCallState("idle");
    }
  }

  function declineCall() {
    startAttemptRef.current += 1;
    const invitationId = activeIncomingCallIdRef.current;

    if (invitationId) {
      void updateCallInvitationStatus(invitationId, "declined");
    }

    channelRef.current?.send({
      type: "broadcast",
      event: "call-end",
      payload: { from: currentUserId, callId: invitationId },
    });

    onCallEnded?.(isVideoCall ? "video" : "audio", "declined", 0);
    cleanup();
    callStateRef.current = "idle";
    setCallState("idle");
  }

  function endCall() {
    startAttemptRef.current += 1;

    const outgoingId = activeOutgoingCallRef.current?.callId ?? null;
    const incomingId = activeIncomingCallIdRef.current;
    const invitationId = outgoingId ?? incomingId;
    const status: CallStatus = wasConnectedRef.current
      ? "completed"
      : incomingId && !outgoingId
        ? "declined"
        : "missed";

    if (invitationId) {
      const invitationStatus =
        status === "completed"
          ? "completed"
          : status === "declined"
            ? "declined"
            : "missed";
      void updateCallInvitationStatus(invitationId, invitationStatus);
    }

    channelRef.current?.send({
      type: "broadcast",
      event: "call-end",
      payload: { from: currentUserId, callId: invitationId },
    });

    onCallEnded?.(
      isVideoCall ? "video" : "audio",
      status,
      durationRef.current
    );
    cleanup();
    callStateRef.current = "idle";
    setCallState("idle");
  }

  // Used when a notification opens the conversation after the original
  // Realtime offer has already been sent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const restoreIncomingCall = useCallback(
    (invitation: PendingCallInvitation) => {
      if (
        !invitation?.id ||
        !invitation.offer ||
        invitation.offer.type !== "offer" ||
        typeof invitation.offer.sdp !== "string" ||
        !Number.isFinite(Date.parse(invitation.expiresAt)) ||
        Date.parse(invitation.expiresAt) <= Date.now()
      ) {
        return;
      }

      if (activeIncomingCallIdRef.current === invitation.id) return;
      if (callStateRef.current !== "idle") return;

      pendingOfferRef.current = invitation.offer;
      activeIncomingCallIdRef.current = invitation.id;
      setCallerName(invitation.callerName || "Someone");
      setIsVideoCall(invitation.callType === "video");
      callStateRef.current = "ringing";
      setCallState("ringing");
      startRinging();
    },
    []
  );

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
    function handleBeforeUnload() {
      cleanup();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
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
    restoreIncomingCall,
    declineCall,
    endCall,
    toggleMute,
    setLocalVideoEl,
    setRemoteVideoEl,
  };
}