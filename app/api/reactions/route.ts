import { db, ensureFeatureColumns } from '@/db';
import { messageReactions } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { getPusherServer } from '@/lib/pusher';

const ALLOWED_EMOJIS = new Set(['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '😡']);

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Unauthorized', 401);

    await ensureFeatureColumns();

    const url = new URL(request.url);
    const messageIdsParam = url.searchParams.get('messageIds') ?? '';
    const messageIds = messageIdsParam
      .split(',')
      .map(Number)
      .filter(n => !isNaN(n) && n > 0);

    if (!messageIds.length) return jsonResponse({ reactions: {} });

    let rows: typeof messageReactions.$inferSelect[] = [];
    try {
      rows = await db
        .select()
        .from(messageReactions)
        .where(inArray(messageReactions.messageId, messageIds));
    } catch (err) {
      console.error('[reactions GET] table select failed:', err);
      return jsonResponse({ reactions: {} });
    }

    const result: Record<number, { emoji: string; count: number; userReacted: boolean }[]> = {};
    for (const row of rows) {
      if (!result[row.messageId]) result[row.messageId] = [];
      const existing = result[row.messageId].find(r => r.emoji === row.emoji);
      if (existing) {
        existing.count += 1;
        if (row.userId === userId) existing.userReacted = true;
      } else {
        result[row.messageId].push({ emoji: row.emoji, count: 1, userReacted: row.userId === userId });
      }
    }

    return jsonResponse({ reactions: result });
  } catch (err) {
    console.error('[reactions GET] outer error:', err);
    return jsonResponse({ reactions: {} });
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    console.log('[reactions POST] userId:', userId);
    if (!userId) return errorResponse('Unauthorized', 401);

    try {
      await ensureFeatureColumns();
      console.log('[reactions POST] ensureFeatureColumns done');
    } catch (err) {
      console.error('[reactions POST] ensureFeatureColumns error:', err);
    }

    const body = (await request.json()) as { messageId?: number; channelId?: number; emoji?: string };
    const { messageId, channelId, emoji } = body;
    console.log('[reactions POST] body:', { messageId, channelId, emoji });

    if (!messageId || !channelId || !emoji) return errorResponse('messageId, channelId, emoji required', 400);
    if (!ALLOWED_EMOJIS.has(emoji)) {
      console.error('[reactions POST] invalid emoji:', emoji);
      return errorResponse('Invalid emoji', 400);
    }

    let existing: typeof messageReactions.$inferSelect | undefined;
    try {
      [existing] = await db
        .select()
        .from(messageReactions)
        .where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, userId), eq(messageReactions.emoji, emoji)))
        .limit(1);
      console.log('[reactions POST] existing reaction:', existing ?? 'none');
    } catch (err) {
      console.error('[reactions POST] select existing failed (table may not exist):', err);
      return errorResponse('Reactions table not available: ' + String(err), 503);
    }

    if (existing) {
      try {
        await db.delete(messageReactions).where(eq(messageReactions.id, existing.id));
        console.log('[reactions POST] deleted reaction', existing.id);
      } catch (err) {
        console.error('[reactions POST] delete failed:', err);
      }
    } else {
      try {
        await db.insert(messageReactions).values({ messageId, userId, emoji });
        console.log('[reactions POST] inserted reaction');
      } catch (err) {
        console.error('[reactions POST] insert failed:', err);
      }
    }

    let rows: typeof messageReactions.$inferSelect[] = [];
    try {
      rows = await db
        .select()
        .from(messageReactions)
        .where(eq(messageReactions.messageId, messageId));
    } catch (err) {
      console.error('[reactions POST] re-fetch failed:', err);
    }

    const reactions: { emoji: string; count: number; userReacted: boolean }[] = [];
    for (const row of rows) {
      const ex = reactions.find(r => r.emoji === row.emoji);
      if (ex) {
        ex.count += 1;
        if (row.userId === userId) ex.userReacted = true;
      } else {
        reactions.push({ emoji: row.emoji, count: 1, userReacted: row.userId === userId });
      }
    }

    try {
      await getPusherServer().trigger(`channel-${channelId}`, 'reaction-updated', { messageId, reactions });
    } catch { /* Pusher not configured */ }

    console.log('[reactions POST] returning reactions:', reactions);
    return jsonResponse({ reactions });
  } catch (err) {
    console.error('[reactions POST] outer error:', err);
    return errorResponse('Unable to process reaction: ' + String(err), 500);
  }
}
