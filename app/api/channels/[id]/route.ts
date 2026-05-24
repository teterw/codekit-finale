import { db } from '@/db';
import { channels, members, servers } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

async function getChannelAndCheckOwner(channelId: number, userId: number) {
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
  if (!channel) return { error: errorResponse('Channel not found', 404) };

  const [server] = await db.select({ ownerId: servers.ownerId }).from(servers).where(eq(servers.id, channel.serverId)).limit(1);
  if (!server) return { error: errorResponse('Server not found', 404) };

  const [membership] = await db
    .select({ role: members.role })
    .from(members)
    .where(and(eq(members.serverId, channel.serverId), eq(members.userId, userId)))
    .limit(1);

  if (!membership) return { error: errorResponse('Access denied', 403) };
  if (server.ownerId !== userId) return { error: errorResponse('Only the server owner can modify channels', 403) };

  return { channel };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Unauthorized', 401);

    const { id } = await params;
    const channelId = Number(id);
    if (isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) return errorResponse('Channel name is required', 400);
    if (name.length < 1 || name.length > 32) return errorResponse('Name must be 1–32 characters', 400);

    const { channel, error } = await getChannelAndCheckOwner(channelId, userId);
    if (error) return error;

    const [updated] = await db.update(channels).set({ name }).where(eq(channels.id, channelId)).returning();
    return jsonResponse({ channel: updated });
  } catch (e) {
    console.error('[channels PATCH]', e);
    return errorResponse('Failed to rename channel', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Unauthorized', 401);

    const { id } = await params;
    const channelId = Number(id);
    if (isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    const { channel, error } = await getChannelAndCheckOwner(channelId, userId);
    if (error) return error;

    await db.delete(channels).where(eq(channels.id, channel!.id));
    return jsonResponse({ ok: true });
  } catch (e) {
    console.error('[channels DELETE]', e);
    return errorResponse('Failed to delete channel', 500);
  }
}
