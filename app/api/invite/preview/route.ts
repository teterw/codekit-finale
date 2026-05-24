import { db } from '@/db';
import { invites, servers, members } from '@/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { errorResponse, jsonResponse } from '@/lib/api-helpers';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code')?.trim().toUpperCase();
    if (!code) return errorResponse('code is required', 400);

    const [invite] = await db
      .select()
      .from(invites)
      .where(and(eq(invites.code, code), gt(invites.expiresAt, new Date())))
      .limit(1);

    if (!invite) return errorResponse('Invalid or expired invite code', 404);

    const [server] = await db
      .select({ id: servers.id, name: servers.name, icon: servers.icon })
      .from(servers)
      .where(eq(servers.id, invite.serverId))
      .limit(1);

    if (!server) return errorResponse('Server not found', 404);

    const memberList = await db
      .select({ userId: members.userId })
      .from(members)
      .where(eq(members.serverId, invite.serverId));

    return jsonResponse({ server: { ...server, memberCount: memberList.length } });
  } catch {
    return errorResponse('Unable to preview invite', 500);
  }
}
