import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Use your DATABASE_URL from .env.dev
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/postgres';
const client = postgres(connectionString, { ssl: 'require' });

export const db = drizzle(client);
