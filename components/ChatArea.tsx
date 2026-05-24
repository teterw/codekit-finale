'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Search, Send, ArrowDown } from 'lucide-react';
import MessageItem from './MessageItem';
import { getPusherClient } from '@/lib/pusher';
import { fadeUp } from '@/lib/animations';

interface Message {
  id: number;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  userId: number;
  userName: string;
  userAvatar: string | null;
}

interface Props {
  channelId: number;
  channelName: string;
  userId: number;
  onOpenSearch: () => void;
}

function isGrouped(messages: Message[], index: number): boolean {
  if (index === 0) return false;
  const prev = messages[index - 1];
  const curr = messages[index];
  if (prev.userId !== curr.userId) return false;
  return new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
}

function getDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function needsDateDivider(messages: Message[], index: number): string | null {
  const date = new Date(messages[index].createdAt);
  if (index === 0) return getDateLabel(date);
  const prevDate = new Date(messages[index - 1].createdAt);
  if (date.toDateString() !== prevDate.toDateString()) return getDateLabel(date);
  return null;
}

export default function ChatArea({ channelId, channelName, userId, onOpenSearch }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async (cursor?: number) => {
    const url = cursor
      ? `/api/messages/${channelId}?cursor=${cursor}`
      : `/api/messages/${channelId}`;
    const res = await fetch(url, { headers: { 'x-user-id': String(userId) } });
    if (!res.ok) return;
    const data = await res.json();
    const fetched: Message[] = [...data.messages].reverse();
    if (cursor) {
      setMessages(prev => [...fetched, ...prev]);
    } else {
      setMessages(fetched);
      setNextCursor(data.nextCursor);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
    }
    setNextCursor(data.nextCursor);
  }, [channelId, userId]);

  useEffect(() => {
    setMessages([]);
    setNextCursor(null);
    setInitialLoading(true);
    fetchMessages().finally(() => setInitialLoading(false));
  }, [fetchMessages]);

  useEffect(() => {
    let pusher: ReturnType<typeof getPusherClient> | null = null;
    try {
      pusher = getPusherClient(userId);
      const channel = pusher.subscribe(`channel-${channelId}`);

      channel.bind('new-message', (msg: Message) => {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        const list = listRef.current;
        if (list) {
          const isNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
          if (isNearBottom) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      });

      channel.bind('message-updated', (updated: Message) => {
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
      });

      channel.bind('message-deleted', ({ id }: { id: number }) => {
        setMessages(prev => prev.filter(m => m.id !== id));
      });
    } catch { /* Pusher not configured */ }

    return () => {
      try { pusher?.unsubscribe(`channel-${channelId}`); } catch { /* ignore */ }
    };
  }, [channelId, userId]);

  function handleScroll() {
    const list = listRef.current;
    if (!list) return;
    const distFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    setShowJumpToBottom(distFromBottom > 200);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const list = listRef.current;
    const prevScrollHeight = list?.scrollHeight ?? 0;
    await fetchMessages(nextCursor);
    if (list) list.scrollTop = list.scrollHeight - prevScrollHeight;
    setLoadingMore(false);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput('');
    try {
      await fetch(`/api/messages/${channelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ content }),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0" style={{ background: 'var(--bg-chat)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-chat)' }}
      >
        <div className="flex items-center gap-2">
          <Hash size={18} style={{ color: 'var(--accent)' }} />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{channelName}</h3>
        </div>
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/[0.06]"
          style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
        >
          <Search size={13} />
          <span>Search</span>
        </button>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0 py-2"
      >
        {nextCursor && (
          <div className="flex justify-center py-3">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs px-4 py-1.5 rounded-full transition-colors disabled:opacity-50"
              style={{ color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)' }}
            >
              {loadingMore ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {initialLoading && (
          <div className="px-4 py-2 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: 'var(--bg-elevated)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="h-3 rounded" style={{ background: 'var(--bg-elevated)', width: `${40 + (i * 13) % 45}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!initialLoading && messages.length === 0 && (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center justify-center h-full px-6 text-center"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)' }}
            >
              <Hash size={28} style={{ color: 'var(--accent)' }} />
            </div>
            <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-1)' }}>
              Welcome to #{channelName}
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              This is the beginning of the #{channelName} channel. Say hello!
            </p>
          </motion.div>
        )}

        {!initialLoading && messages.map((msg, i) => {
          const divider = needsDateDivider(messages, i);
          const grouped = isGrouped(messages, i);
          return (
            <div key={msg.id}>
              {divider && <DateDivider label={divider} />}
              <MessageItem
                message={msg}
                currentUserId={userId}
                channelId={channelId}
                isGrouped={grouped}
                onUpdated={updated => setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))}
                onDeleted={id => setMessages(prev => prev.filter(m => m.id !== id))}
              />
            </div>
          );
        })}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Jump to bottom */}
      <AnimatePresence>
        {showJumpToBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-24 right-6 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-colors"
            style={{ background: 'var(--accent)', color: '#fff', zIndex: 10 }}
          >
            <ArrowDown size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 pb-6 pt-2 flex-shrink-0">
        <form onSubmit={sendMessage}>
          <div
            className="flex items-center gap-3 px-4 rounded-xl transition-shadow"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
            }}
            onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,107,255,0.3)'}
            onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Message #${channelName}`}
              className="flex-1 bg-transparent py-3.5 text-sm outline-none"
              style={{ color: 'var(--text-1)' }}
            />
            <motion.button
              type="submit"
              disabled={!input.trim() || sending}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: input.trim() ? 'var(--accent)' : 'transparent',
                color: input.trim() ? '#fff' : 'var(--text-3)',
              }}
            >
              <Send size={14} />
            </motion.button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 my-4">
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--text-3)' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  );
}
