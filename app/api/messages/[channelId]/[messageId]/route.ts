import { db } from '@/db';
import { messages } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { getPusherServer } from '@/lib/pusher';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ channelId: string; messageId: string }> },
) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId: channelIdStr, messageId: messageIdStr } = await params;
    const channelId = Number(channelIdStr);
    const messageId = Number(messageIdStr);
    if (Number.isNaN(channelId) || Number.isNaN(messageId)) return errorResponse('Invalid ids', 400);

    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim();
    if (!content) return errorResponse('Message content is required', 400);

    const [updated] = await db
      .update(messages)
      .set({ content, updatedAt: new Date() })
      .where(and(eq(messages.id, messageId), eq(messages.channelId, channelId), eq(messages.userId, userId)))
      .returning();

    if (!updated) return errorResponse('Message not found or not editable', 404);

    try {
      await getPusherServer().trigger(`channel-${channelId}`, 'message-updated', updated);
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

    const { channelId: channelIdStr, messageId: messageIdStr } = await params;
    const channelId = Number(channelIdStr);
    const messageId = Number(messageIdStr);
    if (Number.isNaN(channelId) || Number.isNaN(messageId)) return errorResponse('Invalid ids', 400);

    const [deleted] = await db
      .delete(messages)
      .where(and(eq(messages.id, messageId), eq(messages.channelId, channelId), eq(messages.userId, userId)))
      .returning();

    if (!deleted) return errorResponse('Message not found or not deletable', 404);

    try {
      await getPusherServer().trigger(`channel-${channelId}`, 'message-deleted', { id: messageId });
    } catch { /* Pusher not configured */ }

    return jsonResponse({ success: true });
  } catch {
    return errorResponse('Unable to delete message', 500);
  }
}
