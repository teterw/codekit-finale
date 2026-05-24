import { db } from '@/db';
import { channels, messages, members } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

export async function POST(request: Request, { params }: { params: Promise<{ channelId: string; messageId: string }> }) {
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

    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim();
    if (!content) {
      return errorResponse('Message content is required', 400);
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

    const [created] = await db
      .insert(messages)
      .values({ channelId: channelIdNumber, userId, content })
      .returning();

    return jsonResponse({ message: created }, 201);
  } catch (error) {
    return errorResponse('Unable to create message', 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ channelId: string; messageId: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return errorResponse('Missing x-user-id header', 401);
    }

    const { channelId, messageId } = await params;
    const channelIdNumber = Number(channelId);
    const messageIdNumber = Number(messageId);
    if (Number.isNaN(channelIdNumber) || Number.isNaN(messageIdNumber)) {
      return errorResponse('Invalid channel id or message id', 400);
    }

    const body = (await request.json()) as { content?: string };
    const content = body.content?.trim();
    if (!content) {
      return errorResponse('Message content is required', 400);
    }

    const [updated] = await db
      .update(messages)
      .set({ content, updatedAt: new Date() })
      .where(
        and(
          eq(messages.id, messageIdNumber),
          eq(messages.channelId, channelIdNumber),
          eq(messages.userId, userId),
        ),
      )
      .returning();

    if (!updated) {
      return errorResponse('Message not found or not editable', 404);
    }

    return jsonResponse({ message: updated });
  } catch (error) {
    return errorResponse('Unable to update message', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ channelId: string; messageId: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return errorResponse('Missing x-user-id header', 401);
    }

    const { channelId, messageId } = await params;
    const channelIdNumber = Number(channelId);
    const messageIdNumber = Number(messageId);
    if (Number.isNaN(channelIdNumber) || Number.isNaN(messageIdNumber)) {
      return errorResponse('Invalid channel id or message id', 400);
    }

    await db
      .delete(messages)
      .where(
        and(
          eq(messages.id, messageIdNumber),
          eq(messages.channelId, channelIdNumber),
          eq(messages.userId, userId),
        ),
      );

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse('Unable to delete message', 500);
  }
}
