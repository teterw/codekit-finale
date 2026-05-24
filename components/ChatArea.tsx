'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, Hash, Pin, Search, Send, X } from 'lucide-react';
import { fadeUp } from '@/lib/animations';
import { getPusherClient } from '@/lib/pusher-client';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';

interface Message {
  id: number;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  userId: number;
  userName: string;
  userAvatar: string | null;
  replyToId?: number | null;
  replyToContent?: string | null;
  replyToUserName?: string | null;
  isPinned?: boolean;
}

type Reaction = { emoji: string; count: number; userReacted: boolean };

interface ReplyTarget { id: number; content: string; userName: string; }

interface Props {
  channelId: number;
  channelName: string;
  userId: number;
  onOpenSearch?: () => void;
  onViewProfile?: (userId: number) => void;
}

function isGrouped(messages: Message[], index: number): boolean {
  if (index === 0) return false;
  const prev = messages[index - 1];
  const curr = messages[index];
  if (prev.userId !== curr.userId) return false;
  if (curr.replyToId) return false; // replies always show full header
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

const TYPING_DEBOUNCE = 2000;

export default function ChatArea({ channelId, channelName, userId, onOpenSearch, onViewProfile }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [typers, setTypers] = useState<Map<number, string>>(new Map());
  const [reactionsMap, setReactionsMap] = useState<Record<number, Reaction[]>>({});
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [showPinned, setShowPinned] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const fetchMessages = useCallback(async (cursor?: number) => {
    const url = cursor ? `/api/messages/${channelId}?cursor=${cursor}` : `/api/messages/${channelId}`;
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
      // Fetch reactions for these messages
      if (fetched.length > 0) {
        fetchReactions(fetched.map(m => m.id));
      }
    }
    setNextCursor(data.nextCursor);
  }, [channelId, userId]);

  async function fetchReactions(messageIds: number[]) {
    if (!messageIds.length) return;
    try {
      const res = await fetch(`/api/reactions?messageIds=${messageIds.join(',')}&userId=${userId}`, {
        headers: { 'x-user-id': String(userId) },
      });
      if (!res.ok) return;
      const data = await res.json();
      setReactionsMap(prev => ({ ...prev, ...data.reactions }));
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    setMessages([]);
    setNextCursor(null);
    setInitialLoading(true);
    setTypers(new Map());
    setReactionsMap({});
    setReplyTarget(null);
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

      channel.bind('reaction-updated', ({ messageId, reactions }: { messageId: number; reactions: Reaction[] }) => {
        setReactionsMap(prev => ({ ...prev, [messageId]: reactions }));
      });

      channel.bind('typing-start', ({ userId: tid, userName }: { userId: number; userName: string }) => {
        if (tid === userId) return;
        setTypers(prev => new Map(prev).set(tid, userName));
      });

      channel.bind('typing-stop', ({ userId: tid }: { userId: number }) => {
        setTypers(prev => { const next = new Map(prev); next.delete(tid); return next; });
      });

      const userChannel = pusher.subscribe(`user-${userId}`);
      userChannel.bind('profile-updated', (p: { id: number; name: string; avatar: string | null }) => {
        setMessages(prev => prev.map(m => m.userId === p.id ? { ...m, userName: p.name, userAvatar: p.avatar } : m));
      });
    } catch { /* Pusher optional */ }

    return () => {
      try {
        pusher?.unsubscribe(`channel-${channelId}`);
        pusher?.unsubscribe(`user-${userId}`);
      } catch { /* ignore */ }
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

  async function sendTypingEvent(isTyping: boolean) {
    try {
      await fetch('/api/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ channelId, isTyping }),
      });
    } catch { /* non-critical */ }
  }

  function handleInputChange(val: string) {
    setInput(val);
    if (val.trim() && !isTypingRef.current) {
      isTypingRef.current = true;
      sendTypingEvent(true);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTypingEvent(false);
    }, TYPING_DEBOUNCE);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput('');
    setReplyTarget(null);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    isTypingRef.current = false;
    sendTypingEvent(false);
    try {
      await fetch(`/api/messages/${channelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ content, replyToId: replyTarget?.id }),
      });
    } finally {
      setSending(false);
    }
  }

  async function handleReaction(messageId: number, emoji: string) {
    try {
      await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ messageId, channelId, emoji }),
      });
    } catch { /* non-critical */ }
  }

  // Drag and drop upload
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(true);
  }
  function handleDragLeave() { setIsDraggingOver(false); }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const content = `[Image: ${file.name}]`;
      await fetch(`/api/messages/${channelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ content }),
      });
    }
  }

  const typerNames = Array.from(typers.values());
  const pinnedMessages = messages.filter(m => m.isPinned);

  return (
    <div
      className="flex flex-col flex-1 min-w-0 min-h-0 relative"
      style={{ background: 'var(--bg-chat)' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center rounded-xl m-3"
            style={{ background: 'rgba(124,107,255,0.1)', border: '2px dashed var(--accent)' }}
          >
            <p className="text-lg font-semibold" style={{ color: 'var(--accent)' }}>Drop file to share</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-chat)' }}>
        <div className="flex items-center gap-2">
          <Hash size={18} style={{ color: 'var(--accent)' }} />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{channelName}</h3>
          {pinnedMessages.length > 0 && (
            <button
              onClick={() => setShowPinned(p => !p)}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors hover:bg-white/10"
              style={{ color: showPinned ? 'var(--accent)' : 'var(--text-3)' }}
            >
              <Pin size={11} /> {pinnedMessages.length}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Pinned panel */}
      <AnimatePresence>
        {showPinned && pinnedMessages.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden flex-shrink-0"
            style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
          >
            <div className="px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>
                📌 Pinned Messages
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {pinnedMessages.map(m => (
                  <div key={m.id} className="flex items-start gap-2 text-xs py-1 px-2 rounded hover:bg-white/5">
                    <span className="font-semibold flex-shrink-0" style={{ color: 'var(--text-2)' }}>{m.userName}:</span>
                    <span className="truncate" style={{ color: 'var(--text-3)' }}>{m.content}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
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
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-col items-center justify-center h-full px-6 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)' }}>
              <Hash size={28} style={{ color: 'var(--accent)' }} />
            </div>
            <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-1)' }}>Welcome to #{channelName}</h3>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>This is the beginning of #{channelName}. Say hello!</p>
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
                reactions={reactionsMap[msg.id] ?? []}
                onUpdated={updated => setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))}
                onDeleted={id => setMessages(prev => prev.filter(m => m.id !== id))}
                onReply={m => setReplyTarget({ id: m.id, content: m.content, userName: m.userName })}
                onReaction={handleReaction}
              />
            </div>
          );
        })}

        <TypingIndicator typers={typerNames} />
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
            className="absolute bottom-24 right-6 w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: 'var(--accent)', color: '#fff', zIndex: 10 }}
          >
            <ArrowDown size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="px-4 pb-6 pt-2 flex-shrink-0">
        {/* Reply preview */}
        <AnimatePresence>
          {replyTarget && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-between px-3 py-2 mb-1 rounded-t-xl text-xs overflow-hidden"
              style={{ background: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent)' }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span style={{ color: 'var(--text-3)' }}>Replying to</span>
                <span className="font-semibold" style={{ color: 'var(--accent)' }}>{replyTarget.userName}</span>
                <span className="truncate" style={{ color: 'var(--text-3)' }}>{replyTarget.content.slice(0, 60)}</span>
              </div>
              <button onClick={() => setReplyTarget(null)} className="flex-shrink-0 p-0.5 rounded hover:bg-white/10" style={{ color: 'var(--text-3)' }}>
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={sendMessage}>
          <div
            className="flex items-center gap-3 px-4 rounded-xl transition-shadow"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,107,255,0.3)'; }}
            onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
          >
            <input
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape' && replyTarget) { setReplyTarget(null); e.preventDefault(); }
              }}
              placeholder={replyTarget ? `Reply to ${replyTarget.userName}…` : `Message #${channelName}`}
              className="flex-1 bg-transparent py-3.5 text-sm outline-none"
              style={{ color: 'var(--text-1)' }}
            />
            <motion.button
              type="submit"
              disabled={!input.trim() || sending}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: input.trim() ? 'var(--accent)' : 'transparent', color: input.trim() ? '#fff' : 'var(--text-3)' }}
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
      <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--text-3)' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  );
}
