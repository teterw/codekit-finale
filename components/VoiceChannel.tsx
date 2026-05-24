'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, MonitorUp, Music2, PhoneOff, Radio, Volume2, VolumeX, Wand2 } from 'lucide-react';
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
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [voiceEffect, setVoiceEffect] = useState('Clean');
  const [lastClip, setLastClip] = useState('');

  const peerRef = useRef<import('peerjs').Peer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const animFrameRef = useRef<number>(0);
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myPeerIdRef = useRef<string>('');

  function playAudio(stream: MediaStream, peerId: string) {
    let audio = audioRefs.current.get(peerId);
    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      audioRefs.current.set(peerId, audio);
    }
    audio.srcObject = stream;
    audio.muted = deafened;
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      setupVoiceActivity(stream);

      const { Peer } = await import('peerjs');
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', async myPeerId => {
        myPeerIdRef.current = myPeerId;

        const res = await fetch(`/api/voice/${channelId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
          body: JSON.stringify({ peerId: myPeerId }),
        });
        const data = await res.json();
        const allParticipants: Participant[] = data.participants ?? [];
        const others = allParticipants.filter(p => p.userId !== userId);
        setParticipants(allParticipants);
        setJoined(true);
        setConnecting(false);

        for (const p of others) {
          const call = peer.call(p.peerId, stream);
          call?.on('stream', remote => playAudio(remote, p.peerId));
        }

        peer.on('call', call => {
          call.answer(stream);
          call.on('stream', remote => playAudio(remote, call.peer));
        });
      });

      peer.on('error', err => {
        const msg = (err as Error).message ?? '';
        if (!msg.includes('Could not connect') && !msg.includes('Lost connection')) {
          console.warn('PeerJS:', err);
        }
      });
    } catch {
      setError('Could not access microphone. Please allow microphone access and try again.');
      setConnecting(false);
    }
  }

  async function leave() {
    cancelAnimationFrame(animFrameRef.current);
    if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    peerRef.current?.destroy();
    audioRefs.current.forEach(a => { a.srcObject = null; });
    audioRefs.current.clear();
    await fetch(`/api/voice/${channelId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': String(userId) },
    }).catch(() => {});
    setJoined(false);
    setParticipants([]);
    setSpeaking(false);
    setMuted(false);
    setDeafened(false);
    setStreaming(false);
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

  async function toggleStream() {
    if (streaming) {
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setStreaming(false);
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Screen sharing is not supported in this browser.');
      return;
    }

    try {
      setError('');
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = screenStream;
      screenStream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          screenStreamRef.current = null;
          setStreaming(false);
        }, { once: true });
      });
      setStreaming(true);
    } catch {
      setError('Could not start screen share.');
    }
  }

  function playClip(name: string, frequency: number) {
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

  useEffect(() => {
    if (!joined) return;
    let pusher: ReturnType<typeof getPusherClient> | null = null;
    try {
      pusher = getPusherClient(userId);
      const ch = pusher.subscribe(`voice-channel-${channelId}`);

      ch.bind('voice-user-joined', (p: Participant) => {
        // The joining user already called us; just update the participant list.
        // Calling back here would create a duplicate WebRTC connection and break audio.
        setParticipants(prev => {
          const exists = prev.some(x => x.userId === p.userId);
          return exists ? prev.map(x => (x.userId === p.userId ? { ...x, ...p } : x)) : [...prev, p];
        });
      });

      ch.bind('voice-user-left', ({ userId: leftId }: { userId: number }) => {
        setParticipants(prev => {
          const leaving = prev.find(p => p.userId === leftId);
          if (leaving) {
            const audio = audioRefs.current.get(leaving.peerId);
            if (audio) {
              audio.srcObject = null;
              audioRefs.current.delete(leaving.peerId);
            }
          }
          return prev.filter(p => p.userId !== leftId);
        });
      });

      ch.bind('voice-user-state-updated', (updated: Partial<Participant> & { userId: number }) => {
        setParticipants(prev => prev.map(p => (p.userId === updated.userId ? { ...p, ...updated } : p)));
      });
    } catch {
      // Pusher is optional.
    }

    return () => {
      try { pusher?.unsubscribe(`voice-channel-${channelId}`); } catch { /* ignore */ }
    };
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
    userAvatar: null,
  };
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
            <ParticipantCard participant={me} isSelf />
            <AnimatePresence>
              {others.map(p => (
                <motion.div
                  key={p.userId}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <ParticipantCard participant={p} isSelf={false} />
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
                    onClick={() => setVoiceEffect(effect)}
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

function ParticipantCard({ participant, isSelf }: { participant: Participant; isSelf: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <motion.div
          animate={participant.isSpeaking ? { boxShadow: ['0 0 0 0 rgba(35,209,139,0.4)', '0 0 0 8px rgba(35,209,139,0)', '0 0 0 0 rgba(35,209,139,0)'] } : {}}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-lg overflow-hidden"
          style={{
            background: isSelf ? 'var(--accent)' : 'var(--bg-elevated)',
            border: participant.isSpeaking ? '2px solid var(--online)' : '2px solid var(--border)',
          }}
        >
          {participant.userAvatar ? (
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
