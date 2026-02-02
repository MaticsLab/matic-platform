/**
 * Database Pool Management for Better Auth
 * Centralized database connection handling with lazy initialization
 */

import { Pool } from "pg";

// Singleton pool instance - created lazily at runtime
let _pool: Pool | null = null;

/**
 * Get or create the database pool.
 * This is called lazily at runtime, not at build time.
 */
export function getPool(): Pool | null {
  // Return existing pool if already created
  if (_pool) {
    return _pool;
  }
  
  // Check if DATABASE_URL is available (runtime check)
  if (!process.env.DATABASE_URL) {
    console.error('[Better Auth DB] DATABASE_URL is not set. Authentication will not work.');
    return null;
  }
  
  try {
    console.log('[Better Auth DB] Creating database pool...');
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Required for Supabase
      max: 5, // Increased from 1 for better concurrency
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    
    _pool.on('error', (error) => {
      console.error('[Better Auth DB] Pool error:', error);
      // Reset pool on error so it can be recreated
      _pool = null;
    });
    
    _pool.on('connect', () => {
      console.log('[Better Auth DB] Database pool connected successfully');
    });
    
    return _pool;
  } catch (error) {
    console.error('[Better Auth DB] Failed to create database pool:', error);
    return null;
  }
}

/**
 * Close the database pool (useful for cleanup in tests)
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    console.log('[Better Auth DB] Database pool closed');
  }
}
