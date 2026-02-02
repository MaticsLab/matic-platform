#!/usr/bin/env node

/**
 * Check user password and account status
 */

import pg from 'pg';
import * as fs from 'fs';
import { resolve } from 'path';

// Load environment manually
const envPath = resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
}

const { Pool } = pg;

async function main() {
  const email = process.argv[2] || 'jasanchez85@cps.edu';
  
  console.log(`\n🔍 Checking account for: ${email}\n`);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    // Find user and all accounts
    const result = await pool.query(
      `SELECT 
        ba_users.id as user_id,
        ba_users.email,
        ba_users.name,
        ba_users.email_verified,
        ba_users.created_at as user_created,
        ba_accounts.id as account_id,
        ba_accounts.provider_id,
        ba_accounts.account_id as provider_account_id,
        LENGTH(ba_accounts.password) as password_length,
        SUBSTRING(ba_accounts.password, 1, 50) as password_preview,
        ba_accounts.created_at as account_created,
        ba_accounts.updated_at as account_updated
      FROM ba_users 
      LEFT JOIN ba_accounts ON ba_users.id = ba_accounts.user_id
      WHERE LOWER(ba_users.email) = LOWER($1)
      ORDER BY ba_accounts.updated_at DESC`,
      [email]
    );
    
    if (result.rows.length === 0) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }
    
    console.log('User Info:');
    const user = result.rows[0];
    console.log(`  ID: ${user.user_id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Email Verified: ${user.email_verified}`);
    console.log(`  Created: ${user.user_created}`);
    
    console.log('\nAccounts:');
    for (const account of result.rows) {
      console.log(`\n  Provider: ${account.provider_id}`);
      console.log(`  Account ID: ${account.account_id}`);
      console.log(`  Password Length: ${account.password_length || 'N/A'}`);
      if (account.password_preview) {
        console.log(`  Password Preview: ${account.password_preview}...`);
      }
      console.log(`  Created: ${account.account_created}`);
      console.log(`  Updated: ${account.account_updated}`);
    }
    
    // Check sessions
    const sessions = await pool.query(
      `SELECT id, token, expires_at, created_at, updated_at
       FROM ba_sessions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [user.user_id]
    );
    
    console.log('\n\nRecent Sessions:');
    if (sessions.rows.length === 0) {
      console.log('  No sessions found');
    } else {
      for (const session of sessions.rows) {
        console.log(`\n  Session ID: ${session.id}`);
        console.log(`  Expires: ${session.expires_at}`);
        console.log(`  Created: ${session.created_at}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
