'use client';

import { useState } from 'react';

interface Props {
  userId: number;
  onCreated: (serverId: number) => void;
  onClose: () => void;
}

export default function CreateServerModal({ userId, onCreated, onClose }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || loading) return;
    setLoading(true);
    setError('');
    const res = await fetch('/api/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      onCreated(data.server.id);
      onClose();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to create server');
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#36393f] rounded-lg w-full max-w-sm mx-4 p-6 shadow-xl">
        <h2 className="text-white font-bold text-xl text-center mb-1">Create Your Server</h2>
        <p className="text-[#b9bbbe] text-sm text-center mb-6">Give your server a personality with a name.</p>

        <form onSubmit={handleCreate}>
          <label className="block text-[#b9bbbe] text-xs font-semibold uppercase mb-1">Server Name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={`Your Server`}
            maxLength={100}
            className="w-full bg-[#202225] text-white rounded px-3 py-2 outline-none focus:ring-2 focus:ring-[#7289da] text-sm mb-4"
          />
          {error && <p className="text-[#ed4245] text-sm mb-3">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-transparent text-[#b9bbbe] hover:text-white py-2 rounded font-medium transition-colors">
              Back
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="flex-1 bg-[#7289da] hover:bg-[#677bc4] disabled:opacity-50 text-white py-2 rounded font-medium transition-colors"
            >
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
