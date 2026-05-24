import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const requesterId = getUserId(request);
  if (!requesterId) return errorResponse('Unauthorized', 401);

  const { userId } = await params;
  const id = Number(userId);
  if (isNaN(id)) return errorResponse('Invalid user id', 400);

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      avatar: users.avatar,
      username: users.username,
      bio: users.bio,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) return errorResponse('User not found', 404);
  return jsonResponse({ user });
}
