import { db } from '@/db';
import { directConversations, directConversationMembers, directMessages, users } from '@/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

let _dmTables: Promise<void> | null = null;

export function ensureDmTables(): Promise<void> {
  if (_dmTables) return _dmTables;
  _dmTables = (async () => {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS direct_conversations (
          id SERIAL PRIMARY KEY,
          name TEXT,
          type TEXT NOT NULL DEFAULT 'dm',
          owner_id INTEGER NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS direct_conversation_members (
          conversation_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
          PRIMARY KEY (conversation_id, user_id)
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS direct_messages (
          id SERIAL PRIMARY KEY,
          conversation_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } catch { /* tables already exist or no DDL permission */ }
  })();
  return _dmTables;
}

export async function GET(request: Request) {
  try {
    await ensureDmTables();
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const myMemberships = await db
      .select({ conversationId: directConversationMembers.conversationId })
      .from(directConversationMembers)
      .where(eq(directConversationMembers.userId, userId));

    const ids = myMemberships.map((m) => m.conversationId);
    if (ids.length === 0) return jsonResponse({ conversations: [] });

    const convs = await db
      .select()
      .from(directConversations)
      .where(inArray(directConversations.id, ids));

    const memberRows = await db
      .select({
        conversationId: directConversationMembers.conversationId,
        userId: users.id,
        name: users.name,
        avatar: users.avatar,
        status: users.status,
      })
      .from(directConversationMembers)
      .innerJoin(users, eq(directConversationMembers.userId, users.id))
      .where(inArray(directConversationMembers.conversationId, ids));

    const lastIds = await db
      .select({
        conversationId: directMessages.conversationId,
        maxId: sql<number>`max(${directMessages.id})`,
      })
      .from(directMessages)
      .where(inArray(directMessages.conversationId, ids))
      .groupBy(directMessages.conversationId);

    const maxIds = lastIds.map((r) => r.maxId).filter((n): n is number => n != null);
    const lastMessages = maxIds.length
      ? await db
          .select({
            id: directMessages.id,
            conversationId: directMessages.conversationId,
            content: directMessages.content,
            createdAt: directMessages.createdAt,
          })
          .from(directMessages)
          .where(inArray(directMessages.id, maxIds))
      : [];

    const lastByConv = new Map(lastMessages.map((m) => [m.conversationId, m]));

    const conversations = convs
      .map((conv) => {
        const members = memberRows
          .filter((m) => m.conversationId === conv.id)
          .map((m) => ({ id: m.userId, name: m.name, avatar: m.avatar, status: m.status }));
        const last = lastByConv.get(conv.id) ?? null;
        return {
          id: conv.id,
          type: conv.type,
          name: conv.name,
          members,
          lastMessage: last
            ? { content: last.content, createdAt: last.createdAt }
            : null,
        };
      })
      .sort((a, b) => {
        const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return bt - at;
      });

    return jsonResponse({ conversations });
  } catch {
    return errorResponse('Unable to fetch conversations', 500);
  }
}

export async function POST(request: Request) {
  try {
    await ensureDmTables();
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const body = (await request.json()) as { targetUserId?: number };
    const targetUserId = Number(body.targetUserId);
    if (!targetUserId || Number.isNaN(targetUserId)) {
      return errorResponse('targetUserId is required', 400);
    }
    if (targetUserId === userId) return errorResponse('Cannot DM yourself', 400);

    const [target] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!target) return errorResponse('User not found', 404);

    const myDmIds = (
      await db
        .select({ conversationId: directConversationMembers.conversationId })
        .from(directConversationMembers)
        .innerJoin(
          directConversations,
          eq(directConversations.id, directConversationMembers.conversationId),
        )
        .where(
          and(eq(directConversationMembers.userId, userId), eq(directConversations.type, 'dm')),
        )
    ).map((r) => r.conversationId);

    if (myDmIds.length > 0) {
      const shared = await db
        .select({ conversationId: directConversationMembers.conversationId })
        .from(directConversationMembers)
        .where(
          and(
            inArray(directConversationMembers.conversationId, myDmIds),
            eq(directConversationMembers.userId, targetUserId),
          ),
        )
        .limit(1);
      if (shared.length > 0) {
        return jsonResponse({ conversationId: shared[0].conversationId, existing: true });
      }
    }

    const [conversation] = await db
      .insert(directConversations)
      .values({ type: 'dm', ownerId: userId })
      .returning();

    await db.insert(directConversationMembers).values([
      { conversationId: conversation.id, userId },
      { conversationId: conversation.id, userId: targetUserId },
    ]);

    return jsonResponse({ conversationId: conversation.id, existing: false }, 201);
  } catch {
    return errorResponse('Unable to create conversation', 500);
  }
}
