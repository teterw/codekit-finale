import { db } from '@/db';
import { voiceParticipants, users } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS voice_participants (
      id SERIAL PRIMARY KEY,
      channel_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      peer_id TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT voice_participants_channel_user UNIQUE (channel_id, user_id)
    )
  `);
}

export async function GET(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    await ensureTable();

    const { channelId: channelIdStr } = await params;
    const channelId = Number(channelIdStr);
    if (Number.isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    // Clean stale participants (older than 3 minutes)
    await db.execute(sql`
      DELETE FROM voice_participants WHERE updated_at < NOW() - INTERVAL '3 minutes'
    `);

    const participants = await db
      .select({
        userId: voiceParticipants.userId,
        peerId: voiceParticipants.peerId,
        userName: users.name,
        userAvatar: users.avatar,
      })
      .from(voiceParticipants)
      .innerJoin(users, eq(users.id, voiceParticipants.userId))
      .where(eq(voiceParticipants.channelId, channelId));

    return jsonResponse({ participants });
  } catch {
    return errorResponse('Unable to fetch voice participants', 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    await ensureTable();

    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId: channelIdStr } = await params;
    const channelId = Number(channelIdStr);
    if (Number.isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    const body = (await request.json()) as { peerId?: string };
    const peerId = body.peerId?.trim();
    if (!peerId) return errorResponse('peerId is required', 400);

    await db.execute(sql`
      INSERT INTO voice_participants (channel_id, user_id, peer_id)
      VALUES (${channelId}, ${userId}, ${peerId})
      ON CONFLICT ON CONSTRAINT voice_participants_channel_user
      DO UPDATE SET peer_id = ${peerId}, updated_at = NOW()
    `);

    return jsonResponse({ success: true });
  } catch {
    return errorResponse('Unable to join voice channel', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    await ensureTable();

    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId: channelIdStr } = await params;
    const channelId = Number(channelIdStr);
    if (Number.isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    await db
      .delete(voiceParticipants)
      .where(and(eq(voiceParticipants.channelId, channelId), eq(voiceParticipants.userId, userId)));

    return jsonResponse({ success: true });
  } catch {
    return errorResponse('Unable to leave voice channel', 500);
  }
}
