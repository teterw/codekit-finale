'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Channel {
  id: number;
  name: string;
  type: string;
}

export default function ChannelList({ userId }: { userId: number }) {
  const params = useParams();
  const router = useRouter();
  const serverId = params?.serverId ? Number(params.serverId) : null;
  const channelId = params?.channelId ? Number(params.channelId) : null;
  const [channels, setChannels] = useState<Channel[]>([]);
  const [serverName, setServerName] = useState('');

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      if (cancelled) return;

      if (!serverId) {
        setChannels([]);
        setServerName('');
        return;
      }

      try {
        const response = await fetch(`/api/servers/${serverId}`, { headers: { 'x-user-id': String(userId) } });
        const data = await response.json();
        if (cancelled) return;
        setServerName(data.server?.name ?? '');
        setChannels(data.channels ?? []);
      } catch {
        // Leave the current list in place if the sidebar refresh fails.
      }
    });

    return () => {
      cancelled = true;
    };
  }, [serverId, userId]);

  const textChannels = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  return (
    <div
      className="flex flex-col flex-shrink-0 overflow-hidden"
      style={{ width: 240, background: 'var(--dc-sidebar)' }}
    >
      {/* Server name header */}
      <div
        className="px-4 py-3 text-sm font-semibold border-b flex-shrink-0 shadow-sm"
        style={{
          color: 'var(--dc-text)',
          borderColor: 'var(--dc-border)',
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {serverName || (serverId ? 'Loading...' : 'Select a server')}
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {textChannels.length > 0 && (
          <div className="mb-1">
            <p
              className="px-2 py-1 text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--dc-text-muted)' }}
            >
              Text Channels
            </p>
            {textChannels.map(ch => (
              <button
                key={ch.id}
                onClick={() => router.push(`/channels/${serverId}/${ch.id}`)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-sm text-left transition-colors"
                style={{
                  color: channelId === ch.id ? 'var(--dc-text)' : 'var(--dc-text-muted)',
                  background: channelId === ch.id ? 'var(--dc-channel-hover)' : 'transparent',
                  fontWeight: channelId === ch.id ? 600 : 400,
                }}
                onMouseEnter={e => {
                  if (channelId !== ch.id)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={e => {
                  if (channelId !== ch.id)
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: 14 }}>🗨️</span>
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
        )}

        {voiceChannels.length > 0 && (
          <div className="mb-1">
            <p
              className="px-2 py-1 text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--dc-text-muted)' }}
            >
              Voice Channels
            </p>
            {voiceChannels.map(ch => (
              <div
                key={ch.id}
                className="flex items-center gap-2 px-2 py-1 rounded text-sm"
                style={{ color: 'var(--dc-text-muted)' }}
              >
                <span style={{ fontSize: 14 }}>🔊</span>
                <span className="truncate">{ch.name}</span>
              </div>
            ))}
          </div>
        )}

        {!serverId && (
          <p className="px-2 py-4 text-xs text-center" style={{ color: 'var(--dc-text-muted)' }}>
            Select a server to see channels
          </p>
        )}
      </div>
    </div>
  );
}
