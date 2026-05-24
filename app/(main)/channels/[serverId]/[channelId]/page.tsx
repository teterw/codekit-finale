import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ChatArea from '@/components/ChatArea';

export default async function ChannelPage({
  params,
}: {
  params: { serverId: string; channelId: string };
}) {
  const session = await getServerSession(authOptions);
  const channelId = Number(params.channelId);
  const userId = Number(session?.user?.id ?? 0);

  return <ChatArea channelId={channelId} userId={userId} />;
}
