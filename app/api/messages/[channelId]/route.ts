import { db, ensureFeatureColumns } from '@/db';
import { channels, messages, users, members } from '@/db/schema';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { getPusherServer } from '@/lib/pusher';

type BaseMessage = {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  userName: string;
  userAvatar: string | null;
  replyToId: number | null;
  isPinned: boolean;
};

export async function GET(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId } = await params;
    const channelIdNumber = Number(channelId);
    if (Number.isNaN(channelIdNumber)) return errorResponse('Invalid channel id', 400);

    const [channel] = await db.select().from(channels).where(eq(channels.id, channelIdNumber)).limit(1);
    if (!channel) return errorResponse('Channel not found', 404);

    const membership = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.serverId, channel.serverId)))
      .limit(1);
    if (membership.length === 0) return errorResponse('Access denied', 403);

    await ensureFeatureColumns();

    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    const conditions = cursor
      ? and(eq(messages.channelId, channelIdNumber), lt(messages.id, Number(cursor)))
      : eq(messages.channelId, channelIdNumber);

    let rows: BaseMessage[];

    try {
      // Full select including feature columns (reply_to_id, is_pinned)
      rows = await db
        .select({
          id: messages.id,
          content: messages.content,
          createdAt: messages.createdAt,
          updatedAt: messages.updatedAt,
          userId: messages.userId,
          userName: users.name,
          userAvatar: users.avatar,
          replyToId: messages.replyToId,
          isPinned: messages.isPinned,
        })
        .from(messages)
        .innerJoin(users, eq(messages.userId, users.id))
        .where(conditions)
        .orderBy(desc(messages.id))
        .limit(30);
    } catch {
      // Fallback: feature columns don't exist in DB yet — select base columns only
      const baseRows = await db
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
      rows = baseRows.map(r => ({ ...r, replyToId: null, isPinned: false }));
    }

    // Batch-fetch reply previews
    const replyIds = rows.map(r => r.replyToId).filter((id): id is number => id != null);
    const replyMap = new Map<number, { content: string; userName: string }>();
    if (replyIds.length > 0) {
      try {
        const replies = await db
          .select({ id: messages.id, content: messages.content, userName: users.name })
          .from(messages)
          .innerJoin(users, eq(messages.userId, users.id))
          .where(inArray(messages.id, replyIds));
        replies.forEach(r => replyMap.set(r.id, { content: r.content, userName: r.userName }));
      } catch { /* ignore */ }
    }

    const enriched = rows.map(r => ({
      ...r,
      replyToContent: r.replyToId ? (replyMap.get(r.replyToId)?.content ?? null) : null,
      replyToUserName: r.replyToId ? (replyMap.get(r.replyToId)?.userName ?? null) : null,
    }));

    const nextCursor = rows.length > 0 ? rows[rows.length - 1].id : null;
    return jsonResponse({ messages: enriched, nextCursor });
  } catch {
    return errorResponse('Unable to fetch messages', 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId } = await params;
    const channelIdNumber = Number(channelId);
    if (Number.isNaN(channelIdNumber)) return errorResponse('Invalid channel id', 400);

    const body = (await request.json()) as { content?: string; replyToId?: number };
    const content = body.content?.trim();
    if (!content) return errorResponse('Message content is required', 400);

    const [channel] = await db.select().from(channels).where(eq(channels.id, channelIdNumber)).limit(1);
    if (!channel) return errorResponse('Channel not found', 404);

    const membership = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.serverId, channel.serverId)))
      .limit(1);
    if (membership.length === 0) return errorResponse('Access denied', 403);

    await ensureFeatureColumns();

    const [sender] = await db
      .select({ name: users.name, avatar: users.avatar })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const replyToId = body.replyToId ?? null;
    let replyToContent: string | null = null;
    let replyToUserName: string | null = null;
    if (replyToId) {
      try {
        const [reply] = await db
          .select({ content: messages.content, userName: users.name })
          .from(messages)
          .innerJoin(users, eq(messages.userId, users.id))
          .where(eq(messages.id, replyToId))
          .limit(1);
        replyToContent = reply?.content ?? null;
        replyToUserName = reply?.userName ?? null;
      } catch { /* ignore */ }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let created: any;

    try {
      // Try insert with all feature columns (reply_to_id, is_pinned)
      const insertVals: Record<string, unknown> = { channelId: channelIdNumber, userId, content };
      if (replyToId) insertVals.replyToId = replyToId;
      [created] = await db.insert(messages).values(insertVals as never).returning();
    } catch {
      // Fallback: feature columns don't exist in DB yet
      [created] = await db
        .insert(messages)
        .values({ channelId: channelIdNumber, userId, content })
        .returning({
          id: messages.id,
          channelId: messages.channelId,
          userId: messages.userId,
          content: messages.content,
          createdAt: messages.createdAt,
          updatedAt: messages.updatedAt,
        });
    }

    const fullMessage = {
      ...created,
      isPinned: created.isPinned ?? false,
      replyToId: replyToId ?? created.replyToId ?? null,
      userName: sender?.name ?? 'Unknown',
      userAvatar: sender?.avatar ?? null,
      replyToContent,
      replyToUserName,
    };

    try {
      await getPusherServer().trigger(`channel-${channelIdNumber}`, 'new-message', fullMessage);
    } catch { /* Pusher not configured */ }

    return jsonResponse({ message: fullMessage }, 201);
  } catch {
    return errorResponse('Unable to create message', 500);
  }
}
