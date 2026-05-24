'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, X, Upload } from 'lucide-react';
import AnimatedModal from './motion/AnimatedModal';

interface Server {
  id: number;
  name: string;
  icon: string | null;
  ownerId: number;
}

interface Props {
  server: Server;
  currentUserId: number;
  onUpdated: (server: Server) => void;
  onDeleted: (serverId: number) => void;
  onClose: () => void;
}

function readFileAsDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Unable to read file.'));
      }
    };
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

export default function EditServerModal({ server, currentUserId, onUpdated, onDeleted, onClose }: Props) {
  const [name, setName] = useState(server.name);
  const [iconPreview, setIconPreview] = useState<string | null>(server.icon);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(server.name);
    setIconPreview(server.icon);
  }, [server]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file.');
      return;
    }
    setError('');
    const dataUrl = await readFileAsDataURL(file);
    setIconPreview(dataUrl);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Server name cannot be empty.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch(`/api/servers/${server.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(currentUserId) },
      body: JSON.stringify({ name: name.trim(), icon: iconPreview }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error ?? 'Unable to update server.');
      setLoading(false);
      return;
    }

    const data = await res.json();
    onUpdated(data.server);
    setLoading(false);
    onClose();
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/servers/${server.id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': String(currentUserId) },
    });
    setLoading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error ?? 'Unable to delete server.');
      return;
    }

    onDeleted(server.id);
    onClose();
  }

  return (
    <AnimatedModal show onClose={onClose} className="w-full max-w-lg">
      <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <h2 className="font-bold text-xl" style={{ color: 'var(--text-1)' }}>
              Edit Server
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
              Update the name and server icon for this community.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-2)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-[auto_1fr] gap-4 items-center">
            <div className="w-24 h-24 rounded-3xl overflow-hidden bg-slate-900 border border-white/10 flex items-center justify-center">
              {iconPreview ? (
                <img src={iconPreview} alt="Server icon preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-xs uppercase tracking-[0.22em] text-slate-200">No icon</div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--text-3)' }}>
                Server Icon
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: 'var(--text-1)', background: 'var(--bg-elevated)' }}
                >
                  <Upload size={16} />
                  Upload Image
                </button>
                {iconPreview && (
                  <button
                    type="button"
                    onClick={() => setIconPreview(null)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-colors hover:bg-white/10"
                    style={{ color: 'var(--danger)', background: 'var(--bg-elevated)' }}
                  >
                    <Trash2 size={16} />
                    Remove icon
                  </button>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.24em] mb-2" style={{ color: 'var(--text-3)' }}>
                Server Name
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
            </div>

            {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

            <div className="flex flex-col gap-3 sm:flex-row">
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-3 rounded-2xl font-semibold text-white"
                style={{ background: 'var(--accent)' }}
              >
                {loading ? 'Saving…' : 'Save Changes'}
              </motion.button>

              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-3 rounded-2xl font-semibold"
                style={{ background: confirmDelete ? 'var(--danger)' : 'var(--bg-elevated)', color: confirmDelete ? '#fff' : 'var(--text-1)' }}
              >
                {confirmDelete ? 'Confirm Delete' : 'Delete Server'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AnimatedModal>
  );
}
