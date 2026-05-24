'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, Hash, MessageCircle, Search, Send, X } from 'lucide-react';
import { fadeUp } from '@/lib/animations';
import { getPusherClient } from '@/lib/pusher-client';
import MessageItem from './MessageItem';

interface Message {
  id: number;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  userId: number;
  userName: string;
  userAvatar: string | null;
  pending?: boolean;
}

interface Props {
  channelId: number;
  channelName: string;
  userId: number;
  userName: string;
  onOpenSearch?: () => void;
  onViewProfile?: (userId: number) => void;
}

interface ThreadReply {
  author: string;
  content: string;
  time: string;
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

export default function ChatArea({ channelId, channelName, userId, userName, onOpenSearch, onViewProfile }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [threadDraft, setThreadDraft] = useState('');
  const [threadReplies, setThreadReplies] = useState<Record<number, ThreadReply[]>>({});
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
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setMessages([]);
      setNextCursor(null);
      setThreadMessage(null);
      setInitialLoading(true);
      fetchMessages().finally(() => {
        if (!cancelled) setInitialLoading(false);
      });
    });
    return () => { cancelled = true; };
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
    } catch { /* Pusher optional */ }
    return () => {
      try { pusher?.unsubscribe(`channel-${channelId}`); } catch { /* ignore */ }
    };
  }, [channelId, userId]);

  function handleScroll() {
    const list = listRef.current;
    if (!list) return;
    setShowJumpToBottom(list.scrollHeight - list.scrollTop - list.clientHeight > 200);
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

    const tempId = Date.now() * -1;
    const tempMessage: Message = {
      id: tempId,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId,
      userName,
      userAvatar: null,
      pending: true,
    };

    setMessages(prev => [...prev, tempMessage]);
    setInput('');
    setSending(true);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const res = await fetch(`/api/messages/${channelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        const data = await res.json();
        const message = data.message as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) {
            return prev.filter(m => m.id !== tempId);
          }
          return prev.map(m => m.id === tempId ? message : m);
        });
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  }

  function sendThreadReply(e: React.FormEvent) {
    e.preventDefault();
    if (!threadMessage) return;
    const content = threadDraft.trim();
    if (!content) return;
    setThreadReplies(prev => ({
      ...prev,
      [threadMessage.id]: [
        ...(prev[threadMessage.id] ?? []),
        {
          author: userName || 'You',
          content,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    }));
    setThreadDraft('');
  }

  return (
    <div className="relative flex flex-col flex-1 min-w-0 min-h-0" style={{ background: 'var(--bg-chat)' }}>
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-chat)' }}
      >
        <div className="flex items-center gap-2">
          <Hash size={18} style={{ color: 'var(--accent)' }} />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{channelName}</h3>
        </div>
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/[0.06]"
            style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            <Search size={13} />
            <span>Search</span>
          </button>
        )}
      </div>

      <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0 py-2">
        {nextCursor && (
          <div className="flex justify-center py-3">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs px-4 py-1.5 rounded-full transition-colors disabled:opacity-50"
              style={{ color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)' }}
            >
              {loadingMore ? 'Loading...' : 'Load earlier messages'}
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
                onOpenThread={setThreadMessage}
                onViewProfile={onViewProfile}
                onUpdated={updated => setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))}
                onDeleted={id => setMessages(prev => prev.filter(m => m.id !== id))}
              />
            </div>
          );
        })}
        <div ref={bottomRef} className="h-2" />
      </div>

      <AnimatePresence>
        {showJumpToBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-24 right-6 w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: 'var(--accent)', color: '#fff', zIndex: 10 }}
          >
            <ArrowDown size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="px-4 pb-6 pt-2 flex-shrink-0">
        <form onSubmit={sendMessage}>
          <div
            className="flex items-center gap-3 px-4 rounded-xl transition-shadow"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
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

      <AnimatePresence>
        {threadMessage && (
          <ThreadDrawer
            message={threadMessage}
            replies={threadReplies[threadMessage.id] ?? []}
            draft={threadDraft}
            onDraftChange={setThreadDraft}
            onSend={sendThreadReply}
            onClose={() => setThreadMessage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 my-4">
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--text-3)' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  );
}

function ThreadDrawer({
  message, replies, draft, onDraftChange, onSend, onClose,
}: {
  message: Message;
  replies: ThreadReply[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  const sourceTime = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute bottom-20 left-3 right-3 top-[62px] z-20 flex flex-col rounded-xl border shadow-2xl sm:left-auto sm:w-[340px]"
      style={{ background: 'var(--bg-channels)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between gap-3 border-b px-3 py-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex min-w-0 items-center gap-2">
          <MessageCircle size={16} style={{ color: 'var(--accent)' }} />
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Thread</h4>
            <p className="truncate text-[11px]" style={{ color: 'var(--text-3)' }}>Replying to {message.userName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.08]"
          style={{ color: 'var(--text-2)' }}
        >
          <X size={15} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{message.userName}</p>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{sourceTime}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-1)' }}>{message.content}</p>
        </div>
        {replies.length === 0 ? (
          <div className="rounded-xl border border-dashed p-3 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
            Start a focused side conversation without cluttering the channel.
          </div>
        ) : replies.map((reply, index) => (
          <div key={`${reply.time}-${index}`} className="rounded-xl p-3" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{reply.author}</p>
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{reply.time}</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-1)' }}>{reply.content}</p>
          </div>
        ))}
      </div>
      <form onSubmit={onSend} className="border-t p-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <input
            value={draft}
            onChange={e => onDraftChange(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
            style={{ color: 'var(--text-1)' }}
            placeholder="Reply in thread"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-lg disabled:opacity-30"
            style={{ background: draft.trim() ? 'var(--accent)' : 'transparent', color: draft.trim() ? '#fff' : 'var(--text-3)' }}
          >
            <Send size={13} />
          </button>
        </div>
      </form>
    </motion.aside>
  );
}
