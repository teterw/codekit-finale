import { db } from '@/db';
import { channels, messages, users, members } from '@/db/schema';
import { and, desc, eq, lt } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

export async function POST(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId } = await params;
    const channelIdNumber = Number(channelId);
    if (Number.isNaN(channelIdNumber)) return errorResponse('Invalid channel id', 400);

    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim();
    if (!content) return errorResponse('Content is required', 400);

    const [channel] = await db.select().from(channels).where(eq(channels.id, channelIdNumber)).limit(1);
    if (!channel) return errorResponse('Channel not found', 404);

    const membership = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.serverId, channel.serverId)))
      .limit(1);
    if (membership.length === 0) return errorResponse('Access denied', 403);

    const [msg] = await db
      .insert(messages)
      .values({ channelId: channelIdNumber, userId, content })
      .returning();

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    return jsonResponse({
      message: {
        id: msg.id,
        content: msg.content,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
        userId: msg.userId,
        userName: user.name,
        userAvatar: user.avatar,
      },
    });
  } catch {
    return errorResponse('Failed to send message', 500);
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return errorResponse('Missing x-user-id header', 401);
    }

    const { channelId } = await params;
    const channelIdNumber = Number(channelId);
    if (Number.isNaN(channelIdNumber)) {
      return errorResponse('Invalid channel id', 400);
    }

    const [channel] = await db.select().from(channels).where(eq(channels.id, channelIdNumber)).limit(1);
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
    const conditions = cursor
      ? and(eq(messages.channelId, channelIdNumber), lt(messages.id, Number(cursor)))
      : eq(messages.channelId, channelIdNumber);

    const rows = await db
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
      .where(conditions)
      .orderBy(desc(messages.id))
      .limit(30);

    const nextCursor = rows.length > 0 ? rows[rows.length - 1].id : null;

    return jsonResponse({ messages: rows, nextCursor });
  } catch (error) {
    return errorResponse('Unable to fetch messages', 500);
  }
}
