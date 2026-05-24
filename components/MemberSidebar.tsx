'use client';

import { useState } from 'react';
import { Crown, MoreVertical, Shield, ShieldOff, User, X } from 'lucide-react';

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
  currentUserId: number;
  serverId: number;
  onChanged: () => void;
  onClose: () => void;
}

export default function MemberSidebar({ serverName, ownerId, members, currentUserId, serverId, onChanged, onClose }: Props) {
  const [openMenuFor, setOpenMenuFor] = useState<number | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const isOwner = currentUserId === ownerId;

  const sortedMembers = [...members].sort((a, b) => {
    if (a.id === ownerId) return -1;
    if (b.id === ownerId) return 1;
    if (a.role !== b.role) {
      if (a.role === 'admin') return -1;
      if (b.role === 'admin') return 1;
    }
    return a.name.localeCompare(b.name);
  });

  function closeMenu() {
    setOpenMenuFor(null);
    setConfirmTransfer(null);
  }

  async function patchMember(targetId: number, body: { role?: 'admin' | 'member'; transferOwner?: boolean }) {
    setBusyId(targetId);
    setError('');
    try {
      const res = await fetch(`/api/servers/${serverId}/members/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(currentUserId) },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Action failed');
        return;
      }
      closeMenu();
      onChanged();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

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

      {error && (
        <div className="mx-3 mt-3 px-3 py-2 rounded text-xs" style={{ background: 'rgba(242,63,67,0.1)', color: '#F23F43' }}>
          {error}
        </div>
      )}

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
          sortedMembers.map(member => {
            const isMemberOwner = member.id === ownerId;
            const isAdmin = member.role === 'admin';
            const canManage = isOwner && !isMemberOwner;
            const menuOpen = openMenuFor === member.id;
            return (
              <div
                key={member.id}
                className="group relative flex items-center gap-3 rounded-2xl p-3 hover:bg-white/[0.04] transition-colors"
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
                  <p className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--text-1)' }}>
                    {member.name}
                    {isMemberOwner && <Crown size={13} style={{ color: '#F0B232' }} />}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                    {isMemberOwner ? 'Owner' : isAdmin ? 'Admin' : 'Member'}
                  </p>
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => (menuOpen ? closeMenu() : setOpenMenuFor(member.id))}
                    disabled={busyId === member.id}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition disabled:opacity-50"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label={`Manage ${member.name}`}
                  >
                    <MoreVertical size={16} />
                  </button>
                )}

                {canManage && menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={closeMenu} />
                    <div
                      className="absolute right-3 top-12 z-50 w-52 rounded-lg py-1 shadow-xl"
                      style={{ background: '#111214', border: '1px solid var(--border)' }}
                    >
                      <button
                        type="button"
                        onClick={() => patchMember(member.id, { role: isAdmin ? 'member' : 'admin' })}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/[0.06] transition-colors"
                        style={{ color: 'var(--text-1)' }}
                      >
                        {isAdmin ? <ShieldOff size={15} /> : <Shield size={15} />}
                        {isAdmin ? 'Remove Admin' : 'Set as Admin'}
                      </button>

                      {confirmTransfer === member.id ? (
                        <button
                          type="button"
                          onClick={() => patchMember(member.id, { transferOwner: true })}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left font-semibold hover:bg-[rgba(242,63,67,0.15)] transition-colors"
                          style={{ color: '#F23F43' }}
                        >
                          <Crown size={15} />
                          Confirm transfer?
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmTransfer(member.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/[0.06] transition-colors"
                          style={{ color: '#F23F43' }}
                        >
                          <Crown size={15} />
                          Transfer Ownership
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
