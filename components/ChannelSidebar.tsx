'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Volume2, UserPlus, Copy, Check, ChevronDown, LogOut } from 'lucide-react';

interface Channel { id: number; name: string; type: string; }
interface Server { id: number; name: string; ownerId: number; }

interface Props {
  server: Server | null;
  channels: Channel[];
  selectedChannelId: number | null;
  userId: number;
  userName: string;
  onSelectChannel: (channel: Channel) => void;
  onCreateInvite: () => void;
  onLogout: () => void;
}

export default function ChannelSidebar({
  server, channels, selectedChannelId, userId, userName,
  onSelectChannel, onLogout,
}: Props) {
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const textChannels = channels.filter(c => c.type === 'text');
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

  return (
    <div className="w-60 min-w-[240px] flex flex-col" style={{ background: 'var(--bg-channels)' }}>
      {/* Server header */}
      <div
        className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-white/[0.04] transition-colors flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h2 className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>
          {server.name}
        </h2>
        <ChevronDown size={16} className="flex-shrink-0" style={{ color: 'var(--text-2)' }} />
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {textChannels.length > 0 && (
          <ChannelGroup label="Text Channels">
            {textChannels.map(ch => (
              <ChannelRow
                key={ch.id}
                channel={ch}
                selected={ch.id === selectedChannelId}
                onClick={() => onSelectChannel(ch)}
                icon={<Hash size={15} />}
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
                icon={<Volume2 size={15} />}
              />
            ))}
          </ChannelGroup>
        )}

        {/* Invite */}
        <div className="mt-3">
          <button
            onClick={generateInvite}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors hover:bg-white/[0.06]"
            style={{ color: 'var(--text-3)' }}
          >
            <UserPlus size={14} />
            <span>Invite People</span>
          </button>

          <AnimatePresence>
            {showInvite && inviteCode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div
                  className="mx-1 mt-1 rounded-lg p-3"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                >
                  <p className="text-xs mb-1.5" style={{ color: 'var(--text-3)' }}>Invite code (24h)</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs truncate font-mono" style={{ color: 'var(--accent)' }}>
                      {inviteCode}
                    </code>
                    <button
                      onClick={copyCode}
                      className="flex-shrink-0 transition-colors p-1 rounded"
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
      </div>

      {/* User panel */}
      <div
        className="flex items-center gap-2 px-2 py-2.5 flex-shrink-0"
        style={{ background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          {userName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>{userName}</p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--online)' }} />
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Online</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          title="Log out"
          className="p-1.5 rounded-md transition-colors hover:bg-white/10 flex-shrink-0"
          style={{ color: 'var(--text-3)' }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}

function ChannelGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p
        className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-3)' }}
      >
        {label}
      </p>
      {children}
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
