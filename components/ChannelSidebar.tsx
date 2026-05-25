'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, ChevronDown, ChevronRight, Check, Copy,
  Hash, Headphones, LogOut, Mic, MicOff, MoreVertical,
  Pencil, Plus, Settings, Trash2, UserPlus, Volume2, X,
} from 'lucide-react';
import { getPusherClient } from '@/lib/pusher-client';
import EditServerModal from './EditServerModal';

const STATUS_DOT: Record<string, string> = {
  online: '#23A55A',
  idle:   '#F0B232',
  dnd:    '#F23F43',
  offline:'#80848E',
};
const STATUS_LABEL: Record<string, string> = {
  online:  'Online',
  idle:    'Idle',
  dnd:     'Do Not Disturb',
  offline: 'Invisible',
};
const STATUS_OPTIONS = ['online', 'idle', 'dnd', 'offline'] as const;
type StatusKey = typeof STATUS_OPTIONS[number];

interface Channel { id: number; name: string; type: string; }
interface Server  { id: number; name: string; icon: string | null; ownerId: number; }
interface VoiceParticipantEntry {
  userId: number; userName: string; userAvatar: string | null;
  isMuted: boolean; isSpeaking: boolean;
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
  onChannelCreated?: (channel: Channel) => void;
  onChannelRenamed?: (channel: Channel) => void;
  onChannelDeleted?: (channelId: number) => void;
}

export default function ChannelSidebar({
  server, channels, selectedChannelId, userId, userName,
  userAvatar, userStatus, onSelectChannel, onOpenProfileSettings,
  onViewOwnProfile, onLogout, onServerUpdated, onServerDeleted,
  onChannelCreated, onChannelRenamed, onChannelDeleted,
}: Props) {
  const router = useRouter();
  const [inviteCode, setInviteCode]         = useState('');
  const [copied, setCopied]                 = useState(false);
  const [showInvite, setShowInvite]         = useState(false);
  const [showEditServer, setShowEditServer] = useState(false);
  const [localName, setLocalName]           = useState(userName);
  const [localAvatar, setLocalAvatar]       = useState(userAvatar ?? null);
  const [localStatus, setLocalStatus]       = useState(userStatus ?? 'online');
  const [creatingType, setCreatingType]     = useState<'text' | 'voice' | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [createLoading, setCreateLoading]   = useState(false);
  const [createError, setCreateError]       = useState('');
  const createInputRef = useRef<HTMLInputElement>(null);
  const [menuChannelId, setMenuChannelId]   = useState<number | null>(null);
  const [renamingChannelId, setRenamingChannelId] = useState<number | null>(null);
  const [renameValue, setRenameValue]       = useState('');
  const [renameLoading, setRenameLoading]   = useState(false);
  const [renameError, setRenameError]       = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // New: Discord-exact state
  const [serverMenuOpen, setServerMenuOpen]         = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showStatusMenu, setShowStatusMenu]         = useState(false);
  const [isMuted, setIsMuted]                       = useState(false);
  const [isDeafened, setIsDeafened]                 = useState(false);
  const serverMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalName(userName); },         [userName]);
  useEffect(() => { setLocalAvatar(userAvatar ?? null); }, [userAvatar]);
  useEffect(() => { setLocalStatus(userStatus ?? 'online'); }, [userStatus]);

  // Close menus on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (serverMenuRef.current && !serverMenuRef.current.contains(e.target as Node))
        setServerMenuOpen(false);
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node))
        setShowStatusMenu(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Pusher: profile updates
  useEffect(() => {
    let pusher: ReturnType<typeof getPusherClient> | null = null;
    try {
      pusher = getPusherClient(userId);
      const ch = pusher.subscribe(`user-${userId}`);
      ch.bind('profile-updated', (p: { id: number; name: string; avatar: string | null; status?: string }) => {
        setLocalName(p.name);
        setLocalAvatar(p.avatar);
        if (p.status) setLocalStatus(p.status);
      });
    } catch { /* Pusher optional */ }
    return () => { try { pusher?.unsubscribe(`user-${userId}`); } catch { /* ignore */ } };
  }, [userId]);

  const textChannels  = useMemo(() => channels.filter(c => c.type === 'text'),  [channels]);
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
        const chId  = ch.id;
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
    return () => { try { voiceChannels.forEach(ch => pusher?.unsubscribe(`voice-channel-${ch.id}`)); } catch { /* ignore */ } };
  }, [voiceChannels, userId]);

  function toggleCategory(name: string) {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  function openCreate(type: 'text' | 'voice') {
    setCreatingType(type);
    setNewChannelName('');
    setCreateError('');
    setTimeout(() => createInputRef.current?.focus(), 50);
  }
  function cancelCreate() { setCreatingType(null); setNewChannelName(''); setCreateError(''); }

  async function handleCreateChannel() {
    if (!server || !creatingType) return;
    const name = newChannelName.trim();
    if (!name) { setCreateError('Name is required'); return; }
    setCreateLoading(true); setCreateError('');
    try {
      const res  = await fetch(`/api/servers/${server.id}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ name, type: creatingType }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error ?? 'Failed to create'); return; }
      onChannelCreated?.(data.channel);
      cancelCreate();
    } catch { setCreateError('Network error'); }
    finally   { setCreateLoading(false); }
  }

  function openRename(channel: Channel) {
    setMenuChannelId(null);
    setRenamingChannelId(channel.id);
    setRenameValue(channel.name);
    setRenameError('');
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }

  async function handleRename(channelId: number) {
    const name = renameValue.trim();
    if (!name) { setRenameError('Name is required'); return; }
    setRenameLoading(true); setRenameError('');
    try {
      const res  = await fetch(`/api/channels/${channelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { setRenameError(data.error ?? 'Failed to rename'); return; }
      onChannelRenamed?.(data.channel);
      setRenamingChannelId(null);
    } catch { setRenameError('Network error'); }
    finally   { setRenameLoading(false); }
  }

  async function handleDelete(channelId: number) {
    setMenuChannelId(null);
    try {
      const res = await fetch(`/api/channels/${channelId}`, { method: 'DELETE', headers: { 'x-user-id': String(userId) } });
      if (res.ok) onChannelDeleted?.(channelId);
    } catch { /* ignore */ }
  }

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
    setServerMenuOpen(false);
  }

  function inviteUrl() { return `${window.location.origin}/invite/${inviteCode}`; }
  function copyCode() {
    navigator.clipboard.writeText(inviteUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function updateStatus(status: StatusKey) {
    setLocalStatus(status);
    setShowStatusMenu(false);
    try {
      await fetch('/api/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ status }),
      });
    } catch { /* ignore */ }
  }

  if (!server) {
    return (
      <div className="w-60 min-w-[240px] flex items-center justify-center text-sm" style={{ background: 'var(--bg-channels)', color: 'var(--text-3)' }}>
        Select a server
      </div>
    );
  }

  const canManageServer  = server.ownerId === userId;
  const textCollapsed    = collapsedCategories.has('text');
  const voiceCollapsed   = collapsedCategories.has('voice');

  return (
    <div className="w-60 min-w-[240px] flex flex-col" style={{ background: 'var(--bg-channels)' }}>

      {/* ── Server header with dropdown ─────────────────── */}
      <div className="relative flex-shrink-0" ref={serverMenuRef}>
        <button
          onClick={() => setServerMenuOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 h-12 transition-colors group"
          style={{
            borderBottom: '1px solid rgba(0,0,0,0.48)',
            background: serverMenuOpen ? 'rgba(79,84,92,0.16)' : 'transparent',
          }}
          onMouseEnter={e => { if (!serverMenuOpen) (e.currentTarget as HTMLElement).style.background = 'rgba(79,84,92,0.16)'; }}
          onMouseLeave={e => { if (!serverMenuOpen) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <h2 className="font-bold text-[15px] truncate flex-1 text-left" style={{ color: '#F2F3F5' }}>
            {server.name}
          </h2>
          {serverMenuOpen
            ? <X size={18} style={{ color: '#B5BAC1', flexShrink: 0 }} />
            : <ChevronDown size={18} style={{ color: '#B5BAC1', flexShrink: 0 }} />
          }
        </button>

        <AnimatePresence>
          {serverMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.1 }}
              className="absolute top-full left-2 right-2 z-50 rounded py-1.5 shadow-2xl"
              style={{ background: '#111214', border: '1px solid rgba(0,0,0,0.6)' }}
            >
              <ServerMenuItem label="Invite People" icon={<UserPlus size={15} />} onClick={generateInvite} accent />

              {canManageServer && (
                <>
                  <ServerMenuItem label="Server Settings" icon={<Settings size={15} />}
                    onClick={() => { setShowEditServer(true); setServerMenuOpen(false); }} />
                  <ServerMenuItem label="Create Channel" icon={<Plus size={15} />}
                    onClick={() => { openCreate('text'); setServerMenuOpen(false); }} />
                  <ServerMenuItem label="Notification Settings" icon={<Bell size={15} />}
                    onClick={() => setServerMenuOpen(false)} />
                  <div className="my-1 mx-2 h-px" style={{ background: 'rgba(79,84,92,0.3)' }} />
                  <ServerMenuItem label="Delete Server" icon={<Trash2 size={15} />}
                    onClick={() => setServerMenuOpen(false)} danger />
                </>
              )}

              {!canManageServer && (
                <>
                  <ServerMenuItem label="Notification Settings" icon={<Bell size={15} />}
                    onClick={() => setServerMenuOpen(false)} />
                  <div className="my-1 mx-2 h-px" style={{ background: 'rgba(79,84,92,0.3)' }} />
                  <ServerMenuItem label="Leave Server" icon={<LogOut size={15} />}
                    onClick={() => setServerMenuOpen(false)} danger />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Channel list ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-2" onClick={() => setMenuChannelId(null)}>

        {/* TEXT CHANNELS */}
        <CategoryGroup
          label="Text Channels"
          collapsed={textCollapsed}
          onToggle={() => toggleCategory('text')}
          onAdd={canManageServer ? () => openCreate('text') : undefined}
        >
          {textChannels.map(ch => (
            <ChannelRow
              key={ch.id}
              channel={ch}
              selected={ch.id === selectedChannelId}
              onClick={() => onSelectChannel(ch)}
              icon={<Hash size={18} />}
              canManage={canManageServer}
              menuOpen={menuChannelId === ch.id}
              onMenuOpen={e => { e.stopPropagation(); setMenuChannelId(ch.id); }}
              onMenuClose={() => setMenuChannelId(null)}
              onRenameStart={() => openRename(ch)}
              onDelete={() => handleDelete(ch.id)}
              isRenaming={renamingChannelId === ch.id}
              renameValue={renameValue}
              onRenameChange={setRenameValue}
              onRenameSubmit={() => handleRename(ch.id)}
              onRenameCancel={() => { setRenamingChannelId(null); setRenameError(''); }}
              renameLoading={renameLoading}
              renameError={renameError}
              renameInputRef={renameInputRef}
            />
          ))}
          {creatingType === 'text' && (
            <CreateChannelForm
              inputRef={createInputRef} value={newChannelName} onChange={setNewChannelName}
              onSubmit={handleCreateChannel} onCancel={cancelCreate}
              loading={createLoading} error={createError} placeholder="new-text-channel"
            />
          )}
        </CategoryGroup>

        {/* VOICE CHANNELS */}
        <CategoryGroup
          label="Voice Channels"
          collapsed={voiceCollapsed}
          onToggle={() => toggleCategory('voice')}
          onAdd={canManageServer ? () => openCreate('voice') : undefined}
        >
          {voiceChannels.map(ch => (
            <div key={ch.id}>
              <ChannelRow
                channel={ch}
                selected={ch.id === selectedChannelId}
                onClick={() => onSelectChannel(ch)}
                icon={<Volume2 size={18} />}
                canManage={canManageServer}
                menuOpen={menuChannelId === ch.id}
                onMenuOpen={e => { e.stopPropagation(); setMenuChannelId(ch.id); }}
                onMenuClose={() => setMenuChannelId(null)}
                onRenameStart={() => openRename(ch)}
                onDelete={() => handleDelete(ch.id)}
                isRenaming={renamingChannelId === ch.id}
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onRenameSubmit={() => handleRename(ch.id)}
                onRenameCancel={() => { setRenamingChannelId(null); setRenameError(''); }}
                renameLoading={renameLoading}
                renameError={renameError}
                renameInputRef={renameInputRef}
              />
              {(voiceParticipants[ch.id] ?? []).map(p => (
                <div key={p.userId} className="flex items-center gap-1.5 pl-8 pr-2 py-0.5 select-none">
                  <div className="relative flex-shrink-0 w-4 h-4">
                    {p.userAvatar
                      ? <img src={p.userAvatar} alt={p.userName} className="w-4 h-4 rounded-full object-cover"
                          style={{ outline: p.isSpeaking ? '1.5px solid #23A55A' : '1.5px solid transparent', outlineOffset: '1px' }} />
                      : <div className="w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ fontSize: 8, background: p.userId === userId ? 'var(--accent)' : '#36393F', outline: p.isSpeaking ? '1.5px solid #23A55A' : '1.5px solid transparent', outlineOffset: '1px' }}>
                          {p.userName.slice(0, 2).toUpperCase()}
                        </div>
                    }
                  </div>
                  <span className="text-xs truncate flex-1" style={{ color: p.userId === userId ? '#DCDDDE' : '#949BA4' }}>
                    {p.userName}{p.userId === userId ? ' (you)' : ''}
                  </span>
                  {p.isMuted && <MicOff size={9} style={{ color: '#F23F43', flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          ))}
          {creatingType === 'voice' && (
            <CreateChannelForm
              inputRef={createInputRef} value={newChannelName} onChange={setNewChannelName}
              onSubmit={handleCreateChannel} onCancel={cancelCreate}
              loading={createLoading} error={createError} placeholder="new-voice-channel"
            />
          )}
        </CategoryGroup>

        {/* Invite link */}
        <AnimatePresence>
          {showInvite && inviteCode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden px-2 mt-1"
            >
              <div className="rounded p-3" style={{ background: '#111214', border: '1px solid rgba(0,0,0,0.5)' }}>
                <p className="text-xs mb-1.5" style={{ color: '#949BA4' }}>Invite link (24h)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs truncate font-mono" style={{ color: '#5865F2' }}>{inviteUrl()}</code>
                  <button onClick={copyCode} className="flex-shrink-0 p-1 rounded" style={{ color: copied ? '#23A55A' : '#949BA4' }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── User panel ──────────────────────────────────── */}
      <div
        className="flex items-center gap-1 px-2 flex-shrink-0"
        style={{ height: 53, background: 'var(--bg-user-panel)' }}
      >
        {/* Avatar + status dot → click opens status picker */}
        <div className="relative flex-shrink-0" ref={statusMenuRef}>
          <button
            onClick={() => setShowStatusMenu(v => !v)}
            className="relative hover:opacity-90 transition-opacity rounded-full"
            title="Set Status"
          >
            {localAvatar
              ? <img src={localAvatar} alt={localName} className="w-8 h-8 rounded-full object-cover" />
              : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--accent)' }}>
                  {localName.slice(0, 2).toUpperCase()}
                </div>
            }
            <div
              className="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full border-2"
              style={{ background: STATUS_DOT[localStatus] ?? STATUS_DOT.online, borderColor: 'var(--bg-user-panel)' }}
            />
          </button>

          {/* Status picker popup */}
          <AnimatePresence>
            {showStatusMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                className="absolute bottom-full left-0 mb-2 w-52 rounded py-1.5 shadow-2xl z-50"
                style={{ background: '#111214', border: '1px solid rgba(0,0,0,0.6)' }}
              >
                <p className="px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#949BA4' }}>
                  Set Status
                </p>
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-white/[0.06]"
                    style={{ color: '#DBDEE1' }}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[s] }} />
                    <span className="flex-1">{STATUS_LABEL[s]}</span>
                    {localStatus === s && <Check size={14} style={{ color: '#5865F2' }} />}
                  </button>
                ))}
                <div className="my-1 mx-2 h-px" style={{ background: 'rgba(79,84,92,0.3)' }} />
                <button
                  onClick={() => { onLogout(); setShowStatusMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-[rgba(242,63,67,0.15)]"
                  style={{ color: '#F23F43' }}
                >
                  <LogOut size={14} />
                  Log Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Name + status text */}
        <button
          onClick={onViewOwnProfile ?? (() => router.push(`/profile/${userId}`))}
          className="flex-1 min-w-0 text-left px-1 rounded hover:bg-white/[0.06] py-0.5 transition-colors"
        >
          <p className="text-sm font-semibold leading-[18px] truncate" style={{ color: '#F2F3F5' }}>
            {localName}
          </p>
          <p className="text-[11px] leading-[14px] truncate" style={{ color: '#949BA4' }}>
            {STATUS_LABEL[localStatus] ?? 'Online'}
          </p>
        </button>

        {/* Mic / Headphones / Settings */}
        <div className="flex items-center flex-shrink-0 gap-0.5">
          <UserPanelBtn
            onClick={() => setIsMuted(v => !v)}
            title={isMuted ? 'Unmute' : 'Mute'}
            active={isMuted}
          >
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </UserPanelBtn>
          <UserPanelBtn
            onClick={() => setIsDeafened(v => !v)}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
            active={isDeafened}
          >
            <Headphones size={18} style={{ opacity: isDeafened ? 0.5 : 1 }} />
          </UserPanelBtn>
          <UserPanelBtn
            onClick={onOpenProfileSettings ?? (() => router.push('/settings/profile'))}
            title="User Settings"
          >
            <Settings size={18} />
          </UserPanelBtn>
        </div>
      </div>

      {/* Edit server modal */}
      <AnimatePresence>
        {showEditServer && (
          <EditServerModal
            server={server}
            currentUserId={userId}
            onUpdated={s => { onServerUpdated(s); setShowEditServer(false); }}
            onDeleted={id => { onServerDeleted(id); setShowEditServer(false); }}
            onClose={() => setShowEditServer(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────── */

function UserPanelBtn({ children, onClick, title, active }: {
  children: React.ReactNode; onClick: () => void; title: string; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-white/10"
      style={{ color: active ? '#F23F43' : '#80848E' }}
    >
      {children}
    </button>
  );
}

function ServerMenuItem({ label, icon, onClick, accent, danger }: {
  label: string; icon: React.ReactNode; onClick: () => void; accent?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-[7px] text-sm transition-colors text-left rounded-[2px] mx-0.5"
      style={{
        width: 'calc(100% - 4px)',
        color: danger ? '#F23F43' : accent ? '#5865F2' : '#DBDEE1',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = danger
          ? 'rgba(242,63,67,0.15)'
          : accent
          ? 'rgba(88,101,242,0.15)'
          : 'rgba(79,84,92,0.16)';
      }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span>{label}</span>
      <span style={{ opacity: 0.9 }}>{icon}</span>
    </button>
  );
}

function CategoryGroup({ label, collapsed, onToggle, onAdd, children }: {
  label: string; collapsed: boolean; onToggle: () => void;
  onAdd?: () => void; children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="flex items-center group px-2 pt-4 pb-1">
        <button onClick={onToggle} className="flex items-center gap-1 flex-1 min-w-0 text-left">
          <ChevronRight
            size={10}
            className="transition-transform duration-150 flex-shrink-0"
            style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)', color: '#80848E' }}
          />
          <span
            className="text-[11px] font-bold uppercase tracking-[0.02em] truncate"
            style={{ color: '#80848E' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DCDDDE'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#80848E'; }}
          >
            {label}
          </span>
        </button>
        {onAdd && (
          <button
            onClick={onAdd}
            title={`Create ${label}`}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
            style={{ color: '#80848E' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DCDDDE'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#80848E'; }}
          >
            <Plus size={14} />
          </button>
        )}
      </div>
      {!collapsed && children}
    </div>
  );
}

interface ChannelRowProps {
  channel: Channel; selected: boolean; onClick: () => void; icon: React.ReactNode;
  canManage: boolean; menuOpen: boolean;
  onMenuOpen: (e: React.MouseEvent) => void; onMenuClose: () => void;
  onRenameStart: () => void; onDelete: () => void;
  isRenaming: boolean; renameValue: string;
  onRenameChange: (v: string) => void; onRenameSubmit: () => void; onRenameCancel: () => void;
  renameLoading: boolean; renameError: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
}

function ChannelRow({
  channel, selected, onClick, icon, canManage,
  menuOpen, onMenuOpen, onMenuClose, onRenameStart, onDelete,
  isRenaming, renameValue, onRenameChange, onRenameSubmit, onRenameCancel,
  renameLoading, renameError, renameInputRef,
}: ChannelRowProps) {
  if (isRenaming) {
    return (
      <div className="mb-px mx-2 rounded px-2 py-1" style={{ background: 'rgba(79,84,92,0.32)', border: '1px solid #5865F2' }}>
        <form onSubmit={e => { e.preventDefault(); onRenameSubmit(); }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <span style={{ color: '#5865F2', flexShrink: 0 }}>{icon}</span>
            <input
              ref={renameInputRef} value={renameValue}
              onChange={e => onRenameChange(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
              maxLength={32} disabled={renameLoading}
              className="flex-1 text-sm rounded px-1 py-0.5 outline-none min-w-0 bg-transparent"
              style={{ color: '#F2F3F5' }}
              onKeyDown={e => { if (e.key === 'Escape') onRenameCancel(); }}
            />
            <button type="submit" disabled={renameLoading || !renameValue.trim()} className="p-1 rounded hover:bg-white/10 disabled:opacity-40" style={{ color: '#5865F2' }}>
              <Check size={12} />
            </button>
            <button type="button" onClick={onRenameCancel} className="p-1 rounded hover:bg-white/10" style={{ color: '#949BA4' }}>
              <X size={12} />
            </button>
          </div>
          {renameError && <p className="text-xs mt-0.5" style={{ color: '#F23F43' }}>{renameError}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="relative group mx-2 mb-px">
      <button
        onClick={onClick}
        className={`ch-row w-full${selected ? ' ch-active' : ''}`}
      >
        <span className="ch-icon">{icon}</span>
        <span className="truncate flex-1 text-left">{channel.name}</span>
        {canManage && (
          <button
            onClick={onMenuOpen}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
            style={{ color: '#80848E' }}
            title="Channel options"
          >
            <MoreVertical size={14} />
          </button>
        )}
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 top-full z-50 rounded py-1 w-44 shadow-2xl"
          style={{ background: '#111214', border: '1px solid rgba(0,0,0,0.6)' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => { onMenuClose(); onRenameStart(); }}
            className="w-full flex items-center gap-2 px-3 py-[7px] text-sm text-left transition-colors hover:bg-white/[0.06]"
            style={{ color: '#DBDEE1' }}
          >
            <Pencil size={14} /> Rename Channel
          </button>
          <button
            onClick={onDelete}
            className="w-full flex items-center gap-2 px-3 py-[7px] text-sm text-left transition-colors hover:bg-[rgba(242,63,67,0.15)]"
            style={{ color: '#F23F43' }}
          >
            <Trash2 size={14} /> Delete Channel
          </button>
        </div>
      )}
    </div>
  );
}

function CreateChannelForm({ inputRef, value, onChange, onSubmit, onCancel, loading, error, placeholder }: {
  inputRef: React.RefObject<HTMLInputElement | null>; value: string;
  onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void;
  loading: boolean; error: string; placeholder: string;
}) {
  return (
    <div className="mt-1 mb-1 mx-2 rounded p-2" style={{ background: '#111214', border: '1px solid rgba(0,0,0,0.5)' }}>
      <form onSubmit={e => { e.preventDefault(); onSubmit(); }}>
        <div className="flex items-center gap-1">
          <input
            ref={inputRef} value={value}
            onChange={e => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
            placeholder={placeholder} maxLength={32} disabled={loading}
            className="flex-1 text-sm rounded px-2 py-1 outline-none min-w-0"
            style={{ background: '#1E1F22', border: '1px solid rgba(0,0,0,0.5)', color: '#DCDDDE' }}
            onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
          />
          <button type="submit" disabled={loading || !value.trim()} className="p-1 rounded hover:bg-white/10 disabled:opacity-40" style={{ color: '#5865F2' }} title="Create">
            <Check size={13} />
          </button>
          <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-white/10" style={{ color: '#949BA4' }} title="Cancel">
            <X size={13} />
          </button>
        </div>
        {error && <p className="text-xs mt-1" style={{ color: '#F23F43' }}>{error}</p>}
      </form>
    </div>
  );
}
