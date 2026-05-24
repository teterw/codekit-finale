'use client';

import { useState } from 'react';

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
  onSelectChannel, onCreateInvite, onLogout,
}: Props) {
  const [showInviteCode, setShowInviteCode] = useState('');
  const [copyMsg, setCopyMsg] = useState('');

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
      setShowInviteCode(data.invite.code);
      setCopyMsg('');
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(showInviteCode);
    setCopyMsg('Copied!');
    setTimeout(() => setCopyMsg(''), 2000);
  }

  if (!server) {
    return <div className="w-60 bg-[#2f3136] flex items-center justify-center text-[#b9bbbe] text-sm">Select a server</div>;
  }

  return (
    <div className="w-60 min-w-[240px] bg-[#2f3136] flex flex-col">
      <div className="px-4 py-3 border-b border-[#202225] shadow">
        <h2 className="text-white font-semibold truncate">{server.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {textChannels.length > 0 && (
          <div>
            <p className="text-[#8e9297] text-xs font-semibold uppercase px-2 mb-1">Text Channels</p>
            {textChannels.map(ch => (
              <button
                key={ch.id}
                onClick={() => onSelectChannel(ch)}
                className={`w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors ${
                  ch.id === selectedChannelId
                    ? 'bg-[#393c43] text-white'
                    : 'text-[#8e9297] hover:text-[#dcddde] hover:bg-[#34373c]'
                }`}
              >
                <span className="text-[#8e9297]">#</span>
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
        )}

        {voiceChannels.length > 0 && (
          <div>
            <p className="text-[#8e9297] text-xs font-semibold uppercase px-2 mb-1">Voice Channels</p>
            {voiceChannels.map(ch => (
              <button
                key={ch.id}
                onClick={() => onSelectChannel(ch)}
                className={`w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors ${
                  ch.id === selectedChannelId
                    ? 'bg-[#393c43] text-white'
                    : 'text-[#8e9297] hover:text-[#dcddde] hover:bg-[#34373c]'
                }`}
              >
                <span className="text-[#8e9297] text-xs">🔊</span>
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-2">
          <button
            onClick={generateInvite}
            className="w-full text-left px-2 py-1.5 rounded text-xs text-[#8e9297] hover:text-[#dcddde] hover:bg-[#34373c] transition-colors"
          >
            + Invite People
          </button>
          {showInviteCode && (
            <div className="mx-2 mt-1 bg-[#202225] rounded p-2">
              <p className="text-[#b9bbbe] text-xs mb-1">Invite code (24h):</p>
              <div className="flex items-center gap-1">
                <code className="text-[#7289da] text-xs flex-1 truncate">{showInviteCode}</code>
                <button onClick={copyCode} className="text-[#8e9297] hover:text-white text-xs">
                  {copyMsg || 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-2 py-2 bg-[#292b2f] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#7289da] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{userName}</p>
            <p className="text-[#b9bbbe] text-xs">#{userId}</p>
          </div>
        </div>
        <button onClick={onLogout} className="text-[#b9bbbe] hover:text-white text-xs ml-1 flex-shrink-0" title="Log out">
          ⏏
        </button>
      </div>
    </div>
  );
}
