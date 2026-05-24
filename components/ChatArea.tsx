'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, AtSign, Bell, Hash, HelpCircle, Inbox, MessageCircle, Mic, Plus, Search, Send, Smile, X } from 'lucide-react';
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
  return new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime() < 7 * 60 * 1000;
}

function getDateLabel(date: Date): string {
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString())     return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function needsDateDivider(messages: Message[], index: number): string | null {
  const date = new Date(messages[index].createdAt);
  if (index === 0) return getDateLabel(date);
  const prevDate = new Date(messages[index - 1].createdAt);
  if (date.toDateString() !== prevDate.toDateString()) return getDateLabel(date);
  return null;
}

export default function ChatArea({ channelId, channelName, userId, userName, onOpenSearch, onViewProfile }: Props) {
  const [messages, setMessages]           = useState<Message[]>([]);
  const [nextCursor, setNextCursor]       = useState<number | null>(null);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [input, setInput]                 = useState('');
  const [sending, setSending]             = useState(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [threadDraft, setThreadDraft]     = useState('');
  const [threadReplies, setThreadReplies] = useState<Record<number, ThreadReply[]>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

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
      fetchMessages().finally(() => { if (!cancelled) setInitialLoading(false); });
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
          const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 150;
          if (nearBottom) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
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
    const prevHeight = list?.scrollHeight ?? 0;
    await fetchMessages(nextCursor);
    if (list) list.scrollTop = list.scrollHeight - prevHeight;
    setLoadingMore(false);
  }

  async function sendMessage() {
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
    inputRef.current?.focus();
  }

  function handleInputKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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

      {/* ── Channel header ──────────────────────── */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', height: '48px', background: 'var(--bg-chat)' }}
      >
        {/* Left: channel name */}
        <div className="flex items-center gap-2">
          <Hash size={20} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
          <h3 className="font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>
            {channelName}
          </h3>
        </div>

        {/* Right: action icons */}
        <div className="flex items-center gap-0.5">
          <HeaderIcon title="Threads"><MessageCircle size={20} /></HeaderIcon>
          <HeaderIcon title="Notification Settings"><Bell size={20} /></HeaderIcon>
          <HeaderIcon title="Pin Messages"><AtSign size={20} /></HeaderIcon>
          <HeaderIcon title="Members"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M13 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.42 0-8 1.79-8 4v1h16v-1c0-2.21-3.58-4-8-4z" opacity=".3"/><path d="M13 12c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4zm-3-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg></HeaderIcon>
          {onOpenSearch && (
            <div
              className="flex items-center gap-2 ml-1 px-2 h-[24px] rounded cursor-pointer"
              style={{ background: '#1E1F22', minWidth: '144px' }}
              onClick={onOpenSearch}
            >
              <span className="flex-1 text-[13px]" style={{ color: '#6D6F78' }}>Search</span>
              <Search size={14} style={{ color: '#6D6F78' }} />
            </div>
          )}
          <HeaderIcon title="Inbox"><Inbox size={20} /></HeaderIcon>
          <HeaderIcon title="Help"><HelpCircle size={20} /></HeaderIcon>
        </div>
      </div>

      {/* ── Message list ────────────────────────── */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0"
        style={{ paddingBottom: '0' }}
      >
        {/* Load more */}
        {nextCursor && (
          <div className="flex justify-center py-3">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs px-4 py-1.5 rounded-full transition-colors disabled:opacity-50 hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              {loadingMore ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {/* Skeletons */}
        {initialLoading && (
          <div className="px-4 pt-4 space-y-4">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: '#2B2D31' }} />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-28 rounded" style={{ background: '#2B2D31' }} />
                  <div className="h-3 rounded" style={{ background: '#2B2D31', width: `${38 + (i * 17) % 44}%` }} />
                  {i % 3 === 0 && <div className="h-3 rounded" style={{ background: '#2B2D31', width: `${20 + (i * 11) % 30}%` }} />}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Beginning of channel */}
        {!initialLoading && messages.length === 0 && (
          <div className="px-4 pt-12 pb-4">
            <div
              className="w-[68px] h-[68px] rounded-full flex items-center justify-center mb-4"
              style={{ background: '#36393F' }}
            >
              <Hash size={36} strokeWidth={2.5} style={{ color: '#F2F3F5' }} />
            </div>
            <h3 className="font-black text-[32px] mb-2" style={{ color: '#F2F3F5' }}>
              Welcome to #{channelName}!
            </h3>
            <p className="text-[16px]" style={{ color: 'var(--text-2)' }}>
              This is the start of the #{channelName} channel.
            </p>
          </div>
        )}

        {/* Messages */}
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

        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Jump-to-bottom button */}
      <AnimatePresence>
        {showJumpToBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-28 right-6 w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: 'var(--accent)', color: '#fff', zIndex: 10 }}
          >
            <ArrowDown size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Message input ────────────────────────── */}
      <div className="px-4 pb-6 pt-0 flex-shrink-0">
        <div
          className="flex items-center rounded-lg overflow-hidden"
          style={{ background: 'var(--bg-input)', minHeight: '44px' }}
        >
          {/* Attachment */}
          <button
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center transition-colors"
            style={{ color: '#B5BAC1' }}
            title="Add attachment"
            type="button"
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10">
              <Plus size={16} strokeWidth={2.5} />
            </div>
          </button>

          {/* Text area */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleInputKey}
            placeholder={`Message #${channelName}`}
            rows={1}
            className="flex-1 bg-transparent py-3 text-[15px] outline-none resize-none leading-[1.375rem]"
            style={{
              color: '#DCDDDE',
              caretColor: '#DCDDDE',
              maxHeight: '220px',
            }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
            }}
          />

          {/* Right icons */}
          <div className="flex items-center gap-0.5 px-2 flex-shrink-0">
            <button
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
              style={{ color: '#B5BAC1' }}
              title="Use soundboard"
              type="button"
            >
              <Mic size={20} />
            </button>
            <button
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
              style={{ color: '#B5BAC1' }}
              title="Open emoji picker"
              type="button"
            >
              <Smile size={20} />
            </button>
            {input.trim() && (
              <motion.button
                type="button"
                onClick={sendMessage}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-8 h-8 flex items-center justify-center rounded transition-colors"
                style={{ color: input.trim() ? 'var(--accent)' : '#B5BAC1' }}
                title="Send message"
              >
                <Send size={18} fill="currentColor" />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* ── Thread drawer ────────────────────────── */}
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

/* ── Header icon button ──────────────────────── */
function HeaderIcon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <button
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/[0.08] transition-colors"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </button>
  );
}

/* ── Date divider ────────────────────────────── */
function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 px-4 my-4">
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      <span
        className="text-xs font-semibold flex-shrink-0 px-1"
        style={{ color: 'var(--text-3)' }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  );
}

/* ── Thread drawer ───────────────────────────── */
function ThreadDrawer({
  message, replies, draft, onDraftChange, onSend, onClose,
}: {
  message: Message;
  replies: ThreadReply[];
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  const sourceTime = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute bottom-[88px] right-2 top-[52px] z-20 flex flex-col shadow-2xl sm:w-[340px] sm:left-auto sm:right-2"
      style={{ background: 'var(--bg-channels)', borderRadius: '8px', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-3 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle size={16} style={{ color: 'var(--accent)' }} />
          <div className="min-w-0">
            <h4 className="text-[15px] font-bold truncate" style={{ color: 'var(--text-1)' }}>Thread</h4>
            <p className="text-[12px] truncate" style={{ color: 'var(--text-3)' }}>
              #{message.userName}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/[0.08] transition-colors flex-shrink-0"
          style={{ color: 'var(--text-2)' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Original message */}
      <div className="p-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="rounded p-2.5" style={{ background: '#2B2D31' }}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[13px] font-semibold" style={{ color: 'var(--text-1)' }}>{message.userName}</p>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{sourceTime}</span>
          </div>
          <p className="text-[15px] leading-snug" style={{ color: 'var(--text-msg)' }}>{message.content}</p>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
        {replies.length === 0 ? (
          <p className="text-[13px] text-center py-4" style={{ color: 'var(--text-3)' }}>
            No replies yet. Start the thread!
          </p>
        ) : replies.map((reply, i) => (
          <div key={`${reply.time}-${i}`} className="rounded p-2.5" style={{ background: '#313338' }}>
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--text-2)' }}>{reply.author}</p>
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{reply.time}</span>
            </div>
            <p className="text-[15px] leading-snug" style={{ color: 'var(--text-msg)' }}>{reply.content}</p>
          </div>
        ))}
      </div>

      {/* Reply input */}
      <form onSubmit={onSend} className="p-3 flex-shrink-0">
        <div
          className="flex items-center gap-2 rounded px-3"
          style={{ background: 'var(--bg-input)', minHeight: '42px' }}
        >
          <input
            value={draft}
            onChange={e => onDraftChange(e.target.value)}
            className="flex-1 min-w-0 bg-transparent py-2.5 text-[15px] outline-none"
            style={{ color: '#DCDDDE' }}
            placeholder="Reply in thread…"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded disabled:opacity-30 transition-opacity"
            style={{ color: draft.trim() ? 'var(--accent)' : '#B5BAC1' }}
          >
            <Send size={15} fill={draft.trim() ? 'currentColor' : 'none'} />
          </button>
        </div>
      </form>
    </motion.aside>
  );
}
