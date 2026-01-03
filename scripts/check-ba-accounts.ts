#!/usr/bin/env npx tsx

/**
 * Check ba_accounts table details
 */

import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ Missing DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log("🔍 Checking ba_accounts table...\n");

    // Get all accounts with user info
    const accounts = await pool.query(`
      SELECT 
        a.id,
        a.account_id,
        a.provider_id,
        a.user_id,
        u.email,
        u.name as user_name,
        CASE WHEN a.password IS NOT NULL THEN 'Yes' ELSE 'No' END as has_password,
        a.access_token IS NOT NULL as has_access_token,
        a.refresh_token IS NOT NULL as has_refresh_token,
        a.id_token IS NOT NULL as has_id_token,
        a.access_token_expires_at,
        a.refresh_token_expires_at,
        a.scope,
        a.created_at,
        a.updated_at
      FROM ba_accounts a
      JOIN ba_users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
    `);

    console.log(`📊 Total Accounts: ${accounts.rows.length}\n`);

    if (accounts.rows.length === 0) {
      console.log("⚠️  No accounts found!");
      return;
    }

    // Group by provider
    const byProvider: Record<string, any[]> = {};
    for (const account of accounts.rows) {
      if (!byProvider[account.provider_id]) {
        byProvider[account.provider_id] = [];
      }
      byProvider[account.provider_id].push(account);
    }

    for (const [provider, providerAccounts] of Object.entries(byProvider)) {
      console.log(`\n🔑 Provider: ${provider.toUpperCase()} (${providerAccounts.length} accounts)\n`);
      
      for (const account of providerAccounts) {
        console.log(`  Account ID: ${account.id}`);
        console.log(`  User: ${account.email} (${account.user_name || 'No name'})`);
        console.log(`  User ID: ${account.user_id}`);
        console.log(`  Account ID (provider): ${account.account_id}`);
        console.log(`  Has Password: ${account.has_password}`);
        console.log(`  Has Access Token: ${account.has_access_token}`);
        console.log(`  Has Refresh Token: ${account.has_refresh_token}`);
        console.log(`  Has ID Token: ${account.has_id_token}`);
        if (account.access_token_expires_at) {
          const expiresAt = new Date(account.access_token_expires_at);
          const now = new Date();
          const expired = expiresAt < now;
          console.log(`  Access Token Expires: ${expiresAt.toISOString()} ${expired ? '❌ EXPIRED' : '✅ Valid'}`);
        }
        if (account.refresh_token_expires_at) {
          const expiresAt = new Date(account.refresh_token_expires_at);
          const now = new Date();
          const expired = expiresAt < now;
          console.log(`  Refresh Token Expires: ${expiresAt.toISOString()} ${expired ? '❌ EXPIRED' : '✅ Valid'}`);
        }
        if (account.scope) {
          console.log(`  Scope: ${account.scope}`);
        }
        console.log(`  Created: ${new Date(account.created_at).toISOString()}`);
        console.log(`  Updated: ${new Date(account.updated_at).toISOString()}`);
        console.log("");
      }
    }

    // Check for issues
    console.log("\n🔍 Health Checks:\n");

    // Accounts without passwords (for credential provider)
    const noPassword = await pool.query(`
      SELECT COUNT(*) as count
      FROM ba_accounts
      WHERE provider_id = 'credential' AND password IS NULL
    `);
    const noPasswordCount = parseInt(noPassword.rows[0].count, 10);
    if (noPasswordCount > 0) {
      console.log(`⚠️  ${noPasswordCount} credential accounts without passwords (cannot login)`);
    } else {
      console.log("✅ All credential accounts have passwords");
    }

    // Accounts with expired tokens
    const expiredTokens = await pool.query(`
      SELECT COUNT(*) as count
      FROM ba_accounts
      WHERE access_token_expires_at IS NOT NULL 
        AND access_token_expires_at < NOW()
    `);
    const expiredCount = parseInt(expiredTokens.rows[0].count, 10);
    if (expiredCount > 0) {
      console.log(`⚠️  ${expiredCount} accounts with expired access tokens`);
    } else {
      console.log("✅ No expired access tokens");
    }

    // Users without accounts
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

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.code === '42P01') {
      console.error("   → Table ba_accounts does not exist. Run migration 029_better_auth.sql");
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

