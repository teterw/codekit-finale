'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, Calendar, Circle } from 'lucide-react';
import { backdrop, pop } from '@/lib/animations';

interface Profile {
  id: number;
  name: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  status: string;
  createdAt: string | Date;
}

interface Props {
  userId: number;
  currentUserId: number;
  requestUserId: number;
  onClose: () => void;
  onEditProfile?: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  online: '#23d18b',
  idle: '#faa61a',
  dnd: '#f04747',
  offline: '#636b75',
};
const STATUS_LABEL: Record<string, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

function Avatar({ profile, size = 80 }: { profile: Profile; size?: number }) {
  if (profile.avatar) {
    return (
      <img
        src={profile.avatar}
        alt={profile.name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold"
      style={{
        width: size,
        height: size,
        background: 'var(--accent)',
        fontSize: size * 0.35,
      }}
    >
      {profile.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function UserProfileModal({ userId, currentUserId, requestUserId, onClose, onEditProfile }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const endpoint = userId === requestUserId
      ? '/api/profile/me'
      : `/api/profile/${userId}`;
    fetch(endpoint, { headers: { 'x-user-id': String(requestUserId) } })
      .then(r => r.json())
      .then(d => setProfile(d.user ?? null))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [userId, requestUserId]);

  const isOwnProfile = userId === currentUserId;
  const statusColor = STATUS_COLOR[profile?.status ?? 'offline'];
  const joinedDate = profile ? new Date(profile.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' }) : '';

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
          className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {/* Banner */}
          <div
            className="h-24 relative flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--accent-hover), rgba(14,17,23,1))' }}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-black/30"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Avatar row */}
          <div className="relative px-5 pb-4">
            <div className="absolute -top-10 left-5">
              <div className="relative">
                <div
                  className="rounded-full p-1"
                  style={{ background: 'var(--bg-card)' }}
                >
                  {loading ? (
                    <div
                      className="rounded-full animate-pulse"
                      style={{ width: 76, height: 76, background: 'var(--bg-elevated)' }}
                    />
                  ) : profile ? (
                    <Avatar profile={profile} size={76} />
                  ) : null}
                </div>
                {profile && (
                  <div
                    className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2"
                    style={{
                      background: statusColor,
                      borderColor: 'var(--bg-card)',
                    }}
                  />
                )}
              </div>
            </div>

            {isOwnProfile && onEditProfile && (
              <div className="flex justify-end pt-3">
                <button
                  onClick={onEditProfile}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/10"
                  style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
                >
                  <Pencil size={12} />
                  Edit Profile
                </button>
              </div>
            )}

            <div style={{ marginTop: isOwnProfile ? 8 : 52 }}>
              {loading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-5 w-32 rounded" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="h-3 w-24 rounded" style={{ background: 'var(--bg-elevated)' }} />
                </div>
              ) : profile ? (
                <>
                  <h2 className="font-bold text-lg leading-tight" style={{ color: 'var(--text-1)' }}>
                    {profile.name}
                  </h2>
                  {profile.username && (
                    <p className="text-sm" style={{ color: 'var(--text-2)' }}>@{profile.username}</p>
                  )}

                  {/* Status */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <Circle size={8} fill={statusColor} style={{ color: statusColor }} />
                    <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                      {STATUS_LABEL[profile.status] ?? profile.status}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="my-3 h-px" style={{ background: 'var(--border)' }} />

                  {/* Bio */}
                  {profile.bio && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
                        About Me
                      </p>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                        {profile.bio}
                      </p>
                    </div>
                  )}

                  {/* Joined */}
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} style={{ color: 'var(--text-3)' }} />
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>Member since {joinedDate}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>User not found.</p>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
