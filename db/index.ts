import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

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
