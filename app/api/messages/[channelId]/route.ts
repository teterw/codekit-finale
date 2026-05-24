import { db, ensureFeatureColumns } from '@/db';
import { channels, messages, users, members } from '@/db/schema';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { getPusherServer } from '@/lib/pusher';

export async function GET(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId } = await params;
    const channelIdNumber = Number(channelId);
    if (Number.isNaN(channelIdNumber)) return errorResponse('Invalid channel id', 400);

    // Explicit minimal select — avoids schema/DB column mismatch on channels table
    const [channel] = await db
      .select({ id: channels.id, serverId: channels.serverId })
      .from(channels)
      .where(eq(channels.id, channelIdNumber))
      .limit(1);
    if (!channel) return errorResponse('Channel not found', 404);

    const [membership] = await db
      .select({ userId: members.userId })
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.serverId, channel.serverId)))
      .limit(1);
    if (!membership) return errorResponse('Access denied', 403);

    await ensureFeatureColumns();

    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    const conditions = cursor
      ? and(eq(messages.channelId, channelIdNumber), lt(messages.id, Number(cursor)))
      : eq(messages.channelId, channelIdNumber);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows: any[];

    try {
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
      try {
        // Fallback without feature columns (reply_to_id, is_pinned, updated_at)
        const baseRows = await db
          .select({
            id: messages.id,
            content: messages.content,
            createdAt: messages.createdAt,
            userId: messages.userId,
            userName: users.name,
          })
          .from(messages)
          .innerJoin(users, eq(messages.userId, users.id))
          .where(conditions)
          .orderBy(desc(messages.id))
          .limit(30);
        rows = baseRows.map(r => ({
          ...r,
          updatedAt: r.createdAt,
          userAvatar: null,
          replyToId: null,
          isPinned: false,
        }));
      } catch (err2) {
        console.error('[GET messages fallback2]', err2);
        return errorResponse('Unable to fetch messages', 500);
      }
    }

    const replyIds = rows.map((r: { replyToId?: number | null }) => r.replyToId).filter((id: unknown): id is number => typeof id === 'number');
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

    const enriched = rows.map((r: { replyToId?: number | null; [k: string]: unknown }) => ({
      ...r,
      replyToContent: r.replyToId ? (replyMap.get(r.replyToId as number)?.content ?? null) : null,
      replyToUserName: r.replyToId ? (replyMap.get(r.replyToId as number)?.userName ?? null) : null,
    }));

    const nextCursor = rows.length > 0 ? rows[rows.length - 1].id : null;
    return jsonResponse({ messages: enriched, nextCursor });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[GET messages outer]', detail);
    return errorResponse(`Unable to fetch messages: ${detail}`, 500);
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

    // Explicit minimal select — avoids schema/DB column mismatch
    const [channel] = await db
      .select({ id: channels.id, serverId: channels.serverId })
      .from(channels)
      .where(eq(channels.id, channelIdNumber))
      .limit(1);
    if (!channel) return errorResponse('Channel not found', 404);

    const [membership] = await db
      .select({ userId: members.userId })
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.serverId, channel.serverId)))
      .limit(1);
    if (!membership) return errorResponse('Access denied', 403);

    await ensureFeatureColumns();

    // Fetch sender name — fall back gracefully if avatar column doesn't exist
    let senderName = 'Unknown';
    let senderAvatar: string | null = null;
    try {
      const [s] = await db
        .select({ name: users.name, avatar: users.avatar })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      senderName = s?.name ?? 'Unknown';
      senderAvatar = s?.avatar ?? null;
    } catch {
      try {
        const [s] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        senderName = s?.name ?? 'Unknown';
      } catch { /* ignore */ }
    }

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
    let savedId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let savedCreatedAt: Date = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let savedUpdatedAt: Date = savedCreatedAt;

    try {
      // Attempt 1: full insert with all feature columns, return all columns
      const insertVals: Record<string, unknown> = { channelId: channelIdNumber, userId, content };
      if (replyToId) insertVals.replyToId = replyToId;
      const [row] = await db.insert(messages).values(insertVals as never).returning();
      savedId = row.id;
      savedCreatedAt = row.createdAt as Date;
      savedUpdatedAt = (row.updatedAt as Date | undefined) ?? savedCreatedAt;
    } catch {
      try {
        // Attempt 2: minimal insert, return only id
        const [row] = await db
          .insert(messages)
          .values({ channelId: channelIdNumber, userId, content })
          .returning({ id: messages.id });
        savedId = row.id;
      } catch (err2) {
        // Attempt 3: raw SQL to bypass all Drizzle schema mapping
        const result = await db.execute(
          sql`INSERT INTO messages (channel_id, user_id, content) VALUES (${channelIdNumber}, ${userId}, ${content}) RETURNING id`
        );
        const raw = result.rows[0] as { id: number };
        savedId = raw.id;
      }
    }

    const fullMessage = {
      id: savedId!,
      channelId: channelIdNumber,
      userId,
      content,
      isPinned: false,
      replyToId,
      createdAt: savedCreatedAt,
      updatedAt: savedUpdatedAt,
      userName: senderName,
      userAvatar: senderAvatar,
      replyToContent,
      replyToUserName,
    };

    try {
      await getPusherServer().trigger(`channel-${channelIdNumber}`, 'new-message', fullMessage);
    } catch { /* Pusher not configured */ }

    return jsonResponse({ message: fullMessage }, 201);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[POST messages]', detail);
    return errorResponse(`Unable to create message: ${detail}`, 500);
  }
}
