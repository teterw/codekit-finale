'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Compass, MessageSquare, Plus } from 'lucide-react';

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
  onOpenDMs?: () => void;
  dmActive?: boolean;
}

interface RoutedProps {
  userId: number;
}

type Props = ControlledProps | RoutedProps;

export default function ServerSidebar(props: Props) {
  if ('userId' in props) return <RoutedServerSidebar userId={props.userId} />;
  return <ServerSidebarView {...props} />;
}

function RoutedServerSidebar({ userId }: RoutedProps) {
  const router   = useRouter();
  const params   = useParams();
  const selectedId = params?.serverId ? Number(params.serverId) : null;
  const isDmPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/direct-messages');
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
      dmActive={isDmPage}
      onSelect={server => router.push(`/channels/${server.id}`)}
      onOpenDMs={() => router.push('/direct-messages')}
      onAddServer={() => router.push('/channels')}
      onJoinServer={() => router.push('/channels')}
    />
  );
}

/* ── Server icon pill indicator ─────────────── */
function Pill({ selected, hovered }: { selected: boolean; hovered: boolean }) {
  const height = selected ? 40 : hovered ? 20 : 0;
  return (
    <div
      className="absolute left-0 w-[4px] rounded-r-full transition-all duration-200 pointer-events-none"
      style={{
        background: '#F2F3F5',
        height: `${height}px`,
        top: '50%',
        transform: 'translateY(-50%)',
        opacity: selected || hovered ? 1 : 0,
      }}
    />
  );
}

/* ── Individual server icon ──────────────────── */
function ServerIcon({ server, selected, onClick }: { server: Server; selected: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const initials = server.name.slice(0, 2).toUpperCase();

  return (
    <div
      className="relative flex items-center w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Pill selected={selected} hovered={hovered && !selected} />

      <motion.button
        onClick={onClick}
        title={server.name}
        animate={{
          borderRadius: selected || hovered ? '30%' : '50%',
          scale: hovered ? 1.05 : 1,
        }}
        whileTap={{ scale: 0.93 }}
        transition={{ duration: 0.15 }}
        className="mx-auto w-12 h-12 flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0"
        style={{
          background: selected ? 'var(--accent)' : '#36393F',
          color:      selected ? '#fff' : '#DCDDDE',
          boxShadow:  selected ? '0 0 0 3px var(--accent), 0 2px 8px rgba(0,0,0,0.4)' : undefined,
        }}
      >
        {server.icon
          ? <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
          : initials
        }
      </motion.button>

      {/* Tooltip */}
      <Tooltip label={server.name} />
    </div>
  );
}

/* ── Action button (Add / Explore) ───────────── */
function ActionIcon({
  onClick, title, hoverBg, children,
}: {
  onClick: () => void;
  title: string;
  hoverBg: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative flex items-center w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.button
        onClick={onClick}
        animate={{
          borderRadius: hovered ? '30%' : '50%',
          scale: hovered ? 1.05 : 1,
        }}
        whileTap={{ scale: 0.93 }}
        transition={{ duration: 0.15 }}
        className="mx-auto w-12 h-12 flex items-center justify-center"
        style={{
          background: hovered ? hoverBg : '#36393F',
          color:      hovered ? '#fff'   : '#3BA55C',
        }}
      >
        {children}
      </motion.button>

      <Tooltip label={title} />
    </div>
  );
}

/* ── Tooltip ─────────────────────────────────── */
function Tooltip({ label }: { label: string }) {
  return (
    <div
      className="absolute left-[68px] px-3 py-1.5 rounded-[4px] text-sm font-semibold whitespace-nowrap
                 opacity-0 group-hover:opacity-0 pointer-events-none z-50 shadow-xl
                 [.relative:hover_&]:opacity-100"
      style={{ background: '#111214', color: '#F2F3F5' }}
    >
      {label}
      {/* Arrow */}
      <div
        className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent"
        style={{ borderRightColor: '#111214' }}
      />
    </div>
  );
}

/* ── Divider ─────────────────────────────────── */
function Divider() {
  return (
    <div className="flex justify-center w-full px-2 my-0.5">
      <div className="w-8 h-px" style={{ background: '#35363C' }} />
    </div>
  );
}

/* ── DM Home button ──────────────────────────── */
function DMHomeButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative flex items-center w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Pill selected={active} hovered={hovered && !active} />
      <motion.button
        onClick={onClick}
        title="Direct Messages"
        animate={{
          borderRadius: active || hovered ? '30%' : '50%',
          scale: hovered ? 1.05 : 1,
        }}
        whileTap={{ scale: 0.93 }}
        transition={{ duration: 0.15 }}
        className="mx-auto w-12 h-12 flex items-center justify-center"
        style={{
          background: active ? 'var(--accent)' : '#36393F',
          color: active ? '#fff' : '#DCDDDE',
          boxShadow: active ? '0 0 0 3px var(--accent), 0 2px 8px rgba(0,0,0,0.4)' : undefined,
        }}
      >
        <MessageSquare size={22} strokeWidth={2} />
      </motion.button>
      <Tooltip label="Direct Messages" />
    </div>
  );
}

/* ── Main sidebar view ───────────────────────── */
function ServerSidebarView({ servers, selectedId, dmActive, onSelect, onOpenDMs, onAddServer, onJoinServer }: ControlledProps) {
  return (
    <div
      className="flex flex-col items-center gap-2 py-3 w-[72px] min-w-[72px] overflow-y-auto no-scrollbar"
      style={{ background: 'var(--bg-sidebar)' }}
    >
      <DMHomeButton active={!!dmActive} onClick={onOpenDMs ?? (() => {})} />

      <Divider />

      {servers.map(server => (
        <ServerIcon
          key={server.id}
          server={server}
          selected={server.id === selectedId}
          onClick={() => onSelect(server)}
        />
      ))}

      {servers.length > 0 && <Divider />}

      <ActionIcon onClick={onAddServer} title="Add a Server" hoverBg="#3BA55C">
        <Plus size={22} strokeWidth={2.5} />
      </ActionIcon>

      <ActionIcon onClick={onJoinServer} title="Explore Servers" hoverBg="#3BA55C">
        <Compass size={20} strokeWidth={2} />
      </ActionIcon>
    </div>
  );
}
