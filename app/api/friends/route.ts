import { db } from '@/db';
import { friendships, users } from '@/db/schema';
import { and, eq, or, sql } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

let _friendsTable: Promise<void> | null = null;

export function ensureFriendsTable(): Promise<void> {
  if (_friendsTable) return _friendsTable;
  _friendsTable = (async () => {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS friendships (
          id SERIAL PRIMARY KEY,
          requester_id INTEGER NOT NULL,
          addressee_id INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT friendships_pair_unique UNIQUE (requester_id, addressee_id)
        )
      `);
    } catch { /* table already exists or no DDL permission */ }
  })();
  return _friendsTable;
}

export async function GET(request: Request) {
  try {
    await ensureFriendsTable();
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const rows = await db
      .select({
        id: friendships.id,
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
        status: friendships.status,
        createdAt: friendships.createdAt,
      })
      .from(friendships)
      .where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));

    const otherIds = [...new Set(rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId)))];
    const profiles = otherIds.length
      ? await db
          .select({ id: users.id, name: users.name, avatar: users.avatar, status: users.status })
          .from(users)
          .where(or(...otherIds.map((id) => eq(users.id, id))))
      : [];
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const decorate = (r: (typeof rows)[number]) => {
      const otherId = r.requesterId === userId ? r.addresseeId : r.requesterId;
      const p = profileById.get(otherId);
      return {
        friendshipId: r.id,
        userId: otherId,
        name: p?.name ?? 'Unknown',
        avatar: p?.avatar ?? null,
        status: p?.status ?? 'offline',
      };
    };

    const friends = rows.filter((r) => r.status === 'accepted').map(decorate);
    const incoming = rows
      .filter((r) => r.status === 'pending' && r.addresseeId === userId)
      .map(decorate);
    const outgoing = rows
      .filter((r) => r.status === 'pending' && r.requesterId === userId)
      .map(decorate);

    return jsonResponse({ friends, incoming, outgoing });
  } catch {
    return errorResponse('Unable to fetch friends', 500);
  }
}

export async function POST(request: Request) {
  try {
    await ensureFriendsTable();
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const body = (await request.json()) as { targetUserId?: number; name?: string };
    let targetId = Number(body.targetUserId);

    if (!targetId || Number.isNaN(targetId)) {
      const name = body.name?.trim();
      if (!name) return errorResponse('targetUserId or name is required', 400);
      const [found] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.name, name))
        .limit(1);
      if (!found) return errorResponse('User not found', 404);
      targetId = found.id;
    }

    if (targetId === userId) return errorResponse('Cannot add yourself', 400);

    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) return errorResponse('User not found', 404);

    const existing = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, targetId)),
          and(eq(friendships.requesterId, targetId), eq(friendships.addresseeId, userId)),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const f = existing[0];
      if (f.status === 'accepted') return jsonResponse({ status: 'accepted', friendshipId: f.id });
      // Reverse pending request -> accept it
      if (f.addresseeId === userId) {
        await db.update(friendships).set({ status: 'accepted' }).where(eq(friendships.id, f.id));
        return jsonResponse({ status: 'accepted', friendshipId: f.id });
      }
      return jsonResponse({ status: 'pending', friendshipId: f.id });
    }

    const [created] = await db
      .insert(friendships)
      .values({ requesterId: userId, addresseeId: targetId, status: 'pending' })
      .returning();

    return jsonResponse({ status: 'pending', friendshipId: created.id }, 201);
  } catch {
    return errorResponse('Unable to send friend request', 500);
  }
}
