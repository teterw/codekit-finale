import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { getPusherServer } from '@/lib/pusher';

export async function DELETE(request: Request) {
  const userId = getUserId(request);
  if (!userId) return errorResponse('Unauthorized', 401);

  const [updated] = await db
    .update(users)
    .set({ avatar: null, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (!updated) return errorResponse('User not found', 404);

  try {
    await getPusherServer().trigger(`user-${userId}`, 'profile-updated', { avatar: null });
  } catch { /* Pusher not configured */ }

  return jsonResponse({ success: true });
}
