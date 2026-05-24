'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import MessageInput from './MessageInput';

interface Message {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
  userName: string;
  userAvatar: string | null;
}

function Avatar({ name, avatar }: { name: string; avatar: string | null }) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
      />
    );
  }
  return (
    <div
      className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold"
      style={{ background: 'var(--dc-accent)', color: 'white' }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function MessageItem({
  msg,
  currentUserId,
  onDelete,
  onEdit,
}: {
  msg: Message;
  currentUserId: number;
  onDelete: (id: number) => void;
  onEdit: (id: number, content: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(msg.content);
  const isOwn = msg.userId === currentUserId;

  const edited =
    msg.updatedAt && msg.createdAt && new Date(msg.updatedAt) > new Date(msg.createdAt);

  function submitEdit() {
    const trimmed = editVal.trim();
    if (trimmed && trimmed !== msg.content) {
      onEdit(msg.id, trimmed);
    }
    setEditing(false);
  }

  return (
    <div
      className="flex gap-3 px-4 py-1 relative group"
      style={{ background: hovered ? 'rgba(0,0,0,0.07)' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Avatar name={msg.userName} avatar={msg.userAvatar} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="font-semibold text-sm" style={{ color: 'var(--dc-text)' }}>
            {msg.userName}
          </span>
          <span className="text-xs" style={{ color: 'var(--dc-text-muted)' }}>
            {new Date(msg.createdAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {edited && <span className="ml-1 text-xs" style={{ color: 'var(--dc-text-muted)' }}>(edited)</span>}
          </span>
        </div>

        {editing ? (
          <div className="mt-1">
            <textarea
              autoFocus
              className="w-full rounded px-3 py-2 text-sm resize-none outline-none"
              style={{
                background: 'var(--dc-input-bg)',
                color: 'var(--dc-text)',
                border: '1px solid var(--dc-accent)',
              }}
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitEdit();
                }
                if (e.key === 'Escape') setEditing(false);
              }}
              rows={2}
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={submitEdit}
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'var(--dc-accent)', color: 'white' }}
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'var(--dc-input-bg)', color: 'var(--dc-text-muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p
            className="text-sm break-words whitespace-pre-wrap"
            style={{ color: 'var(--dc-text)', lineHeight: '1.375rem' }}
          >
            {msg.content}
          </p>
        )}
      </div>

      {/* Action buttons — own messages only */}
      {hovered && isOwn && !editing && (
        <div
          className="absolute right-4 top-0 -translate-y-1/2 flex gap-1 rounded shadow-lg z-10 border"
          style={{
            background: 'var(--dc-sidebar)',
            borderColor: 'var(--dc-border)',
            top: 4,
            transform: 'none',
          }}
        >
          <button
            onClick={() => {
              setEditing(true);
              setEditVal(msg.content);
            }}
            className="px-2 py-1 text-xs rounded transition-colors hover:opacity-80"
            style={{ color: 'var(--dc-text-muted)' }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(msg.id)}
            className="px-2 py-1 text-xs rounded transition-colors hover:opacity-80"
            style={{ color: 'var(--dc-danger)' }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function ChatArea({ channelId, userId }: { channelId: number; userId: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(
    async (cursor?: number) => {
      const url = `/api/messages/${channelId}${cursor ? `?cursor=${cursor}` : ''}`;
      const res = await fetch(url, { headers: { 'x-user-id': String(userId) } });
      if (!res.ok) return null;
      return res.json() as Promise<{ messages: Message[]; nextCursor: number | null }>;
    },
    [channelId, userId],
  );

  // Initial load
  useEffect(() => {
    setMessages([]);
    setNextCursor(null);
    fetchMessages().then(data => {
      if (!data) return;
      setMessages([...data.messages].reverse());
      setNextCursor(data.nextCursor);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
    });
  }, [channelId, fetchMessages]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchMessages(nextCursor);
    setLoadingMore(false);
    if (!data) return;
    setMessages(prev => [...[...data.messages].reverse(), ...prev]);
    setNextCursor(data.nextCursor);
  }

  async function sendMessage(content: string) {
    const res = await fetch(`/api/messages/${channelId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setMessages(prev => [...prev, data.message]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function deleteMessage(id: number) {
    await fetch(`/api/messages/${channelId}/${id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': String(userId) },
    });
    setMessages(prev => prev.filter(m => m.id !== id));
  }

  async function editMessage(id: number, content: string) {
    const res = await fetch(`/api/messages/${channelId}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setMessages(prev => prev.map(m => (m.id === id ? data.message : m)));
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4">
        {nextCursor && (
          <div className="flex justify-center py-2">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs px-3 py-1 rounded transition-colors disabled:opacity-50"
              style={{
                background: 'var(--dc-input-bg)',
                color: 'var(--dc-text-muted)',
              }}
            >
              {loadingMore ? 'Loading...' : '↑ Load older messages'}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--dc-text-muted)' }}>
            <div style={{ fontSize: 48 }}>💬</div>
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        )}

        {messages.map(msg => (
          <MessageItem
            key={msg.id}
            msg={msg}
            currentUserId={userId}
            onDelete={deleteMessage}
            onEdit={editMessage}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-2">
        <MessageInput onSend={sendMessage} />
      </div>
    </div>
  );
}
