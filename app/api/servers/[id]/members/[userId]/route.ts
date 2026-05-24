import { db } from '@/db';
import { servers, members, users } from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

async function membersList(serverId: number) {
  return db
    .select({ id: users.id, name: users.name, avatar: users.avatar, status: users.status, role: members.role })
    .from(users)
    .innerJoin(members, eq(members.userId, users.id))
    .where(eq(members.serverId, serverId))
    .orderBy(asc(users.name));
}

// Owner-only management of a single member: toggle admin role or hand over
// ownership. Custom (Discord-style colored) roles need the roles/member_roles
// tables, which the app DB role cannot create — not handled here.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const requesterId = getUserId(request);
    if (!requesterId) return errorResponse('Missing x-user-id header', 401);

    const { id, userId: targetStr } = await params;
    const serverId = Number(id);
    const targetUserId = Number(targetStr);
    if (Number.isNaN(serverId) || Number.isNaN(targetUserId)) return errorResponse('Invalid id', 400);

    const body = (await request.json()) as { role?: 'admin' | 'member'; transferOwner?: boolean };

    const [server] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    if (!server) return errorResponse('Server not found', 404);
    if (server.ownerId !== requesterId) return errorResponse('Only the server owner can manage members', 403);

    const [target] = await db
      .select()
      .from(members)
      .where(and(eq(members.serverId, serverId), eq(members.userId, targetUserId)))
      .limit(1);
    if (!target) return errorResponse('Member not found in this server', 404);

    if (body.transferOwner) {
      if (targetUserId === requesterId) return errorResponse('You already own this server', 400);
      await db.update(servers).set({ ownerId: targetUserId }).where(eq(servers.id, serverId));
      // New owner and previous owner both keep admin powers.
      await db.update(members).set({ role: 'admin' }).where(and(eq(members.serverId, serverId), eq(members.userId, targetUserId)));
      await db.update(members).set({ role: 'admin' }).where(and(eq(members.serverId, serverId), eq(members.userId, requesterId)));
    } else if (body.role === 'admin' || body.role === 'member') {
      if (targetUserId === server.ownerId) return errorResponse("Cannot change the owner's role", 400);
      await db
        .update(members)
        .set({ role: body.role })
        .where(and(eq(members.serverId, serverId), eq(members.userId, targetUserId)));
    } else {
      return errorResponse('Nothing to update', 400);
    }

    const [updatedServer] = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    return jsonResponse({ server: updatedServer, members: await membersList(serverId) });
  } catch (e) {
    console.error('[members PATCH] FAILED:', e);
    return errorResponse('Unable to update member', 500);
  }
}
