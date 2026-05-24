'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2, X, Check, Reply, Pin, SmilePlus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '😡'];

interface Reaction { emoji: string; count: number; userReacted: boolean; }

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

interface Props {
  message: Message;
  currentUserId: number;
  channelId: number;
  isGrouped: boolean;
  reactions?: Reaction[];
  onUpdated: (msg: Message) => void;
  onDeleted: (id: number) => void;
  onReply: (msg: Message) => void;
  onReaction: (messageId: number, emoji: string) => void;
}

export default function MessageItem({
  message, currentUserId, channelId, isGrouped, reactions = [],
  onUpdated, onDeleted, onReply, onReaction,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
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

  async function togglePin() {
    const res = await fetch(`/api/messages/${channelId}/${message.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(currentUserId) },
      body: JSON.stringify({ isPinned: !message.isPinned }),
    });
    if (res.ok) {
      const data = await res.json();
      onUpdated({ ...message, isPinned: data.message.isPinned });
    }
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
          <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none pt-0.5" style={{ color: 'var(--text-3)', fontSize: '10px', lineHeight: '20px' }}>
            {time}
          </span>
        ) : (
          <button
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5 overflow-hidden hover:ring-2 hover:ring-[var(--accent)] transition-shadow"
            style={{ background: 'var(--accent)' }}
            onClick={() => router.push(`/profile/${message.userId}`)}
          >
            {message.userAvatar ? (
              <img src={message.userAvatar} alt={message.userName} className="w-full h-full object-cover" />
            ) : (
              message.userName.slice(0, 2).toUpperCase()
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <button
              className="font-semibold text-sm hover:underline"
              style={{ color: 'var(--text-1)' }}
              onClick={() => router.push(`/profile/${message.userId}`)}
            >
              {message.userName}
            </button>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{time}</span>
            {wasEdited && <span className="text-xs" style={{ color: 'var(--text-3)' }}>(edited)</span>}
            {message.isPinned && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: '10px' }}>
                📌 pinned
              </span>
            )}
          </div>
        )}

        {/* Reply preview */}
        {message.replyToId && message.replyToContent && (
          <div
            className="flex items-start gap-2 mb-1 pl-2 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity"
            style={{ borderLeft: '2px solid var(--text-3)', color: 'var(--text-3)' }}
          >
            <span className="font-semibold" style={{ color: 'var(--text-2)' }}>{message.replyToUserName}</span>
            <span className="truncate">{message.replyToContent.slice(0, 80)}{message.replyToContent.length > 80 ? '…' : ''}</span>
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
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent)', color: 'var(--text-1)', boxShadow: '0 0 0 3px var(--accent-dim)' }}
            />
            <div className="flex items-center gap-2 mt-1.5">
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Enter to save · Esc to cancel</p>
              <button onClick={() => { setEditing(false); setEditContent(message.content); }} className="p-1 rounded" style={{ color: 'var(--text-3)' }}><X size={12} /></button>
              <button onClick={saveEdit} disabled={saving} className="p-1 rounded" style={{ color: 'var(--online)' }}><Check size={12} /></button>
            </div>
          </div>
        ) : (
          <div className="text-sm leading-relaxed break-words prose prose-invert prose-sm max-w-none" style={{ color: 'var(--text-1)' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="m-0">{children}</p>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes('language-');
                  if (isBlock) {
                    return (
                      <code
                        className="block rounded-lg px-3 py-2 my-1 text-xs font-mono overflow-x-auto"
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', color: '#e2e8f0' }}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code
                      className="rounded px-1 py-0.5 text-xs font-mono"
                      style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--accent)' }}
                    >
                      {children}
                    </code>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="pl-3 my-1" style={{ borderLeft: '3px solid var(--accent)', color: 'var(--text-2)' }}>
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }} className="hover:underline">
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
            {isGrouped && wasEdited && <span className="text-xs ml-1" style={{ color: 'var(--text-3)' }}>(edited)</span>}
          </div>
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reactions.map(r => (
              <motion.button
                key={r.emoji}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onReaction(message.id, r.emoji)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all"
                style={{
                  background: r.userReacted ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                  border: `1px solid ${r.userReacted ? 'var(--accent-glow)' : 'var(--border)'}`,
                  color: r.userReacted ? 'var(--accent)' : 'var(--text-2)',
                }}
              >
                <span>{r.emoji}</span>
                <span>{r.count}</span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <AnimatePresence>
        {!editing && (
          <motion.div
            className="message-actions absolute right-4 -top-3 flex gap-0.5 rounded-lg overflow-hidden shadow-lg"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            {/* Emoji picker */}
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => setShowEmojiPicker(p => !p)}
                className="flex items-center gap-1 px-2 py-1.5 text-xs transition-colors hover:bg-white/10"
                style={{ color: 'var(--text-2)' }}
                title="React"
              >
                <SmilePlus size={12} />
              </button>
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute bottom-full mb-1 right-0 flex gap-1 p-1.5 rounded-xl shadow-xl z-50"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                    onMouseLeave={() => setShowEmojiPicker(false)}
                  >
                    {EMOJIS.map(emoji => (
                      <motion.button
                        key={emoji}
                        whileHover={{ scale: 1.3 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => { onReaction(message.id, emoji); setShowEmojiPicker(false); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-base transition-colors hover:bg-white/10"
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Reply */}
            <button
              onClick={() => onReply(message)}
              className="flex items-center gap-1 px-2 py-1.5 text-xs transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-2)' }}
              title="Reply"
            >
              <Reply size={12} />
            </button>

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
                  onClick={togglePin}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs transition-colors hover:bg-white/10"
                  style={{ color: message.isPinned ? 'var(--accent)' : 'var(--text-2)' }}
                  title={message.isPinned ? 'Unpin' : 'Pin'}
                >
                  <Pin size={12} />
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
