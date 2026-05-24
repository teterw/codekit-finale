import { db } from '@/db';
import { invites, members } from '@/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

export async function POST(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return errorResponse('Missing x-user-id header', 401);
    }

    const body = (await request.json()) as { code?: string };
    const code = body.code?.trim();
    if (!code) {
      return errorResponse('Invite code is required', 400);
    }

    const [invite] = await db
      .select()
      .from(invites)
      .where(and(eq(invites.code, code), gt(invites.expiresAt, new Date())))
      .limit(1);

    if (!invite) {
      return errorResponse('Invite code is invalid or expired', 404);
    }

    const existing = await db
      .select()
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.serverId, invite.serverId)))
      .limit(1);

    if (existing.length > 0) {
      return jsonResponse({ joined: true, serverId: invite.serverId });
    }

    await db.insert(members).values({
      userId,
      serverId: invite.serverId,
      role: 'member',
    });

    return jsonResponse({ joined: true, serverId: invite.serverId });
  } catch (error) {
    return errorResponse('Unable to join server', 500);
  }
}
