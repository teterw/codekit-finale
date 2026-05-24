'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Check, Link } from 'lucide-react';
import AnimatedModal from './motion/AnimatedModal';

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
      setTimeout(() => { onJoined(data.serverId); onClose(); }, 900);
    } else {
      setPreviewError('Failed to join server. Please try again.');
    }
    setJoining(false);
  }

  return (
    <AnimatedModal show onClose={onClose} className="w-full max-w-md">
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="font-bold text-base" style={{ color: 'var(--text-1)' }}>Join a Server</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
              Enter an invite code to join
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-2)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>
              Invite Code
            </label>
            <div className="relative">
              <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
              <input
                type="text"
                value={code}
                onChange={e => { setCode(e.target.value); fetchPreview(e.target.value); }}
                placeholder="e.g. ABC12345"
                className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm uppercase tracking-widest outline-none transition-shadow"
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
          </div>

          {/* Preview */}
          <AnimatePresence>
            {previewError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm"
                style={{ color: 'var(--danger)' }}
              >
                {previewError}
              </motion.p>
            )}
            {preview && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-4 p-4 rounded-xl"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 overflow-hidden"
                  style={{ background: 'var(--accent)' }}
                >
                  {preview.icon ? (
                    <img src={preview.icon} alt={preview.name} className="w-full h-full object-cover" />
                  ) : (
                    preview.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{preview.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Users size={12} style={{ color: 'var(--text-3)' }} />
                    <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                      {preview.memberCount} member{preview.memberCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {joined && (
                  <div className="ml-auto">
                    <Check size={18} style={{ color: 'var(--online)' }} />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/[0.06]"
              style={{ color: 'var(--text-2)' }}
            >
              Cancel
            </button>
            <motion.button
              onClick={handleJoin}
              disabled={!preview || joining || joined}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              style={{ background: joined ? 'var(--online)' : 'var(--accent)' }}
            >
              {joined ? 'Joined!' : joining ? 'Joining…' : 'Join Server'}
            </motion.button>
          </div>
        </div>
      </div>
    </AnimatedModal>
  );
}
