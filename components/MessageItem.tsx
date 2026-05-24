'use client';
import { memo, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, MessageCircle, Pencil, Pin, Reply, SmilePlus, Trash2, X } from 'lucide-react';
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
  onReply?: (msg: Message) => void;
  onReaction?: (messageId: number, emoji: string) => void;
  onOpenThread?: (msg: Message) => void;
  onViewProfile?: (userId: number) => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatTimestamp(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return `Today at ${formatTime(date)}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${formatTime(date)}`;
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function MessageItem({
  message,
  currentUserId,
  channelId,
  isGrouped,
  reactions = [],
  onUpdated,
  onDeleted,
  onReply,
  onReaction,
  onOpenThread,
  onViewProfile,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const isOwn = message.userId === currentUserId;

  useEffect(() => {
    if (!showEmojiPicker) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmojiPicker]);

  const createdDate = new Date(message.createdAt);
  const updatedDate = new Date(message.updatedAt);
  const timestamp = formatTimestamp(createdDate);
  const shortTime = formatTime(createdDate);
  const wasEdited = updatedDate.getTime() - createdDate.getTime() > 1000;

  function viewProfile() {
    if (onViewProfile) onViewProfile(message.userId);
    else router.push(`/profile/${message.userId}`);
  }

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
    <div
      className="message-hover group relative flex items-start gap-4 px-4"
      style={{ paddingTop: isGrouped ? '2px' : '17px', paddingBottom: '2px' }}
    >
      <div className="w-10 flex-shrink-0 flex justify-center">
        {isGrouped ? (
          <span className="opacity-0 group-hover:opacity-100 text-[11px] select-none mt-0.5 w-10 text-center" style={{ color: 'var(--text-3)', lineHeight: '22px' }}>
            {shortTime}
          </span>
        ) : (
          <button
            className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold flex-shrink-0 hover:opacity-90 transition-opacity mt-0.5"
            style={{ background: 'var(--accent)' }}
            onClick={viewProfile}
          >
            {message.userAvatar ? (
              <img src={message.userAvatar} alt={message.userName} className="w-full h-full object-cover" />
            ) : (
              message.userName.slice(0, 2).toUpperCase()
            )}
          </button>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <button className="font-semibold text-[15px] hover:underline" style={{ color: 'var(--text-1)' }} onClick={viewProfile}>
              {message.userName}
            </button>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{timestamp}</span>
            {wasEdited && <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>(edited)</span>}
            {message.isPinned && (
              <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                pinned
              </span>
            )}
          </div>
        )}

        {message.replyToId && message.replyToContent && (
          <div className="flex items-start gap-2 mb-1 pl-2 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity" style={{ borderLeft: '2px solid var(--text-3)', color: 'var(--text-3)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-2)' }}>{message.replyToUserName}</span>
            <span className="truncate">{message.replyToContent.slice(0, 80)}{message.replyToContent.length > 80 ? '...' : ''}</span>
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
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent)', color: 'var(--text-msg)', boxShadow: '0 0 0 2px rgba(88,101,242,0.3)' }}
            />
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>Enter to save - Esc to cancel</span>
              <button onClick={() => { setEditing(false); setEditContent(message.content); }} className="p-1 rounded" style={{ color: 'var(--text-3)' }}>
                <X size={12} />
              </button>
              <button onClick={saveEdit} disabled={saving} className="p-1 rounded" style={{ color: 'var(--online)' }}>
                <Check size={12} />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-[15px] leading-[1.375rem] break-words" style={{ color: 'var(--text-msg)' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes('language-');
                  return (
                    <code
                      className={isBlock ? 'block rounded-lg px-3 py-2 my-1 text-xs font-mono overflow-x-auto' : 'rounded px-1 py-0.5 text-xs font-mono'}
                      style={isBlock
                        ? { background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', color: '#e2e8f0' }
                        : { background: 'rgba(0,0,0,0.3)', color: 'var(--accent)' }}
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

        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reactions.map(r => (
              <motion.button
                key={r.emoji}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onReaction?.(message.id, r.emoji)}
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

      <AnimatePresence>
        {(isOwn || onReaction || onReply || onOpenThread) && !editing && (
          <motion.div
            className="message-actions absolute right-4 -top-3 flex gap-0.5 rounded-lg shadow-lg"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              ...(showEmojiPicker ? { opacity: 1, pointerEvents: 'auto' as const } : {}),
            }}
          >
            {onReaction && (
              <div className="relative" ref={pickerRef}>
                <button onClick={() => setShowEmojiPicker(p => !p)} className="flex items-center gap-1 px-2 py-1.5 text-xs transition-colors hover:bg-white/10" style={{ color: 'var(--text-2)' }} title="React">
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
            )}

            {onReply && (
              <button onClick={() => onReply(message)} className="flex items-center gap-1 px-2 py-1.5 text-xs transition-colors hover:bg-white/10" style={{ color: 'var(--text-2)' }} title="Reply">
                <Reply size={12} />
              </button>
            )}

            {onOpenThread && (
              <button onClick={() => onOpenThread(message)} className="flex items-center gap-1 px-2 py-1.5 text-xs transition-colors hover:bg-white/10" style={{ color: 'var(--text-2)' }} title="Open thread">
                <MessageCircle size={12} />
              </button>
            )}

            {isOwn && (
              <>
                <button onClick={() => { setEditing(true); setEditContent(message.content); }} className="flex items-center gap-1 px-2 py-1.5 text-xs transition-colors hover:bg-white/10" style={{ color: 'var(--text-2)' }} title="Edit">
                  <Pencil size={12} />
                </button>
                <button onClick={togglePin} className="flex items-center gap-1 px-2 py-1.5 text-xs transition-colors hover:bg-white/10" style={{ color: message.isPinned ? 'var(--accent)' : 'var(--text-2)' }} title={message.isPinned ? 'Unpin' : 'Pin'}>
                  <Pin size={12} />
                </button>
                <button onClick={deleteMsg} className="flex items-center gap-1 px-2 py-1.5 text-xs transition-colors hover:bg-[rgba(240,71,71,0.15)]" style={{ color: 'var(--text-2)' }} title="Delete">
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(MessageItem);
