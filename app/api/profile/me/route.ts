import { db } from '@/db';
import { users } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { getPusherServer } from '@/lib/pusher';

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Unauthorized', 401);

    await ensureProfileColumns();
  const userId = getUserId(request);
  if (!userId) return errorResponse('Unauthorized', 401);

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatar: users.avatar,
        username: users.username,
        bio: users.bio,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return errorResponse('User not found', 404);
    return jsonResponse({ user });
  } catch (e) {
    console.error('[profile/me GET]', e);
    return errorResponse('Failed to load profile', 500);
  }
}

export async function PATCH(request: Request) {
  const userId = getUserId(request);
  if (!userId) return errorResponse('Unauthorized', 401);

  const body = (await request.json()) as {
    name?: string;
    username?: string | null;
    bio?: string | null;
    status?: string;
    avatar?: string | null;
  };

  const update: Partial<{
    name: string;
    username: string | null;
    bio: string | null;
    status: string;
    avatar: string | null;
    updatedAt: Date;
  }> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2 || name.length > 32) return errorResponse('Name must be 2–32 characters', 400);
    update.name = name;
  }

  if (body.username !== undefined) {
    if (body.username === null || body.username === '') {
      update.username = null;
    } else {
      const username = String(body.username).trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        return errorResponse('Username must be 3–24 characters: lowercase letters, numbers, underscore', 400);
      }
      const taken = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, username), ne(users.id, userId)))
        .limit(1);
      if (taken.length > 0) return errorResponse('Username already taken', 409);
      update.username = username;
    }
  }

  if (body.bio !== undefined) {
    update.bio = body.bio === null ? null : String(body.bio).trim().slice(0, 160) || null;
  }

  if (body.status !== undefined) {
    if (!['online', 'idle', 'dnd', 'offline'].includes(String(body.status))) {
      return errorResponse('Invalid status', 400);
    }
    update.status = String(body.status);
  }

  if (body.avatar !== undefined) {
    update.avatar = body.avatar;
  }

  if (Object.keys(update).length === 0) return errorResponse('No updates provided', 400);

  update.updatedAt = new Date();

  try {
    const [updated] = await db.update(users).set(update).where(eq(users.id, userId)).returning();
    if (!updated) return errorResponse('User not found', 404);

    const profile = {
      id: updated.id,
      name: updated.name,
      username: updated.username,
      avatar: updated.avatar,
      bio: updated.bio,
      status: updated.status,
    };

    try {
      await getPusherServer().trigger(`user-${userId}`, 'profile-updated', profile);
    } catch { /* Pusher not configured */ }

    return jsonResponse({ user: { ...profile, email: updated.email, createdAt: updated.createdAt } });
  } catch (e) {
    console.error('[profile/me PATCH]', e);
    return errorResponse('Failed to save profile', 500);
  }
}
