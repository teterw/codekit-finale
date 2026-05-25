'use client';

import { useState } from 'react';
import { Crown, Shield, ShieldOff, UserPlus, X } from 'lucide-react';

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

export default function MemberSidebar({
  ownerId, members, currentUserId, serverId, onChanged, onClose,
}: Props) {
  const [openMenuFor, setOpenMenuFor]     = useState<number | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState<number | null>(null);
  const [busyId, setBusyId]               = useState<number | null>(null);
  const [error, setError]                 = useState('');

  const isOwner = currentUserId === ownerId;

  const owner  = members.filter(m => m.id === ownerId);
  const admins = members.filter(m => m.id !== ownerId && m.role === 'admin');
  const online = members.filter(m => m.id !== ownerId && m.role !== 'admin' && m.status !== 'offline');
  const offline= members.filter(m => m.id !== ownerId && m.role !== 'admin' && m.status === 'offline');

  function closeMenu() { setOpenMenuFor(null); setConfirmTransfer(null); }

  async function patchMember(targetId: number, body: { role?: 'admin' | 'member'; transferOwner?: boolean }) {
    setBusyId(targetId); setError('');
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
    } catch { setError('Network error. Please try again.'); }
    finally   { setBusyId(null); }
  }

  return (
    <div className="w-60 flex-shrink-0 flex flex-col h-full" style={{ background: 'var(--bg-channels)' }}>
      {/* Close button — mobile only in main layout; desktop via chat header toggle */}
      <div className="flex items-center justify-end px-3 pt-3 pb-1 md:hidden">
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: '#80848E' }}>
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="mx-3 mt-2 px-3 py-2 rounded text-xs" style={{ background: 'rgba(242,63,67,0.1)', color: '#F23F43' }}>
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 pt-3">
        <RoleGroup label="Owner" count={owner.length}>
          {owner.map(m => (
            <MemberRow
              key={m.id} member={m} isSelf={m.id === currentUserId}
              badge={<Crown size={12} style={{ color: '#F0B232' }} />}
              menuOpen={openMenuFor === m.id} canManage={false}
              onMenuToggle={() => {}}
              onMenuClose={closeMenu}
              onSetAdmin={() => {}}
              onTransfer={() => {}}
              confirmingTransfer={false}
              busy={busyId === m.id}
            />
          ))}
        </RoleGroup>

        {admins.length > 0 && (
          <RoleGroup label="Admin" count={admins.length}>
            {admins.map(m => (
              <MemberRow
                key={m.id} member={m} isSelf={m.id === currentUserId}
                badge={<Shield size={12} style={{ color: '#5865F2' }} />}
                menuOpen={openMenuFor === m.id}
                canManage={isOwner}
                onMenuToggle={() => setOpenMenuFor(openMenuFor === m.id ? null : m.id)}
                onMenuClose={closeMenu}
                onSetAdmin={() => patchMember(m.id, { role: 'member' })}
                onTransfer={() => setConfirmTransfer(m.id)}
                confirmingTransfer={confirmTransfer === m.id}
                busy={busyId === m.id}
              />
            ))}
          </RoleGroup>
        )}

        {online.length > 0 && (
          <RoleGroup label="Online" count={online.length}>
            {online.map(m => (
              <MemberRow
                key={m.id} member={m} isSelf={m.id === currentUserId}
                menuOpen={openMenuFor === m.id}
                canManage={isOwner}
                onMenuToggle={() => setOpenMenuFor(openMenuFor === m.id ? null : m.id)}
                onMenuClose={closeMenu}
                onSetAdmin={() => patchMember(m.id, { role: 'admin' })}
                onTransfer={() => setConfirmTransfer(m.id)}
                confirmingTransfer={confirmTransfer === m.id}
                busy={busyId === m.id}
              />
            ))}
          </RoleGroup>
        )}

        {offline.length > 0 && (
          <RoleGroup label="Offline" count={offline.length}>
            {offline.map(m => (
              <MemberRow
                key={m.id} member={m} isSelf={m.id === currentUserId}
                menuOpen={openMenuFor === m.id}
                canManage={isOwner}
                onMenuToggle={() => setOpenMenuFor(openMenuFor === m.id ? null : m.id)}
                onMenuClose={closeMenu}
                onSetAdmin={() => patchMember(m.id, { role: 'admin' })}
                onTransfer={() => setConfirmTransfer(m.id)}
                confirmingTransfer={confirmTransfer === m.id}
                busy={busyId === m.id}
              />
            ))}
          </RoleGroup>
        )}

        {members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <UserPlus size={28} className="mb-3" style={{ color: '#4E5058' }} />
            <p className="text-sm font-medium" style={{ color: '#4E5058' }}>No members yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleGroup({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="px-2 mb-1 text-[11px] font-bold uppercase tracking-[0.02em]" style={{ color: '#80848E' }}>
        {label} — {count}
      </p>
      {children}
    </div>
  );
}

function MemberRow({
  member, isSelf, badge, menuOpen, canManage,
  onMenuToggle, onMenuClose, onSetAdmin, onTransfer,
  confirmingTransfer, busy,
}: {
  member: Member; isSelf: boolean; badge?: React.ReactNode;
  menuOpen: boolean; canManage: boolean;
  onMenuToggle: () => void; onMenuClose: () => void;
  onSetAdmin: () => void; onTransfer: () => void;
  confirmingTransfer: boolean; busy: boolean;
}) {
  const isOffline = member.status === 'offline';

  return (
    <div className="relative group">
      <button
        onClick={canManage ? onMenuToggle : undefined}
        className="w-full flex items-center gap-2 px-2 py-[3px] rounded transition-colors text-left"
        style={{ height: 34 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(79,84,92,0.16)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {member.avatar
            ? <img src={member.avatar} alt={member.name}
                className="w-8 h-8 rounded-full object-cover"
                style={{ opacity: isOffline ? 0.5 : 1 }} />
            : <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                style={{ background: isOffline ? '#4E5058' : 'var(--accent)', opacity: isOffline ? 0.7 : 1 }}
              >
                {member.name.slice(0, 2).toUpperCase()}
              </div>
          }
          {/* Status dot */}
          <div
            className="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] rounded-full border-2"
            style={{ background: STATUS_DOT[member.status] ?? STATUS_DOT.offline, borderColor: 'var(--bg-channels)' }}
          />
        </div>

        {/* Name + badge */}
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <span
            className="text-[15px] font-medium truncate leading-none"
            style={{ color: isOffline ? '#4E5058' : isSelf ? '#F2F3F5' : '#B5BAC1' }}
          >
            {member.name}
          </span>
          {badge}
          {isSelf && (
            <span className="text-[10px] px-1 rounded flex-shrink-0" style={{ background: '#5865F2', color: '#fff' }}>
              you
            </span>
          )}
        </div>
      </button>

      {/* Context menu */}
      {canManage && menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onMenuClose} />
          <div
            className="absolute right-0 top-full z-50 w-52 rounded py-1 shadow-xl"
            style={{ background: '#111214', border: '1px solid rgba(0,0,0,0.6)' }}
          >
            <button
              type="button"
              onClick={onSetAdmin}
              disabled={busy}
              className="flex w-full items-center gap-2 px-3 py-[7px] text-sm text-left hover:bg-white/[0.06] transition-colors disabled:opacity-50"
              style={{ color: '#DBDEE1' }}
            >
              {member.role === 'admin'
                ? <><ShieldOff size={15} /> Remove Admin</>
                : <><Shield size={15} /> Set as Admin</>
              }
            </button>

            {confirmingTransfer
              ? (
                <button
                  type="button"
                  onClick={onTransfer}
                  disabled={busy}
                  className="flex w-full items-center gap-2 px-3 py-[7px] text-sm text-left font-semibold hover:bg-[rgba(242,63,67,0.15)] transition-colors disabled:opacity-50"
                  style={{ color: '#F23F43' }}
                >
                  <Crown size={15} /> Confirm transfer?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onTransfer}
                  className="flex w-full items-center gap-2 px-3 py-[7px] text-sm text-left hover:bg-white/[0.06] transition-colors"
                  style={{ color: '#F23F43' }}
                >
                  <Crown size={15} /> Transfer Ownership
                </button>
              )
            }
          </div>
        </>
      )}
    </div>
  );
}
