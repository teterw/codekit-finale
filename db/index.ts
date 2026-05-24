import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined. Set it in your environment.');
}

const client = neon(connectionString);
export const db = drizzle(client);

let schemaReady: Promise<void> | null = null;

async function createSchema() {
  console.debug('[db] creating schema if missing');
  await db.execute(`
    create table if not exists users (
      id serial primary key,
      name text not null,
      email text not null,
      password text not null,
      avatar text,
      status text not null default 'offline',
      created_at timestamp not null default now()
    );
    create unique index if not exists users_email_unique on users(email);

    create table if not exists servers (
      id serial primary key,
      name text not null,
      icon text,
      owner_id integer not null,
      created_at timestamp not null default now()
    );

    create table if not exists channels (
      id serial primary key,
      server_id integer not null,
      name text not null,
      type text not null default 'text',
      created_at timestamp not null default now()
    );

    create table if not exists messages (
      id serial primary key,
      channel_id integer not null,
      user_id integer not null,
      content text not null,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
    );

    create table if not exists members (
      user_id integer not null,
      server_id integer not null,
      role text not null default 'member',
      joined_at timestamp not null default now(),
      primary key (user_id, server_id)
    );

    create table if not exists invites (
      id serial primary key,
      server_id integer not null,
      code text not null,
      created_at timestamp not null default now(),
      expires_at timestamp not null
    );
    create unique index if not exists invites_code_unique on invites(code);

    create table if not exists voice_participants (
      id serial primary key,
      channel_id integer not null,
      user_id integer not null,
      peer_id text not null,
      updated_at timestamp not null default now()
    );
    create unique index if not exists voice_participants_channel_user on voice_participants(channel_id, user_id);
  `);
}

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = createSchema();
  }
  return schemaReady;
}
