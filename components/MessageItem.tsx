'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, MessageCircle, Pencil, Trash2, X } from 'lucide-react';

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
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const isOwn = message.userId === currentUserId;

  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const wasEdited = new Date(message.updatedAt).getTime() - new Date(message.createdAt).getTime() > 1000;

  async function saveEdit() {
    const content = editContent.trim();
    if (!content || content === message.content || saving) { setEditing(false); return; }
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
    if (!confirm('Delete this message?')) return;
    const res = await fetch(`/api/messages/${channelId}/${message.id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': String(currentUserId) },
    });
    if (res.ok) onDeleted(message.id);
  }

  return (
    <motion.div
      layout="position"
      className="message-hover relative flex items-start gap-3 px-4 group"
      style={{ paddingTop: isGrouped ? '2px' : '12px', paddingBottom: '2px' }}
    >
      {/* Avatar column */}
      <div className="w-10 flex-shrink-0 flex justify-center">
        {isGrouped ? (
          <span
            className="text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none pt-0.5"
            style={{ color: 'var(--text-3)', fontSize: '10px', lineHeight: '20px' }}
          >
            {time}
          </span>
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5 overflow-hidden cursor-pointer hover:ring-2 hover:ring-[var(--accent)] transition-shadow"
            style={{ background: 'var(--accent)' }}
            onClick={() => onViewProfile?.(message.userId)}
          >
            {message.userAvatar ? (
              <img src={message.userAvatar} alt={message.userName} className="w-full h-full object-cover" />
            ) : (
              message.userName.slice(0, 2).toUpperCase()
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
              {message.userName}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{time}</span>
            {wasEdited && (
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>(edited)</span>
            )}
          </div>
        )}

        {editing ? (
          <div className="mt-1">
            <textarea
              autoFocus
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                if (e.key === 'Escape') { setEditing(false); setEditContent(message.content); }
              }}
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none transition-shadow"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--accent)',
                color: 'var(--text-1)',
                boxShadow: '0 0 0 3px var(--accent-dim)',
              }}
            />
            <div className="flex items-center gap-2 mt-1.5">
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Enter to save - Esc to cancel</p>
              <button onClick={() => { setEditing(false); setEditContent(message.content); }} className="p-1 rounded" style={{ color: 'var(--text-3)' }}>
                <X size={12} />
              </button>
              <button onClick={saveEdit} disabled={saving} className="p-1 rounded" style={{ color: 'var(--online)' }}>
                <Check size={12} />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed break-words" style={{ color: 'var(--text-1)' }}>
            {message.content}
            {isGrouped && wasEdited && (
              <span className="ml-1.5 text-xs" style={{ color: 'var(--text-3)' }}>(edited)</span>
            )}
          </p>
        )}
      </div>

      {/* Action bar (hover reveal) */}
      <AnimatePresence>
        {(isOwn || onOpenThread) && !editing && (
          <motion.div
            className="message-actions absolute right-4 -top-3 flex gap-0.5 rounded-lg overflow-hidden shadow-lg"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            {onOpenThread && (
              <button
                onClick={() => onOpenThread(message)}
                className="flex items-center gap-1 px-2 py-1.5 text-xs transition-colors hover:bg-white/10"
                style={{ color: 'var(--text-2)' }}
                title="Open thread"
              >
                <MessageCircle size={12} />
              </button>
            )}
            {isOwn && (
              <>
                <button
                  onClick={() => { setEditing(true); setEditContent(message.content); }}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs transition-colors hover:bg-white/10"
                  style={{ color: 'var(--text-2)' }}
                  title="Edit"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={deleteMsg}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs transition-colors hover:bg-[rgba(240,71,71,0.15)]"
                  style={{ color: 'var(--text-2)' }}
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
