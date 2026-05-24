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
