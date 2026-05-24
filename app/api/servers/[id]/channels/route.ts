import { db } from '@/db';
import { channels, members } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const body = (await request.json()) as { name?: string; type?: string };
    const name = body.name?.trim();
    const type = body.type === 'voice' ? 'voice' : 'text';

    if (!name) {
      return errorResponse('Channel name is required', 400);
    }

    const membership = await db
      .select()
      .from(members)
      .where(and(eq(members.serverId, serverId), eq(members.userId, userId)))
      .limit(1);

    if (membership.length === 0) {
      return errorResponse('Access denied', 403);
    }

    const [created] = await db
      .insert(channels)
      .values({ serverId, name, type })
      .returning();

    return jsonResponse({ channel: created });
  } catch (error) {
    return errorResponse('Unable to create channel', 500);
  }
}
