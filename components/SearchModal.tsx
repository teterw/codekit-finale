'use client';

import { useState, useCallback } from 'react';

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
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&channelId=${channelId}`, {
      headers: { 'x-user-id': String(userId) },
    });
    if (res.ok) {
      const data = await res.json();
      setResults(data.results ?? []);
    }
    setLoading(false);
  }, [channelId, userId]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') search(query);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#36393f] rounded-lg w-full max-w-lg mx-4 shadow-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#202225]">
          <span className="text-[#8e9297]">🔍</span>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Search in #${channelName}`}
            className="flex-1 bg-transparent text-white placeholder-[#72767d] outline-none text-sm"
          />
          <button onClick={() => search(query)} className="text-[#7289da] text-xs hover:underline px-2">Search</button>
          <button onClick={onClose} className="text-[#b9bbbe] hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-8">
              <span className="text-[#b9bbbe] text-sm">Searching…</span>
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="flex flex-col items-center py-8 text-[#b9bbbe]">
              <p className="text-4xl mb-2">🔍</p>
              <p className="text-sm">No results found for <strong className="text-white">"{query}"</strong></p>
            </div>
          )}

          {!loading && results.map(r => (
            <div key={r.id} className="px-4 py-3 hover:bg-[#32353b] border-b border-[#202225]">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-white text-sm font-medium">{r.userName}</span>
                <span className="text-[#72767d] text-xs">
                  {new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[#dcddde] text-sm">{r.content}</p>
            </div>
          ))}

          {!loading && !searched && (
            <div className="flex flex-col items-center py-8 text-[#b9bbbe]">
              <p className="text-sm">Type something and press Enter or click Search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
