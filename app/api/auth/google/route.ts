import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { errorResponse, hashPassword, jsonResponse } from '@/lib/api-helpers';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      avatar?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    const avatar = body.avatar?.trim();

    if (!email || !name) {
      return errorResponse('Google email and name are required', 400);
    }

    const [existing] = await db
      .select({ id: users.id, name: users.name, email: users.email, avatar: users.avatar })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return jsonResponse({ user: existing });
    }

    const randomPassword = Math.random().toString(36).slice(2);
    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashPassword(randomPassword),
        avatar: avatar ?? null,
      })
      .returning();

    return jsonResponse({
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        avatar: created.avatar,
      },
    });
  } catch (error) {
    console.error('[api/auth/google] error', error);
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(`Unable to sign in with Google: ${message}`, 500);
  }
}
