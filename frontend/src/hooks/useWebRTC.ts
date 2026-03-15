import { useEffect, useRef, useCallback } from 'react';
import { socketClient } from '@/lib/socket';

interface UseWebRTCOptions {
  roomId: string | null;
  isMuted: boolean;
  onSpeakingChange?: (isSpeaking: boolean) => void;
}

interface UseWebRTCResult {
  start: () => Promise<boolean>;
  stop: () => void;
  /** Call when a remote peer has joined and we should initiate an offer to them. */
  connectToPeer: (userId: string) => Promise<void>;
  /** Call when a remote peer has left. */
  disconnectFromPeer: (userId: string) => void;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useWebRTC({ roomId, isMuted, onSpeakingChange }: UseWebRTCOptions): UseWebRTCResult {
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  // ICE candidates that arrived before setRemoteDescription — buffer per peer
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const speakingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMutedRef = useRef(isMuted);
  const roomIdRef = useRef(roomId);
  const onSpeakingChangeRef = useRef(onSpeakingChange);

  // Keep refs in sync with latest props without recreating callbacks
  isMutedRef.current = isMuted;
  roomIdRef.current = roomId;
  onSpeakingChangeRef.current = onSpeakingChange;

  // ── helpers ──────────────────────────────────────────────────────────────

  const playAudio = useCallback((userId: string, stream: MediaStream) => {
    let audio = audioElementsRef.current.get(userId);
    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      audioElementsRef.current.set(userId, audio);
    }
    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
      audio.play().catch(() => {
        // Retry on next user gesture if autoplay is blocked
        const retry = () => { audio!.play().catch(() => {}); document.removeEventListener('click', retry); };
        document.addEventListener('click', retry, { once: true });
      });
    }
  }, []);

  const flushCandidates = useCallback(async (userId: string, peer: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current.get(userId) ?? [];
    pendingCandidatesRef.current.delete(userId);
    for (const c of pending) {
      try { await peer.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
  }, []);

  const createPeer = useCallback((userId: string): RTCPeerConnection => {
    const existing = peersRef.current.get(userId);
    if (existing) return existing;

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    peer.onicecandidate = ({ candidate }) => {
      if (candidate && roomIdRef.current) {
        socketClient.sendVoiceSignal(roomIdRef.current, userId, {
          type: 'ice-candidate',
          candidate: candidate.toJSON(),
        });
      }
    };

    peer.ontrack = ({ streams }) => {
      const stream = streams[0];
      if (stream) playAudio(userId, stream);
    };

    peersRef.current.set(userId, peer);
    return peer;
  }, [playAudio]);

  const closePeer = useCallback((userId: string) => {
    peersRef.current.get(userId)?.close();
    peersRef.current.delete(userId);
    pendingCandidatesRef.current.delete(userId);
    const audio = audioElementsRef.current.get(userId);
    if (audio) { audio.srcObject = null; audioElementsRef.current.delete(userId); }
  }, []);

  // ── speaking detection ────────────────────────────────────────────────────

  const startSpeakingDetection = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let last = false;
      speakingIntervalRef.current = setInterval(() => {
        if (isMutedRef.current) {
          if (last) { last = false; onSpeakingChangeRef.current?.(false); }
          return;
        }
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const speaking = avg > 12;
        if (speaking !== last) { last = speaking; onSpeakingChangeRef.current?.(speaking); }
      }, 200);
    } catch {}
  }, []);

  // ── incoming WebRTC signals ───────────────────────────────────────────────

  useEffect(() => {
    const handleSignal = async (data: unknown) => {
      const { fromUserId, signal } = data as {
        fromUserId: string;
        signal: {
          type: 'offer' | 'answer' | 'ice-candidate';
          sdp?: RTCSessionDescriptionInit;
          candidate?: RTCIceCandidateInit;
        };
      };

      if (signal.type === 'offer') {
        // We received an offer: create/reuse peer, add our tracks, answer
        const peer = createPeer(fromUserId);
        if (localStreamRef.current) {
          // Only add tracks if not already added
          const senders = peer.getSenders();
          localStreamRef.current.getTracks().forEach((track) => {
            if (!senders.find((s) => s.track === track)) {
              peer.addTrack(track, localStreamRef.current!);
            }
          });
        }
        await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp!));
        await flushCandidates(fromUserId, peer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        if (roomIdRef.current) {
          socketClient.sendVoiceSignal(roomIdRef.current, fromUserId, {
            type: 'answer',
            sdp: peer.localDescription!,
          });
        }
      } else if (signal.type === 'answer') {
        const peer = peersRef.current.get(fromUserId);
        if (peer) {
          await peer.setRemoteDescription(new RTCSessionDescription(signal.sdp!));
          await flushCandidates(fromUserId, peer);
        }
      } else if (signal.type === 'ice-candidate' && signal.candidate) {
        const peer = peersRef.current.get(fromUserId);
        if (peer?.remoteDescription) {
          try { await peer.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch {}
        } else {
          // Buffer until remote description is set
          if (!pendingCandidatesRef.current.has(fromUserId)) {
            pendingCandidatesRef.current.set(fromUserId, []);
          }
          pendingCandidatesRef.current.get(fromUserId)!.push(signal.candidate);
        }
      }
    };

    const unsub = socketClient.on('voice:signal', handleSignal as (...args: unknown[]) => void);
    return () => unsub?.();
  }, [createPeer, flushCandidates]);

  // ── mute: enable/disable audio tracks ────────────────────────────────────

  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !isMuted; });
  }, [isMuted]);

  // ── public API ────────────────────────────────────────────────────────────

  /** Acquires the microphone. Call this BEFORE joining the socket room. */
  const start = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getAudioTracks().forEach((t) => { t.enabled = !isMutedRef.current; });
      localStreamRef.current = stream;
      startSpeakingDetection(stream);
      return true;
    } catch (err) {
      console.error('getUserMedia error:', err);
      return false;
    }
  }, [startSpeakingDetection]);

  /** Stops all media and closes all peer connections. */
  const stop = useCallback(() => {
    if (speakingIntervalRef.current) { clearInterval(speakingIntervalRef.current); speakingIntervalRef.current = null; }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    peersRef.current.forEach((_, userId) => closePeer(userId));
    pendingCandidatesRef.current.clear();
  }, [closePeer]);

  /**
   * Initiate a WebRTC connection to a peer who just joined.
   * We create an offer and send it to them.
   * IMPORTANT: only call this after start() has completed.
   */
  const connectToPeer = useCallback(async (userId: string): Promise<void> => {
    if (!localStreamRef.current || !roomIdRef.current) return;
    const peer = createPeer(userId);
    localStreamRef.current.getTracks().forEach((track) => {
      peer.addTrack(track, localStreamRef.current!);
    });
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socketClient.sendVoiceSignal(roomIdRef.current, userId, {
      type: 'offer',
      sdp: peer.localDescription!,
    });
  }, [createPeer]);

  /** Close the connection to a peer who left. */
  const disconnectFromPeer = useCallback((userId: string) => {
    closePeer(userId);
  }, [closePeer]);

  useEffect(() => { return () => { stop(); }; }, [stop]);

  return { start, stop, connectToPeer, disconnectFromPeer };
}
