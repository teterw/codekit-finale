import { getPusherServer } from '@/lib/pusher';
import { getUserId } from '@/lib/api-helpers';

export async function POST(request: Request) {
  const userId = getUserId(request);
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const text = await request.text();
  const params = new URLSearchParams(text);
  const socket_id = params.get('socket_id') ?? '';
  const channel_name = params.get('channel_name') ?? '';

  if (!socket_id || !channel_name) {
    return Response.json({ error: 'Missing socket_id or channel_name' }, { status: 400 });
  }

  try {
    const pusher = getPusherServer();
    const auth = pusher.authorizeChannel(socket_id, channel_name);
    return Response.json(auth);
  } catch {
    return Response.json({ error: 'Pusher not configured' }, { status: 500 });
  }
}
