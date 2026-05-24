'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface ServerPreview {
  id: number;
  name: string;
  icon: string | null;
  memberCount: number;
}

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [server, setServer] = useState<ServerPreview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch(`/api/invite/preview?code=${encodeURIComponent(code)}`);
        if (!res.ok) {
          setError('This invite link is invalid or has expired.');
          return;
        }
        const data = await res.json();
        setServer(data.server);
      } catch {
        setError('Unable to load invite.');
      } finally {
        setLoading(false);
      }
    }
    if (code) fetchPreview();
  }, [code]);

  async function joinServer() {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    if (!userId) {
      router.push('/');
      return;
    }
    setJoining(true);
    try {
      const res = await fetch('/api/invite/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        setJoined(true);
        setTimeout(() => router.push('/'), 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Unable to join server.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setJoining(false);
    }
  }

  const initials = server?.name.slice(0, 2).toUpperCase() ?? '??';

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-sidebar, #1a1a2e)' }}
    >
      <div
        className="flex flex-col items-center gap-6 rounded-2xl p-10 shadow-2xl w-full max-w-sm"
        style={{ background: 'var(--bg-chat, #23233a)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {loading && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-3xl animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="h-4 w-32 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl" style={{ background: 'rgba(240,71,71,0.15)' }}>
              🚫
            </div>
            <p className="font-semibold text-base" style={{ color: '#f04747' }}>Invalid Invite</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{error}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-2 px-6 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
            >
              Go Home
            </button>
          </div>
        )}

        {!loading && server && (
          <div className="flex flex-col items-center gap-4 text-center w-full">
            <div className="w-20 h-20 rounded-3xl overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent, #7c6bff)' }}>
              {server.icon ? (
                <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-white">{initials}</span>
              )}
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                You&apos;ve been invited to join
              </p>
              <h1 className="text-2xl font-bold" style={{ color: '#fff' }}>{server.name}</h1>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {server.memberCount} {server.memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>

            {joined ? (
              <div className="w-full py-3 rounded-xl text-sm font-semibold text-center" style={{ background: 'rgba(35,165,90,0.2)', color: '#23a55a' }}>
                Joined! Redirecting...
              </div>
            ) : (
              <button
                onClick={joinServer}
                disabled={joining}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60 hover:opacity-90"
                style={{ background: 'var(--accent, #7c6bff)', color: '#fff' }}
              >
                {joining ? 'Joining...' : 'Accept Invite'}
              </button>
            )}

            <button
              onClick={() => router.push('/')}
              className="text-xs transition-opacity hover:opacity-80"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Go back home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
