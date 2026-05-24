'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BadgeCheck,
  Bot,
  Crown,
  Gamepad2,
  Megaphone,
  MessageCircle,
  Palette,
  Plus,
  Radio,
  Send,
  Shield,
  Sparkles,
  Sticker,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';

interface Server {
  id: number;
  name: string;
  icon: string | null;
  ownerId: number;
}

interface Channel {
  id: number;
  name: string;
  type: string;
}

interface Props {
  server: Server | null;
  activeChannel: Channel | null;
  userId: number;
  userName: string;
}

type Tab = 'dms' | 'community' | 'studio' | 'profile';

interface Conversation {
  id: number;
  name: string;
  type: 'dm' | 'group';
  members: string[];
  messages: { author: string; content: string; time: string }[];
}

const tabItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dms', label: 'DMs', icon: <MessageCircle size={15} /> },
  { id: 'community', label: 'Server', icon: <Shield size={15} /> },
  { id: 'studio', label: 'Live', icon: <Radio size={15} /> },
  { id: 'profile', label: 'Profile', icon: <UserRound size={15} /> },
];

const defaultConversations: Conversation[] = [
  {
    id: 1,
    name: 'Maya',
    type: 'dm',
    members: ['Maya'],
    messages: [
      { author: 'Maya', content: 'I pushed the lobby copy into review.', time: '10:16' },
      { author: 'You', content: 'Nice, I will check it after standup.', time: '10:18' },
    ],
  },
  {
    id: 2,
    name: 'Launch group',
    type: 'group',
    members: ['Noah', 'Iris', 'Ren', 'Kai'],
    messages: [
      { author: 'Noah', content: 'Streaming the build in voice after lunch.', time: '09:42' },
      { author: 'Iris', content: 'I can bring the checklist.', time: '09:45' },
    ],
  },
];

export default function FeatureHub({ server, activeChannel, userId, userName }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('dms');

  return (
    <aside
      className="hidden xl:flex w-[360px] min-w-[360px] flex-col border-l"
      style={{ background: 'var(--bg-channels)', borderColor: 'var(--border)' }}
    >
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Command Center
            </p>
            <h2 className="truncate text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
              {server?.name ?? 'Workspace'}
            </h2>
          </div>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            <Sparkles size={16} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl p-1" style={{ background: 'var(--bg-sidebar)' }}>
          {tabItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs transition-colors"
              style={{
                background: activeTab === item.id ? 'var(--bg-elevated)' : 'transparent',
                color: activeTab === item.id ? 'var(--text-1)' : 'var(--text-3)',
              }}
              title={item.label}
            >
              {item.icon}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === 'dms' && <DirectMessagesPanel userName={userName} />}
        {activeTab === 'community' && <CommunityPanel server={server} activeChannel={activeChannel} />}
        {activeTab === 'studio' && <StudioPanel activeChannel={activeChannel} />}
        {activeTab === 'profile' && <ProfilePanel userId={userId} userName={userName} server={server} />}
      </div>
    </aside>
  );
}

function DirectMessagesPanel({ userName }: { userName: string }) {
  const [conversations, setConversations] = useState(defaultConversations);
  const [selectedId, setSelectedId] = useState(1);
  const [draft, setDraft] = useState('');
  const selected = conversations.find(conversation => conversation.id === selectedId) ?? conversations[0];

  function sendMessage() {
    const content = draft.trim();
    if (!content) return;

    setConversations(prev => prev.map(conversation => (
      conversation.id === selected.id
        ? {
            ...conversation,
            messages: [
              ...conversation.messages,
              { author: userName || 'You', content, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
            ],
          }
        : conversation
    )));
    setDraft('');
  }

  function createGroup() {
    const nextId = Math.max(...conversations.map(conversation => conversation.id)) + 1;
    setConversations(prev => [
      ...prev,
      {
        id: nextId,
        name: `Group ${nextId}`,
        type: 'group',
        members: ['Maya', 'Noah', 'Iris'],
        messages: [{ author: 'System', content: 'Group chat created.', time: 'now' }],
      },
    ]);
    setSelectedId(nextId);
  }

  return (
    <PanelStack>
      <div className="flex items-center justify-between">
        <SectionTitle icon={<MessageCircle size={15} />} title="Direct Messages" />
        <button
          onClick={createGroup}
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06]"
          style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
          title="New group"
        >
          <Plus size={15} />
        </button>
      </div>

      <div className="grid grid-cols-[112px_1fr] gap-2">
        <div className="space-y-1">
          {conversations.map(conversation => (
            <button
              key={conversation.id}
              onClick={() => setSelectedId(conversation.id)}
              className="w-full rounded-lg px-2 py-2 text-left text-xs transition-colors"
              style={{
                background: selectedId === conversation.id ? 'var(--bg-elevated)' : 'transparent',
                color: selectedId === conversation.id ? 'var(--text-1)' : 'var(--text-2)',
              }}
            >
              <span className="block truncate font-semibold">{conversation.name}</span>
              <span className="block truncate" style={{ color: 'var(--text-3)' }}>
                {conversation.type === 'group' ? `${conversation.members.length + 1}/25` : '1-on-1'}
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-sidebar)' }}>
          <div className="border-b px-3 py-2" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{selected.name}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{selected.members.join(', ')}</p>
          </div>
          <div className="max-h-52 space-y-2 overflow-y-auto px-3 py-2">
            {selected.messages.map((message, index) => (
              <div key={`${message.time}-${index}`}>
                <p className="text-[11px] font-semibold" style={{ color: 'var(--text-2)' }}>
                  {message.author} <span style={{ color: 'var(--text-3)' }}>{message.time}</span>
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-1)' }}>{message.content}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t p-2" style={{ borderColor: 'var(--border)' }}>
            <input
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') sendMessage();
              }}
              className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 text-xs outline-none"
              style={{ color: 'var(--text-1)', border: '1px solid var(--border)' }}
              placeholder="Message"
            />
            <button
              onClick={sendMessage}
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: 'var(--accent)', color: '#fff' }}
              title="Send"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </PanelStack>
  );
}

function CommunityPanel({ server, activeChannel }: { server: Server | null; activeChannel: Channel | null }) {
  const [roles, setRoles] = useState([
    { name: 'Admin', color: '#f04747', permissions: ['Moderate', 'Manage roles', 'Broadcast'] },
    { name: 'Creator', color: '#7c6bff', permissions: ['Go Live', 'Soundboard', 'Emoji upload'] },
    { name: 'Member', color: '#23d18b', permissions: ['Chat', 'Voice', 'Threads'] },
  ]);
  const [rulesEnabled, setRulesEnabled] = useState(true);
  const [announcement, setAnnouncement] = useState('Patch notes are live in #updates');
  const [emojiName, setEmojiName] = useState('launch');
  const [assets, setAssets] = useState([':ship:', ':spark:', ':gg:']);

  const insights = [
    { label: 'Join rate', value: 74, detail: '+18%' },
    { label: 'Channel engagement', value: 62, detail: '12 active' },
    { label: 'Voice minutes', value: 48, detail: '6.4h' },
    { label: 'Onboarding completion', value: rulesEnabled ? 88 : 42, detail: rulesEnabled ? 'Rules gate' : 'Open' },
  ];

  function addRole() {
    setRoles(prev => [...prev, { name: `Role ${prev.length + 1}`, color: '#faa61a', permissions: ['Chat'] }]);
  }

  function addAsset() {
    const clean = emojiName.trim().replace(/\s+/g, '-');
    if (!clean) return;
    setAssets(prev => [...prev, `:${clean}:`]);
    setEmojiName('');
  }

  return (
    <PanelStack>
      <SectionTitle icon={<TrendingUp size={15} />} title="Server Insights" />
      <div className="grid grid-cols-2 gap-2">
        {insights.map(item => (
          <Metric key={item.label} label={item.label} value={item.value} detail={item.detail} />
        ))}
      </div>

      <PanelBlock>
        <div className="flex items-center justify-between gap-3">
          <SectionTitle icon={<Shield size={15} />} title="Roles" />
          <button
            onClick={addRole}
            className="rounded-lg px-2 py-1 text-xs"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            Add
          </button>
        </div>
        <div className="space-y-2">
          {roles.map(role => (
            <div key={role.name} className="rounded-lg p-2" style={{ background: 'var(--bg-sidebar)' }}>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: role.color }} />
                <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{role.name}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {role.permissions.map(permission => (
                  <span
                    key={permission}
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
                  >
                    {permission}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PanelBlock>

      <PanelBlock>
        <SectionTitle icon={<Megaphone size={15} />} title="Announcements" />
        <input
          value={announcement}
          onChange={event => setAnnouncement(event.target.value)}
          className="w-full rounded-lg bg-transparent px-3 py-2 text-xs outline-none"
          style={{ color: 'var(--text-1)', border: '1px solid var(--border)' }}
        />
        <p className="mt-2 text-[11px]" style={{ color: 'var(--text-3)' }}>
          Following {activeChannel?.name ?? 'updates'} across {server?.name ?? 'this server'}.
        </p>
      </PanelBlock>

      <PanelBlock>
        <SectionTitle icon={<Sticker size={15} />} title="Emoji & Stickers" />
        <div className="flex flex-wrap gap-1">
          {assets.map(asset => (
            <span key={asset} className="rounded-lg px-2 py-1 text-xs" style={{ background: 'var(--bg-sidebar)' }}>
              {asset}
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={emojiName}
            onChange={event => setEmojiName(event.target.value)}
            className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 text-xs outline-none"
            style={{ color: 'var(--text-1)', border: '1px solid var(--border)' }}
            placeholder="emoji-name"
          />
          <button onClick={addAsset} className="rounded-lg px-2 text-xs" style={{ background: 'var(--accent)', color: '#fff' }}>
            Save
          </button>
        </div>
      </PanelBlock>

      <PanelBlock>
        <div className="flex items-center justify-between">
          <SectionTitle icon={<BadgeCheck size={15} />} title="Onboarding" />
          <Toggle enabled={rulesEnabled} onClick={() => setRulesEnabled(prev => !prev)} />
        </div>
        <div className="mt-2 space-y-1 text-xs" style={{ color: 'var(--text-2)' }}>
          <p>Accept rules</p>
          <p>Select interests: games, design, voice</p>
        </div>
      </PanelBlock>
    </PanelStack>
  );
}

function StudioPanel({ activeChannel }: { activeChannel: Channel | null }) {
  const [liveSource, setLiveSource] = useState<'game' | 'app' | 'screen'>('screen');
  const [watchUrl, setWatchUrl] = useState('youtube.com/watch?v=team-sync');
  const [bots, setBots] = useState([
    { name: 'ModKit', category: 'Moderation', enabled: true },
    { name: 'TuneBox', category: 'Music', enabled: true },
    { name: 'MarketBot', category: 'Economy', enabled: false },
  ]);
  const [presence, setPresence] = useState('Steam: Stardew Valley');

  return (
    <PanelStack>
      <PanelBlock>
        <SectionTitle icon={<Radio size={15} />} title="Go Live" />
        <Segmented
          value={liveSource}
          options={[
            { value: 'game', label: 'Game' },
            { value: 'app', label: 'App' },
            { value: 'screen', label: 'Screen' },
          ]}
          onChange={value => setLiveSource(value as 'game' | 'app' | 'screen')}
        />
        <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>
            {activeChannel?.name ?? 'Voice channel'}
          </p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>
            Source: {liveSource}
          </p>
        </div>
      </PanelBlock>

      <PanelBlock>
        <SectionTitle icon={<Gamepad2 size={15} />} title="Activities" />
        <div className="grid grid-cols-2 gap-2">
          {['Chess', 'Poker Night', 'Watch Together', 'Sketch Heads'].map(activity => (
            <button
              key={activity}
              className="rounded-lg px-2 py-2 text-left text-xs transition-colors hover:bg-white/[0.06]"
              style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              {activity}
            </button>
          ))}
        </div>
        <input
          value={watchUrl}
          onChange={event => setWatchUrl(event.target.value)}
          className="mt-2 w-full rounded-lg bg-transparent px-3 py-2 text-xs outline-none"
          style={{ color: 'var(--text-1)', border: '1px solid var(--border)' }}
        />
      </PanelBlock>

      <PanelBlock>
        <SectionTitle icon={<Bot size={15} />} title="Bots" />
        <div className="space-y-2">
          {bots.map(bot => (
            <div key={bot.name} className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{bot.name}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{bot.category}</p>
              </div>
              <Toggle
                enabled={bot.enabled}
                onClick={() => setBots(prev => prev.map(item => item.name === bot.name ? { ...item, enabled: !item.enabled } : item))}
              />
            </div>
          ))}
        </div>
      </PanelBlock>

      <PanelBlock>
        <SectionTitle icon={<Activity size={15} />} title="Rich Presence" />
        <input
          value={presence}
          onChange={event => setPresence(event.target.value)}
          className="w-full rounded-lg bg-transparent px-3 py-2 text-xs outline-none"
          style={{ color: 'var(--text-1)', border: '1px solid var(--border)' }}
        />
      </PanelBlock>
    </PanelStack>
  );
}

function ProfilePanel({ userId, userName, server }: { userId: number; userName: string; server: Server | null }) {
  const [theme, setTheme] = useState('Nebula');
  const [about, setAbout] = useState('Building things with friends.');
  const [boosts, setBoosts] = useState(2);
  const [nitro, setNitro] = useState(true);
  const questProgress = useMemo(() => Math.min(100, 35 + boosts * 12), [boosts]);

  return (
    <PanelStack>
      <PanelBlock>
        <SectionTitle icon={<Palette size={15} />} title="Custom Profile" />
        <div
          className="rounded-xl p-3"
          style={{ background: 'linear-gradient(135deg, rgba(124,107,255,0.25), rgba(35,209,139,0.12))', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl font-bold text-white" style={{ background: 'var(--accent)' }}>
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{userName}</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>#{userId}</p>
            </div>
          </div>
          <textarea
            value={about}
            onChange={event => setAbout(event.target.value)}
            rows={2}
            className="mt-3 w-full resize-none rounded-lg bg-black/10 px-3 py-2 text-xs outline-none"
            style={{ color: 'var(--text-1)', border: '1px solid var(--border)' }}
          />
        </div>
        <Segmented
          value={theme}
          options={[
            { value: 'Nebula', label: 'Nebula' },
            { value: 'Mono', label: 'Mono' },
            { value: 'Aurora', label: 'Aurora' },
          ]}
          onChange={setTheme}
        />
      </PanelBlock>

      <PanelBlock>
        <div className="flex items-center justify-between">
          <SectionTitle icon={<Crown size={15} />} title="Nitro" />
          <Toggle enabled={nitro} onClick={() => setNitro(prev => !prev)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            'Larger uploads',
            'HD streaming',
            'Global emoji',
            'Profile effects',
          ].map(perk => (
            <div key={perk} className="rounded-lg p-2 text-[11px]" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-2)' }}>
              {perk}
            </div>
          ))}
        </div>
      </PanelBlock>

      <PanelBlock>
        <SectionTitle icon={<Sparkles size={15} />} title="Shop & Quests" />
        <Metric label="Quest progress" value={questProgress} detail="avatar frame" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {['Solar Ring', 'Pixel Banner', 'Crystal Badge', 'Wave Theme'].map(item => (
            <button
              key={item}
              className="rounded-lg p-2 text-left text-xs transition-colors hover:bg-white/[0.06]"
              style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              {item}
            </button>
          ))}
        </div>
      </PanelBlock>

      <PanelBlock>
        <SectionTitle icon={<Users size={15} />} title="Server Boosting" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{server?.name ?? 'Server'}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Audio quality, emoji slots, vanity URL</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setBoosts(prev => Math.max(0, prev - 1))}
              className="h-7 w-7 rounded-lg"
              style={{ border: '1px solid var(--border)', color: 'var(--text-2)' }}
            >
              -
            </button>
            <span className="w-6 text-center text-xs" style={{ color: 'var(--text-1)' }}>{boosts}</span>
            <button
              onClick={() => setBoosts(prev => prev + 1)}
              className="h-7 w-7 rounded-lg"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              +
            </button>
          </div>
        </div>
      </PanelBlock>
    </PanelStack>
  );
}

function PanelStack({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function PanelBlock({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      {children}
    </section>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span style={{ color: 'var(--accent)' }}>{icon}</span>
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>{title}</h3>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold" style={{ color: 'var(--text-2)' }}>{label}</p>
        <span className="text-[11px]" style={{ color: 'var(--accent)' }}>{detail}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-sidebar)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className="h-full rounded-full"
          style={{ background: 'var(--accent)' }}
        />
      </div>
      <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{value}%</p>
    </div>
  );
}

function Toggle({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative h-6 w-10 rounded-full transition-colors"
      style={{ background: enabled ? 'var(--accent)' : 'var(--bg-sidebar)' }}
      title={enabled ? 'Enabled' : 'Disabled'}
    >
      <span
        className="absolute top-1 h-4 w-4 rounded-full bg-white transition-all"
        style={{ left: enabled ? 20 : 4 }}
      />
    </button>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1 rounded-xl p-1" style={{ background: 'var(--bg-sidebar)', gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className="rounded-lg px-2 py-1.5 text-xs transition-colors"
          style={{
            background: value === option.value ? 'var(--bg-elevated)' : 'transparent',
            color: value === option.value ? 'var(--text-1)' : 'var(--text-3)',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
