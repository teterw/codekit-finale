'use client';

import { useEffect, useState, useCallback } from 'react';
import AuthForm from './AuthForm';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import ChatArea from './ChatArea';
import VoiceChannel from './VoiceChannel';
import InviteModal from './InviteModal';
import SearchModal from './SearchModal';
import CreateServerModal from './CreateServerModal';

interface Server { id: number; name: string; icon: string | null; ownerId: number; }
interface Channel { id: number; name: string; type: string; }

export default function MainApp() {
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Read auth from localStorage on mount
  useEffect(() => {
    const id = localStorage.getItem('userId');
    const name = localStorage.getItem('userName');
    if (id && name) {
      setUserId(Number(id));
      setUserName(name);
    }
    setLoading(false);
  }, []);

  const fetchServers = useCallback(async (uid: number) => {
    const res = await fetch('/api/servers', { headers: { 'x-user-id': String(uid) } });
    if (!res.ok) return;
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
      const textChannel = data.channels.find((c: Channel) => c.type === 'text') ?? data.channels[0];
      setSelectedChannel(textChannel);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchServers(userId).then(list => {
      if (list && list.length > 0) {
        setSelectedServer(list[0]);
        fetchServerDetails(userId, list[0].id);
      }
    });
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

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-[#36393f] text-[#b9bbbe]">Loading…</div>;
  }

  if (!userId) {
    return <AuthForm onAuth={handleAuth} />;
  }

  if (servers.length === 0 && !loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#36393f]">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">👋</p>
          <h2 className="text-white font-bold text-xl mb-2">Welcome, {userName}!</h2>
          <p className="text-[#b9bbbe] text-sm mb-6">You're not in any servers yet. Create one or join with an invite code.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#7289da] hover:bg-[#677bc4] text-white px-5 py-2 rounded font-medium transition-colors"
            >
              Create Server
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="bg-[#36393f] hover:bg-[#40444b] text-white border border-[#40444b] px-5 py-2 rounded font-medium transition-colors"
            >
              Join Server
            </button>
          </div>
          <button onClick={handleLogout} className="mt-4 text-[#b9bbbe] hover:text-white text-sm underline">Log out</button>
        </div>

        {showCreateModal && (
          <CreateServerModal userId={userId} onCreated={handleServerCreated} onClose={() => setShowCreateModal(false)} />
        )}
        {showInviteModal && (
          <InviteModal userId={userId} onJoined={handleJoined} onClose={() => setShowInviteModal(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#36393f]">
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
        onSelectChannel={setSelectedChannel}
        onCreateInvite={() => {}}
        onLogout={handleLogout}
      />

      <main className="flex flex-1 min-w-0">
        {!selectedChannel ? (
          <div className="flex flex-1 items-center justify-center text-[#b9bbbe]">
            <div className="text-center">
              <p className="text-4xl mb-2">👈</p>
              <p className="text-sm">Select a channel to get started</p>
            </div>
          </div>
        ) : selectedChannel.type === 'voice' ? (
          <VoiceChannel
            key={selectedChannel.id}
            channelId={selectedChannel.id}
            channelName={selectedChannel.name}
            userId={userId}
            userName={userName}
          />
        ) : (
          <ChatArea
            key={selectedChannel.id}
            channelId={selectedChannel.id}
            channelName={selectedChannel.name}
            userId={userId}
            onOpenSearch={() => setShowSearchModal(true)}
          />
        )}
      </main>

      {showSearchModal && selectedChannel && (
        <SearchModal
          channelId={selectedChannel.id}
          channelName={selectedChannel.name}
          userId={userId}
          onClose={() => setShowSearchModal(false)}
        />
      )}
      {showCreateModal && (
        <CreateServerModal userId={userId} onCreated={handleServerCreated} onClose={() => setShowCreateModal(false)} />
      )}
      {showInviteModal && (
        <InviteModal userId={userId} onJoined={handleJoined} onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  );
}
