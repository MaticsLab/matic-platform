#!/usr/bin/env npx tsx

/**
 * User Migration Script - Supabase Auth to Better Auth
 * 
 * Run this script to migrate all users from Supabase Auth to Better Auth.
 * 
 * Usage:
 *   npx tsx scripts/migrate-users-to-better-auth.ts
 * 
 * Environment Variables Required:
 *   - DATABASE_URL: PostgreSQL connection string
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (admin access)
 */

import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

// Validate required environment variables
const requiredEnvVars = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

async function ensureBetterAuthTables(): Promise<void> {
  console.log("📋 Checking Better Auth tables...");
  
  // Check if user table exists
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'user'
    );
  `);
  
  if (!tableCheck.rows[0].exists) {
    console.log("📝 Creating Better Auth tables...");
    
    // Create user table with Better Auth schema + custom fields
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE NOT NULL,
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        image TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        supabase_user_id TEXT,
        migrated_from_supabase BOOLEAN DEFAULT FALSE,
        full_name TEXT,
        avatar_url TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
      CREATE INDEX IF NOT EXISTS idx_user_supabase_id ON "user"(supabase_user_id);
    `);
    
    // Create session table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        id TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        active_organization_id TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_session_user_id ON "session"(user_id);
      CREATE INDEX IF NOT EXISTS idx_session_token ON "session"(token);
    `);
    
    // Create account table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "account" (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        access_token TEXT,
        refresh_token TEXT,
        id_token TEXT,
        access_token_expires_at TIMESTAMPTZ,
        refresh_token_expires_at TIMESTAMPTZ,
        scope TEXT,
        password TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_account_user_id ON "account"(user_id);
    `);
    
    // Create verification table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "verification" (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Create organization tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "organization" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        logo TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS "member" (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(organization_id, user_id)
      );
      
      CREATE TABLE IF NOT EXISTS "invitation" (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        status TEXT NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMPTZ NOT NULL,
        inviter_id TEXT REFERENCES "user"(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log("✅ Better Auth tables created");
  } else {
    console.log("✅ Better Auth tables already exist");
    
    // Add custom columns if they don't exist
    try {
      await pool.query(`
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS supabase_user_id TEXT;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS migrated_from_supabase BOOLEAN DEFAULT FALSE;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS full_name TEXT;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      `);
      console.log("✅ Custom columns verified");
    } catch (err) {
      // Columns may already exist
    }
  }
}

async function migrateUsers(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  console.log("\n📥 Fetching users from Supabase Auth...");
  
  const { data: supabaseUsers, error: fetchError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (fetchError) {
    console.error("❌ Failed to fetch Supabase users:", fetchError);
    throw fetchError;
  }
  
  stats.total = supabaseUsers.users.length;
  console.log(`📊 Found ${stats.total} users in Supabase Auth\n`);
  
  // Get existing Better Auth users
  const existingUsers = await pool.query(
    'SELECT email, supabase_user_id FROM "user"'
  );
  const existingEmails = new Set(
    existingUsers.rows.map((u) => u.email?.toLowerCase())
  );
  const existingSupabaseIds = new Set(
    existingUsers.rows.filter((u) => u.supabase_user_id).map((u) => u.supabase_user_id)
  );

  console.log(`📊 Found ${existingEmails.size} existing users in Better Auth\n`);
  console.log("🔄 Starting migration...\n");

  for (const supabaseUser of supabaseUsers.users) {
    const email = supabaseUser.email?.toLowerCase();
    
    if (!email) {
      console.log(`⏭️  Skipping user without email (ID: ${supabaseUser.id})`);
      stats.skipped++;
      continue;
    }

    // Check if already migrated
    if (existingEmails.has(email) || existingSupabaseIds.has(supabaseUser.id)) {
      console.log(`⏭️  Skipping ${email} - already exists`);
      stats.skipped++;
      continue;
    }

    try {
      const userName = 
        supabaseUser.user_metadata?.full_name ||
        supabaseUser.user_metadata?.name ||
        email.split("@")[0];
      const avatarUrl = supabaseUser.user_metadata?.avatar_url || null;
      
      const userId = crypto.randomUUID();
      
      // Insert user
      await pool.query(
        `INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at, supabase_user_id, migrated_from_supabase, full_name, avatar_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          userId,
          userName,
          email,
          supabaseUser.email_confirmed_at ? true : false,
          avatarUrl,
          supabaseUser.created_at || new Date().toISOString(),
          new Date().toISOString(),
          supabaseUser.id,
          true,
          userName,
          avatarUrl,
        ]
      );

      // Create credential account
      const accountId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO "account" (id, account_id, provider_id, user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          accountId,
          supabaseUser.id,
          "credential",
          userId,
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      console.log(`✅ Migrated: ${email}`);
      stats.migrated++;
      
    } catch (error: any) {
      console.error(`❌ Failed to migrate ${email}:`, error.message);
      stats.errors++;
    }
  }

  return stats;
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     Supabase Auth → Better Auth User Migration Script        ║
╚══════════════════════════════════════════════════════════════╝
`);

  try {
    // Test database connection
    console.log("🔌 Connecting to database...");
    await pool.query("SELECT 1");
    console.log("✅ Database connected\n");

    // Ensure Better Auth tables exist
    await ensureBetterAuthTables();

    // Run migration
    const stats = await migrateUsers();

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    Migration Complete                         ║
╠══════════════════════════════════════════════════════════════╣
║  Total Supabase Users:  ${String(stats.total).padStart(5)}                              ║
║  Migrated:              ${String(stats.migrated).padStart(5)}                              ║
║  Skipped (existing):    ${String(stats.skipped).padStart(5)}                              ║
║  Errors:                ${String(stats.errors).padStart(5)}                              ║
╚══════════════════════════════════════════════════════════════╝

⚠️  Note: Migrated users will need to reset their password on first
    Better Auth login, as password hashes cannot be migrated.
`);

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
