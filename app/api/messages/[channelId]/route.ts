import { db } from '@/db';
import { channels, messages, users, members } from '@/db/schema';
import { and, desc, eq, lt } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { getPusherServer } from '@/lib/pusher';

export async function GET(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId: channelIdStr } = await params;
    const channelId = Number(channelIdStr);
    if (Number.isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel) return errorResponse('Channel not found', 404);

    const membership = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.serverId, channel.serverId)))
      .limit(1);
    if (membership.length === 0) return errorResponse('Access denied', 403);

    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');

    let query = db
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
      .where(eq(messages.channelId, channelId))
      .$dynamic();

    if (cursor) {
      query = query.where(and(eq(messages.channelId, channelId), lt(messages.id, Number(cursor))));
    }

    const rows = await query.orderBy(desc(messages.id)).limit(30);
    const nextCursor = rows.length > 0 ? rows[rows.length - 1].id : null;

    return jsonResponse({ messages: rows, nextCursor });
  } catch {
    return errorResponse('Unable to fetch messages', 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId: channelIdStr } = await params;
    const channelId = Number(channelIdStr);
    if (Number.isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim();
    if (!content) return errorResponse('Message content is required', 400);

    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel) return errorResponse('Channel not found', 404);

    const membership = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.serverId, channel.serverId)))
      .limit(1);
    if (membership.length === 0) return errorResponse('Access denied', 403);

    const [sender] = await db
      .select({ name: users.name, avatar: users.avatar })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [created] = await db.insert(messages).values({ channelId, userId, content }).returning();

    const fullMessage = { ...created, userName: sender?.name ?? 'Unknown', userAvatar: sender?.avatar ?? null };

    try {
      await getPusherServer().trigger(`channel-${channelId}`, 'new-message', fullMessage);
    } catch {
      // Pusher not configured — message saved, just not pushed live
    }

    return jsonResponse({ message: fullMessage }, 201);
  } catch {
    return errorResponse('Unable to create message', 500);
  }
}
