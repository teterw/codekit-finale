'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Server { id: number; name: string; icon: string | null; ownerId: number; }

interface ControlledProps {
  servers: Server[];
  selectedId: number | null;
  onSelect: (server: Server) => void;
  onAddServer: () => void;
  onJoinServer: () => void;
}

interface RoutedProps {
  userId: number;
}

type Props = ControlledProps | RoutedProps;

export default function ServerSidebar(props: Props) {
  if ('userId' in props) {
    return <RoutedServerSidebar userId={props.userId} />;
  }

  return <ServerSidebarView {...props} />;
}

function RoutedServerSidebar({ userId }: RoutedProps) {
  const router = useRouter();
  const params = useParams();
  const selectedId = params?.serverId ? Number(params.serverId) : null;
  const [servers, setServers] = useState<Server[]>([]);

  useEffect(() => {
    fetch('/api/servers', { headers: { 'x-user-id': String(userId) } })
      .then(res => (res.ok ? res.json() : { servers: [] }))
      .then(data => setServers(data.servers ?? []))
      .catch(() => setServers([]));
  }, [userId]);

  return (
    <ServerSidebarView
      servers={servers}
      selectedId={selectedId}
      onSelect={server => router.push(`/channels/${server.id}`)}
      onAddServer={() => router.push('/channels')}
      onJoinServer={() => router.push('/channels')}
    />
  );
}

function ServerSidebarView({ servers, selectedId, onSelect, onAddServer, onJoinServer }: ControlledProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-3 w-[72px] min-w-[72px] bg-[#202225] overflow-y-auto">
      {servers.map(server => {
        const selected = server.id === selectedId;
        const initials = server.name.slice(0, 2).toUpperCase();
        return (
          <div key={server.id} className="relative group flex-shrink-0">
            <div
              className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-white transition-all ${selected ? 'h-10' : 'h-5 opacity-0 group-hover:opacity-100'}`}
            />
            <button
              onClick={() => onSelect(server)}
              title={server.name}
              className={`w-12 h-12 rounded-[50%] group-hover:rounded-[30%] transition-all duration-200 flex items-center justify-center text-white font-bold text-sm overflow-hidden ${selected ? 'rounded-[30%] bg-[#7289da]' : 'bg-[#36393f]'}`}
            >
              {server.icon ? (
                <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </button>
          </div>
        );
      })}

      <div className="w-8 h-[2px] bg-[#36393f] rounded-full my-1" />

      <div className="relative group flex-shrink-0">
        <button
          onClick={onAddServer}
          title="Create a Server"
          className="w-12 h-12 rounded-[50%] group-hover:rounded-[30%] transition-all duration-200 bg-[#36393f] hover:bg-[#3ba55c] flex items-center justify-center text-[#3ba55c] hover:text-white text-2xl font-light"
        >
          +
        </button>
      </div>

      <div className="relative group flex-shrink-0">
        <button
          onClick={onJoinServer}
          title="Join a Server"
          className="w-12 h-12 rounded-[50%] group-hover:rounded-[30%] transition-all duration-200 bg-[#36393f] hover:bg-[#7289da] flex items-center justify-center text-[#7289da] hover:text-white text-xl"
        >
          ↗
        </button>
      </div>
    </div>
  );
}
