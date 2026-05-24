'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Trash2, Check, Circle } from 'lucide-react';
import { backdrop, pop } from '@/lib/animations';
import { useUploadThing } from '@/lib/uploadthing';

interface Profile {
  id: number;
  name: string;
  email: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  status: string;
}

interface Props {
  userId: number;
  onClose: () => void;
  onSaved: (profile: Partial<Profile>) => void;
}

const STATUSES = [
  { value: 'online', label: 'Online', color: '#23d18b' },
  { value: 'idle', label: 'Idle', color: '#faa61a' },
  { value: 'dnd', label: 'Do Not Disturb', color: '#f04747' },
  { value: 'offline', label: 'Invisible', color: '#636b75' },
];

export default function ProfileSettingsModal({ userId, onClose, onSaved }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('online');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function dbg(msg: string) {
    const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
    console.log('[UT debug]', line);
    setDebugLog(prev => [...prev.slice(-19), line]);
  }

  const { startUpload, isUploading } = useUploadThing('avatarUploader', {
    headers: { 'x-user-id': String(userId) },
    onClientUploadComplete(res) {
      dbg(`onClientUploadComplete — res length: ${res?.length ?? 'null'}`);
      if (res?.[0]) {
        dbg(`res[0] keys: ${Object.keys(res[0]).join(', ')}`);
        dbg(`res[0].url: ${(res[0] as unknown as Record<string, unknown>).url}`);
        dbg(`res[0].ufsUrl: ${res[0].ufsUrl}`);
        dbg(`res[0].serverData: ${JSON.stringify(res[0].serverData)}`);
      } else {
        dbg('res[0] is null/undefined!');
      }
      const url = res?.[0]?.ufsUrl ?? res?.[0]?.serverData?.url;
      dbg(`resolved url: ${url ?? 'NONE'}`);
      if (url) { setAvatarPreview(url); setDirty(true); }
      setUploadError('');
    },
    onUploadError(e) {
      dbg(`onUploadError — code: ${e.code} | message: ${e.message}`);
      setUploadError(`Upload failed: ${e.message}`);
    },
  });

  useEffect(() => {
    fetch('/api/profile/me', { headers: { 'x-user-id': String(userId) } })
      .then(r => r.json())
      .then(d => {
        const u = d.user as Profile;
        setProfile(u);
        setName(u.name ?? '');
        setUsername(u.username ?? '');
        setBio(u.bio ?? '');
        setStatus(u.status ?? 'online');
        setAvatarPreview(u.avatar ?? null);
      })
      .catch(() => {});
  }, [userId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    dbg(`file selected: ${file.name} | type: ${file.type} | size: ${file.size} bytes`);
    dbg(`userId: ${userId}`);
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    dbg('calling startUpload…');
    try {
      const result = await startUpload([file]);
      dbg(`startUpload resolved — result: ${JSON.stringify(result)}`);
    } catch (err) {
      dbg(`startUpload threw: ${err}`);
    }
  }

  async function handleRemoveAvatar() {
    setAvatarPreview(null);
    setDirty(true);
    await fetch('/api/profile/avatar', {
      method: 'DELETE',
      headers: { 'x-user-id': String(userId) },
    });
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim() || null,
          bio: bio.trim() || null,
          status,
          avatar: avatarPreview,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? 'Failed to save'); return; }
      setSaved(true);
      onSaved(data.user);
      setTimeout(() => { setSaved(false); setDirty(false); }, 2000);
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function markDirty() { setDirty(true); setSaved(false); }

  return (
    <AnimatePresence>
      <motion.div
        variants={backdrop}
        initial="hidden"
        animate="show"
        exit="exit"
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          variants={pop}
          initial="hidden"
          animate="show"
          exit="exit"
          className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <h2 className="font-bold text-base" style={{ color: 'var(--text-1)' }}>Edit Profile</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-2)' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Banner + Avatar */}
            <div
              className="h-28 relative flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--accent-hover), rgba(14,17,23,1))' }}
            >
              <div className="absolute -bottom-12 left-6">
                <div className="relative group">
                  <div
                    className="rounded-full p-1 cursor-pointer"
                    style={{ background: 'var(--bg-card)' }}
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                  >
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar"
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl"
                        style={{ background: 'var(--accent)' }}
                      >
                        {(name || profile?.name || '?').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {/* Overlay */}
                    <div
                      className="absolute inset-1 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      style={{ background: 'rgba(0,0,0,0.6)' }}
                    >
                      {isUploading ? (
                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Camera size={20} color="#fff" />
                      )}
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 pt-16 pb-6 space-y-5">
              {/* Avatar actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {isUploading ? 'Uploading…' : 'Change Avatar'}
                </button>
                {avatarPreview && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/10"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={12} />
                    Remove
                  </button>
                )}
              </div>
              {uploadError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{uploadError}</p>}

              {/* DEBUG PANEL — remove once upload is fixed */}
              {debugLog.length > 0 && (
                <div className="rounded-lg p-2 text-[10px] font-mono leading-relaxed overflow-x-auto" style={{ background: '#0d1117', border: '1px solid #30363d', color: '#8b949e', maxHeight: 160, overflowY: 'auto' }}>
                  <p className="text-yellow-400 mb-1 font-bold">Upload Debug Log</p>
                  {debugLog.map((line, i) => (
                    <p key={i} style={{ color: line.includes('ERROR') || line.includes('FAIL') ? '#f85149' : line.includes('OK') || line.includes('resolved url') ? '#3fb950' : '#8b949e' }}>{line}</p>
                  ))}
                </div>
              )}

              {/* Display Name */}
              <Field label="Display Name">
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); markDirty(); }}
                  maxLength={32}
                  className="w-full rounded-lg py-2.5 px-3 text-sm outline-none transition-shadow"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-1)',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-dim)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <p className="text-right text-xs mt-1" style={{ color: 'var(--text-3)' }}>{name.length}/32</p>
              </Field>

              {/* Username */}
              <Field label="Username" hint="Lowercase letters, numbers, underscore only. 3–24 characters.">
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: 'var(--text-3)' }}
                  >
                    @
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value.toLowerCase()); markDirty(); }}
                    maxLength={24}
                    placeholder="your_handle"
                    className="w-full rounded-lg py-2.5 pl-7 pr-3 text-sm outline-none transition-shadow"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-1)',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-dim)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
              </Field>

              {/* Bio */}
              <Field label="About Me">
                <textarea
                  value={bio}
                  onChange={e => { setBio(e.target.value.slice(0, 160)); markDirty(); }}
                  rows={3}
                  placeholder="Tell people a bit about yourself…"
                  className="w-full rounded-lg py-2.5 px-3 text-sm outline-none resize-none transition-shadow"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-1)',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-dim)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <p className="text-right text-xs mt-1" style={{ color: bio.length >= 150 ? 'var(--warning)' : 'var(--text-3)' }}>
                  {bio.length}/160
                </p>
              </Field>

              {/* Status */}
              <Field label="Status">
                <div className="grid grid-cols-2 gap-2">
                  {STATUSES.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => { setStatus(s.value); markDirty(); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{
                        background: status === s.value ? 'var(--bg-elevated)' : 'transparent',
                        border: `1px solid ${status === s.value ? s.color : 'var(--border)'}`,
                        color: status === s.value ? 'var(--text-1)' : 'var(--text-2)',
                      }}
                    >
                      <Circle size={10} fill={s.color} style={{ color: s.color, flexShrink: 0 }} />
                      <span className="truncate">{s.label}</span>
                      {status === s.value && <Check size={12} className="ml-auto flex-shrink-0" style={{ color: s.color }} />}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          {/* Save bar */}
          <AnimatePresence>
            {dirty && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}
              >
                <div>
                  {saveError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{saveError}</p>}
                  {saved && (
                    <p className="text-xs flex items-center gap-1" style={{ color: 'var(--online)' }}>
                      <Check size={12} /> Saved!
                    </p>
                  )}
                  {!saveError && !saved && (
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>Unsaved changes</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setDirty(false); setSaved(false); setSaveError(''); }}
                    className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-white/10"
                    style={{ color: 'var(--text-2)' }}
                  >
                    Reset
                  </button>
                  <motion.button
                    onClick={handleSave}
                    disabled={saving || isUploading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: saved ? 'var(--online)' : 'var(--accent)' }}
                  >
                    {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-3)' }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{hint}</p>}
    </div>
  );
}
