import 'client-only';
import PusherClient from 'pusher-js';

let _client: PusherClient | null = null;

export function getPusherClient(userId: number): PusherClient {
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
