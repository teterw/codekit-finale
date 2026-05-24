'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, PhoneOff, Volume2, Radio } from 'lucide-react';
import { fadeUp } from '@/lib/animations';

interface Participant {
  userId: number;
  peerId: string;
  userName: string;
  userAvatar: string | null;
}

interface Props {
  channelId: number;
  channelName: string;
  userId: number;
  userName: string;
}

export default function VoiceChannel({ channelId, channelName, userId, userName }: Props) {
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const peerRef = useRef<import('peerjs').Peer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function getParticipants(): Promise<Participant[]> {
    const res = await fetch(`/api/voice/${channelId}`, { headers: { 'x-user-id': String(userId) } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.participants ?? [];
  }

  function playAudio(stream: MediaStream, peerId: string) {
    let audio = audioRefs.current.get(peerId);
    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      audioRefs.current.set(peerId, audio);
    }
    audio.srcObject = stream;
  }

  function setupVoiceActivity(stream: MediaStream) {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    function tick() {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setSpeaking(avg > 15);
      animFrameRef.current = requestAnimationFrame(tick);
    }
    tick();
  }

  async function join() {
    setError('');
    setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setupVoiceActivity(stream);

      const { Peer } = await import('peerjs');
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', async (myPeerId) => {
        await fetch(`/api/voice/${channelId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
          body: JSON.stringify({ peerId: myPeerId }),
        });

        setJoined(true);
        setConnecting(false);

        const others = await getParticipants();
        setParticipants(others);

        for (const p of others) {
          if (p.peerId === myPeerId) continue;
          const call = peer.call(p.peerId, stream);
          call.on('stream', remote => playAudio(remote, p.peerId));
        }

        peer.on('call', call => {
          call.answer(stream);
          call.on('stream', remote => playAudio(remote, call.peer));
        });

        pollRef.current = setInterval(async () => {
          const list = await getParticipants();
          setParticipants(list);
          for (const p of list) {
            if (p.peerId === myPeerId || audioRefs.current.has(p.peerId)) continue;
            const call = peer.call(p.peerId, stream);
            call.on('stream', remote => playAudio(remote, p.peerId));
          }
        }, 5000);
      });

      peer.on('error', err => {
        if ((err as Error).message?.includes('Could not connect')) return;
        console.warn('PeerJS:', err);
      });
    } catch {
      setError('Could not access microphone. Please allow microphone access.');
      setConnecting(false);
    }
  }

  async function leave() {
    cancelAnimationFrame(animFrameRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    peerRef.current?.destroy();
    audioRefs.current.forEach(a => { a.srcObject = null; });
    audioRefs.current.clear();
    await fetch(`/api/voice/${channelId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': String(userId) },
    });
    setJoined(false);
    setParticipants([]);
    setSpeaking(false);
  }

  function toggleMute() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); }
  }

  useEffect(() => {
    return () => { if (joined) leave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const others = participants.filter(p => p.userId !== userId);

  return (
    <div className="flex flex-col flex-1 min-w-0" style={{ background: 'var(--bg-chat)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <Volume2 size={18} style={{ color: 'var(--accent)' }} />
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{channelName}</h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          Voice
        </span>
        {joined && (
          <span className="ml-auto text-xs" style={{ color: 'var(--text-3)' }}>
            {participants.length} connected
          </span>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
        {/* Status */}
        {!joined && !connecting && (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="text-center"
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)' }}
            >
              <Radio size={36} style={{ color: 'var(--accent)' }} />
            </div>
            <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text-1)' }}>
              {channelName}
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>
              Join to talk with others in this voice channel
            </p>
          </motion.div>
        )}

        {/* Participant grid */}
        {joined && (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="flex flex-wrap gap-6 justify-center"
          >
            {/* Self */}
            <ParticipantCard
              name={userName}
              avatar={null}
              isSelf
              speaking={speaking && !muted}
              muted={muted}
            />
            {/* Others */}
            <AnimatePresence>
              {others.map(p => (
                <motion.div
                  key={p.userId}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <ParticipantCard
                    name={p.userName}
                    avatar={p.userAvatar}
                    isSelf={false}
                    speaking={false}
                    muted={false}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>{error}</p>
        )}

        {/* Controls */}
        <div className="flex gap-3">
          {!joined ? (
            <motion.button
              onClick={join}
              disabled={connecting}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-70 transition-opacity"
              style={{ background: 'var(--online)', boxShadow: '0 4px 20px rgba(35,209,139,0.3)' }}
            >
              <Mic size={16} />
              {connecting ? 'Connecting…' : 'Join Voice'}
            </motion.button>
          ) : (
            <>
              <motion.button
                onClick={toggleMute}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors"
                style={{
                  background: muted ? 'rgba(240,71,71,0.2)' : 'var(--bg-elevated)',
                  color: muted ? 'var(--danger)' : 'var(--text-1)',
                  border: muted ? '1px solid rgba(240,71,71,0.4)' : '1px solid var(--border)',
                }}
              >
                {muted ? <MicOff size={18} /> : <Mic size={18} />}
              </motion.button>

              <motion.button
                onClick={leave}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-colors"
                style={{ background: 'var(--danger)' }}
              >
                <PhoneOff size={16} />
                Leave
              </motion.button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ParticipantCard({
  name, avatar, isSelf, speaking, muted,
}: {
  name: string;
  avatar: string | null;
  isSelf: boolean;
  speaking: boolean;
  muted: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-lg overflow-hidden ${speaking ? 'speaking' : ''}`}
          style={{
            background: isSelf ? 'var(--accent)' : 'var(--bg-elevated)',
            border: speaking ? '2px solid var(--online)' : '2px solid var(--border)',
          }}
        >
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full object-cover" />
          ) : (
            name.slice(0, 2).toUpperCase()
          )}
        </div>
        {muted && (
          <div
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: 'var(--danger)', border: '2px solid var(--bg-chat)' }}
          >
            <MicOff size={10} color="#fff" />
          </div>
        )}
      </div>
      <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
        {name}{isSelf ? ' (you)' : ''}
      </span>
    </div>
  );
}
