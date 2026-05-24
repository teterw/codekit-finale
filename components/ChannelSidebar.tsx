'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Copy, Check, Hash, UserPlus, Volume2, Settings, LogOut, Edit2 } from 'lucide-react';
import { getPusherClient } from '@/lib/pusher-client';
import EditServerModal from './EditServerModal';

const STATUS_DOT: Record<string, string> = {
  online:  '#23A55A',
  idle:    '#F0B232',
  dnd:     '#F23F43',
  offline: '#80848E',
};
const STATUS_LABEL: Record<string, string> = {
  online:  'Online',
  idle:    'Idle',
  dnd:     'Do Not Disturb',
  offline: 'Invisible',
};

interface Channel { id: number; name: string; type: string; }
interface Server   { id: number; name: string; icon: string | null; ownerId: number; }

interface Props {
  server: Server | null;
  channels: Channel[];
  selectedChannelId: number | null;
  userId: number;
  userName: string;
  userAvatar?: string | null;
  userStatus?: string;
  onSelectChannel: (channel: Channel) => void;
  onCreateInvite: () => void;
  onLogout: () => void;
  onOpenProfileSettings?: () => void;
  onViewOwnProfile?: () => void;
  onServerUpdated: (server: Server) => void;
  onServerDeleted: (serverId: number) => void;
}

export default function ChannelSidebar({
  server, channels, selectedChannelId, userId, userName,
  userAvatar, userStatus,
  onSelectChannel, onLogout, onOpenProfileSettings, onViewOwnProfile,
  onServerUpdated, onServerDeleted,
}: Props) {
  const [inviteCode, setInviteCode]   = useState('');
  const [copied, setCopied]           = useState(false);
  const [showInvite, setShowInvite]   = useState(false);
  const [showEditServer, setShowEditServer] = useState(false);
  const [localName, setLocalName]     = useState(userName);
  const [localAvatar, setLocalAvatar] = useState(userAvatar ?? null);
  const [localStatus, setLocalStatus] = useState(userStatus ?? 'online');

  useEffect(() => { setLocalName(userName); },          [userName]);
  useEffect(() => { setLocalAvatar(userAvatar ?? null); }, [userAvatar]);
  useEffect(() => { setLocalStatus(userStatus ?? 'online'); }, [userStatus]);

  useEffect(() => {
    let pusher: ReturnType<typeof getPusherClient> | null = null;
    try {
      pusher = getPusherClient(userId);
      const ch = pusher.subscribe(`user-${userId}`);
      ch.bind('profile-updated', (p: { name: string; avatar: string | null; status: string }) => {
        if (p.name)   setLocalName(p.name);
        setLocalAvatar(p.avatar ?? null);
        if (p.status) setLocalStatus(p.status);
      });
    } catch { /* Pusher not configured */ }
    return () => {
      try { pusher?.unsubscribe(`user-${userId}`); } catch { /* ignore */ }
    };
  }, [userId]);

  const textChannels  = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  async function generateInvite() {
    if (!server) return;
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
      body: JSON.stringify({ serverId: server.id, expiresInHours: 24 }),
    });
    if (res.ok) {
      const data = await res.json();
      setInviteCode(data.invite.code);
      setShowInvite(true);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!server) {
    return (
      <div
        className="w-60 min-w-[240px] flex items-center justify-center text-sm"
        style={{ background: 'var(--bg-channels)', color: 'var(--text-3)' }}
      >
        Select a server
      </div>
    );
  }

  const canManageServer = server.ownerId === userId;

  return (
    <div className="w-60 min-w-[240px] flex flex-col" style={{ background: 'var(--bg-channels)' }}>

      {/* ── Server header ─────────────────────── */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0 cursor-pointer hover:bg-white/[0.05] transition-colors"
        style={{ borderBottom: '1px solid var(--border)', height: '48px' }}
      >
        <h2
          className="flex-1 font-bold text-[15px] truncate"
          style={{ color: 'var(--text-1)' }}
        >
          {server.name}
        </h2>
        <div className="flex items-center gap-1 flex-shrink-0">
          {canManageServer && (
            <button
              onClick={() => setShowEditServer(true)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Edit server"
              style={{ color: 'var(--text-muted)' }}
            >
              <Edit2 size={14} />
            </button>
          )}
          <ChevronDown size={16} style={{ color: 'var(--text-2)' }} />
        </div>
      </div>

      {/* ── Channels ──────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-2">

        {textChannels.length > 0 && (
          <ChannelGroup label="Text Channels">
            {textChannels.map(ch => (
              <ChannelRow
                key={ch.id}
                channel={ch}
                selected={ch.id === selectedChannelId}
                onClick={() => onSelectChannel(ch)}
                icon={<Hash size={16} />}
              />
            ))}
          </ChannelGroup>
        )}

        {voiceChannels.length > 0 && (
          <ChannelGroup label="Voice Channels">
            {voiceChannels.map(ch => (
              <ChannelRow
                key={ch.id}
                channel={ch}
                selected={ch.id === selectedChannelId}
                onClick={() => onSelectChannel(ch)}
                icon={<Volume2 size={16} />}
              />
            ))}
          </ChannelGroup>
        )}

        {/* Invite People */}
        <button onClick={generateInvite} className="ch-row mt-1">
          <span className="ch-icon"><UserPlus size={16} /></span>
          <span className="flex-1 truncate">Invite People</span>
        </button>

        <AnimatePresence>
          {showInvite && inviteCode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div
                className="mx-1 mt-1 mb-2 rounded p-2.5"
                style={{ background: '#1E1F22', border: '1px solid var(--border)' }}
              >
                <p
                  className="text-[11px] uppercase font-bold tracking-wider mb-2"
                  style={{ color: 'var(--text-3)' }}
                >
                  Invite Link (24h)
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs truncate font-mono" style={{ color: 'var(--accent)' }}>
                    {inviteCode}
                  </code>
                  <button
                    onClick={copyCode}
                    className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
                    style={{ color: copied ? 'var(--online)' : 'var(--text-3)' }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── User panel ────────────────────────── */}
      <div
        className="flex items-center gap-2 px-2 flex-shrink-0"
        style={{ background: 'var(--bg-user-panel)', height: '52px' }}
      >
        {/* Avatar + status dot */}
        <button
          onClick={onViewOwnProfile}
          className="relative flex-shrink-0 hover:opacity-90 transition-opacity"
          title="Your profile"
        >
          {localAvatar ? (
            <img src={localAvatar} alt={localName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'var(--accent)' }}
            >
              {localName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div
            className="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full border-[2.5px]"
            style={{
              background: STATUS_DOT[localStatus] ?? STATUS_DOT.online,
              borderColor: 'var(--bg-user-panel)',
            }}
          />
        </button>

        {/* Name / status */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: 'var(--text-1)' }}>
            {localName}
          </p>
          <p className="text-[11px] leading-tight truncate" style={{ color: 'var(--text-3)' }}>
            {STATUS_LABEL[localStatus] ?? 'Online'}
          </p>
        </div>

        {/* Action icons */}
        <div className="flex items-center flex-shrink-0">
          <button
            onClick={onOpenProfileSettings}
            title="User Settings"
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <Settings size={18} />
          </button>
          <button
            onClick={onLogout}
            title="Log out"
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Edit server modal */}
      <AnimatePresence>
        {showEditServer && (
          <EditServerModal
            server={server}
            currentUserId={userId}
            onUpdated={updatedServer => {
              onServerUpdated(updatedServer);
              setShowEditServer(false);
            }}
            onDeleted={deletedServerId => {
              onServerDeleted(deletedServerId);
              setShowEditServer(false);
            }}
            onClose={() => setShowEditServer(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sub-components ─────────────────────────── */

function ChannelGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button className="cat-row" onClick={() => setOpen(v => !v)}>
        {open
          ? <ChevronDown size={12} className="cat-chevron" />
          : <ChevronRight size={12} className="cat-chevron" />
        }
        <span className="cat-label">{label}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChannelRow({
  channel, selected, onClick, icon,
}: {
  channel: Channel;
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className={`ch-row ${selected ? 'ch-active' : ''}`}>
      <span className="ch-icon">{icon}</span>
      <span className="flex-1 truncate">{channel.name}</span>
    </button>
  );
}
