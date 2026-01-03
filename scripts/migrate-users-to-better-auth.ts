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
  
  // Check if ba_users table exists (using ba_ prefix as per migration 029)
  const tableCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'ba_users'
    );
  `);
  
  if (!tableCheck.rows[0].exists) {
    console.log("⚠️  Better Auth tables (ba_*) not found!");
    console.log("   Please run migration 029_better_auth.sql first");
    throw new Error("Better Auth tables not found. Run migration 029_better_auth.sql");
  } else {
    console.log("✅ Better Auth tables (ba_*) exist");
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
  
  // Get existing Better Auth users (using ba_ prefix)
  const existingUsers = await pool.query(
    'SELECT email, supabase_user_id FROM ba_users'
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
      
      // Insert user (using ba_users table with ba_ prefix)
      await pool.query(
        `INSERT INTO ba_users (id, name, email, email_verified, image, created_at, updated_at, supabase_user_id, migrated_from_supabase, full_name, avatar_url)
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

      // Create credential account (using ba_accounts table)
      // NOTE: For credential (email/password) auth:
      //   - password: Will be NULL initially (users must reset password)
      //   - OAuth tokens (access_token, refresh_token, id_token): NULL (only for OAuth providers)
      //   - account_id: Links to Supabase user ID for migration tracking
      const accountId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO ba_accounts (id, account_id, provider_id, user_id, password, access_token, refresh_token, id_token, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          accountId,
          supabaseUser.id, // Link to Supabase user ID
          "credential", // Email/password authentication
          userId,
          null, // Password cannot be migrated (different hash format: Supabase uses bcrypt, Better Auth uses scrypt)
          null, // OAuth tokens are NULL for credential auth (only for OAuth providers like Google, GitHub)
          null, // OAuth tokens are NULL for credential auth
          null, // OAuth tokens are NULL for credential auth
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

⚠️  IMPORTANT: Migrated users will need to reset their password on first
    Better Auth login, as password hashes cannot be migrated.
    
    Reason: Supabase uses bcrypt, Better Auth uses scrypt. These are
    incompatible hash formats, so users must set a new password.
    
    OAuth Tokens: For credential (email/password) accounts, OAuth tokens
    (access_token, refresh_token, id_token) are correctly set to NULL.
    These tokens are only used for OAuth providers (Google, GitHub, etc.).
`);

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
