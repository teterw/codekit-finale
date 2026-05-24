import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { errorResponse, getUserId, jsonResponse } from '@/lib/api-helpers';
import { getPusherServer } from '@/lib/pusher';

// The deployed voice_participants table only has core columns
// (id, channel_id, user_id, peer_id, updated_at) and no unique constraint on
// (channel_id, user_id). The app DB role is not the table owner, so it cannot
// ALTER the table to add the mute/deafen/speaking columns or the constraint.
// Everything below therefore touches only the core columns; per-user mute/
// deafen/speaking/camera state is ephemeral and relayed over Pusher instead.

const CLEANUP_INTERVAL_MS = 60_000;
let _lastCleanup = 0;

let _voiceTable: Promise<void> | null = null;

function ensureVoiceTable(): Promise<void> {
  if (_voiceTable) return _voiceTable;
  _voiceTable = (async () => {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS voice_participants (
          id SERIAL PRIMARY KEY,
          channel_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          peer_id TEXT NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } catch { /* table already exists or no DDL permission */ }
  })();
  return _voiceTable;
}

interface ParticipantRow {
  user_id: number;
  peer_id: string;
  user_name: string;
  user_avatar: string | null;
}

async function getParticipantList(channelId: number) {
  const result = await db.execute(sql`
    SELECT vp.user_id, vp.peer_id, u.name AS user_name, u.avatar AS user_avatar
    FROM voice_participants vp
    JOIN users u ON u.id = vp.user_id
    WHERE vp.channel_id = ${channelId}
  `);
  const rows = (result.rows ?? []) as unknown as ParticipantRow[];
  return rows.map(r => ({
    userId: r.user_id,
    peerId: r.peer_id,
    userName: r.user_name,
    userAvatar: r.user_avatar,
    isMuted: false,
    isDeafened: false,
    isSpeaking: false,
    isCameraOn: false,
  }));
}

export async function GET(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    await ensureVoiceTable();
    const { channelId: channelIdStr } = await params;
    const channelId = Number(channelIdStr);
    if (Number.isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    // Clean stale participants (older than 10 minutes — PATCH refreshes updated_at on state changes).
    // Throttled so a frequently-polled GET doesn't fire a DELETE round-trip every time.
    const now = Date.now();
    if (now - _lastCleanup > CLEANUP_INTERVAL_MS) {
      _lastCleanup = now;
      await db.execute(sql`DELETE FROM voice_participants WHERE updated_at < NOW() - INTERVAL '10 minutes'`);
    }

    const participants = await getParticipantList(channelId);
    return jsonResponse({ participants });
  } catch (e) {
    console.error('[Voice GET] FAILED:', e);
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

    // Manual upsert: no unique constraint exists on (channel_id, user_id),
    // so ON CONFLICT is unavailable — delete any prior row then insert.
    await db.execute(sql`DELETE FROM voice_participants WHERE channel_id = ${channelId} AND user_id = ${userId}`);
    await db.execute(sql`
      INSERT INTO voice_participants (channel_id, user_id, peer_id, updated_at)
      VALUES (${channelId}, ${userId}, ${peerId}, NOW())
    `);

    const participants = await getParticipantList(channelId);
    const me = participants.find(p => p.userId === userId);

    try {
      await getPusherServer().trigger(`voice-channel-${channelId}`, 'voice-user-joined', me ?? { userId, peerId });
    } catch (e) {
      console.error('[Voice POST] Pusher trigger failed:', e);
    }

    return jsonResponse({ success: true, participants });
  } catch (e) {
    console.error('[Voice POST] FAILED:', e);
    return errorResponse('Unable to join voice channel', 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId: channelIdStr } = await params;
    const channelId = Number(channelIdStr);
    if (Number.isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    const body = (await request.json()) as {
      isMuted?: boolean;
      isDeafened?: boolean;
      isSpeaking?: boolean;
      isCameraOn?: boolean;
      soundboard?: { name: string; tone: number };
    };

    // Keep the row fresh so the stale-cleanup doesn't drop an active user.
    try {
      await db.execute(sql`UPDATE voice_participants SET updated_at = NOW() WHERE channel_id = ${channelId} AND user_id = ${userId}`);
    } catch { /* best effort */ }

    // Soundboard clips are fire-and-forget: relay to everyone in the channel.
    if (body.soundboard) {
      try {
        await getPusherServer().trigger(`voice-channel-${channelId}`, 'voice-soundboard', {
          userId,
          name: body.soundboard.name,
          tone: body.soundboard.tone,
        });
      } catch { /* Pusher not configured */ }
      return jsonResponse({ success: true });
    }

    // Mute/deafen/speaking/camera aren't persisted (no columns) — relay live.
    try {
      await getPusherServer().trigger(`voice-channel-${channelId}`, 'voice-user-state-updated', { userId, ...body });
    } catch { /* Pusher not configured */ }

    return jsonResponse({ success: true });
  } catch (e) {
    console.error('[Voice PATCH] FAILED:', e);
    return errorResponse('Unable to update voice state', 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const userId = getUserId(request);
    if (!userId) return errorResponse('Missing x-user-id header', 401);

    const { channelId: channelIdStr } = await params;
    const channelId = Number(channelIdStr);
    if (Number.isNaN(channelId)) return errorResponse('Invalid channel id', 400);

    await db.execute(sql`DELETE FROM voice_participants WHERE channel_id = ${channelId} AND user_id = ${userId}`);

    try {
      await getPusherServer().trigger(`voice-channel-${channelId}`, 'voice-user-left', { userId });
    } catch { /* Pusher not configured */ }

    return jsonResponse({ success: true });
  } catch (e) {
    console.error('[Voice DELETE] FAILED:', e);
    return errorResponse('Unable to leave voice channel', 500);
  }
}
