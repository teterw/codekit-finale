import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { channels } from '@/db/schema';
import { authOptions } from '@/lib/auth';
import ChatArea from '@/components/ChatArea';

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ serverId: string; channelId: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { serverId, channelId } = await params;
  const serverIdNumber = Number(serverId);
  const channelIdNumber = Number(channelId);
  const userId = Number(session?.user?.id ?? 0);

  if (Number.isNaN(serverIdNumber) || Number.isNaN(channelIdNumber)) {
    notFound();
  }

  const [channel] = await db
    .select({ name: channels.name })
    .from(channels)
    .where(and(eq(channels.id, channelIdNumber), eq(channels.serverId, serverIdNumber)))
    .limit(1);

  if (!channel) {
    notFound();
  }

  return (
    <ChatArea
      channelId={channelIdNumber}
      channelName={channel.name}
      userId={userId}
      userName={session?.user?.name ?? 'You'}
    />
  );
}
