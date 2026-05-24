'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Server } from 'lucide-react';
import AnimatedModal from './motion/AnimatedModal';

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
    <AnimatedModal show onClose={onClose} className="w-full max-w-sm">
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div />
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-2)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)' }}
          >
            <Server size={28} style={{ color: 'var(--accent)' }} />
          </div>
        </div>

        <div className="px-6 pb-6">
          <h2 className="font-bold text-lg text-center mb-1" style={{ color: 'var(--text-1)' }}>
            Create Your Server
          </h2>
          <p className="text-sm text-center mb-5" style={{ color: 'var(--text-2)' }}>
            Give your community a name and a home.
          </p>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--text-3)' }}
              >
                Server Name
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="My Awesome Server"
                maxLength={100}
                className="w-full rounded-xl py-2.5 px-4 text-sm outline-none transition-shadow"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-1)',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-dim)';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/[0.06]"
                style={{ color: 'var(--text-2)' }}
              >
                Cancel
              </button>
              <motion.button
                type="submit"
                disabled={!name.trim() || loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                {loading ? 'Creating…' : 'Create Server'}
              </motion.button>
            </div>
          </form>
        </div>
      </div>
    </AnimatedModal>
  );
}
