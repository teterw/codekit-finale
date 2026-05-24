import { drizzle } from 'drizzle-orm/neon-serverless/driver';
import { Pool } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined. Set it in your environment.');
}

const client = new Pool({ connectionString });
export const db = drizzle(client);
