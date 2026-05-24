import { db } from '@/db';
import { servers, members } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return errorResponse('Missing x-user-id header', 401);
    }

    const rows = await db
      .select({
        id: servers.id,
        name: servers.name,
        icon: servers.icon,
        ownerId: servers.ownerId,
        createdAt: servers.createdAt,
      })
      .from(servers)
      .innerJoin(members, eq(members.serverId, servers.id))
      .where(eq(members.userId, userId));

    return jsonResponse({ servers: rows });
  } catch (error) {
    return errorResponse('Unable to fetch servers', 500);
  }
}
