'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Zap } from 'lucide-react';
import AuthForm from './AuthForm';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import ChatArea from './ChatArea';
import VoiceChannel from './VoiceChannel';
import FeatureHub from './FeatureHub';
import InviteModal from './InviteModal';
import SearchModal from './SearchModal';
import CreateServerModal from './CreateServerModal';
import UserProfileModal from './profile/UserProfileModal';
import ProfileSettingsModal from './profile/ProfileSettingsModal';
import { fadeUp } from '@/lib/animations';

interface Server { id: number; name: string; icon: string | null; ownerId: number; }
interface Channel { id: number; name: string; type: string; }

export default function MainApp() {
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState('online');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      const id = localStorage.getItem('userId');
      const name = localStorage.getItem('userName');
      if (id && name) { setUserId(Number(id)); setUserName(name); }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchServers = useCallback(async (uid: number) => {
    const res = await fetch('/api/servers', { headers: { 'x-user-id': String(uid) } });
    if (!res.ok) return undefined;
    const data = await res.json();
    setServers(data.servers ?? []);
    return data.servers as Server[];
  }, []);

  const fetchServerDetails = useCallback(async (uid: number, serverId: number) => {
    const res = await fetch(`/api/servers/${serverId}`, { headers: { 'x-user-id': String(uid) } });
    if (!res.ok) return;
    const data = await res.json();
    setChannels(data.channels ?? []);
    if (data.channels?.length > 0) {
      const text = data.channels.find((c: Channel) => c.type === 'text') ?? data.channels[0];
      setSelectedChannel(text);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    fetch('/api/profile/me', { headers: { 'x-user-id': String(userId) } })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (d.user?.avatar !== undefined) setUserAvatar(d.user.avatar);
        if (d.user?.status) setUserStatus(d.user.status);
        if (d.user?.name) setUserName(d.user.name);
      })
      .catch(() => {});

    queueMicrotask(async () => {
      const list = await fetchServers(userId);
      if (cancelled) return;
      if (list && list.length > 0) {
        setSelectedServer(list[0]);
        fetchServerDetails(userId, list[0].id);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId, fetchServers, fetchServerDetails]);

  function handleAuth(uid: number, name: string) {
    setUserId(uid);
    setUserName(name);
  }

  function handleLogout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    setUserId(null);
    setUserName('');
    setServers([]);
    setSelectedServer(null);
    setChannels([]);
    setSelectedChannel(null);
  }

  async function handleSelectServer(server: Server) {
    setSelectedServer(server);
    setSelectedChannel(null);
    setMobileSidebarOpen(false);
    if (userId) await fetchServerDetails(userId, server.id);
  }

  async function handleServerCreated(serverId: number) {
    if (!userId) return;
    const list = await fetchServers(userId);
    const newServer = list?.find(s => s.id === serverId);
    if (newServer) {
      setSelectedServer(newServer);
      await fetchServerDetails(userId, serverId);
    }
  }

  async function handleJoined(serverId: number) {
    if (!userId) return;
    const list = await fetchServers(userId);
    const joined = list?.find(s => s.id === serverId);
    if (joined) {
      setSelectedServer(joined);
      await fetchServerDetails(userId, serverId);
    }
  }

  function handleServerUpdated(updatedServer: Server) {
    setServers(prev => prev.map(server => (server.id === updatedServer.id ? updatedServer : server)));
    if (selectedServer?.id === updatedServer.id) {
      setSelectedServer(updatedServer);
    }
  }

  function handleServerDeleted(serverId: number) {
    setServers(prev => {
      const remaining = prev.filter(server => server.id !== serverId);
      if (selectedServer?.id === serverId) {
        if (remaining.length > 0) {
          const next = remaining[0];
          setSelectedServer(next);
          if (userId) {
            fetchServerDetails(userId, next.id);
          }
        } else {
          setSelectedServer(null);
          setChannels([]);
          setSelectedChannel(null);
        }
      }
      return remaining;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Zap size={28} style={{ color: 'var(--accent)' }} />
        </motion.div>
      </div>
    );
  }

  if (!userId) return <AuthForm onAuth={handleAuth} />;

  if (servers.length === 0) {
    return (
      <div
        className="flex items-center justify-center min-h-screen p-6"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124,107,255,0.12) 0%, var(--bg) 60%)' }}
      >
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="text-center max-w-sm"
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-glow)' }}
          >
            <Zap size={36} fill="currentColor" style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="font-bold text-2xl mb-2" style={{ color: 'var(--text-1)' }}>
            Welcome, {userName}!
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-2)' }}>
            You&apos;re not in any servers yet. Create one or join with an invite code to get started.
          </p>
          <div className="flex gap-3 justify-center">
            <motion.button
              onClick={() => setShowCreateModal(true)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))' }}
            >
              Create Server
            </motion.button>
            <motion.button
              onClick={() => setShowInviteModal(true)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors hover:bg-white/[0.08]"
              style={{ color: 'var(--text-1)', border: '1px solid var(--border)' }}
            >
              Join Server
            </motion.button>
          </div>
          <button
            onClick={handleLogout}
            className="mt-6 text-xs transition-colors hover:opacity-80"
            style={{ color: 'var(--text-3)' }}
          >
            Log out
          </button>
        </motion.div>

        <AnimatePresence>
          {showCreateModal && (
            <CreateServerModal userId={userId} onCreated={handleServerCreated} onClose={() => setShowCreateModal(false)} />
          )}
          {showInviteModal && (
            <InviteModal userId={userId} onJoined={handleJoined} onClose={() => setShowInviteModal(false)} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Desktop layout */}
      <div className="hidden md:flex h-full">
        <ServerSidebar
          servers={servers}
          selectedId={selectedServer?.id ?? null}
          onSelect={handleSelectServer}
          onAddServer={() => setShowCreateModal(true)}
          onJoinServer={() => setShowInviteModal(true)}
        />
        <ChannelSidebar
          server={selectedServer}
          channels={channels}
          selectedChannelId={selectedChannel?.id ?? null}
          userId={userId}
          userName={userName}
          userAvatar={userAvatar}
          userStatus={userStatus}
          onSelectChannel={ch => { setSelectedChannel(ch); }}
          onCreateInvite={() => {}}
          onServerUpdated={handleServerUpdated}
          onServerDeleted={handleServerDeleted}
          onLogout={handleLogout}
          onOpenProfileSettings={() => setShowProfileSettings(true)}
          onViewOwnProfile={() => setProfileUserId(userId)}
        />
      </div>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed left-0 top-0 bottom-0 z-50 flex md:hidden"
            >
              <ServerSidebar
                servers={servers}
                selectedId={selectedServer?.id ?? null}
                onSelect={handleSelectServer}
                onAddServer={() => { setShowCreateModal(true); setMobileSidebarOpen(false); }}
                onJoinServer={() => { setShowInviteModal(true); setMobileSidebarOpen(false); }}
              />
              <ChannelSidebar
                server={selectedServer}
                channels={channels}
                selectedChannelId={selectedChannel?.id ?? null}
                userId={userId}
                userName={userName}
                userAvatar={userAvatar}
                userStatus={userStatus}
                onSelectChannel={ch => { setSelectedChannel(ch); setMobileSidebarOpen(false); }}
                onCreateInvite={() => {}}
                onServerUpdated={handleServerUpdated}
                onServerDeleted={handleServerDeleted}
                onLogout={handleLogout}
                onOpenProfileSettings={() => { setShowProfileSettings(true); setMobileSidebarOpen(false); }}
                onViewOwnProfile={() => { setProfileUserId(userId); setMobileSidebarOpen(false); }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex flex-col flex-1 min-w-0">
        {/* Mobile header */}
        <div
          className="flex items-center gap-3 px-4 py-3 md:hidden flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-chat)' }}
        >
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-2)' }}
          >
            <Menu size={20} />
          </button>
          {selectedServer && (
            <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>
              {selectedServer.name}
            </span>
          )}
        </div>

        <AnimatePresence mode="wait">
          {!selectedChannel ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center"
              style={{ background: 'var(--bg-chat)' }}
            >
              <div className="text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'var(--accent-dim)' }}
                >
                  <X size={24} style={{ color: 'var(--accent)', opacity: 0.5 }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>Select a channel</p>
              </div>
            </motion.div>
          ) : selectedChannel.type === 'voice' ? (
            <motion.div
              key={`voice-${selectedChannel.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 min-h-0"
            >
              <VoiceChannel
                channelId={selectedChannel.id}
                channelName={selectedChannel.name}
                userId={userId}
                userName={userName}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`chat-${selectedChannel.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 min-h-0 relative"
            >
              <ChatArea
                channelId={selectedChannel.id}
                channelName={selectedChannel.name}
                userId={userId}
                userName={userName}
                onOpenSearch={() => setShowSearchModal(true)}
                onViewProfile={setProfileUserId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <FeatureHub
        server={selectedServer}
        activeChannel={selectedChannel}
        userId={userId}
        userName={userName}
      />

      {/* Modals */}
      <AnimatePresence>
        {showSearchModal && selectedChannel && (
          <SearchModal
            key="search"
            channelId={selectedChannel.id}
            channelName={selectedChannel.name}
            userId={userId}
            onClose={() => setShowSearchModal(false)}
          />
        )}
        {showCreateModal && (
          <CreateServerModal
            key="create"
            userId={userId}
            onCreated={handleServerCreated}
            onClose={() => setShowCreateModal(false)}
          />
        )}
        {showInviteModal && (
          <InviteModal
            key="invite"
            userId={userId}
            onJoined={handleJoined}
            onClose={() => setShowInviteModal(false)}
          />
        )}
        {profileUserId !== null && (
          <UserProfileModal
            key={`profile-${profileUserId}`}
            userId={profileUserId}
            currentUserId={userId}
            requestUserId={userId}
            onClose={() => setProfileUserId(null)}
            onEditProfile={() => {
              setProfileUserId(null);
              setShowProfileSettings(true);
            }}
          />
        )}
        {showProfileSettings && (
          <ProfileSettingsModal
            key="profile-settings"
            userId={userId}
            onClose={() => setShowProfileSettings(false)}
            onSaved={(profile) => {
              if (profile.name) setUserName(profile.name);
              setUserAvatar(profile.avatar ?? null);
              if (profile.status) setUserStatus(profile.status);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
