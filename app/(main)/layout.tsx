import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ServerSidebar from '@/components/ServerSidebar';
import ChannelList from '@/components/ChannelList';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const userId = Number(session.user.id);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--dc-bg)' }}>
      {/* Server sidebar — 72px */}
      <ServerSidebar userId={userId} />
      {/* Channel list — 240px */}
      <ChannelList userId={userId} />
      {/* Main content — flex-1 */}
      <main className="flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--dc-bg)' }}>
        {children}
      </main>
    </div>
  );
}
