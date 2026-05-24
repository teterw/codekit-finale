import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { errorResponse, hashPassword, jsonResponse } from '@/lib/api-helpers';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      avatar?: string;
    };

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const avatar = body.avatar;

    if (!name || !email || !password) {
      return errorResponse('name, email, and password are required', 400);
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return errorResponse('Email is already registered', 409);
    }

    const hashedPassword = hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        avatar: avatar ?? null,
      })
      .returning();

    return jsonResponse({
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        avatar: created.avatar,
        status: created.status,
        createdAt: created.createdAt,
      },
    });
  } catch (error) {
    return errorResponse('Registration failed', 500);
  }
}
