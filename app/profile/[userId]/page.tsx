'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Circle, Pencil } from 'lucide-react';
import { fadeUp } from '@/lib/animations';

interface Profile {
  id: number;
  name: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  status: string;
  createdAt: string;
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

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.userId);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('userId');
    if (id) setCurrentUserId(Number(id));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const requesterId = localStorage.getItem('userId');
    if (!requesterId) { router.push('/'); return; }

    const endpoint = userId === Number(requesterId) ? '/api/profile/me' : `/api/profile/${userId}`;
    fetch(endpoint, { headers: { 'x-user-id': requesterId } })
      .then(r => r.json())
      .then(d => setProfile(d.user ?? null))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [userId, router]);

  const isOwn = currentUserId === userId;
  const statusColor = STATUS_COLOR[profile?.status ?? 'offline'];
  const joined = profile ? new Date(profile.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Back button */}
      <div className="fixed top-4 left-4 z-10">
        <motion.button
          onClick={() => router.back()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-white/10"
          style={{ color: 'var(--text-2)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <ArrowLeft size={16} />
          Back
        </motion.button>
      </div>

      <div className="flex justify-center pt-16 px-4 pb-16">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {/* Banner */}
          <div
            className="h-40 relative"
            style={{ background: 'linear-gradient(135deg, var(--accent-hover), rgba(14,17,23,1))' }}
          >
            {isOwn && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/settings/profile')}
                className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <Pencil size={12} />
                Edit Profile
              </motion.button>
            )}
          </div>

          {/* Avatar + info */}
          <div className="px-8 pb-8">
            <div className="flex items-end justify-between -mt-16 mb-6">
              <div className="relative">
                <div className="rounded-full p-1.5" style={{ background: 'var(--bg-card)' }}>
                  {loading ? (
                    <div className="w-24 h-24 rounded-full animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
                  ) : profile?.avatar ? (
                    <img src={profile.avatar} alt={profile.name} className="w-24 h-24 rounded-full object-cover" />
                  ) : (
                    <div
                      className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl"
                      style={{ background: 'var(--accent)' }}
                    >
                      {profile?.name.slice(0, 2).toUpperCase() ?? '??'}
                    </div>
                  )}
                  {profile && (
                    <div
                      className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full border-2"
                      style={{ background: statusColor, borderColor: 'var(--bg-card)' }}
                    />
                  )}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-6 w-48 rounded" style={{ background: 'var(--bg-elevated)' }} />
                <div className="h-4 w-32 rounded" style={{ background: 'var(--bg-elevated)' }} />
              </div>
            ) : profile ? (
              <>
                <h1 className="font-bold text-2xl mb-1" style={{ color: 'var(--text-1)' }}>{profile.name}</h1>
                {profile.username && (
                  <p className="text-sm mb-2" style={{ color: 'var(--text-2)' }}>@{profile.username}</p>
                )}
                <div className="flex items-center gap-2 mb-6">
                  <Circle size={10} fill={statusColor} style={{ color: statusColor }} />
                  <span className="text-sm" style={{ color: 'var(--text-2)' }}>
                    {STATUS_LABEL[profile.status] ?? profile.status}
                  </span>
                </div>

                <div className="h-px mb-6" style={{ background: 'var(--border)' }} />

                {profile.bio && (
                  <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>
                      About Me
                    </p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-1)' }}>{profile.bio}</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Calendar size={14} style={{ color: 'var(--text-3)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-3)' }}>Member since {joined}</p>
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--text-3)' }}>User not found.</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
