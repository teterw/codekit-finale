import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined. Set it in your environment.');
}

const client = neon(connectionString);
export const db = drizzle(client);

// Schema must be created manually via Neon SQL editor; the app role lacks DDL permissions.
export function ensureSchema() {
  return Promise.resolve();
}

let _profileMigration: Promise<void> | null = null;

export function ensureProfileColumns(): Promise<void> {
  if (_profileMigration) return _profileMigration;
  _profileMigration = (async () => {
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS username text`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamp`);
      await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username) WHERE username IS NOT NULL`,
      );
    } catch (e) {
      console.error('[db] profile migration failed', e);
      _profileMigration = null;
      throw e;
    }
  })();
  return _profileMigration;
}

let _featureMigration: Promise<void> | null = null;

export function ensureFeatureColumns(): Promise<void> {
  if (_featureMigration) return _featureMigration;
  _featureMigration = (async () => {
    try {
      await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id integer`);
      await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS message_reactions (
          id serial PRIMARY KEY,
          message_id integer NOT NULL,
          user_id integer NOT NULL,
          emoji text NOT NULL,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS message_reactions_unique
        ON message_reactions(message_id, user_id, emoji)
      `);

      await db.execute(sql`ALTER TABLE voice_participants ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT false`);
      await db.execute(sql`ALTER TABLE voice_participants ADD COLUMN IF NOT EXISTS is_deafened boolean NOT NULL DEFAULT false`);
      await db.execute(sql`ALTER TABLE voice_participants ADD COLUMN IF NOT EXISTS is_speaking boolean NOT NULL DEFAULT false`);
    } catch (e) {
      console.error('[db] feature migration failed', e);
      _featureMigration = null;
      throw e;
    }
  })();
  return _featureMigration;
}
