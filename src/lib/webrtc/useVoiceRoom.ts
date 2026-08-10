"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Participant = {
  id: string;
  name: string;
  muted: boolean;
};

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export function useVoiceRoom(roomId: string, userId: string, userName: string) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<any>(null);
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  function createPeerConnection(remoteId: string) {
    const existing = peersRef.current.get(remoteId);
    if (existing) {
      existing.close();
      peersRef.current.delete(remoteId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { from: userId, to: remoteId, candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      let audioEl = audioElsRef.current.get(remoteId);
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);
        audioElsRef.current.set(remoteId, audioEl);
      }
      audioEl.srcObject = event.streams[0];
    };

    peersRef.current.set(remoteId, pc);
    return pc;
  }

  async function joinRoom() {
    setConnecting(true);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("Microphone permission denied or unavailable", err);
      setConnecting(false);
      return;
    }
    localStreamRef.current = stream;

    const supabase = createClient();
    const channel = supabase.channel(`voice-${roomId}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const list: Participant[] = Object.values(state).map((entries: any) => {
          const entry = entries[0];
          return { id: entry.userId, name: entry.userName, muted: entry.muted };
        });
        setParticipants(list);
      })
      .on("presence", { event: "join" }, ({ key }: any) => {
        if (key === userId) return;
        if (peersRef.current.has(key)) return;
        const pc = createPeerConnection(key);
        pc.createOffer().then(async (offer) => {
          await pc.setLocalDescription(offer);
          channelRef.current?.send({
            type: "broadcast",
            event: "offer",
            payload: { from: userId, to: key, offer },
          });
        });
      })
      .on("presence", { event: "leave" }, ({ key }: any) => {
        peersRef.current.get(key)?.close();
        peersRef.current.delete(key);
        const audioEl = audioElsRef.current.get(key);
        if (audioEl) {
          audioEl.remove();
          audioElsRef.current.delete(key);
        }
      })
      .on("broadcast", { event: "offer" }, async ({ payload }: any) => {
        if (payload.to !== userId) return;
        const pc = createPeerConnection(payload.from);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channelRef.current?.send({
          type: "broadcast",
          event: "answer",
          payload: { from: userId, to: payload.from, answer },
        });
      })
      .on("broadcast", { event: "answer" }, async ({ payload }: any) => {
        if (payload.to !== userId) return;
        const pc = peersRef.current.get(payload.from);
        if (pc && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }: any) => {
        if (payload.to !== userId) return;
        const pc = peersRef.current.get(payload.from);
        try {
          if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (err) {
          console.error(err);
        }
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId, userName, muted: false });
          setJoined(true);
          setConnecting(false);
        }
      });
  }

  function leaveRoom() {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();

    audioElsRef.current.forEach((el) => el.remove());
    audioElsRef.current.clear();

    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setJoined(false);
    setParticipants([]);
    setMuted(false);
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const newMuted = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !newMuted;
    });
    setMuted(newMuted);
    channelRef.current?.track({ userId, userName, muted: newMuted });
  }

  useEffect(() => {
    return () => {
      leaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { participants, joined, connecting, muted, joinRoom, leaveRoom, toggleMute };
}