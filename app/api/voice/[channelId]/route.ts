import { db, ensureFeatureColumns } from '@/db';
import { voiceParticipants, users } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { getPusherServer } from '@/lib/pusher';

async function ensureVoiceTable() {
  await ensureFeatureColumns();
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS voice_participants (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        peer_id TEXT NOT NULL,
        is_muted BOOLEAN NOT NULL DEFAULT false,
        is_deafened BOOLEAN NOT NULL DEFAULT false,
        is_speaking BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT voice_participants_channel_user UNIQUE (channel_id, user_id)
      )
    `);
  } catch { /* table already exists or no DDL permission */ }
}

async function getParticipantList(channelId: number) {
  return db
    .select({
      userId: voiceParticipants.userId,
      peerId: voiceParticipants.peerId,
      isMuted: voiceParticipants.isMuted,
      isDeafened: voiceParticipants.isDeafened,
      isSpeaking: voiceParticipants.isSpeaking,
      userName: users.name,
      userAvatar: users.avatar,
    })
    .from(voiceParticipants)
    .innerJoin(users, eq(users.id, voiceParticipants.userId))
    .where(eq(voiceParticipants.channelId, channelId));
}

export async function GET(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    await ensureVoiceTable();
    const { channelId: channelIdStr } = await params;
    const channelId = Number(channelIdStr);
    if (Number.isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    // Clean stale participants (older than 10 minutes — PATCH refreshes updated_at on state changes)
    await db.execute(sql`DELETE FROM voice_participants WHERE updated_at < NOW() - INTERVAL '10 minutes'`);

    const participants = await getParticipantList(channelId);
    return jsonResponse({ participants });
  } catch {
    return errorResponse('Unable to fetch voice participants', 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    await ensureVoiceTable();
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId: channelIdStr } = await params;
    const channelId = Number(channelIdStr);
    if (Number.isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    const body = (await request.json()) as { peerId?: string };
    const peerId = body.peerId?.trim();
    if (!peerId) return errorResponse('peerId is required', 400);

    // Use Drizzle ORM upsert — avoids ON CONFLICT ON CONSTRAINT (needs named constraint,
    // not a unique index). ON CONFLICT (column_list) works with both.
    await db
      .insert(voiceParticipants)
      .values({ channelId, userId, peerId, isMuted: false, isDeafened: false, isSpeaking: false })
      .onConflictDoUpdate({
        target: [voiceParticipants.channelId, voiceParticipants.userId],
        set: { peerId, isMuted: false, isDeafened: false, isSpeaking: false, updatedAt: new Date() },
      });

    const participants = await getParticipantList(channelId);
    const me = participants.find(p => p.userId === userId);

    try {
      await getPusherServer().trigger(`voice-channel-${channelId}`, 'voice-user-joined', me ?? { userId, peerId });
    } catch { /* Pusher not configured */ }

    return jsonResponse({ success: true, participants });
  } catch {
    return errorResponse('Unable to join voice channel', 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    await ensureVoiceTable();
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId: channelIdStr } = await params;
    const channelId = Number(channelIdStr);
    if (Number.isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    const body = (await request.json()) as { isMuted?: boolean; isDeafened?: boolean; isSpeaking?: boolean };

    // Build SET fragments dynamically then reduce-join with commas
    const fields: ReturnType<typeof sql>[] = [];
    if (body.isMuted !== undefined) fields.push(sql`is_muted = ${body.isMuted}`);
    if (body.isDeafened !== undefined) fields.push(sql`is_deafened = ${body.isDeafened}`);
    if (body.isSpeaking !== undefined) fields.push(sql`is_speaking = ${body.isSpeaking}`);

    if (fields.length === 0) return errorResponse('No state to update', 400);
    fields.push(sql`updated_at = NOW()`);

    const setClause = fields.reduce((acc, f, i) => (i === 0 ? f : sql`${acc}, ${f}`));
    await db.execute(sql`UPDATE voice_participants SET ${setClause} WHERE channel_id = ${channelId} AND user_id = ${userId}`);

    const participants = await getParticipantList(channelId);
    const me = participants.find(p => p.userId === userId);

    try {
      await getPusherServer().trigger(`voice-channel-${channelId}`, 'voice-user-state-updated', me ?? { userId, ...body });
    } catch { /* Pusher not configured */ }

    return jsonResponse({ success: true });
  } catch {
    return errorResponse('Unable to update voice state', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    await ensureVoiceTable();
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId: channelIdStr } = await params;
    const channelId = Number(channelIdStr);
    if (Number.isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    await db
      .delete(voiceParticipants)
      .where(and(eq(voiceParticipants.channelId, channelId), eq(voiceParticipants.userId, userId)));

    try {
      await getPusherServer().trigger(`voice-channel-${channelId}`, 'voice-user-left', { userId });
    } catch { /* Pusher not configured */ }

    return jsonResponse({ success: true });
  } catch {
    return errorResponse('Unable to leave voice channel', 500);
  }
}
