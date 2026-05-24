'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AtSign,
  Bell,
  Check,
  CircleHelp,
  Compass,
  Download,
  Gamepad2,
  Home,
  Inbox,
  Mail,
  MessageSquarePlus,
  Phone,
  Plus,
  Search,
  Send,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import VoiceChannel from '@/components/VoiceChannel';
import { getPusherClient } from '@/lib/pusher-client';

type RequestStatus = 'requests' | 'spam';
type View = 'friends' | 'requests' | 'dm';

const DM_CALL_OFFSET = 1_000_000;
const ACCENTS = ['#5865f2', '#23a55a', '#fee75c', '#eb459e', '#ef4444', '#3ba55c', '#faa61a'];

function accentFor(id: number) {
  return ACCENTS[Math.abs(id) % ACCENTS.length];
}

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

interface Server {
  id: number;
  name: string;
  icon: string | null;
  ownerId: number;
}

interface ConvMember {
  id: number;
  name: string;
  avatar: string | null;
  status: string;
}

interface Conversation {
  id: number;
  type: string;
  name: string | null;
  members: ConvMember[];
  lastMessage: { content: string; createdAt: string } | null;
}

interface Friend {
  friendshipId: number;
  userId: number;
  name: string;
  avatar: string | null;
  status: string;
}

interface FriendsState {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
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

const requestsSeed: MessageRequest[] = [];

function convDisplay(conv: Conversation, userId: number) {
  if (conv.type === 'dm') {
    const other = conv.members.find((m) => m.id !== userId) ?? conv.members[0];
    const name = other?.name ?? 'Direct Message';
    return {
      name,
      initials: name.slice(0, 2).toUpperCase(),
      accent: accentFor(other?.id ?? conv.id),
      status: other?.status ?? 'offline',
      isGroup: false,
    };
  }
  const name = conv.name ?? (conv.members.filter((m) => m.id !== userId).map((m) => m.name).join(', ') || 'Group');
  return {
    name,
    initials: name.slice(0, 2).toUpperCase(),
    accent: accentFor(conv.id),
    status: `${conv.members.length} Members`,
    isGroup: true,
  };
}

export default function DirectMessagesPage({ userId }: { userId: number }) {
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<FriendsState>({ friends: [], incoming: [], outgoing: [] });
  const [myName, setMyName] = useState('You');

  const [view, setView] = useState<View>('friends');
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);

  const [tab, setTab] = useState<RequestStatus>('spam');
  const [requests, setRequests] = useState(requestsSeed);
  const [selectedRequestId, setSelectedRequestId] = useState(3);

  const refreshConversations = useCallback(() => {
    fetch('/api/direct-messages', { headers: { 'x-user-id': String(userId) } })
      .then((res) => (res.ok ? res.json() : { conversations: [] }))
      .then((data) => setConversations(data.conversations ?? []))
      .catch(() => setConversations([]));
  }, [userId]);

  const refreshFriends = useCallback(() => {
    fetch('/api/friends', { headers: { 'x-user-id': String(userId) } })
      .then((res) => (res.ok ? res.json() : { friends: [], incoming: [], outgoing: [] }))
      .then((data) => setFriends({ friends: data.friends ?? [], incoming: data.incoming ?? [], outgoing: data.outgoing ?? [] }))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    fetch('/api/servers', { headers: { 'x-user-id': String(userId) } })
      .then((res) => (res.ok ? res.json() : { servers: [] }))
      .then((data) => setServers(data.servers ?? []))
      .catch(() => setServers([]));

    fetch('/api/profile/me', { headers: { 'x-user-id': String(userId) } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.user?.name) setMyName(data.user.name); })
      .catch(() => {});

    refreshConversations();
    refreshFriends();
  }, [userId, refreshConversations, refreshFriends]);

  const openDm = useCallback(
    async (targetUserId: number) => {
      const res = await fetch('/api/direct-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { conversationId: number };
      refreshConversations();
      setSelectedConvId(data.conversationId);
      setView('dm');
    },
    [userId, refreshConversations],
  );

  async function addFriend(targetUserId: number): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
      body: JSON.stringify({ targetUserId }),
    });
    refreshFriends();
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? 'Could not send request' };
  }

  async function acceptFriend(friendshipId: number) {
    await fetch(`/api/friends/${friendshipId}`, {
      method: 'PATCH',
      headers: { 'x-user-id': String(userId) },
    });
    refreshFriends();
  }

  async function removeFriend(friendshipId: number) {
    await fetch(`/api/friends/${friendshipId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': String(userId) },
    });
    refreshFriends();
  }

  const visibleRequests = useMemo(
    () => requests.filter((request) => request.status === tab && !request.accepted && !request.reported),
    [requests, tab],
  );
  const selectedRequest = requests.find((r) => r.id === selectedRequestId) ?? visibleRequests[0] ?? requests[0];
  const spamCount = requests.filter((r) => r.status === 'spam' && !r.accepted && !r.reported).length;
  const requestCount = requests.filter((r) => r.status === 'requests' && !r.accepted && !r.reported).length;
  const pendingTotal = requestCount + spamCount + friends.incoming.length;

  const selectedConv = conversations.find((c) => c.id === selectedConvId) ?? null;

  function markRequest(id: number, field: 'accepted' | 'reported') {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: true } : r)));
  }

  function clearAllSpam() {
    setRequests((prev) => prev.map((r) => (r.status === 'spam' ? { ...r, reported: true } : r)));
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#313338] text-[#f2f3f5]">
      <ServerRail servers={servers} onSelectServer={(id) => router.push(`/channels/${id}`)} />
      <DirectSidebar
        userId={userId}
        view={view}
        conversations={conversations}
        selectedConvId={selectedConvId}
        requestBadge={pendingTotal}
        onShowFriends={() => setView('friends')}
        onShowRequests={() => setView('requests')}
        onSelectConv={(id) => { setSelectedConvId(id); setView('dm'); }}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        {view === 'friends' && (
          <FriendsPanel
            userId={userId}
            friends={friends}
            onAddFriend={addFriend}
            onAccept={acceptFriend}
            onRemove={removeFriend}
            onMessage={openDm}
          />
        )}

        {view === 'dm' && selectedConv && (
          <ConversationView
            key={selectedConv.id}
            conv={selectedConv}
            userId={userId}
            myName={myName}
            onSent={refreshConversations}
          />
        )}

        {view === 'dm' && !selectedConv && (
          <div className="flex flex-1 items-center justify-center text-sm text-[#949ba4]">
            Select a conversation.
          </div>
        )}

        {view === 'requests' && (
          <>
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
                    {visibleRequests.map((request) => (
                      <RequestRow
                        key={request.id}
                        request={request}
                        selected={selectedRequest.id === request.id}
                        onSelect={() => setSelectedRequestId(request.id)}
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

              {selectedRequest ? (
                <RequestPreview
                  request={selectedRequest}
                  onAccept={() => markRequest(selectedRequest.id, 'accepted')}
                  onReport={() => markRequest(selectedRequest.id, 'reported')}
                />
              ) : (
                <aside className="hidden w-[450px] flex-shrink-0 flex-col items-center justify-center bg-[#313338] text-sm text-[#949ba4] xl:flex">
                  No requests to show.
                </aside>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ConversationView({
  conv,
  userId,
  myName,
  onSent,
}: {
  conv: Conversation;
  userId: number;
  myName: string;
  onSent: () => void;
}) {
  const display = convDisplay(conv, userId);
  const other = conv.members.find((m) => m.id !== userId);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [inCall, setInCall] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    fetch(`/api/direct-messages/${conv.id}`, { headers: { 'x-user-id': String(userId) } })
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data) => setMessages([...(data.messages ?? [])].reverse()))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conv.id, userId]);

  useEffect(() => {
    let pusher: ReturnType<typeof getPusherClient> | null = null;
    try {
      pusher = getPusherClient(userId);
      const ch = pusher.subscribe(`dm-${conv.id}`);
      ch.bind('dm-message', (msg: ApiMessage) => {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      });
    } catch { /* Pusher not configured */ }
    return () => {
      try { pusher?.unsubscribe(`dm-${conv.id}`); } catch { /* ignore */ }
    };
  }, [conv.id, userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    const res = await fetch(`/api/direct-messages/${conv.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': String(userId) },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      onSent();
    }
  }

  return (
    <>
      <header className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-black/40 bg-[#313338] px-4">
        <AtSign size={22} className="text-[#949ba4]" />
        <h2 className="min-w-0 flex-1 truncate font-semibold text-[#f2f3f5]">{display.name}</h2>
        <button
          onClick={() => setInCall((v) => !v)}
          title={inCall ? 'End call' : 'Start voice call'}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium"
          style={{ color: inCall ? '#f23f43' : '#b5bac1' }}
        >
          <Phone size={20} />
        </button>
        <Bell size={20} className="text-[#b5bac1]" />
      </header>

      {inCall ? (
        <VoiceChannel
          channelId={DM_CALL_OFFSET + conv.id}
          channelName={`Call with ${display.name}`}
          userId={userId}
          userName={myName}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mb-6">
              <Avatar initials={display.initials} accent={display.accent} size="xl" />
              <h1 className="mt-4 text-3xl font-bold text-white">{display.name}</h1>
              <p className="mt-2 text-sm text-[#b5bac1]">
                This is the beginning of your direct message history with {display.name}.
              </p>
            </div>

            {loading && <p className="py-4 text-center text-xs text-[#949ba4]">Loading messages…</p>}

            <div className="space-y-3">
              {messages.map((message) => {
                const isMe = message.userId === userId;
                const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={message.id} className="flex gap-3">
                    <Avatar
                      initials={(isMe ? myName : message.userName).slice(0, 2).toUpperCase()}
                      accent={isMe ? '#5865f2' : display.accent}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#f2f3f5]">
                        {isMe ? myName : message.userName}{' '}
                        <span className="text-xs font-normal text-[#949ba4]">{time}</span>
                      </p>
                      <p className="text-sm leading-relaxed text-[#dbdee1]">{message.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-4 pb-6">
            <div className="flex h-11 items-center gap-3 rounded-lg bg-[#383a40] px-3">
              <button className="flex h-5 w-5 items-center justify-center rounded-full bg-[#b5bac1] text-[#383a40]" title="Add attachment">
                <Plus size={14} />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                className="min-w-0 flex-1 bg-transparent text-sm text-[#dbdee1] outline-none placeholder:text-[#949ba4]"
                placeholder={`Message ${other?.name ?? display.name}`}
              />
              <button onClick={send} className="text-[#b5bac1] hover:text-[#f2f3f5]" title="Send message">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FriendsPanel({
  userId,
  friends,
  onAddFriend,
  onAccept,
  onRemove,
  onMessage,
}: {
  userId: number;
  friends: FriendsState;
  onAddFriend: (targetUserId: number) => Promise<{ ok: boolean; error?: string }>;
  onAccept: (id: number) => void;
  onRemove: (id: number) => void;
  onMessage: (userId: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ConvMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [feedback, setFeedback] = useState('');

  const knownIds = useMemo(() => {
    const ids = new Set<number>();
    [...friends.friends, ...friends.incoming, ...friends.outgoing].forEach((f) => ids.add(f.userId));
    return ids;
  }, [friends]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/users?q=${encodeURIComponent(q)}`, { headers: { 'x-user-id': String(userId) } })
        .then((res) => (res.ok ? res.json() : { users: [] }))
        .then((data) => setResults(data.users ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, userId]);

  async function handleAdd(target: ConvMember) {
    const result = await onAddFriend(target.id);
    setFeedback(result.ok ? `Friend request sent to ${target.name}.` : (result.error ?? 'Could not send request'));
    setQuery('');
    setResults([]);
  }

  return (
    <>
      <header className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-black/40 px-4">
        <UsersRound size={20} className="text-[#b5bac1]" />
        <span className="font-semibold text-[#f2f3f5]">Friends</span>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-8 max-w-xl">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#b5bac1]">Add Friend</h3>
          <p className="mt-1 text-sm text-[#949ba4]">Search by name or email, then send a request.</p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#949ba4]" size={16} />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setFeedback(''); }}
              placeholder="Search for people"
              className="h-10 w-full rounded-lg border border-black/40 bg-[#1e1f22] pl-9 pr-3 text-sm text-[#dbdee1] outline-none placeholder:text-[#949ba4]"
            />
          </div>

          {feedback && <p className="mt-2 text-xs text-[#23a55a]">{feedback}</p>}

          {query.trim() && (
            <div className="mt-2 overflow-hidden rounded-lg border border-black/40 bg-[#2b2d31]">
              {searching && <p className="px-3 py-3 text-sm text-[#949ba4]">Searching…</p>}
              {!searching && results.length === 0 && (
                <p className="px-3 py-3 text-sm text-[#949ba4]">No users found.</p>
              )}
              {results.map((u) => {
                const known = knownIds.has(u.id);
                return (
                  <div key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-[#35373c]">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                    ) : (
                      <Avatar initials={u.name.slice(0, 2).toUpperCase()} accent={accentFor(u.id)} size="sm" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-[#dbdee1]">{u.name}</span>
                    <button
                      onClick={() => handleAdd(u)}
                      disabled={known}
                      className="flex items-center gap-1.5 rounded bg-[#5865f2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4752c4] disabled:cursor-default disabled:bg-[#4e5058] disabled:opacity-70"
                    >
                      <UserPlus size={13} /> {known ? 'Added' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {friends.incoming.length > 0 && (
          <FriendSection title={`Pending — ${friends.incoming.length}`}>
            {friends.incoming.map((f) => (
              <FriendRow key={f.friendshipId} friend={f}>
                <span className="mr-2 text-xs text-[#949ba4]">Incoming request</span>
                <IconBtn title="Accept" onClick={() => onAccept(f.friendshipId)} color="#23a55a">
                  <Check size={18} />
                </IconBtn>
                <IconBtn title="Decline" onClick={() => onRemove(f.friendshipId)} color="#f23f43">
                  <X size={18} />
                </IconBtn>
              </FriendRow>
            ))}
          </FriendSection>
        )}

        {friends.outgoing.length > 0 && (
          <FriendSection title={`Outgoing — ${friends.outgoing.length}`}>
            {friends.outgoing.map((f) => (
              <FriendRow key={f.friendshipId} friend={f}>
                <span className="mr-2 text-xs text-[#949ba4]">Pending…</span>
                <IconBtn title="Cancel" onClick={() => onRemove(f.friendshipId)} color="#f23f43">
                  <X size={18} />
                </IconBtn>
              </FriendRow>
            ))}
          </FriendSection>
        )}

        <FriendSection title={`All Friends — ${friends.friends.length}`}>
          {friends.friends.length === 0 && (
            <p className="py-6 text-sm text-[#949ba4]">No friends yet. Add someone above to get started.</p>
          )}
          {friends.friends.map((f) => (
            <FriendRow key={f.friendshipId} friend={f}>
              <IconBtn title="Message" onClick={() => onMessage(f.userId)} color="#b5bac1">
                <MessageSquarePlus size={18} />
              </IconBtn>
              <IconBtn title="Remove friend" onClick={() => onRemove(f.friendshipId)} color="#f23f43">
                <X size={18} />
              </IconBtn>
            </FriendRow>
          ))}
        </FriendSection>
      </div>
    </>
  );
}

function FriendSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 border-b border-black/30 pb-2 text-xs font-bold uppercase tracking-wide text-[#b5bac1]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FriendRow({ friend, children }: { friend: Friend; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded px-2 py-2 hover:bg-[#35373c]">
      <Avatar initials={friend.name.slice(0, 2).toUpperCase()} accent={accentFor(friend.userId)} size="md" online={friend.status === 'online'} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#f2f3f5]">{friend.name}</p>
        <p className="truncate text-xs text-[#949ba4] capitalize">{friend.status}</p>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function IconBtn({ title, onClick, color, children }: { title: string; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2b2d31] hover:bg-[#1e1f22]"
      style={{ color }}
    >
      {children}
    </button>
  );
}

function ServerRail({ servers, onSelectServer }: { servers: Server[]; onSelectServer: (id: number) => void }) {
  const router = useRouter();
  return (
    <aside className="hidden w-[72px] flex-col items-center gap-2 bg-[#1e1f22] py-3 md:flex overflow-y-auto no-scrollbar">
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

      {servers.map((server) => {
        const initials = server.name.slice(0, 2).toUpperCase();
        return (
          <ServerIconButton key={server.id} title={server.name} onClick={() => onSelectServer(server.id)}>
            {server.icon ? (
              <img src={server.icon} alt={server.name} className="w-full h-full object-cover rounded-[inherit]" />
            ) : (
              <span className="text-xs font-bold text-[#dcddde]">{initials}</span>
            )}
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

function ServerIconButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
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
      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent" style={{ borderRightColor: '#111214' }} />
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

function DirectSidebar({
  userId,
  view,
  conversations,
  selectedConvId,
  requestBadge,
  onShowFriends,
  onShowRequests,
  onSelectConv,
}: {
  userId: number;
  view: View;
  conversations: Conversation[];
  selectedConvId: number | null;
  requestBadge: number;
  onShowFriends: () => void;
  onShowRequests: () => void;
  onSelectConv: (id: number) => void;
}) {
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
        <SideNavItem icon={<UsersRound size={20} />} label="Friends" active={view === 'friends'} onClick={onShowFriends} />
        <SideNavItem icon={<Gamepad2 size={20} />} label="Nitro" onClick={() => {}} />
        <SideNavItem icon={<Mail size={20} />} label="Message Requests" active={view === 'requests'} badge={requestBadge} onClick={onShowRequests} />
      </nav>

      <div className="mt-6 flex items-center justify-between px-4 text-xs font-bold uppercase tracking-wide text-[#b5bac1]">
        <span>Direct Messages</span>
        <button onClick={onShowFriends} className="text-[#949ba4] hover:text-[#dbdee1]" title="Create DM">
          <MessageSquarePlus size={15} />
        </button>
      </div>

      <div className="mt-2 flex-1 space-y-1 overflow-y-auto px-2">
        {conversations.length === 0 && (
          <p className="px-2 py-3 text-xs text-[#949ba4]">No conversations yet. Message a friend to start one.</p>
        )}
        {conversations.map((conv) => {
          const display = convDisplay(conv, userId);
          return (
            <button
              key={conv.id}
              onClick={() => onSelectConv(conv.id)}
              className="flex h-[46px] w-full items-center gap-3 rounded px-2 text-left transition-colors hover:bg-[#35373c]"
              style={{ background: selectedConvId === conv.id ? '#35373c' : 'transparent' }}
            >
              <Avatar initials={display.initials} accent={display.accent} size="sm" online={display.status === 'online'} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#dbdee1]">{display.name}</p>
                <p className="truncate text-xs text-[#949ba4]">
                  {conv.lastMessage ? conv.lastMessage.content : display.isGroup ? display.status : 'Start chatting'}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function SideNavItem({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
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

function RequestPreview({
  request,
  onAccept,
  onReport,
}: {
  request: MessageRequest;
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
      {online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#313338] bg-[#23a55a]" />}
    </div>
  );
}
