'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Link as LinkIcon, Plus } from 'lucide-react';

interface Server {
  id: number;
  name: string;
  icon: string | null;
  ownerId: number;
}

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

function ServerIcon({ server, selected, onClick }: { server: Server; selected: boolean; onClick: () => void }) {
  const initials = server.name.slice(0, 2).toUpperCase();

  return (
    <div className="relative group flex items-center w-full">
      <div
        className="absolute left-0 w-1 rounded-r-full transition-all duration-200"
        style={{
          background: 'var(--text-1)',
          height: selected ? '40px' : '8px',
          opacity: selected ? 1 : 0,
        }}
      />
      <div
        className="absolute left-0 w-1 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: 'var(--text-1)', height: '20px', display: selected ? 'none' : undefined }}
      />

      <motion.button
        onClick={onClick}
        title={server.name}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className="mx-auto w-12 h-12 flex items-center justify-center font-bold text-sm overflow-hidden transition-[border-radius] duration-200 flex-shrink-0"
        style={{
          borderRadius: selected ? '30%' : '50%',
          background: selected ? 'var(--accent)' : 'var(--bg-elevated)',
          boxShadow: selected ? '0 0 0 2px var(--accent), 0 4px 12px rgba(124,107,255,0.3)' : undefined,
          color: selected ? '#fff' : 'var(--text-2)',
        }}
      >
        {server.icon ? (
          <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </motion.button>

      <div
        className="absolute left-16 px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-xl"
        style={{ background: '#111', color: 'var(--text-1)', border: '1px solid var(--border)' }}
      >
        {server.name}
        <div
          className="absolute left-0 top-1/2 -translate-x-1.5 -translate-y-1/2 w-1.5 h-1.5 rotate-45"
          style={{ background: '#111', borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
        />
      </div>
    </div>
  );
}

function ActionIcon({
  onClick,
  title,
  color,
  children,
}: {
  onClick: () => void;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group flex items-center w-full">
      <motion.button
        onClick={onClick}
        title={title}
        whileHover={{ scale: 1.08, borderRadius: '30%' }}
        whileTap={{ scale: 0.94 }}
        className="mx-auto w-12 h-12 rounded-full flex items-center justify-center transition-colors"
        style={{ background: 'var(--bg-elevated)', color }}
      >
        {children}
      </motion.button>
      <div
        className="absolute left-16 px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-xl"
        style={{ background: '#111', color: 'var(--text-1)', border: '1px solid var(--border)' }}
      >
        {title}
      </div>
    </div>
  );
}

function ServerSidebarView({ servers, selectedId, onSelect, onAddServer, onJoinServer }: ControlledProps) {
  return (
    <div
      className="flex flex-col items-center gap-2 py-3 w-[72px] min-w-[72px] overflow-y-auto no-scrollbar"
      style={{ background: 'var(--bg-sidebar)' }}
    >
      {servers.map(server => (
        <ServerIcon
          key={server.id}
          server={server}
          selected={server.id === selectedId}
          onClick={() => onSelect(server)}
        />
      ))}

      <div className="w-8 my-1 flex-shrink-0" style={{ height: '1px', background: 'var(--border)' }} />

      <ActionIcon onClick={onAddServer} title="Create Server" color="var(--online)">
        <Plus size={20} strokeWidth={2.5} />
      </ActionIcon>

      <ActionIcon onClick={onJoinServer} title="Join Server" color="var(--accent)">
        <LinkIcon size={18} strokeWidth={2} />
      </ActionIcon>
    </div>
  );
}
