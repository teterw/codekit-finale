import { db, ensureFeatureColumns } from '@/db';
import { messageReactions } from '@/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { getPusherServer } from '@/lib/pusher';

const ALLOWED_EMOJIS = new Set(['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '😡']);

export async function GET(request: Request) {
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

  const rows = await db
    .select()
    .from(messageReactions)
    .where(inArray(messageReactions.messageId, messageIds));

  // Group by messageId → emoji → {count, userReacted}
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
}

export async function POST(request: Request) {
  const userId = getUserId(request);
  if (!userId) return errorResponse('Unauthorized', 401);

  await ensureFeatureColumns();

  const body = (await request.json()) as { messageId?: number; channelId?: number; emoji?: string };
  const { messageId, channelId, emoji } = body;

  if (!messageId || !channelId || !emoji) return errorResponse('messageId, channelId, emoji required', 400);
  if (!ALLOWED_EMOJIS.has(emoji)) return errorResponse('Invalid emoji', 400);

  // Toggle: check if already reacted
  const [existing] = await db
    .select()
    .from(messageReactions)
    .where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, userId), eq(messageReactions.emoji, emoji)))
    .limit(1);

  if (existing) {
    await db.delete(messageReactions).where(eq(messageReactions.id, existing.id));
  } else {
    await db.insert(messageReactions).values({ messageId, userId, emoji });
  }

  // Re-fetch updated reactions for this message
  const rows = await db
    .select()
    .from(messageReactions)
    .where(eq(messageReactions.messageId, messageId));

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

  return jsonResponse({ reactions });
}
