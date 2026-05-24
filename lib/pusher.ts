import Pusher from 'pusher';
import PusherClient from 'pusher-js';

export function getPusherServer(): Pusher {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    throw new Error(
      'Missing Pusher server env vars. Set PUSHER_APP_ID, NEXT_PUBLIC_PUSHER_KEY, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_CLUSTER.',
    );
  }

  return new Pusher({ appId, key, secret, cluster, useTLS: true });
}

let _client: PusherClient | null = null;

export function getPusherClient(userId: number): PusherClient {
  if (typeof window === 'undefined') throw new Error('getPusherClient is browser-only');

  if (_client) return _client;

  _client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    authEndpoint: '/api/pusher/auth',
    auth: {
      headers: { 'x-user-id': String(userId) },
    },
  });

  return _client;
}

export function resetPusherClient() {
  if (_client) {
    _client.disconnect();
    _client = null;
  }
}
