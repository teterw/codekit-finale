'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Camera, Check, Circle, Trash2 } from 'lucide-react';
import { useUploadThing } from '@/lib/uploadthing';
import { fadeUp } from '@/lib/animations';

interface Profile {
  id: number;
  name: string;
  email: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  status: string;
}

const STATUSES = [
  { value: 'online', label: 'Online', color: '#23d18b' },
  { value: 'idle', label: 'Idle', color: '#faa61a' },
  { value: 'dnd', label: 'Do Not Disturb', color: '#f04747' },
  { value: 'offline', label: 'Invisible', color: '#636b75' },
];

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('online');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = localStorage.getItem('userId');
    if (!id) { router.push('/'); return; }
    const uid = Number(id);
    setUserId(uid);

    fetch('/api/profile/me', { headers: { 'x-user-id': id } })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
        return d;
      })
      .then(d => {
        const u = d.user as Profile;
        setProfile(u);
        setName(u.name ?? '');
        setUsername(u.username ?? '');
        setBio(u.bio ?? '');
        setStatus(u.status ?? 'online');
        setAvatarPreview(u.avatar ?? null);
        setProfileLoaded(true);
      })
      .catch(e => {
        setLoadError(`Failed to load profile: ${e.message}`);
      });
  }, [router]);

  const { startUpload, isUploading } = useUploadThing('avatarUploader', {
    headers: userId ? { 'x-user-id': String(userId) } : {},
    onClientUploadComplete(res) {
      const url = res?.[0]?.ufsUrl ?? res?.[0]?.serverData?.url;
      if (url) { setAvatarPreview(url); setDirty(true); }
      setUploadError('');
    },
    onUploadError(e) { setUploadError(`Upload failed: ${e.message}`); },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setAvatarPreview(URL.createObjectURL(file));
    await startUpload([file]);
  }

  async function handleRemoveAvatar() {
    setAvatarPreview(null);
    setDirty(true);
    if (userId) {
      await fetch('/api/profile/avatar', { method: 'DELETE', headers: { 'x-user-id': String(userId) } });
    }
  }

  async function handleSave() {
    if (!dirty || saving || !userId || !profileLoaded) return;
    const trimmedName = name.trim();
    if (trimmedName.length < 2) { setSaveError('Display name must be at least 2 characters.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ name: trimmedName, username: username.trim() || null, bio: bio.trim() || null, status, avatar: avatarPreview }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? 'Failed to save'); return; }
      setSaved(true);
      localStorage.setItem('userName', data.user.name);
      setTimeout(() => { setSaved(false); setDirty(false); }, 2000);
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function markDirty() { setDirty(true); setSaved(false); }

  if (!userId) return null;

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center space-y-3 p-6 rounded-2xl max-w-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>Could not load profile</p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{loadError}</p>
          <button onClick={() => router.refresh()} className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: 'var(--accent)' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profileLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-4 px-6 py-4"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
      >
        <motion.button
          onClick={() => router.back()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors hover:bg-white/10"
          style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
        >
          <ArrowLeft size={16} />
          Back
        </motion.button>
        <h1 className="font-bold text-base" style={{ color: 'var(--text-1)' }}>Profile Settings</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Avatar section */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="h-28 relative" style={{ background: 'linear-gradient(135deg, var(--accent-hover), rgba(14,17,23,1))' }} />
          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-12 mb-4">
              <div className="relative group cursor-pointer" onClick={() => !isUploading && fileInputRef.current?.click()}>
                <div className="rounded-full p-1" style={{ background: 'var(--bg-card)' }}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl" style={{ background: 'var(--accent)' }}>
                      {(name || profile?.name || '?').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-1 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.6)' }}>
                    {isUploading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Camera size={20} color="#fff" />}
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff' }}>
                {isUploading ? 'Uploading…' : 'Change Avatar'}
              </button>
              {avatarPreview && (
                <button onClick={handleRemoveAvatar} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg hover:bg-white/10" style={{ color: 'var(--danger)' }}>
                  <Trash2 size={12} /> Remove
                </button>
              )}
            </div>
            {uploadError && <p className="text-xs mt-2" style={{ color: 'var(--danger)' }}>{uploadError}</p>}
          </div>
        </motion.div>

        {/* Form */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="rounded-2xl p-6 space-y-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <Field label="Display Name">
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); markDirty(); }}
              maxLength={32}
              className="w-full rounded-lg py-2.5 px-3 text-sm outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-dim)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            <p className="text-right text-xs mt-1" style={{ color: 'var(--text-3)' }}>{name.length}/32</p>
          </Field>

          <Field label="Username" hint="Lowercase letters, numbers, underscore. 3–24 characters.">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-3)' }}>@</span>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value.toLowerCase()); markDirty(); }}
                maxLength={24}
                placeholder="your_handle"
                className="w-full rounded-lg py-2.5 pl-7 pr-3 text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-dim)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </Field>

          <Field label="About Me">
            <textarea
              value={bio}
              onChange={e => { setBio(e.target.value.slice(0, 160)); markDirty(); }}
              rows={3}
              placeholder="Tell people a bit about yourself…"
              className="w-full rounded-lg py-2.5 px-3 text-sm outline-none resize-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-dim)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            <p className="text-right text-xs mt-1" style={{ color: bio.length >= 150 ? 'var(--warning)' : 'var(--text-3)' }}>{bio.length}/160</p>
          </Field>

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
        </motion.div>
      </div>

      {/* Save bar */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-6 py-4 z-20"
            style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}
          >
            <div>
              {saveError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{saveError}</p>}
              {saved && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--online)' }}><Check size={12} /> Saved!</p>}
              {!saveError && !saved && <p className="text-xs" style={{ color: 'var(--text-3)' }}>Unsaved changes</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setDirty(false); setSaved(false); setSaveError(''); }} className="px-4 py-2 rounded-lg text-sm hover:bg-white/10" style={{ color: 'var(--text-2)' }}>
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
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-3)' }}>{label}</label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{hint}</p>}
    </div>
  );
}
