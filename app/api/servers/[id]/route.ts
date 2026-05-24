import { db } from '@/db';
import { servers, channels, users, members } from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
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
      .select({
        id: channels.id,
        name: channels.name,
        type: channels.type,
        createdAt: channels.createdAt,
      })
      .from(channels)
      .where(eq(channels.serverId, serverId))
      .orderBy(asc(channels.createdAt));

    const onlineMembers = await db
      .select({
        id: users.id,
        name: users.name,
        avatar: users.avatar,
        status: users.status,
      })
      .from(users)
      .innerJoin(members, eq(members.userId, users.id))
      .where(and(eq(members.serverId, serverId), eq(users.status, 'online')));

    return jsonResponse({ server, channels: channelRows, onlineMembers });
  } catch (error) {
    return errorResponse('Unable to fetch server details', 500);
  }
}
