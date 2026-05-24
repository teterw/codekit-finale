'use client';

import { useState } from 'react';

interface Props {
  userId: number;
  onJoined: (serverId: number) => void;
  onClose: () => void;
}

interface ServerPreview {
  id: number;
  name: string;
  icon: string | null;
  memberCount: number;
}

export default function InviteModal({ userId, onJoined, onClose }: Props) {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<ServerPreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  async function fetchPreview(value: string) {
    const trimmed = value.trim().toUpperCase();
    if (trimmed.length < 4) { setPreview(null); setPreviewError(''); return; }
    const res = await fetch(`/api/invite/preview?code=${trimmed}`);
    if (!res.ok) {
      setPreview(null);
      setPreviewError('Invalid or expired invite code.');
      return;
    }
    const data = await res.json();
    setPreview(data.server);
    setPreviewError('');
  }

  async function handleJoin() {
    if (!preview || joining) return;
    setJoining(true);
    const res = await fetch('/api/invite/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
      body: JSON.stringify({ code: code.trim().toUpperCase() }),
    });
    if (res.ok) {
      const data = await res.json();
      setJoined(true);
      setTimeout(() => { onJoined(data.serverId); onClose(); }, 800);
    } else {
      setPreviewError('Failed to join server.');
    }
    setJoining(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#36393f] rounded-lg w-full max-w-md mx-4 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">Join a Server</h2>
          <button onClick={onClose} className="text-[#b9bbbe] hover:text-white text-xl leading-none">×</button>
        </div>

        <p className="text-[#b9bbbe] text-sm mb-4">Enter an invite code below to join an existing server.</p>

        <div className="mb-4">
          <label className="block text-[#b9bbbe] text-xs font-semibold uppercase mb-1">Invite Code</label>
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value); fetchPreview(e.target.value); }}
            placeholder="e.g. ABC12345"
            className="w-full bg-[#202225] text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#7289da] text-sm uppercase"
          />
        </div>

        {previewError && <p className="text-[#ed4245] text-sm mb-3">{previewError}</p>}

        {preview && (
          <div className="bg-[#2f3136] rounded-lg p-4 mb-4 flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#7289da] flex items-center justify-center text-white font-bold text-lg flex-shrink-0 overflow-hidden">
              {preview.icon ? (
                <img src={preview.icon} alt={preview.name} className="w-full h-full object-cover" />
              ) : (
                preview.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <p className="text-white font-semibold">{preview.name}</p>
              <p className="text-[#b9bbbe] text-sm">{preview.memberCount} member{preview.memberCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
        )}

        {joined && <p className="text-[#3ba55c] text-sm font-medium mb-3">You joined successfully!</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-transparent text-[#b9bbbe] hover:text-white py-2 rounded font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleJoin}
            disabled={!preview || joining || joined}
            className="flex-1 bg-[#7289da] hover:bg-[#677bc4] disabled:opacity-50 text-white py-2 rounded font-medium transition-colors"
          >
            {joining ? 'Joining…' : joined ? 'Joined!' : 'Join Server'}
          </button>
        </div>
      </div>
    </div>
  );
}
