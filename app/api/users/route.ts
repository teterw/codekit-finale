import { db } from '@/db';
import { users } from '@/db/schema';
import { and, ne, or, ilike } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim();
    if (!q) return jsonResponse({ users: [] });

    const rows = await db
      .select({ id: users.id, name: users.name, avatar: users.avatar, status: users.status })
      .from(users)
      .where(
        and(
          ne(users.id, userId),
          or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)),
        ),
      )
      .limit(10);

    return jsonResponse({ users: rows });
  } catch {
    return errorResponse('Unable to search users', 500);
  }
}
