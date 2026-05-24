import { db } from '@/db';
import { servers, members, channels } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const rows = await db
      .select({ id: servers.id, name: servers.name, icon: servers.icon, ownerId: servers.ownerId, createdAt: servers.createdAt })
      .from(servers)
      .innerJoin(members, eq(members.serverId, servers.id))
      .where(eq(members.userId, userId));

    return jsonResponse({ servers: rows });
  } catch {
    return errorResponse('Unable to fetch servers', 500);
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) return errorResponse('Server name is required', 400);

    const [server] = await db.insert(servers).values({ name, ownerId: userId }).returning();

    await db.insert(members).values({ userId, serverId: server.id, role: 'admin' });

    await db.insert(channels).values([
      { serverId: server.id, name: 'general', type: 'text' },
      { serverId: server.id, name: 'General Voice', type: 'voice' },
    ]);

    return jsonResponse({ server }, 201);
  } catch {
    return errorResponse('Unable to create server', 500);
  }
}
