'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AtSign,
  Bell,
  CircleHelp,
  Compass,
  Download,
  Gamepad2,
  Home,
  Inbox,
  Mail,
  MessageSquarePlus,
  Plus,
  Search,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';

type RequestStatus = 'requests' | 'spam';

interface MessageRequest {
  id: number;
  name: string;
  handle: string;
  status: RequestStatus;
  title: string;
  preview: string;
  time: string;
  unread?: number;
  accent: string;
  initials: string;
  accepted?: boolean;
  reported?: boolean;
}

interface DirectMessage {
  id: number;
  name: string;
  status: string;
  note?: string;
  initials: string;
  accent: string;
  unread?: boolean;
}

interface Server {
  id: number;
  name: string;
  icon: string | null;
  ownerId: number;
}

interface ApiMessage {
  id: number;
  content: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  userId: number;
  userName: string;
  userAvatar: string | null;
}

const requestsSeed: MessageRequest[] = [
  {
    id: 1,
    name: 'Free Gold in Game',
    handle: 'gold-drop',
    status: 'spam',
    title: 'Free Gold in Game',
    preview: 'Sign up for free! Epic Legends mobile free gold at this limited link.',
    time: 'Today at 9:18 AM',
    accent: '#d7dce3',
    initials: 'FG',
  },
  {
    id: 2,
    name: 'Web Bot',
    handle: 'web.bot',
    status: 'spam',
    title: 'Web Bot',
    preview: 'Hurry! Your chance to redeem free prizes is running out!',
    time: 'Yesterday at 11:22 PM',
    accent: '#c49a6c',
    initials: 'WB',
  },
  {
    id: 3,
    name: 'Nia',
    handle: 'nia.design',
    status: 'requests',
    title: 'Nia',
    preview: 'Hey, are you the person building the launch community page?',
    time: 'Today at 8:04 AM',
    accent: '#23a55a',
    initials: 'NI',
  },
];

const directMessages: DirectMessage[] = [
  { id: 1, name: 'Deku', status: 'Playing Wumpus Castle', initials: 'DE', accent: '#fee75c', unread: true },
  { id: 2, name: 'Group DM for Awesome', status: '9 Members', initials: 'GD', accent: '#23a55a' },
  { id: 3, name: 'jigglepugg', status: 'Online', initials: 'JI', accent: '#5865f2' },
];

export default function DirectMessagesPage({ userId }: { userId: number }) {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [tab, setTab] = useState<RequestStatus>('spam');
  const [requests, setRequests] = useState(requestsSeed);
  const [selectedId, setSelectedId] = useState(2);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    fetch('/api/servers', { headers: { 'x-user-id': String(userId) } })
      .then(res => (res.ok ? res.json() : { servers: [] }))
      .then(data => setServers(data.servers ?? []))
      .catch(() => setServers([]));
  }, [userId]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingMessages(true);
    setMessages([]);
    fetch(`/api/direct-messages/${selectedId}`, { headers: { 'x-user-id': String(userId) } })
      .then(res => (res.ok ? res.json() : { messages: [] }))
      .then(data => setMessages(([...(data.messages ?? [])]).reverse()))
      .catch(() => {})
      .finally(() => setLoadingMessages(false));
  }, [selectedId, userId]);

  const visibleRequests = useMemo(
    () => requests.filter(request => request.status === tab && !request.accepted && !request.reported),
    [requests, tab],
  );
  const selectedRequest = requests.find(request => request.id === selectedId) ?? visibleRequests[0] ?? requests[0];
  const spamCount = requests.filter(request => request.status === 'spam' && !request.accepted && !request.reported).length;
  const requestCount = requests.filter(request => request.status === 'requests' && !request.accepted && !request.reported).length;

  function markRequest(id: number, field: 'accepted' | 'reported') {
    setRequests(prev => prev.map(request => request.id === id ? { ...request, [field]: true } : request));
  }

  function clearAllSpam() {
    setRequests(prev => prev.map(request => request.status === 'spam' ? { ...request, reported: true } : request));
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!content) return;
    setDraft('');

    const res = await fetch(`/api/direct-messages/${selectedId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
      body: JSON.stringify({ content }),
    });

    if (res.ok) {
      const data = await res.json();
      setMessages(prev => [...prev, data.message as ApiMessage]);
    } else {
      const tempMsg: ApiMessage = {
        id: Date.now() * -1,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId,
        userName: 'You',
        userAvatar: null,
      };
      setMessages(prev => [...prev, tempMsg]);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#313338] text-[#f2f3f5]">
      <ServerRail servers={servers} onSelectServer={id => router.push(`/channels/${id}`)} />
      <DirectSidebar requestCount={requestCount + spamCount} />

      <section className="flex min-w-0 flex-1 flex-col">
        <TopBar tab={tab} setTab={setTab} requestCount={requestCount} spamCount={spamCount} />

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 border-r border-black/40 bg-[#313338]">
            <div className="px-8 py-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#b5bac1]">
                <span>{tab === 'spam' ? `Spam - ${spamCount}` : `Requests - ${requestCount}`}</span>
                {tab === 'spam' && (
                  <button onClick={clearAllSpam} className="font-medium normal-case text-[#00a8fc] hover:underline">
                    Clear All
                  </button>
                )}
              </div>

              <div className="mt-4 border-t border-black/30">
                {visibleRequests.map(request => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    selected={selectedRequest.id === request.id}
                    onSelect={() => setSelectedId(request.id)}
                    onAccept={() => markRequest(request.id, 'accepted')}
                    onReport={() => markRequest(request.id, 'reported')}
                  />
                ))}

                {visibleRequests.length === 0 && (
                  <div className="flex h-80 items-center justify-center text-sm text-[#949ba4]">
                    No {tab === 'spam' ? 'spam' : 'message'} requests.
                  </div>
                )}
              </div>
            </div>
          </main>

          <MessagePreview
            request={selectedRequest}
            messages={messages}
            loadingMessages={loadingMessages}
            userId={userId}
            draft={draft}
            onDraftChange={setDraft}
            onSend={sendMessage}
            onAccept={() => markRequest(selectedRequest.id, 'accepted')}
            onReport={() => markRequest(selectedRequest.id, 'reported')}
          />
        </div>
      </section>
    </div>
  );
}

function ServerRail({
  servers,
  onSelectServer,
}: {
  servers: Server[];
  onSelectServer: (id: number) => void;
}) {
  const router = useRouter();

  return (
    <aside className="hidden w-[72px] flex-col items-center gap-2 bg-[#1e1f22] py-3 md:flex overflow-y-auto no-scrollbar">
      {/* Home button – active on DM page */}
      <div className="relative flex w-full items-center justify-center">
        <span className="absolute left-0 h-10 w-1 rounded-r-full bg-white" />
        <button
          title="Direct Messages"
          className="flex h-12 w-12 items-center justify-center rounded-[30%] text-white transition-all"
          style={{ background: '#5865f2' }}
        >
          <Home size={22} />
        </button>
      </div>

      {servers.length > 0 && <Divider />}

      {servers.map(server => {
        const initials = server.name.slice(0, 2).toUpperCase();
        return (
          <ServerIconButton
            key={server.id}
            title={server.name}
            onClick={() => onSelectServer(server.id)}
          >
            {server.icon
              ? <img src={server.icon} alt={server.name} className="w-full h-full object-cover rounded-[inherit]" />
              : <span className="text-xs font-bold text-[#dcddde]">{initials}</span>
            }
          </ServerIconButton>
        );
      })}

      <Divider />

      <ServerIconButton title="Add a Server" onClick={() => router.push('/')}>
        <Plus size={22} strokeWidth={2.5} className="text-[#23a55a] group-hover:text-white" />
      </ServerIconButton>

      <ServerIconButton title="Explore Servers" onClick={() => router.push('/')}>
        <Compass size={20} strokeWidth={2} className="text-[#23a55a] group-hover:text-white" />
      </ServerIconButton>
    </aside>
  );
}

function ServerIconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group relative flex w-full items-center justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        title={title}
        onClick={onClick}
        className="flex h-12 w-12 items-center justify-center overflow-hidden transition-all duration-150"
        style={{
          background: '#36393f',
          borderRadius: hovered ? '30%' : '50%',
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        {children}
      </button>
      <Tooltip label={title} />
    </div>
  );
}

function Tooltip({ label }: { label: string }) {
  return (
    <div
      className="pointer-events-none absolute left-[68px] z-50 whitespace-nowrap rounded-[4px] px-3 py-1.5 text-sm font-semibold opacity-0 shadow-xl [.group:hover_&]:opacity-100"
      style={{ background: '#111214', color: '#F2F3F5' }}
    >
      {label}
      <div
        className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent"
        style={{ borderRightColor: '#111214' }}
      />
    </div>
  );
}

function Divider() {
  return (
    <div className="flex w-full justify-center px-2">
      <div className="h-px w-8" style={{ background: '#35363c' }} />
    </div>
  );
}

function DirectSidebar({ requestCount }: { requestCount: number }) {
  return (
    <aside className="hidden w-60 flex-shrink-0 flex-col bg-[#2b2d31] md:flex">
      <div className="p-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#949ba4]" size={14} />
          <input
            className="h-8 w-full rounded bg-[#1e1f22] pl-8 pr-3 text-sm text-[#dbdee1] outline-none placeholder:text-[#949ba4]"
            placeholder="Find or start a conversation"
          />
        </label>
      </div>

      <nav className="space-y-1 px-2">
        <SideNavItem icon={<UsersRound size={20} />} label="Friends" />
        <SideNavItem icon={<Gamepad2 size={20} />} label="Nitro" />
        <SideNavItem icon={<Mail size={20} />} label="Message Requests" active badge={requestCount} />
      </nav>

      <div className="mt-6 flex items-center justify-between px-4 text-xs font-bold uppercase tracking-wide text-[#b5bac1]">
        <span>Direct Messages</span>
        <button className="text-[#949ba4] hover:text-[#dbdee1]" title="Create DM">
          <MessageSquarePlus size={15} />
        </button>
      </div>

      <div className="mt-2 space-y-1 px-2">
        {directMessages.map(dm => (
          <button
            key={dm.id}
            className="flex h-[46px] w-full items-center gap-3 rounded px-2 text-left transition-colors hover:bg-[#35373c]"
          >
            <Avatar initials={dm.initials} accent={dm.accent} size="sm" online={dm.status !== '9 Members'} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#b5bac1]">{dm.name}</p>
              <p className="truncate text-xs text-[#949ba4]">{dm.status}</p>
            </div>
            {dm.unread && <span className="h-2 w-2 rounded-full bg-[#f2f3f5]" />}
          </button>
        ))}
      </div>
    </aside>
  );
}

function SideNavItem({
  icon,
  label,
  active,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
}) {
  return (
    <button
      className="flex h-10 w-full items-center gap-3 rounded px-3 text-left text-[#b5bac1] transition-colors hover:bg-[#35373c] hover:text-[#f2f3f5]"
      style={{ background: active ? '#404249' : 'transparent', color: active ? '#f2f3f5' : undefined }}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      {!!badge && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f23f43] px-1.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

function TopBar({
  tab,
  setTab,
  requestCount,
  spamCount,
}: {
  tab: RequestStatus;
  setTab: (value: RequestStatus) => void;
  requestCount: number;
  spamCount: number;
}) {
  return (
    <header className="flex h-12 flex-shrink-0 items-center border-b border-black/40 bg-[#313338] px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Mail size={20} className="text-[#b5bac1]" />
        <span className="hidden font-semibold text-[#f2f3f5] sm:block">Message Requests</span>
        <div className="mx-2 hidden h-6 w-px bg-black/40 sm:block" />
        <TabButton active={tab === 'requests'} onClick={() => setTab('requests')}>
          Requests {requestCount > 0 ? `(${requestCount})` : ''}
        </TabButton>
        <TabButton active={tab === 'spam'} onClick={() => setTab('spam')}>
          Spam ({spamCount})
        </TabButton>
      </div>
      <div className="flex items-center gap-5 text-[#b5bac1]">
        <Download size={20} className="text-[#23a55a]" />
        <Inbox size={20} />
        <CircleHelp size={20} />
      </div>
    </header>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[#3b3d44]"
      style={{ background: active ? '#404249' : 'transparent', color: active ? '#f2f3f5' : '#b5bac1' }}
    >
      {children}
    </button>
  );
}

function RequestRow({
  request,
  selected,
  onSelect,
  onAccept,
  onReport,
}: {
  request: MessageRequest;
  selected: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onReport: () => void;
}) {
  return (
    <div
      className="flex min-h-[62px] items-center gap-3 border-b border-black/30 px-0 py-3 transition-colors hover:bg-[#35373c]"
      style={{ background: selected ? '#35373c' : 'transparent' }}
    >
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar initials={request.initials} accent={request.accent} online size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <p className="truncate text-base font-medium text-[#f2f3f5]">{request.title}</p>
            <p className="truncate text-xs text-[#949ba4]">{request.time}</p>
          </div>
          <p className="truncate text-sm text-[#b5bac1]">{request.preview}</p>
        </div>
      </button>
      <button onClick={onReport} className="rounded bg-[#da373c] px-5 py-2 text-sm font-semibold text-white hover:bg-[#a12828]">
        Report
      </button>
      <button onClick={onAccept} className="rounded bg-[#4e5058] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5c5f68]">
        Accept DM
      </button>
    </div>
  );
}

function MessagePreview({
  request,
  messages,
  loadingMessages,
  userId,
  draft,
  onDraftChange,
  onSend,
  onAccept,
  onReport,
}: {
  request: MessageRequest;
  messages: ApiMessage[];
  loadingMessages: boolean;
  userId: number;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onAccept: () => void;
  onReport: () => void;
}) {
  return (
    <aside className="hidden w-[450px] flex-shrink-0 flex-col bg-[#313338] xl:flex">
      <div className="flex h-12 items-center gap-3 border-b border-black/40 px-4">
        <AtSign size={22} className="text-[#949ba4]" />
        <h2 className="min-w-0 flex-1 truncate font-semibold text-[#f2f3f5]">{request.name}</h2>
        <Bell size={20} className="text-[#b5bac1]" />
        <X size={24} className="text-[#b5bac1]" />
      </div>

      <div className="border-b border-black/20 px-4 py-3 text-sm text-[#b5bac1]">
        <div className="flex items-center justify-between gap-4">
          <p>Was this message spam? Let us know and help improve filtering.</p>
          <button className="rounded bg-[#5865f2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4752c4]">
            Mark not spam
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end px-4 pb-6">
        <div className="mb-8">
          <Avatar initials={request.initials} accent={request.accent} size="xl" />
          <h1 className="mt-5 text-3xl font-bold leading-tight text-white">{request.name}</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#b5bac1]">
            This is the beginning of your direct message history with @{request.handle}.
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={onAccept} className="rounded bg-[#5865f2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4752c4]">
              Accept DM
            </button>
            <button className="rounded bg-[#4e5058] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5c5f68]">
              Ignore
            </button>
            <button onClick={onReport} className="rounded bg-[#da373c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#a12828]">
              Report
            </button>
          </div>
        </div>

        <div className="space-y-4 border-t border-black/30 pt-5">
          {loadingMessages && (
            <div className="flex items-center justify-center py-4">
              <span className="text-xs text-[#949ba4]">Loading messages…</span>
            </div>
          )}
          {!loadingMessages && messages.map((message) => {
            const isMe = message.userId === userId;
            const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={message.id} className="flex gap-3">
                <Avatar
                  initials={isMe ? 'YO' : request.initials}
                  accent={isMe ? '#5865f2' : request.accent}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#f2f3f5]">
                    {message.userName} <span className="text-xs font-normal text-[#949ba4]">{time}</span>
                  </p>
                  <p className="text-sm leading-relaxed text-[#dbdee1]">{message.content}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex h-11 items-center gap-3 rounded-lg bg-[#383a40] px-3">
          <button className="flex h-5 w-5 items-center justify-center rounded-full bg-[#b5bac1] text-[#383a40]" title="Add attachment">
            <MessageSquarePlus size={13} />
          </button>
          <input
            value={draft}
            onChange={event => onDraftChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') onSend();
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-[#dbdee1] outline-none placeholder:text-[#949ba4]"
            placeholder={`Message ${request.name}`}
          />
          <button onClick={onSend} className="text-[#b5bac1] hover:text-[#f2f3f5]" title="Send message">
            <UserRound size={20} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function Avatar({
  initials,
  accent,
  size,
  online,
}: {
  initials: string;
  accent: string;
  size: 'sm' | 'md' | 'xl';
  online?: boolean;
}) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-xs',
    xl: 'h-20 w-20 text-xl',
  };

  return (
    <div className="relative flex-shrink-0">
      <div
        className={`flex items-center justify-center rounded-full font-bold text-white ${sizes[size]}`}
        style={{ background: `linear-gradient(135deg, ${accent}, #2b2d31)` }}
      >
        {initials}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#313338] bg-[#23a55a]" />
      )}
    </div>
  );
}
