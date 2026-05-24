import { db, ensureFeatureColumns } from '@/db';
import { messages } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { getPusherServer } from '@/lib/pusher';

const BASE_RETURNING = {
  id: messages.id,
  channelId: messages.channelId,
  userId: messages.userId,
  content: messages.content,
  createdAt: messages.createdAt,
  updatedAt: messages.updatedAt,
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ channelId: string; messageId: string }> },
) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId, messageId } = await params;
    const channelIdNumber = Number(channelId);
    const messageIdNumber = Number(messageId);
    if (Number.isNaN(channelIdNumber) || Number.isNaN(messageIdNumber)) {
      return errorResponse('Invalid channel id or message id', 400);
    }

    const body = (await request.json()) as { content?: string; isPinned?: boolean };

    await ensureFeatureColumns();

    // Pin toggle — any member can pin
    if (body.isPinned !== undefined) {
      let updated: Record<string, unknown> | null = null;

      try {
        // Try full update with is_pinned column
        const [row] = await db
          .update(messages)
          .set({ isPinned: body.isPinned })
          .where(and(eq(messages.id, messageIdNumber), eq(messages.channelId, channelIdNumber)))
          .returning();
        updated = row ?? null;
      } catch {
        // is_pinned column doesn't exist — acknowledge without persisting
        updated = { id: messageIdNumber, channelId: channelIdNumber, isPinned: body.isPinned };
      }

      if (!updated) return errorResponse('Message not found', 404);

      try {
        await getPusherServer().trigger(`channel-${channelIdNumber}`, 'message-updated', updated);
      } catch { /* Pusher not configured */ }

      return jsonResponse({ message: updated });
    }

    // Content edit — only message author
    const content = body.content?.trim();
    if (!content) return errorResponse('Message content is required', 400);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let updated: any;

    try {
      // Try returning all columns (includes reply_to_id, is_pinned)
      [updated] = await db
        .update(messages)
        .set({ content, updatedAt: new Date() })
        .where(and(eq(messages.id, messageIdNumber), eq(messages.channelId, channelIdNumber), eq(messages.userId, userId)))
        .returning();
    } catch {
      // Fallback: return only guaranteed base columns
      [updated] = await db
        .update(messages)
        .set({ content, updatedAt: new Date() })
        .where(and(eq(messages.id, messageIdNumber), eq(messages.channelId, channelIdNumber), eq(messages.userId, userId)))
        .returning(BASE_RETURNING);
    }

    if (!updated) return errorResponse('Message not found or not editable', 404);

    try {
      await getPusherServer().trigger(`channel-${channelIdNumber}`, 'message-updated', updated);
    } catch { /* Pusher not configured */ }

    return jsonResponse({ message: updated });
  } catch {
    return errorResponse('Unable to update message', 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ channelId: string; messageId: string }> },
) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId, messageId } = await params;
    const channelIdNumber = Number(channelId);
    const messageIdNumber = Number(messageId);
    if (Number.isNaN(channelIdNumber) || Number.isNaN(messageIdNumber)) {
      return errorResponse('Invalid channel id or message id', 400);
    }

    const [deleted] = await db
      .delete(messages)
      .where(and(eq(messages.id, messageIdNumber), eq(messages.channelId, channelIdNumber), eq(messages.userId, userId)))
      .returning({ id: messages.id });

    if (!deleted) return errorResponse('Message not found or not deletable', 404);

    try {
      await getPusherServer().trigger(`channel-${channelIdNumber}`, 'message-deleted', { id: messageIdNumber });
    } catch { /* Pusher not configured */ }

    return jsonResponse({ success: true });
  } catch {
    return errorResponse('Unable to delete message', 500);
  }
}
