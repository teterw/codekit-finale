import { db } from '@/db';
import { invites, members } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { errorResponse, generateInviteCode, getUserId, jsonResponse } from '@/lib/api-helpers';

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return errorResponse('Missing x-user-id header', 401);
    }

    const body = (await request.json()) as { serverId?: number; expiresInHours?: number };
    const serverId = Number(body.serverId);
    if (Number.isNaN(serverId)) {
      return errorResponse('serverId is required', 400);
    }

    const membership = await db
      .select()
      .from(members)
      .where(and(eq(members.serverId, serverId), eq(members.userId, userId)))
      .limit(1);

    if (membership.length === 0) {
      return errorResponse('Access denied', 403);
    }

    const expiresInHours = Number(body.expiresInHours) || 24;
    const code = generateInviteCode(8);
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const [created] = await db
      .insert(invites)
      .values({ serverId, code, expiresAt })
      .returning();

    return jsonResponse({ invite: created }, 201);
  } catch (error) {
    return errorResponse('Unable to generate invite', 500);
  }
}
