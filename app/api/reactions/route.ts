import { db, ensureFeatureColumns } from '@/db';
import { messageReactions } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { getPusherServer } from '@/lib/pusher';

const ALLOWED_EMOJIS = new Set(['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '😡']);

type ReactionSummary = { emoji: string; count: number; userReacted: boolean };

function summarizeReactions(
  rows: (typeof messageReactions.$inferSelect)[],
  userId: number,
): Record<number, ReactionSummary[]> {
  const result: Record<number, ReactionSummary[]> = {};

  for (const row of rows) {
    if (!result[row.messageId]) result[row.messageId] = [];
    const existing = result[row.messageId].find(r => r.emoji === row.emoji);
    if (existing) {
      existing.count += 1;
      if (row.userId === userId) existing.userReacted = true;
    } else {
      result[row.messageId].push({
        emoji: row.emoji,
        count: 1,
        userReacted: row.userId === userId,
      });
    }
  }

  return result;
}

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Unauthorized', 401);

    await ensureFeatureColumns();

    const url = new URL(request.url);
    const messageIds = (url.searchParams.get('messageIds') ?? '')
      .split(',')
      .map(Number)
      .filter(n => !Number.isNaN(n) && n > 0);

    if (!messageIds.length) return jsonResponse({ reactions: {} });

    const rows = await db
      .select()
      .from(messageReactions)
      .where(inArray(messageReactions.messageId, messageIds));

    return jsonResponse({ reactions: summarizeReactions(rows, userId) });
  } catch (err) {
    console.error('[reactions GET] error:', err);
    return jsonResponse({ reactions: {} });
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Unauthorized', 401);

    await ensureFeatureColumns();

    const body = (await request.json()) as { messageId?: number; channelId?: number; emoji?: string };
    const { messageId, channelId, emoji } = body;

    if (!messageId || !channelId || !emoji) {
      return errorResponse('messageId, channelId, emoji required', 400);
    }

    if (!ALLOWED_EMOJIS.has(emoji)) {
      return errorResponse('Invalid emoji', 400);
    }

    const [existing] = await db
      .select()
      .from(messageReactions)
      .where(and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, emoji),
      ))
      .limit(1);

    if (existing) {
      await db.delete(messageReactions).where(eq(messageReactions.id, existing.id));
    } else {
      await db.insert(messageReactions).values({ messageId, userId, emoji });
    }

    const rows = await db
      .select()
      .from(messageReactions)
      .where(eq(messageReactions.messageId, messageId));

    const reactions = summarizeReactions(rows, userId)[messageId] ?? [];

    try {
      await getPusherServer().trigger(`channel-${channelId}`, 'reaction-updated', { messageId, reactions });
    } catch (err) {
      console.error('[reactions POST] pusher trigger failed:', err);
    }

    return jsonResponse({ reactions });
  } catch (err) {
    console.error('[reactions POST] error:', err);
    return errorResponse('Unable to process reaction: ' + String(err), 500);
  }
}
