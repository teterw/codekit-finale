'use client';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, MessageSquare } from 'lucide-react';
import { fadeUp } from '@/lib/animations';
import { StaggerList, StaggerItem } from './motion/StaggerList';

interface Result {
  id: number;
  content: string;
  createdAt: string | Date;
  channelId: number;
  userName: string;
  userAvatar: string | null;
}

interface Props {
  channelId: number;
  channelName: string;
  userId: number;
  onClose: () => void;
}

export default function SearchModal({ channelId, channelName, userId, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(q)}&channelId=${channelId}`,
      { headers: { 'x-user-id': String(userId) } },
    );
    if (res.ok) {
      const data = await res.json();
      setResults(data.results ?? []);
    }
    setLoading(false);
  }, [channelId, userId]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 pt-[10vh] px-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Search bar */}
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <Search size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search(query); if (e.key === 'Escape') onClose(); }}
            placeholder={`Search in #${channelName}…`}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-1)' }}
          />
          <button
            onClick={() => search(query)}
            className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            Search
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10 flex-shrink-0"
            style={{ color: 'var(--text-2)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse space-y-1.5">
                  <div className="h-3 w-24 rounded" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="h-3 rounded" style={{ background: 'var(--bg-elevated)', width: `${50 + (i * 17) % 40}%` }} />
                </div>
              ))}
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="flex flex-col items-center py-10 text-center"
            >
              <MessageSquare size={32} className="mb-3" style={{ color: 'var(--text-3)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                No results for &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                Try a different search term
              </p>
            </motion.div>
          )}

          {!loading && searched && results.length > 0 && (
            <StaggerList>
              {results.map(r => (
                <StaggerItem key={r.id}>
                  <div
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04] cursor-default"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5 overflow-hidden"
                      style={{ background: 'var(--accent)' }}
                    >
                      {r.userAvatar ? (
                        <img src={r.userAvatar} alt={r.userName} className="w-full h-full object-cover" />
                      ) : (
                        r.userName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{r.userName}</span>
                        <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                          {new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{r.content}</p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerList>
          )}

          {!searched && !loading && (
            <div className="flex flex-col items-center py-8" style={{ color: 'var(--text-3)' }}>
              <p className="text-sm">Press Enter or click Search to find messages</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
