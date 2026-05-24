'use client';

import { User, X } from 'lucide-react';

const STATUS_DOT: Record<string, string> = {
  online:  '#23A55A',
  idle:    '#F0B232',
  dnd:     '#F23F43',
  offline: '#80848E',
};

interface Member {
  id: number;
  name: string;
  avatar: string | null;
  status: string;
  role: string;
}

interface Props {
  serverName: string;
  ownerId: number;
  members: Member[];
  onClose: () => void;
}

export default function MemberSidebar({ serverName, ownerId, members, onClose }: Props) {
  const sortedMembers = [...members].sort((a, b) => {
    if (a.id === ownerId) return -1;
    if (b.id === ownerId) return 1;
    if (a.role !== b.role) {
      if (a.role === 'admin') return -1;
      if (b.role === 'admin') return 1;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col h-full bg-[var(--bg-channels)]">
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
            Server Members
          </p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {members.length} member{members.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Close members panel"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sortedMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 rounded-xl"
            style={{ color: 'var(--text-3)' }}
          >
            <User size={28} className="mb-3" />
            <p className="text-sm font-medium">No members found</p>
            <p className="text-xs mt-1">Invite people to join this server.</p>
          </div>
        ) : (
          sortedMembers.map(member => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-2xl p-3 hover:bg-white/[0.04] transition-colors"
            >
              <div className="relative flex-shrink-0">
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {member.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[2px]"
                  style={{
                    background: STATUS_DOT[member.status] ?? STATUS_DOT.online,
                    borderColor: 'var(--bg-channels)',
                  }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                  {member.name}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                  {member.id === ownerId ? 'Owner' : member.role === 'admin' ? 'Admin' : 'Member'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
