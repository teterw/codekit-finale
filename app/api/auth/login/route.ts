import { db, ensureSchema } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { errorResponse, jsonResponse, verifyPassword } from '@/lib/api-helpers';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    await ensureSchema();

    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email, avatar: users.avatar, password: users.password })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !verifyPassword(user.password, password)) {
      return errorResponse('Invalid email or password', 401);
    }

    return jsonResponse({ user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch (error) {
    console.error('[api/auth/login] error', error);
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(`Unable to login: ${message}`, 500);
  }
}
