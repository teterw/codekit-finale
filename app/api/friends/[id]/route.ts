import { db } from '@/db';
import { friendships } from '@/db/schema';
import { and, eq, or } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { ensureFriendsTable } from '../route';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureFriendsTable();
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { id } = await params;
    const friendshipId = Number(id);
    if (Number.isNaN(friendshipId)) return errorResponse('Invalid id', 400);

    const [f] = await db.select().from(friendships).where(eq(friendships.id, friendshipId)).limit(1);
    if (!f) return errorResponse('Request not found', 404);
    if (f.addresseeId !== userId) return errorResponse('Only the recipient can accept', 403);

    await db.update(friendships).set({ status: 'accepted' }).where(eq(friendships.id, friendshipId));
    return jsonResponse({ status: 'accepted' });
  } catch {
    return errorResponse('Unable to accept request', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureFriendsTable();
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { id } = await params;
    const friendshipId = Number(id);
    if (Number.isNaN(friendshipId)) return errorResponse('Invalid id', 400);

    const [f] = await db.select().from(friendships).where(eq(friendships.id, friendshipId)).limit(1);
    if (!f) return errorResponse('Request not found', 404);
    if (f.requesterId !== userId && f.addresseeId !== userId) {
      return errorResponse('Access denied', 403);
    }

    await db
      .delete(friendships)
      .where(
        and(
          eq(friendships.id, friendshipId),
          or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
        ),
      );
    return jsonResponse({ success: true });
  } catch {
    return errorResponse('Unable to remove friend', 500);
  }
}
