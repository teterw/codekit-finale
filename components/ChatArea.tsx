'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import MessageItem from './MessageItem';
import { getPusherClient } from '@/lib/pusher-client';

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
  onOpenSearch?: () => void;
}

export default function ChatArea({ channelId, channelName, userId, onOpenSearch }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
    }
    setNextCursor(data.nextCursor);
  }, [channelId, userId]);

  useEffect(() => {
    setMessages([]);
    setNextCursor(null);
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

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
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      });

      channel.bind('message-updated', (updated: Message) => {
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
      });

      channel.bind('message-deleted', ({ id }: { id: number }) => {
        setMessages(prev => prev.filter(m => m.id !== id));
      });
    } catch {
      // Pusher not configured — polling would work as fallback
    }

    return () => {
      try {
        pusher?.unsubscribe(`channel-${channelId}`);
      } catch { /* ignore */ }
    };
  }, [channelId, userId]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await fetchMessages(nextCursor);
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
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#202225] bg-[#36393f] shadow">
        <div className="flex items-center gap-2">
          <span className="text-[#8e9297] text-lg">#</span>
          <h3 className="text-white font-semibold">{channelName}</h3>
        </div>
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="text-[#8e9297] hover:text-white transition-colors"
            title="Search messages"
          >
          🔍
          </button>
        )}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto py-4">
        {nextCursor && (
          <div className="flex justify-center mb-4">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-[#7289da] text-sm hover:underline disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[#b9bbbe]">
            <p className="text-4xl mb-2">#</p>
            <p className="font-bold text-white text-lg">Welcome to #{channelName}!</p>
            <p className="text-sm">This is the start of the #{channelName} channel.</p>
          </div>
        )}

        {messages.map(msg => (
          <MessageItem
            key={msg.id}
            message={msg}
            currentUserId={userId}
            channelId={channelId}
            onUpdated={updated => setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))}
            onDeleted={id => setMessages(prev => prev.filter(m => m.id !== id))}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="px-4 pb-6 pt-2">
        <div className="flex items-center bg-[#40444b] rounded-lg px-4 gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`Message #${channelName}`}
            className="flex-1 bg-transparent text-[#dcddde] placeholder-[#72767d] py-3 outline-none text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="text-[#72767d] hover:text-white disabled:opacity-30 transition-colors"
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  );
}
