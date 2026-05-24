'use client';

import { useState } from 'react';

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
  onUpdated: (msg: Message) => void;
  onDeleted: (id: number) => void;
}

export default function MessageItem({ message, currentUserId, channelId, onUpdated, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [hovering, setHovering] = useState(false);
  const isOwn = message.userId === currentUserId;

  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const wasEdited = new Date(message.updatedAt).getTime() - new Date(message.createdAt).getTime() > 1000;

  async function saveEdit() {
    const content = editContent.trim();
    if (!content || content === message.content) { setEditing(false); return; }
    const res = await fetch(`/api/messages/${channelId}/${message.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(currentUserId) },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const data = await res.json();
      onUpdated({ ...message, content: data.message.content, updatedAt: data.message.updatedAt });
    }
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
    <div
      className="flex items-start gap-3 px-4 py-1 hover:bg-[#32353b] group relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="w-10 h-10 rounded-full bg-[#7289da] flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">
        {message.userAvatar ? (
          <img src={message.userAvatar} alt={message.userName} className="w-full h-full rounded-full object-cover" />
        ) : (
          message.userName.slice(0, 2).toUpperCase()
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-white font-medium text-sm">{message.userName}</span>
          <span className="text-[#72767d] text-xs">{time}</span>
          {wasEdited && <span className="text-[#72767d] text-xs">(edited)</span>}
        </div>

        {editing ? (
          <div className="mt-1">
            <input
              autoFocus
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-full bg-[#40444b] text-[#dcddde] rounded px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#7289da]"
            />
            <p className="text-[#72767d] text-xs mt-1">Enter to save · Esc to cancel</p>
          </div>
        ) : (
          <p className="text-[#dcddde] text-sm leading-relaxed break-words">{message.content}</p>
        )}
      </div>

      {isOwn && hovering && !editing && (
        <div className="absolute right-4 top-1 flex gap-1 bg-[#2f3136] border border-[#202225] rounded shadow-lg px-1 py-0.5">
          <button
            onClick={() => { setEditing(true); setEditContent(message.content); }}
            className="text-[#b9bbbe] hover:text-white text-xs px-2 py-1 rounded hover:bg-[#40444b]"
            title="Edit"
          >
            ✏️
          </button>
          <button
            onClick={deleteMsg}
            className="text-[#b9bbbe] hover:text-[#ed4245] text-xs px-2 py-1 rounded hover:bg-[#40444b]"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}
