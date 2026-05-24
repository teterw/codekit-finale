'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Server {
  id: number;
  name: string;
  icon: string | null;
}

export default function ServerSidebar({ userId }: { userId: number }) {
  const [servers, setServers] = useState<Server[]>([]);
  const params = useParams();
  const router = useRouter();
  const activeServerId = params?.serverId ? Number(params.serverId) : null;

  useEffect(() => {
    fetch('/api/servers', { headers: { 'x-user-id': String(userId) } })
      .then(r => r.json())
      .then(data => setServers(data.servers ?? []))
      .catch(() => {});
  }, [userId]);

  return (
    <nav
      className="flex flex-col items-center gap-2 py-3 overflow-y-auto flex-shrink-0"
      style={{ width: 72, background: 'var(--dc-server-bar)' }}
    >
      {/* Home */}
      <button
        onClick={() => router.push('/channels')}
        title="Home"
        className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition-all hover:rounded-2xl flex-shrink-0"
        style={{ background: 'var(--dc-accent)', color: 'white' }}
      >
        🏠
      </button>
      <div className="w-8 h-px my-1 flex-shrink-0" style={{ background: 'var(--dc-border)' }} />

      {servers.map(server => {
        const isActive = server.id === activeServerId;
        const initials = server.name
          .split(' ')
          .map(w => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        return (
          <button
            key={server.id}
            onClick={() => router.push(`/channels/${server.id}`)}
            title={server.name}
            className="w-12 h-12 flex items-center justify-center text-xs font-semibold transition-all overflow-hidden flex-shrink-0 relative"
            style={{
              borderRadius: isActive ? '33%' : '50%',
              background: isActive ? 'var(--dc-accent)' : 'var(--dc-sidebar)',
              color: isActive ? 'white' : 'var(--dc-text)',
            }}
          >
            {isActive && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r"
                style={{ height: 36, background: 'white' }}
              />
            )}
            {server.icon ? (
              <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </button>
        );
      })}
    </nav>
  );
}
