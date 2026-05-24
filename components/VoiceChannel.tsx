'use client';

import { useEffect, useRef, useState } from 'react';

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
            if (p.peerId === myPeerId) continue;
            if (!audioRefs.current.has(p.peerId)) {
              const call = peer.call(p.peerId, stream);
              call.on('stream', remote => playAudio(remote, p.peerId));
            }
          }
        }, 5000);
      });

      peer.on('error', (err) => {
        if ((err as Error).message?.includes('Could not connect')) return;
        console.warn('PeerJS error:', err);
      });
    } catch (err) {
      setError('Could not access microphone. Please allow microphone access.');
      console.error(err);
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

  useEffect(() => {
    return () => {
      if (joined) leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center px-4 py-3 border-b border-[#202225] bg-[#36393f] shadow">
        <span className="text-[#8e9297] mr-2">🔊</span>
        <h3 className="text-white font-semibold">{channelName}</h3>
        <span className="ml-2 text-xs text-[#8e9297]">Voice Channel</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <div className="text-center">
          <p className="text-[#b9bbbe] text-sm mb-4">
            {joined ? `${participants.length} participant${participants.length !== 1 ? 's' : ''}` : 'Not connected'}
          </p>

          <div className="flex flex-wrap gap-4 justify-center mb-6 min-h-[80px]">
            {joined && (
              <div className="flex flex-col items-center gap-2">
                <div className={`relative w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg transition-all ${speaking ? 'ring-4 ring-[#3ba55c]' : 'ring-2 ring-[#36393f]'} bg-[#7289da]`}>
                  {userName.slice(0, 2).toUpperCase()}
                  {muted && <span className="absolute -bottom-1 -right-1 bg-[#ed4245] rounded-full w-5 h-5 flex items-center justify-center text-xs">🔇</span>}
                </div>
                <span className="text-[#dcddde] text-xs">{userName} (you)</span>
              </div>
            )}

            {participants
              .filter(p => p.userId !== userId)
              .map(p => (
                <div key={p.userId} className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg bg-[#36393f] ring-2 ring-[#36393f]">
                    {p.userName.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-[#dcddde] text-xs">{p.userName}</span>
                </div>
              ))}
          </div>

          {error && <p className="text-[#ed4245] text-sm mb-4">{error}</p>}

          <div className="flex gap-3 justify-center">
            {!joined ? (
              <button
                onClick={join}
                className="bg-[#3ba55c] hover:bg-[#2d7d46] text-white px-6 py-2 rounded-full font-medium transition-colors"
              >
                Join Voice
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    const track = streamRef.current?.getAudioTracks()[0];
                    if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); }
                  }}
                  className={`px-4 py-2 rounded-full font-medium transition-colors ${muted ? 'bg-[#ed4245] hover:bg-[#c03537] text-white' : 'bg-[#40444b] hover:bg-[#36393f] text-[#dcddde]'}`}
                >
                  {muted ? '🔇 Unmute' : '🎙️ Mute'}
                </button>
                <button
                  onClick={leave}
                  className="bg-[#ed4245] hover:bg-[#c03537] text-white px-4 py-2 rounded-full font-medium transition-colors"
                >
                  📴 Leave
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
