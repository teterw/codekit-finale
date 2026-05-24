'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Edit2, Hash, LogOut, MicOff, Settings, UserPlus, Volume2 } from 'lucide-react';
import { getPusherClient } from '@/lib/pusher-client';
import EditServerModal from './EditServerModal';

const STATUS_DOT: Record<string, string> = {
  online: '#23A55A',
  idle: '#F0B232',
  dnd: '#F23F43',
  offline: '#80848E',
};
const STATUS_LABEL: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Invisible',
};

interface Channel { id: number; name: string; type: string; }
interface Server { id: number; name: string; icon: string | null; ownerId: number; }
interface VoiceParticipantEntry {
  userId: number;
  userName: string;
  userAvatar: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
}

interface Props {
  server: Server | null;
  channels: Channel[];
  selectedChannelId: number | null;
  userId: number;
  userName: string;
  userAvatar?: string | null;
  userStatus?: string;
  onSelectChannel: (channel: Channel) => void;
  onCreateInvite?: () => void;
  onOpenProfileSettings?: () => void;
  onViewOwnProfile?: () => void;
  onLogout: () => void;
  onServerUpdated: (server: Server) => void;
  onServerDeleted: (serverId: number) => void;
}

export default function ChannelSidebar({
  server,
  channels,
  selectedChannelId,
  userId,
  userName,
  userAvatar,
  userStatus,
  onSelectChannel,
  onOpenProfileSettings,
  onViewOwnProfile,
  onLogout,
  onServerUpdated,
  onServerDeleted,
}: Props) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showEditServer, setShowEditServer] = useState(false);
  const [localName, setLocalName] = useState(userName);
  const [localAvatar, setLocalAvatar] = useState(userAvatar ?? null);
  const [localStatus, setLocalStatus] = useState(userStatus ?? 'online');

  useEffect(() => { setLocalName(userName); }, [userName]);
  useEffect(() => { setLocalAvatar(userAvatar ?? null); }, [userAvatar]);
  useEffect(() => { setLocalStatus(userStatus ?? 'online'); }, [userStatus]);

  useEffect(() => {
    let pusher: ReturnType<typeof getPusherClient> | null = null;
    try {
      pusher = getPusherClient(userId);
      const channel = pusher.subscribe(`user-${userId}`);
      channel.bind('profile-updated', (profile: { id: number; name: string; avatar: string | null; status?: string }) => {
        setLocalName(profile.name);
        setLocalAvatar(profile.avatar);
        if (profile.status) setLocalStatus(profile.status);
      });
    } catch {
      // Pusher is optional.
    }
    return () => {
      try { pusher?.unsubscribe(`user-${userId}`); } catch { /* ignore */ }
    };
  }, [userId]);

  const textChannels = useMemo(() => channels.filter(c => c.type === 'text'), [channels]);
  const voiceChannels = useMemo(() => channels.filter(c => c.type === 'voice'), [channels]);
  const [voiceParticipants, setVoiceParticipants] = useState<Record<number, VoiceParticipantEntry[]>>({});

  useEffect(() => {
    if (voiceChannels.length === 0) return;
    let cancelled = false;
    Promise.all(voiceChannels.map(async ch => {
      try {
        const res = await fetch(`/api/voice/${ch.id}`);
        if (res.ok) return { id: ch.id, data: (await res.json()).participants ?? [] };
      } catch { /* ignore */ }
      return { id: ch.id, data: [] };
    })).then(results => {
      if (cancelled) return;
      const map: Record<number, VoiceParticipantEntry[]> = {};
      results.forEach(r => { map[r.id] = r.data; });
      setVoiceParticipants(map);
    });
    return () => { cancelled = true; };
  }, [voiceChannels]);

  useEffect(() => {
    if (voiceChannels.length === 0) return;
    let pusher: ReturnType<typeof getPusherClient> | null = null;
    try {
      pusher = getPusherClient(userId);
      for (const ch of voiceChannels) {
        const pchan = pusher.subscribe(`voice-channel-${ch.id}`);
        const chId = ch.id;
        pchan.bind('voice-user-joined', (p: VoiceParticipantEntry) => {
          setVoiceParticipants(prev => {
            const existing = prev[chId] ?? [];
            const exists = existing.some(x => x.userId === p.userId);
            return { ...prev, [chId]: exists ? existing.map(x => x.userId === p.userId ? { ...x, ...p } : x) : [...existing, p] };
          });
        });
        pchan.bind('voice-user-left', ({ userId: leftId }: { userId: number }) => {
          setVoiceParticipants(prev => ({ ...prev, [chId]: (prev[chId] ?? []).filter(p => p.userId !== leftId) }));
        });
        pchan.bind('voice-user-state-updated', (updated: Partial<VoiceParticipantEntry> & { userId: number }) => {
          setVoiceParticipants(prev => ({ ...prev, [chId]: (prev[chId] ?? []).map(p => p.userId === updated.userId ? { ...p, ...updated } : p) }));
        });
      }
    } catch { /* Pusher optional */ }
    return () => {
      try { voiceChannels.forEach(ch => pusher?.unsubscribe(`voice-channel-${ch.id}`)); } catch { /* ignore */ }
    };
  }, [voiceChannels, userId]);

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

  function inviteUrl() {
    return `${window.location.origin}/invite/${inviteCode}`;
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!server) {
    return (
      <div className="w-60 min-w-[240px] flex items-center justify-center text-sm" style={{ background: 'var(--bg-channels)', color: 'var(--text-3)' }}>
        Select a server
      </div>
    );
  }

  const canManageServer = server.ownerId === userId;
  const serverInitials = server.name.slice(0, 2).toUpperCase();

  return (
    <div className="w-60 min-w-[240px] flex flex-col" style={{ background: 'var(--bg-channels)' }}>
      <div className="flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.04] transition-colors flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl overflow-hidden bg-slate-950 border border-white/10 flex items-center justify-center flex-shrink-0">
            {server.icon ? (
              <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">{serverInitials}</span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>{server.name}</h2>
            <p className="text-[11px] uppercase tracking-[0.24em] mt-0.5" style={{ color: 'var(--text-3)' }}>
              {canManageServer ? 'Server owner' : 'Server member'}
            </p>
          </div>
        </div>

        {canManageServer && (
          <button onClick={() => setShowEditServer(true)} className="p-2 rounded-xl transition-colors hover:bg-white/[0.06]" title="Edit server" style={{ color: 'var(--text-2)' }}>
            <Edit2 size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {textChannels.length > 0 && (
          <ChannelGroup label="Text Channels">
            {textChannels.map(ch => (
              <ChannelRow key={ch.id} channel={ch} selected={ch.id === selectedChannelId} onClick={() => onSelectChannel(ch)} icon={<Hash size={15} />} />
            ))}
          </ChannelGroup>
        )}

        {voiceChannels.length > 0 && (
          <ChannelGroup label="Voice Channels">
            {voiceChannels.map(ch => (
              <div key={ch.id}>
                <ChannelRow channel={ch} selected={ch.id === selectedChannelId} onClick={() => onSelectChannel(ch)} icon={<Volume2 size={15} />} />
                {(voiceParticipants[ch.id] ?? []).map(p => (
                  <div key={p.userId} className="flex items-center gap-1.5 pl-7 pr-2 py-0.5 rounded-md select-none">
                    <div className="relative flex-shrink-0 w-4 h-4">
                      {p.userAvatar ? (
                        <img
                          src={p.userAvatar}
                          alt={p.userName}
                          className="w-4 h-4 rounded-full object-cover"
                          style={{ outline: p.isSpeaking ? '1.5px solid var(--online)' : '1.5px solid transparent', outlineOffset: '1px' }}
                        />
                      ) : (
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ fontSize: 8, background: p.userId === userId ? 'var(--accent)' : 'var(--bg-elevated)', outline: p.isSpeaking ? '1.5px solid var(--online)' : '1.5px solid transparent', outlineOffset: '1px' }}
                        >
                          {p.userName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-xs truncate flex-1" style={{ color: p.userId === userId ? 'var(--text-1)' : 'var(--text-3)' }}>
                      {p.userName}{p.userId === userId ? ' (you)' : ''}
                    </span>
                    {p.isMuted && <MicOff size={9} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            ))}
          </ChannelGroup>
        )}

        <div className="mt-3">
          <button onClick={generateInvite} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors hover:bg-white/[0.06]" style={{ color: 'var(--text-3)' }}>
            <UserPlus size={14} />
            <span>Invite People</span>
          </button>

          <AnimatePresence>
            {showInvite && inviteCode && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="mx-1 mt-1 rounded-lg p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <p className="text-xs mb-1.5" style={{ color: 'var(--text-3)' }}>Invite link (24h)</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs truncate font-mono" style={{ color: 'var(--accent)' }}>{inviteUrl()}</code>
                    <button onClick={copyCode} className="flex-shrink-0 transition-colors p-1 rounded" style={{ color: copied ? 'var(--online)' : 'var(--text-3)' }}>
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-2 px-2 py-2.5 flex-shrink-0" style={{ background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)' }}>
        <button onClick={onViewOwnProfile ?? (() => router.push(`/profile/${userId}`))} className="relative flex-shrink-0 rounded-full transition-opacity hover:opacity-80" title="View profile">
          {localAvatar ? (
            <img src={localAvatar} alt={localName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--accent)' }}>
              {localName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2" style={{ background: STATUS_DOT[localStatus] ?? STATUS_DOT.online, borderColor: 'var(--bg-sidebar)' }} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>{localName}</p>
          <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{STATUS_LABEL[localStatus] ?? 'Online'}</p>
        </div>
        <button onClick={onOpenProfileSettings ?? (() => router.push('/settings/profile'))} title="Profile settings" className="p-1.5 rounded-md transition-colors hover:bg-white/10 flex-shrink-0" style={{ color: 'var(--text-3)' }}>
          <Settings size={15} />
        </button>
        <button onClick={onLogout} title="Log out" className="p-1.5 rounded-md transition-colors hover:bg-white/10 flex-shrink-0" style={{ color: 'var(--text-3)' }}>
          <LogOut size={15} />
        </button>
      </div>

      <AnimatePresence>
        {showEditServer && (
          <EditServerModal
            server={server}
            currentUserId={userId}
            onUpdated={updatedServer => { onServerUpdated(updatedServer); setShowEditServer(false); }}
            onDeleted={deletedServerId => { onServerDeleted(deletedServerId); setShowEditServer(false); }}
            onClose={() => setShowEditServer(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ChannelGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{label}</p>
      {children}
    </div>
  );
}

function ChannelRow({ channel, selected, onClick, icon }: { channel: Channel; selected: boolean; onClick: () => void; icon: React.ReactNode; }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors mb-0.5"
      style={{
        background: selected ? 'var(--bg-elevated)' : 'transparent',
        color: selected ? 'var(--text-1)' : 'var(--text-2)',
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
      }}
    >
      <span style={{ color: selected ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0 }}>{icon}</span>
      <span className="truncate text-sm">{channel.name}</span>
    </motion.button>
  );
}
