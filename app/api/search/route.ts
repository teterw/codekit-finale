import { db } from '@/db';
import { messages, users, channels, members } from '@/db/schema';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim();
    const channelId = Number(url.searchParams.get('channelId'));

    if (!q || !channelId || Number.isNaN(channelId)) {
      return errorResponse('q and channelId are required', 400);
    }

    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel) return errorResponse('Channel not found', 404);

    const membership = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.serverId, channel.serverId)))
      .limit(1);
    if (membership.length === 0) return errorResponse('Access denied', 403);

    const results = await db
      .select({
        id: messages.id,
        content: messages.content,
        createdAt: messages.createdAt,
        channelId: messages.channelId,
        userId: messages.userId,
        userName: users.name,
        userAvatar: users.avatar,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(and(eq(messages.channelId, channelId), ilike(messages.content, `%${q}%`)))
      .orderBy(desc(messages.createdAt))
      .limit(20);

    return jsonResponse({ results });
  } catch {
    return errorResponse('Unable to search messages', 500);
  }
}
