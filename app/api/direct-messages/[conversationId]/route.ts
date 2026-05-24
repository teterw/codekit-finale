import { db } from '@/db';
import { directConversations, directConversationMembers, directMessages, users } from '@/db/schema';
import { and, desc, eq, lt } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

export async function GET(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { conversationId } = await params;
    const convId = Number(conversationId);
    if (Number.isNaN(convId)) return errorResponse('Invalid conversation id', 400);

    const [conversation] = await db.select().from(directConversations).where(eq(directConversations.id, convId)).limit(1);
    if (!conversation) return errorResponse('Conversation not found', 404);

    const membership = await db
      .select()
      .from(directConversationMembers)
      .where(and(eq(directConversationMembers.userId, userId), eq(directConversationMembers.conversationId, convId)))
      .limit(1);
    if (membership.length === 0) return errorResponse('Access denied', 403);

    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    const conditions = cursor
      ? and(eq(directMessages.conversationId, convId), lt(directMessages.id, Number(cursor)))
      : eq(directMessages.conversationId, convId);

    const rows = await db
      .select({
        id: directMessages.id,
        content: directMessages.content,
        createdAt: directMessages.createdAt,
        updatedAt: directMessages.updatedAt,
        userId: directMessages.userId,
        userName: users.name,
        userAvatar: users.avatar,
      })
      .from(directMessages)
      .innerJoin(users, eq(directMessages.userId, users.id))
      .where(conditions)
      .orderBy(desc(directMessages.id))
      .limit(30);

    const nextCursor = rows.length > 0 ? rows[rows.length - 1].id : null;
    return jsonResponse({ messages: rows, nextCursor });
  } catch {
    return errorResponse('Unable to fetch messages', 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { conversationId } = await params;
    const convId = Number(conversationId);
    if (Number.isNaN(convId)) return errorResponse('Invalid conversation id', 400);

    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim();
    if (!content) return errorResponse('Message content is required', 400);

    const [conversation] = await db.select().from(directConversations).where(eq(directConversations.id, convId)).limit(1);
    if (!conversation) return errorResponse('Conversation not found', 404);

    const membership = await db
      .select()
      .from(directConversationMembers)
      .where(and(eq(directConversationMembers.userId, userId), eq(directConversationMembers.conversationId, convId)))
      .limit(1);
    if (membership.length === 0) return errorResponse('Access denied', 403);

    const [sender] = await db
      .select({ name: users.name, avatar: users.avatar })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [created] = await db
      .insert(directMessages)
      .values({ conversationId: convId, userId, content })
      .returning();

    return jsonResponse(
      { message: { ...created, userName: sender?.name ?? 'Unknown', userAvatar: sender?.avatar ?? null } },
      201,
    );
  } catch {
    return errorResponse('Unable to create message', 500);
  }
}
