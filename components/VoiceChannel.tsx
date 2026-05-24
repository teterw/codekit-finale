'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, MonitorUp, Music2, PhoneOff, Radio, Video, VideoOff, Volume2, VolumeX, Wand2 } from 'lucide-react';
import { fadeUp } from '@/lib/animations';
import { getPusherClient } from '@/lib/pusher-client';

interface Participant {
  userId: number;
  peerId: string;
  userName: string;
  userAvatar: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isCameraOn?: boolean;
}

interface Props {
  channelId: number;
  channelName: string;
  userId: number;
  userName: string;
}

const SPEAK_THRESHOLD = 18;
const SPEAK_DEBOUNCE = 600;

export default function VoiceChannel({ channelId, channelName, userId, userName }: Props) {
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [voiceEffect, setVoiceEffect] = useState('Clean');
  const [lastClip, setLastClip] = useState('');

  function dbg(msg: string) {
    console.log('[Voice debug]', `[${new Date().toISOString().slice(11, 23)}] ${msg}`);
  }

  const peerRef = useRef<import('peerjs').Peer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const outgoingStreamRef = useRef<MediaStream | null>(null);
  const callsRef = useRef<Map<string, import('peerjs').MediaConnection>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const animFrameRef = useRef<number>(0);
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myPeerIdRef = useRef<string>('');

  // WebAudio graph used to apply a live effect to the outgoing voice.
  const fxCtxRef = useRef<AudioContext | null>(null);
  const fxSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const fxDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const fxNodesRef = useRef<AudioNode[]>([]);

  // Route the raw mic through a WebAudio graph and return a processed track so
  // peers hear the selected effect. Falls back to the raw track on failure.
  function buildVoicePipeline(micTrack: MediaStreamTrack): MediaStreamTrack {
    try {
      const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return micTrack;
      const ctx = new Ctor();
      const source = ctx.createMediaStreamSource(new MediaStream([micTrack]));
      const dest = ctx.createMediaStreamDestination();
      fxCtxRef.current = ctx;
      fxSourceRef.current = source;
      fxDestRef.current = dest;
      ctx.resume().catch(() => {});
      applyVoiceEffect(voiceEffect);
      return dest.stream.getAudioTracks()[0] ?? micTrack;
    } catch {
      return micTrack;
    }
  }

  function applyVoiceEffect(effect: string) {
    const ctx = fxCtxRef.current;
    const source = fxSourceRef.current;
    const dest = fxDestRef.current;
    if (!ctx || !source || !dest) return;

    try { source.disconnect(); } catch { /* not connected */ }
    fxNodesRef.current.forEach(n => { try { n.disconnect(); } catch { /* ignore */ } });
    fxNodesRef.current = [];

    if (effect === 'Radio') {
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1800;
      bandpass.Q.value = 1.4;
      const boost = ctx.createGain();
      boost.gain.value = 1.6;
      source.connect(bandpass);
      bandpass.connect(boost);
      boost.connect(dest);
      fxNodesRef.current = [bandpass, boost];
    } else if (effect === 'Deep') {
      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.value = 220;
      lowShelf.gain.value = 14;
      const lowPass = ctx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 2200;
      source.connect(lowShelf);
      lowShelf.connect(lowPass);
      lowPass.connect(dest);
      fxNodesRef.current = [lowShelf, lowPass];
    } else {
      // Clean — straight passthrough.
      source.connect(dest);
    }
  }

  function changeVoiceEffect(effect: string) {
    setVoiceEffect(effect);
    applyVoiceEffect(effect);
  }

  function handleRemoteStream(stream: MediaStream, peerId: string) {
    dbg(`remote stream — peerId: ${peerId} | tracks: ${stream.getTracks().length} | deafened: ${deafened}`);
    let audio = audioRefs.current.get(peerId);
    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      audioRefs.current.set(peerId, audio);
      dbg(`remote stream — created new Audio element for ${peerId}`);
    }
    audio.srcObject = stream;
    audio.muted = deafened;
    // Keep the same stream for video rendering (the video track lives in it too).
    setRemoteStreams(prev => (prev[peerId] === stream ? prev : { ...prev, [peerId]: stream }));
  }

  function setupVoiceActivity(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      function tick() {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const nowSpeaking = avg > SPEAK_THRESHOLD;

        if (nowSpeaking !== wasSpeaking) {
          wasSpeaking = nowSpeaking;
          setSpeaking(nowSpeaking);

          if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
          speakTimerRef.current = setTimeout(() => {
            fetch(`/api/voice/${channelId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
              body: JSON.stringify({ isSpeaking: nowSpeaking }),
            }).catch(() => {});
          }, SPEAK_DEBOUNCE);
        }
        animFrameRef.current = requestAnimationFrame(tick);
      }
      tick();
    } catch {
      // AudioContext can fail when browser audio is unavailable.
    }
  }

  async function join() {
    setError('');
    setConnecting(true);
    dbg(`join() — userId: ${userId} | channelId: ${channelId}`);
    try {
      dbg('requesting microphone + camera…');
      // Acquire a video track up front so it is part of the WebRTC offer to every
      // peer — toggling the camera then just flips track.enabled (no renegotiation).
      // Fall back to audio-only if the camera is unavailable or denied.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = false; // start with camera off
          setHasCamera(true);
        }
        dbg(`mic+cam OK — audio: ${stream.getAudioTracks().length} | video: ${stream.getVideoTracks().length}`);
      } catch {
        dbg('camera unavailable — falling back to audio only');
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setHasCamera(false);
      }
      streamRef.current = stream;
      dbg(`media ready — track label: ${stream.getAudioTracks()[0]?.label ?? 'none'}`);
      setupVoiceActivity(stream);

      // Build the stream we actually send to peers: processed (effect) audio
      // plus the camera video track. Muting still works because it disables the
      // raw mic track that feeds the effect graph, silencing the processed output.
      const micTrack = stream.getAudioTracks()[0];
      const processedAudio = micTrack ? buildVoicePipeline(micTrack) : null;
      const outgoing = new MediaStream();
      if (processedAudio) outgoing.addTrack(processedAudio);
      const camTrack = stream.getVideoTracks()[0];
      if (camTrack) outgoing.addTrack(camTrack);
      outgoingStreamRef.current = outgoing;

      dbg('creating PeerJS peer…');
      const { Peer } = await import('peerjs');
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', async myPeerId => {
        myPeerIdRef.current = myPeerId;
        dbg(`peer.on(open) — myPeerId: ${myPeerId}`);

        dbg(`POST /api/voice/${channelId} with peerId: ${myPeerId}`);
        const res = await fetch(`/api/voice/${channelId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
          body: JSON.stringify({ peerId: myPeerId }),
        });
        dbg(`POST response status: ${res.status}`);
        const data = await res.json();
        const allParticipants: Participant[] = data.participants ?? [];
        dbg(`participants from API: ${allParticipants.length} — ${JSON.stringify(allParticipants.map(p => ({ uid: p.userId, peer: p.peerId?.slice(0, 8) })))}`);

        const others = allParticipants.filter(p => p.userId !== userId);
        dbg(`others to call: ${others.length}`);
        setParticipants(allParticipants);
        setJoined(true);
        setConnecting(false);

        const outStream = outgoingStreamRef.current ?? stream;
        for (const p of others) {
          dbg(`calling peer ${p.peerId?.slice(0, 8)}… (userId ${p.userId})`);
          const call = peer.call(p.peerId, outStream);
          if (!call) {
            dbg(`ERROR — peer.call returned null for peerId ${p.peerId?.slice(0, 8)}`);
          } else {
            callsRef.current.set(p.peerId, call);
            call.on('stream', remote => {
              dbg(`got remote stream from ${p.peerId?.slice(0, 8)} (userId ${p.userId})`);
              handleRemoteStream(remote, p.peerId);
            });
            call.on('error', e => dbg(`call error to ${p.peerId?.slice(0, 8)}: ${e}`));
            call.on('close', () => { dbg(`call closed with ${p.peerId?.slice(0, 8)}`); callsRef.current.delete(p.peerId); });
          }
        }

        peer.on('call', call => {
          dbg(`incoming call from peer ${call.peer?.slice(0, 8)}`);
          call.answer(outgoingStreamRef.current ?? stream);
          callsRef.current.set(call.peer, call);
          dbg(`answered call from ${call.peer?.slice(0, 8)}`);
          call.on('stream', remote => {
            dbg(`got remote stream from incoming call peer ${call.peer?.slice(0, 8)}`);
            handleRemoteStream(remote, call.peer);
          });
          call.on('error', e => dbg(`incoming call error from ${call.peer?.slice(0, 8)}: ${e}`));
          call.on('close', () => { dbg(`incoming call closed from ${call.peer?.slice(0, 8)}`); callsRef.current.delete(call.peer); });
        });
      });

      peer.on('disconnected', () => dbg('peer DISCONNECTED from signaling server'));
      peer.on('close', () => dbg('peer CLOSED'));
      peer.on('error', err => {
        const msg = (err as Error).message ?? String(err);
        dbg(`peer ERROR: ${msg}`);
        if (!msg.includes('Could not connect') && !msg.includes('Lost connection')) {
          console.warn('PeerJS:', err);
        }
      });
    } catch (e) {
      dbg(`join() FAILED: ${e}`);
      setError('Could not access microphone. Please allow microphone access and try again.');
      setConnecting(false);
    }
  }

  async function leave() {
    dbg('leave() called');
    cancelAnimationFrame(animFrameRef.current);
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    peerRef.current?.destroy();
    callsRef.current.clear();
    audioRefs.current.forEach(a => { a.srcObject = null; });
    audioRefs.current.clear();
    fxCtxRef.current?.close().catch(() => {});
    fxCtxRef.current = null;
    fxSourceRef.current = null;
    fxDestRef.current = null;
    fxNodesRef.current = [];
    outgoingStreamRef.current = null;
    await fetch(`/api/voice/${channelId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': String(userId) },
    }).catch(() => {});
    dbg('leave() complete');
    setJoined(false);
    setParticipants([]);
    setRemoteStreams({});
    setSpeaking(false);
    setMuted(false);
    setDeafened(false);
    setCameraOn(false);
    setHasCamera(false);
    setStreaming(false);
  }

  function toggleCamera() {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (!videoTrack) {
      setError('No camera available on this device.');
      return;
    }
    const next = !cameraOn;
    videoTrack.enabled = next;
    setCameraOn(next);
    dbg(`camera ${next ? 'ON' : 'OFF'}`);
    fetch(`/api/voice/${channelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
      body: JSON.stringify({ isCameraOn: next }),
    }).catch(() => {});
  }

  function toggleMute() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    const newMuted = !muted;
    track.enabled = !newMuted;
    setMuted(newMuted);
    fetch(`/api/voice/${channelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
      body: JSON.stringify({ isMuted: newMuted }),
    }).catch(() => {});
  }

  function toggleDeafen() {
    const newDeafened = !deafened;
    setDeafened(newDeafened);
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !newDeafened;
      setMuted(newDeafened);
    }
    audioRefs.current.forEach(a => { a.muted = newDeafened; });
    fetch(`/api/voice/${channelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
      body: JSON.stringify({ isDeafened: newDeafened, isMuted: newDeafened }),
    }).catch(() => {});
  }

  // Swap the outgoing video track on every active peer connection. replaceTrack
  // reuses the already-negotiated video sender, so no renegotiation is needed.
  function replaceOutgoingVideo(track: MediaStreamTrack | null) {
    callsRef.current.forEach(call => {
      const pc = call.peerConnection;
      const sender = pc?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(track).catch(() => {});
    });
  }

  function broadcastCameraState(on: boolean) {
    fetch(`/api/voice/${channelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
      body: JSON.stringify({ isCameraOn: on }),
    }).catch(() => {});
  }

  function stopStream() {
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStreamRef.current = null;
    // Revert peers to the camera track (kept disabled unless the camera is on).
    const camTrack = streamRef.current?.getVideoTracks()[0] ?? null;
    replaceOutgoingVideo(camTrack);
    setStreaming(false);
    broadcastCameraState(cameraOn);
    dbg('screen share stopped');
  }

  async function toggleStream() {
    if (streaming) {
      stopStream();
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Screen sharing is not supported in this browser.');
      return;
    }
    if (callsRef.current.size > 0 && !streamRef.current?.getVideoTracks()[0]) {
      setError('Screen sharing needs camera access granted at join time on this setup.');
      return;
    }

    try {
      setError('');
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Send the screen to every peer and let them render it in our video tile.
      replaceOutgoingVideo(screenTrack);
      setStreaming(true);
      broadcastCameraState(true);
      dbg('screen share started');

      // Browser-native "Stop sharing" button ends the track.
      screenTrack?.addEventListener('ended', () => stopStream(), { once: true });
    } catch {
      setError('Could not start screen share.');
    }
  }

  // Plays the clip locally on this machine only.
  function playTone(name: string, frequency: number) {
    const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = name === 'Airhorn' ? 'sawtooth' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
    setLastClip(name);
    window.setTimeout(() => ctx.close(), 420);
  }

  // Plays locally and tells everyone else in the channel to play it too.
  function playClip(name: string, frequency: number) {
    playTone(name, frequency);
    fetch(`/api/voice/${channelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
      body: JSON.stringify({ soundboard: { name, tone: frequency } }),
    }).catch(() => {});
  }

  useEffect(() => {
    if (!joined) return;
    let pusher: ReturnType<typeof getPusherClient> | null = null;
    try {
      dbg(`subscribing Pusher to voice-channel-${channelId}`);
      pusher = getPusherClient(userId);
      const ch = pusher.subscribe(`voice-channel-${channelId}`);

      ch.bind('pusher:subscription_succeeded', () => dbg('Pusher subscription_succeeded'));
      ch.bind('pusher:subscription_error', (e: unknown) => dbg(`Pusher subscription_error: ${JSON.stringify(e)}`));

      ch.bind('voice-user-joined', (p: Participant) => {
        dbg(`Pusher voice-user-joined — userId: ${p.userId} | peerId: ${p.peerId?.slice(0, 8)}`);
        setParticipants(prev => {
          const exists = prev.some(x => x.userId === p.userId);
          dbg(`voice-user-joined — exists in list: ${exists} | list size before: ${prev.length}`);
          return exists ? prev.map(x => (x.userId === p.userId ? { ...x, ...p } : x)) : [...prev, p];
        });
      });

      ch.bind('voice-user-left', ({ userId: leftId }: { userId: number }) => {
        dbg(`Pusher voice-user-left — userId: ${leftId}`);
        setParticipants(prev => {
          const leaving = prev.find(p => p.userId === leftId);
          if (leaving) {
            const audio = audioRefs.current.get(leaving.peerId);
            if (audio) { audio.srcObject = null; audioRefs.current.delete(leaving.peerId); }
          }
          return prev.filter(p => p.userId !== leftId);
        });
      });

      ch.bind('voice-user-state-updated', (updated: Partial<Participant> & { userId: number }) => {
        dbg(`Pusher voice-user-state-updated — userId: ${updated.userId}`);
        setParticipants(prev => prev.map(p => (p.userId === updated.userId ? { ...p, ...updated } : p)));
      });

      ch.bind('voice-soundboard', (clip: { userId: number; name: string; tone: number }) => {
        if (clip.userId === userId) return; // we already played it locally
        dbg(`Pusher voice-soundboard — ${clip.name} from userId ${clip.userId}`);
        playTone(clip.name, clip.tone);
      });
    } catch (e) {
      dbg(`Pusher setup ERROR: ${e}`);
    }

    return () => {
      try { pusher?.unsubscribe(`voice-channel-${channelId}`); dbg('Pusher unsubscribed'); } catch { /* ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, channelId, userId]);

  useEffect(() => {
    return () => { if (joined) leave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me: Participant = {
    userId,
    userName,
    peerId: myPeerIdRef.current,
    isMuted: muted,
    isDeafened: deafened,
    isSpeaking: speaking,
    isCameraOn: cameraOn || streaming,
    userAvatar: null,
  };
  const myStream = streaming ? screenStreamRef.current : cameraOn ? streamRef.current : null;
  const others = participants.filter(p => p.userId !== userId);

  return (
    <div className="flex flex-col flex-1 min-w-0" style={{ background: 'var(--bg-chat)' }}>
      <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <Volume2 size={18} style={{ color: 'var(--accent)' }} />
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{channelName}</h3>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>Voice</span>
        {joined && <span className="ml-auto text-xs" style={{ color: 'var(--text-3)' }}>{participants.length} connected</span>}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
        {!joined && !connecting && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)' }}>
              <Radio size={36} style={{ color: 'var(--accent)' }} />
            </div>
            <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-1)' }}>{channelName}</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>Join to talk with others in this voice channel</p>
          </motion.div>
        )}

        {connecting && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="text-center">
            <div className="w-16 h-16 rounded-full border-4 border-t-transparent border-[var(--accent)] animate-spin mx-auto mb-4" />
            <p style={{ color: 'var(--text-2)' }}>Connecting...</p>
          </motion.div>
        )}

        {joined && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-wrap gap-6 justify-center">
            <ParticipantCard participant={me} isSelf stream={myStream} mirror={cameraOn && !streaming} />
            <AnimatePresence>
              {others.map(p => (
                <motion.div
                  key={p.userId}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <ParticipantCard participant={p} isSelf={false} stream={p.isCameraOn ? remoteStreams[p.peerId] ?? null : null} />
                </motion.div>
              ))}
            </AnimatePresence>

            {others.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>No one else is here yet...</p>
            )}
          </motion.div>
        )}

        {error && <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="flex gap-3">
          {!joined && !connecting ? (
            <motion.button
              onClick={join}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white"
              style={{ background: 'var(--online)', boxShadow: '0 4px 20px rgba(35,209,139,0.3)' }}
            >
              <Mic size={16} />
              Join Voice
            </motion.button>
          ) : joined ? (
            <>
              <motion.button
                onClick={toggleMute}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors"
                title={muted ? 'Unmute' : 'Mute'}
                style={{
                  background: muted ? 'rgba(240,71,71,0.2)' : 'var(--bg-elevated)',
                  color: muted ? 'var(--danger)' : 'var(--text-1)',
                  border: muted ? '1px solid rgba(240,71,71,0.4)' : '1px solid var(--border)',
                }}
              >
                {muted ? <MicOff size={18} /> : <Mic size={18} />}
              </motion.button>

              <motion.button
                onClick={toggleDeafen}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors"
                title={deafened ? 'Undeafen' : 'Deafen'}
                style={{
                  background: deafened ? 'rgba(240,71,71,0.2)' : 'var(--bg-elevated)',
                  color: deafened ? 'var(--danger)' : 'var(--text-1)',
                  border: deafened ? '1px solid rgba(240,71,71,0.4)' : '1px solid var(--border)',
                }}
              >
                {deafened ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </motion.button>

              <motion.button
                onClick={toggleCamera}
                disabled={!hasCamera}
                whileHover={{ scale: hasCamera ? 1.06 : 1 }}
                whileTap={{ scale: hasCamera ? 0.94 : 1 }}
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={!hasCamera ? 'No camera available' : cameraOn ? 'Turn off camera' : 'Turn on camera'}
                style={{
                  background: cameraOn ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                  color: cameraOn ? 'var(--accent)' : 'var(--text-1)',
                  border: cameraOn ? '1px solid var(--accent-glow)' : '1px solid var(--border)',
                }}
              >
                {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
              </motion.button>

              <motion.button
                onClick={leave}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white"
                style={{ background: 'var(--danger)' }}
              >
                <PhoneOff size={16} />
                Leave
              </motion.button>
            </>
          ) : null}
        </div>

        {joined && (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="grid w-full max-w-3xl gap-3 md:grid-cols-3"
          >
            <ControlPanel
              icon={<MonitorUp size={16} />}
              title="Go Live"
              detail={streaming ? 'Streaming screen' : 'Share a game, app, or screen'}
            >
              <button
                onClick={toggleStream}
                className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
                style={{
                  background: streaming ? 'rgba(240,71,71,0.2)' : 'var(--accent-dim)',
                  color: streaming ? 'var(--danger)' : 'var(--accent)',
                  border: streaming ? '1px solid rgba(240,71,71,0.35)' : '1px solid var(--accent-glow)',
                }}
              >
                {streaming ? 'Stop Stream' : 'Start Stream'}
              </button>
            </ControlPanel>

            <ControlPanel
              icon={<Wand2 size={16} />}
              title="Voice Effects"
              detail={`${voiceEffect} voice active`}
            >
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg p-1" style={{ background: 'var(--bg-sidebar)' }}>
                {['Clean', 'Radio', 'Deep'].map(effect => (
                  <button
                    key={effect}
                    onClick={() => changeVoiceEffect(effect)}
                    className="rounded-md px-2 py-1.5 text-[11px] transition-colors"
                    style={{
                      background: voiceEffect === effect ? 'var(--bg-elevated)' : 'transparent',
                      color: voiceEffect === effect ? 'var(--text-1)' : 'var(--text-3)',
                    }}
                  >
                    {effect}
                  </button>
                ))}
              </div>
            </ControlPanel>

            <ControlPanel
              icon={<Music2 size={16} />}
              title="Soundboard"
              detail={lastClip ? `Played ${lastClip}` : 'Tap a clip reaction'}
            >
              <div className="mt-3 grid grid-cols-3 gap-1">
                {[
                  { name: 'Airhorn', tone: 220 },
                  { name: 'GG', tone: 440 },
                  { name: 'Spark', tone: 660 },
                ].map(clip => (
                  <button
                    key={clip.name}
                    onClick={() => playClip(clip.name, clip.tone)}
                    className="rounded-lg px-2 py-2 text-[11px] transition-colors hover:bg-white/[0.06]"
                    style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
                  >
                    {clip.name}
                  </button>
                ))}
              </div>
            </ControlPanel>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ControlPanel({
  icon,
  title,
  detail,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5" style={{ color: 'var(--accent)' }}>{icon}</span>
        <div className="min-w-0">
          <h4 className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{title}</h4>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-3)' }}>{detail}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function VideoTile({ stream, mirror }: { stream: MediaStream; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover"
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
    />
  );
}

function ParticipantCard({ participant, isSelf, stream, mirror }: { participant: Participant; isSelf: boolean; stream?: MediaStream | null; mirror?: boolean }) {
  const showVideo = !!(participant.isCameraOn && stream);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <motion.div
          animate={participant.isSpeaking ? { boxShadow: ['0 0 0 0 rgba(35,209,139,0.4)', '0 0 0 8px rgba(35,209,139,0)', '0 0 0 0 rgba(35,209,139,0)'] } : {}}
          transition={{ duration: 1.2, repeat: Infinity }}
          className={`rounded-2xl flex items-center justify-center text-white font-bold text-lg overflow-hidden ${showVideo ? 'w-48 h-32' : 'w-16 h-16'}`}
          style={{
            background: isSelf ? 'var(--accent)' : 'var(--bg-elevated)',
            border: participant.isSpeaking ? '2px solid var(--online)' : '2px solid var(--border)',
          }}
        >
          {showVideo && stream ? (
            <VideoTile stream={stream} mirror={mirror ?? isSelf} />
          ) : participant.userAvatar ? (
            <img src={participant.userAvatar} alt={participant.userName} className="w-full h-full object-cover" />
          ) : (
            participant.userName.slice(0, 2).toUpperCase()
          )}
        </motion.div>

        {participant.isMuted && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--danger)', border: '2px solid var(--bg-chat)' }}>
            <MicOff size={10} color="#fff" />
          </div>
        )}
        {participant.isDeafened && !participant.isMuted && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--danger)', border: '2px solid var(--bg-chat)' }}>
            <VolumeX size={10} color="#fff" />
          </div>
        )}
      </div>
      <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
        {participant.userName}{isSelf ? ' (you)' : ''}
      </span>
    </div>
  );
}
