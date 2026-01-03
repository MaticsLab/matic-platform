#!/usr/bin/env npx tsx

/**
 * Better Auth Database Checker
 * 
 * Checks Supabase database directly to verify Better Auth setup and user migration.
 * 
 * Usage:
 *   npx tsx scripts/check-better-auth-db.ts
 * 
 * Environment Variables Required:
 *   - DATABASE_URL: PostgreSQL connection string
 */

import { Pool } from "pg";

// Get DATABASE_URL from environment or command line
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ Missing required environment variable: DATABASE_URL");
  console.error("   Usage: DATABASE_URL=... npx tsx scripts/check-better-auth-db.ts");
  process.exit(1);
}

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface TableInfo {
  table_name: string;
  exists: boolean;
  row_count: number;
}

interface UserInfo {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
  migrated_from_supabase: boolean;
  supabase_user_id: string | null;
  created_at: Date;
}

interface SessionInfo {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  active_organization_id: string | null;
}

interface AccountInfo {
  id: string;
  user_id: string;
  provider_id: string;
  account_id: string;
  has_password: boolean;
}

async function checkTableExists(tableName: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `, [tableName]);
  return result.rows[0].exists;
}

async function getTableRowCount(tableName: string): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    return 0;
  }
}

async function checkBetterAuthTables(): Promise<TableInfo[]> {
  const tables = [
    'ba_users',
    'ba_sessions',
    'ba_accounts',
    'ba_verifications',
    'ba_organizations',
    'ba_members',
    'ba_invitations',
  ];

  const tableInfo: TableInfo[] = [];

  for (const table of tables) {
    const exists = await checkTableExists(table);
    const rowCount = exists ? await getTableRowCount(table) : 0;
    tableInfo.push({ table_name: table, exists, row_count: rowCount });
  }

  return tableInfo;
}

async function getUsersInfo(): Promise<UserInfo[]> {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        email,
        name,
        email_verified,
        migrated_from_supabase,
        supabase_user_id,
        created_at
      FROM ba_users
      ORDER BY created_at DESC
      LIMIT 20
    `);
    return result.rows;
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

async function getSessionsInfo(): Promise<SessionInfo[]> {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        user_id,
        token,
        expires_at,
        active_organization_id
      FROM ba_sessions
      WHERE expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 10
    `);
    return result.rows;
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return [];
  }
}

async function getAccountsInfo(): Promise<AccountInfo[]> {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        user_id,
        provider_id,
        account_id,
        CASE WHEN password IS NOT NULL THEN true ELSE false END as has_password
      FROM ba_accounts
      ORDER BY created_at DESC
      LIMIT 20
    `);
    return result.rows;
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return [];
  }
}

async function checkMigrationStatus(): Promise<{
  total_users: number;
  migrated_users: number;
  users_with_sessions: number;
  users_with_accounts: number;
}> {
  const stats = await pool.query(`
    SELECT 
      COUNT(*) as total_users,
      COUNT(*) FILTER (WHERE migrated_from_supabase = true) as migrated_users,
      COUNT(DISTINCT s.user_id) as users_with_sessions,
      COUNT(DISTINCT a.user_id) as users_with_accounts
    FROM ba_users u
    LEFT JOIN ba_sessions s ON s.user_id = u.id AND s.expires_at > NOW()
    LEFT JOIN ba_accounts a ON a.user_id = u.id
  `);

  return {
    total_users: parseInt(stats.rows[0].total_users, 10),
    migrated_users: parseInt(stats.rows[0].migrated_users, 10),
    users_with_sessions: parseInt(stats.rows[0].users_with_sessions, 10),
    users_with_accounts: parseInt(stats.rows[0].users_with_accounts, 10),
  };
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║          Better Auth Database Verification Script             ║
╚══════════════════════════════════════════════════════════════╝
`);

  try {
    // Test database connection
    console.log("🔌 Connecting to database...");
    await pool.query("SELECT 1");
    console.log("✅ Database connected\n");

    // Check tables
    console.log("📋 Checking Better Auth tables...\n");
    const tables = await checkBetterAuthTables();
    
    let allTablesExist = true;
    for (const table of tables) {
      const status = table.exists ? "✅" : "❌";
      console.log(`${status} ${table.table_name.padEnd(25)} ${table.exists ? `(${table.row_count} rows)` : "MISSING"}`);
      if (!table.exists) allTablesExist = false;
    }

    if (!allTablesExist) {
      console.log("\n⚠️  Some tables are missing! Run migration 029_better_auth.sql");
      process.exit(1);
    }

    // Check migration status
    console.log("\n📊 Migration Statistics:\n");
    const stats = await checkMigrationStatus();
    console.log(`Total Users:           ${stats.total_users}`);
    console.log(`Migrated from Supabase: ${stats.migrated_users}`);
    console.log(`Users with Sessions:    ${stats.users_with_sessions}`);
    console.log(`Users with Accounts:    ${stats.users_with_accounts}`);

    // Show sample users
    console.log("\n👥 Sample Users (last 10):\n");
    const users = await getUsersInfo();
    if (users.length === 0) {
      console.log("⚠️  No users found in ba_users table");
    } else {
      for (const user of users.slice(0, 10)) {
        const migrated = user.migrated_from_supabase ? "✅ Migrated" : "🆕 New";
        const verified = user.email_verified ? "✓" : "✗";
        console.log(`  ${user.email.padEnd(40)} ${migrated} ${verified} Verified`);
        if (user.supabase_user_id) {
          console.log(`    └─ Supabase ID: ${user.supabase_user_id}`);
        }
      }
    }

    // Show active sessions
    console.log("\n🔐 Active Sessions:\n");
    const sessions = await getSessionsInfo();
    if (sessions.length === 0) {
      console.log("⚠️  No active sessions found");
    } else {
      for (const session of sessions) {
        const expiresIn = Math.floor((new Date(session.expires_at).getTime() - Date.now()) / (1000 * 60 * 60));
        console.log(`  User: ${session.user_id.substring(0, 8)}... | Expires in: ${expiresIn}h | Org: ${session.active_organization_id || "None"}`);
      }
    }

    // Show accounts
    console.log("\n🔑 Accounts:\n");
    const accounts = await getAccountsInfo();
    if (accounts.length === 0) {
      console.log("⚠️  No accounts found");
    } else {
      const providerCounts: Record<string, number> = {};
      for (const account of accounts) {
        providerCounts[account.provider_id] = (providerCounts[account.provider_id] || 0) + 1;
      }
      for (const [provider, count] of Object.entries(providerCounts)) {
        console.log(`  ${provider.padEnd(20)} ${count} accounts`);
      }
    }

    // Check for issues
    console.log("\n🔍 Health Checks:\n");
    
    // Check for users without accounts
    const usersWithoutAccounts = await pool.query(`
      SELECT COUNT(*) as count
      FROM ba_users u
      LEFT JOIN ba_accounts a ON a.user_id = u.id
      WHERE a.id IS NULL
    `);
    const noAccounts = parseInt(usersWithoutAccounts.rows[0].count, 10);
    if (noAccounts > 0) {
      console.log(`⚠️  ${noAccounts} users without accounts (cannot login)`);
    } else {
      console.log("✅ All users have accounts");
    }

    // Check for expired sessions
    const expiredSessions = await pool.query(`
      SELECT COUNT(*) as count
      FROM ba_sessions
      WHERE expires_at < NOW()
    `);
    const expired = parseInt(expiredSessions.rows[0].count, 10);
    console.log(`📊 ${expired} expired sessions (will be cleaned up)`);

    // Check for users with supabase_user_id but not marked as migrated
    const inconsistent = await pool.query(`
      SELECT COUNT(*) as count
      FROM ba_users
      WHERE supabase_user_id IS NOT NULL 
      AND migrated_from_supabase = false
    `);
    const inconsistentCount = parseInt(inconsistent.rows[0].count, 10);
    if (inconsistentCount > 0) {
      console.log(`⚠️  ${inconsistentCount} users with supabase_user_id but not marked as migrated`);
    } else {
      console.log("✅ Migration flags are consistent");
    }

    console.log("\n✅ Database check complete!\n");

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.code === '42P01') {
      console.error("   → Table does not exist. Run migration 029_better_auth.sql");
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

