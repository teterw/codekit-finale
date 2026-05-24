'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, MessageCircle, Pencil, SmilePlus, Trash2, X } from 'lucide-react';

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
  message: Message;
  currentUserId: number;
  channelId: number;
  isGrouped: boolean;
  onUpdated: (msg: Message) => void;
  onDeleted: (id: number) => void;
  onOpenThread?: (msg: Message) => void;
  onViewProfile?: (userId: number) => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatTimestamp(date: Date): string {
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString())
    return `Today at ${formatTime(date)}`;
  if (date.toDateString() === yesterday.toDateString())
    return `Yesterday at ${formatTime(date)}`;
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

export default function MessageItem({
  message,
  currentUserId,
  channelId,
  isGrouped,
  onUpdated,
  onDeleted,
  onOpenThread,
  onViewProfile,
}: Props) {
  const [editing, setEditing]       = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [saving, setSaving]         = useState(false);
  const isOwn = message.userId === currentUserId;

  const createdDate = new Date(message.createdAt);
  const updatedDate = new Date(message.updatedAt);
  const timestamp   = formatTimestamp(createdDate);
  const shortTime   = formatTime(createdDate);
  const wasEdited   = updatedDate.getTime() - createdDate.getTime() > 1000;

  async function saveEdit() {
    const content = editContent.trim();
    if (!content || content === message.content || saving) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/messages/${channelId}/${message.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(currentUserId) },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const data = await res.json();
      onUpdated({ ...message, content: data.message.content, updatedAt: data.message.updatedAt });
    }
    setSaving(false);
    setEditing(false);
  }

  async function deleteMsg() {
    if (!confirm('Are you sure you want to delete this message?')) return;
    const res = await fetch(`/api/messages/${channelId}/${message.id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': String(currentUserId) },
    });
    if (res.ok) onDeleted(message.id);
  }

  return (
    <div
      className="message-hover relative flex items-start gap-4 px-4"
      style={{ paddingTop: isGrouped ? '2px' : '17px', paddingBottom: '2px' }}
    >
      {/* ── Avatar column ─────────────────────── */}
      <div className="w-10 flex-shrink-0 flex justify-center">
        {isGrouped ? (
          /* Hover timestamp for grouped messages */
          <span
            className="opacity-0 group-hover:opacity-100 text-[11px] select-none mt-0.5 w-10 text-center"
            style={{ color: 'var(--text-3)', lineHeight: '22px' }}
          >
            {shortTime}
          </span>
        ) : (
          <button
            className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold flex-shrink-0 hover:opacity-90 transition-opacity mt-0.5"
            style={{ background: 'var(--accent)', cursor: onViewProfile ? 'pointer' : 'default' }}
            onClick={() => onViewProfile?.(message.userId)}
          >
            {message.userAvatar ? (
              <img
                src={message.userAvatar}
                alt={message.userName}
                className="w-full h-full object-cover"
              />
            ) : (
              message.userName.slice(0, 2).toUpperCase()
            )}
          </button>
        )}
      </div>

      {/* ── Message body ──────────────────────── */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <button
              className="font-semibold text-[15px] hover:underline"
              style={{ color: 'var(--text-1)', cursor: onViewProfile ? 'pointer' : 'default' }}
              onClick={() => onViewProfile?.(message.userId)}
            >
              {message.userName}
            </button>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              {timestamp}
            </span>
            {wasEdited && !isGrouped && (
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>(edited)</span>
            )}
          </div>
        )}

        {editing ? (
          <div>
            <textarea
              autoFocus
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                if (e.key === 'Escape') { setEditing(false); setEditContent(message.content); }
              }}
              rows={2}
              className="w-full rounded px-3 py-2 text-[15px] outline-none resize-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--accent)',
                color: 'var(--text-msg)',
                boxShadow: '0 0 0 2px rgba(88,101,242,0.3)',
              }}
            />
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                escape to{' '}
                <button
                  onClick={() => { setEditing(false); setEditContent(message.content); }}
                  className="hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  cancel
                </button>
                {' '}· enter to{' '}
                <button onClick={saveEdit} className="hover:underline" style={{ color: 'var(--accent)' }}>
                  save
                </button>
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[15px] leading-[1.375rem] break-words" style={{ color: 'var(--text-msg)' }}>
            {message.content}
            {isGrouped && wasEdited && (
              <span className="ml-1.5 text-[11px]" style={{ color: 'var(--text-3)' }}>(edited)</span>
            )}
          </p>
        )}
      </div>

      {/* ── Action bar (hover reveal) ──────────── */}
      {!editing && (
        <div
          className="message-actions absolute right-4 flex gap-px rounded overflow-hidden"
          style={{
            top: isGrouped ? '-16px' : '-16px',
            background: '#2B2D31',
            border: '1px solid rgba(0,0,0,0.3)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
          }}
        >
          {/* Reaction */}
          <ActionBtn title="Add Reaction">
            <SmilePlus size={16} />
          </ActionBtn>

          {/* Thread */}
          {onOpenThread && (
            <ActionBtn title="Reply in Thread" onClick={() => onOpenThread(message)}>
              <MessageCircle size={16} />
            </ActionBtn>
          )}

          {/* Edit & Delete (own messages) */}
          {isOwn && (
            <>
              <ActionBtn title="Edit Message" onClick={() => { setEditing(true); setEditContent(message.content); }}>
                <Pencil size={15} />
              </ActionBtn>
              <ActionBtn title="Delete Message" danger onClick={deleteMsg}>
                <Trash2 size={15} />
              </ActionBtn>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  children, title, onClick, danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="px-2 py-1.5 transition-colors"
      style={{ color: danger ? undefined : 'var(--text-2)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.color    = danger ? '#F23F43' : '#DCDDDE';
        (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(242,63,67,0.1)' : 'rgba(79,84,92,0.16)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.color    = '';
        (e.currentTarget as HTMLElement).style.background = '';
      }}
    >
      {children}
    </button>
  );
}
