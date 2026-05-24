import { db } from '@/db';
import { servers, channels, users, members, invites, voiceParticipants } from '@/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return errorResponse('Missing x-user-id header', 401);
    }

    const { id } = await params;
    const serverId = Number(id);
    if (Number.isNaN(serverId)) {
      return errorResponse('Invalid server id', 400);
    }

    const membership = await db
      .select()
      .from(members)
      .where(and(eq(members.serverId, serverId), eq(members.userId, userId)))
      .limit(1);

    if (membership.length === 0) {
      return errorResponse('Access denied', 403);
    }

    const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    if (!server) {
      return errorResponse('Server not found', 404);
    }

    const channelRows = await db
      .select({ id: channels.id, name: channels.name, type: channels.type, createdAt: channels.createdAt })
      .from(channels)
      .where(eq(channels.serverId, serverId))
      .orderBy(asc(channels.createdAt));

    const onlineMembers = await db
      .select({ id: users.id, name: users.name, avatar: users.avatar, status: users.status })
      .from(users)
      .innerJoin(members, eq(members.userId, users.id))
      .where(and(eq(members.serverId, serverId), eq(users.status, 'online')));

    return jsonResponse({ server, channels: channelRows, onlineMembers });
  } catch {
    return errorResponse('Unable to fetch server details', 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return errorResponse('Missing x-user-id header', 401);
    }

    const { id } = await params;
    const serverId = Number(id);
    if (Number.isNaN(serverId)) {
      return errorResponse('Invalid server id', 400);
    }

    const payload = (await request.json()) as { name?: string; icon?: string | null };
    if (payload.name === undefined && payload.icon === undefined) {
      return errorResponse('Nothing to update', 400);
    }

    const membership = await db
      .select()
      .from(members)
      .where(and(eq(members.serverId, serverId), eq(members.userId, userId)))
      .limit(1);

    if (membership.length === 0) {
      return errorResponse('Access denied', 403);
    }

    const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    if (!server) {
      return errorResponse('Server not found', 404);
    }

    const updateData: { name?: string; icon?: string | null } = {};
    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) {
        return errorResponse('Server name cannot be empty', 400);
      }
      updateData.name = name;
    }

    if (payload.icon !== undefined) {
      updateData.icon = payload.icon;
    }

    const [updatedServer] = await db
      .update(servers)
      .set(updateData)
      .where(eq(servers.id, serverId))
      .returning();

    return jsonResponse({ server: updatedServer });
  } catch {
    return errorResponse('Unable to update server', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return errorResponse('Missing x-user-id header', 401);
    }

    const { id } = await params;
    const serverId = Number(id);
    if (Number.isNaN(serverId)) {
      return errorResponse('Invalid server id', 400);
    }

    const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    if (!server) {
      return errorResponse('Server not found', 404);
    }

    if (server.ownerId !== userId) {
      return errorResponse('Only the server owner can delete the server', 403);
    }

    await db.execute(sql`delete from messages where channel_id in (select id from channels where server_id = ${serverId})`);
    await db.execute(sql`delete from voice_participants where channel_id in (select id from channels where server_id = ${serverId})`);
    await db.delete(invites).where(eq(invites.serverId, serverId));
    await db.delete(members).where(eq(members.serverId, serverId));
    await db.delete(channels).where(eq(channels.serverId, serverId));
    await db.delete(servers).where(eq(servers.id, serverId));

    return jsonResponse({ success: true });
  } catch {
    return errorResponse('Unable to delete server', 500);
  }
}
