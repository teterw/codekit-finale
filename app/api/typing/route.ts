import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { getPusherServer } from '@/lib/pusher';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  const userId = getUserId(request);
  if (!userId) return errorResponse('Unauthorized', 401);

  const body = (await request.json()) as { channelId?: number; isTyping?: boolean };
  if (!body.channelId) return errorResponse('channelId required', 400);

  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  const userName = user?.name ?? 'Someone';

  try {
    const event = body.isTyping ? 'typing-start' : 'typing-stop';
    await getPusherServer().trigger(`channel-${body.channelId}`, event, { userId, userName });
  } catch { /* Pusher not configured */ }

  return jsonResponse({ ok: true });
}
