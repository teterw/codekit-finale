import { db } from '@/db';
import { channels, messages, users, members } from '@/db/schema';
import { and, desc, eq, lt } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

export async function GET(request: Request, { params }: { params: { channelId: string } }) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return errorResponse('Missing x-user-id header', 401);
    }

    const channelId = Number(params.channelId);
    if (Number.isNaN(channelId)) {
      return errorResponse('Invalid channel id', 400);
    }

    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel) {
      return errorResponse('Channel not found', 404);
    }

    const membership = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.serverId, channel.serverId)))
      .limit(1);

    if (membership.length === 0) {
      return errorResponse('Access denied', 403);
    }

    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    const query = db
      .select({
        id: messages.id,
        content: messages.content,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        userId: messages.userId,
        userName: users.name,
        userAvatar: users.avatar,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(eq(messages.channelId, channelId));

    const limitedQuery = cursor
      ? query.where(lt(messages.id, Number(cursor)))
      : query;

    const rows = await limitedQuery.orderBy(desc(messages.id)).limit(30);
    const nextCursor = rows.length > 0 ? rows[rows.length - 1].id : null;

    return jsonResponse({ messages: rows, nextCursor });
  } catch (error) {
    return errorResponse('Unable to fetch messages', 500);
  }
}
