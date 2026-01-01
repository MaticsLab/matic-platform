#!/usr/bin/env node

/**
 * Reset Better Auth password for a user
 * Usage: node scripts/reset-ba-password.mjs <email> <new-password>
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

// Better Auth's password hashing config (from their source)
const hashConfig = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64,
};

// Dynamic import for scrypt
async function hashPassword(password) {
  const { scrypt } = await import('@noble/hashes/scrypt.js');
  const { bytesToHex } = await import('@noble/hashes/utils.js');
  
  // Generate random salt (16 bytes = 32 hex chars)
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = bytesToHex(saltBytes);
  
  // Generate key using scrypt (sync version from noble/hashes v2)
  const key = scrypt(password.normalize('NFKC'), salt, {
    N: hashConfig.N,
    p: hashConfig.p,
    r: hashConfig.r,
    dkLen: hashConfig.dkLen,
    maxmem: 128 * hashConfig.N * hashConfig.r * 2,
  });
  
  return `${salt}:${bytesToHex(key)}`;
}

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];
  
  if (!email || !newPassword) {
    console.log('Usage: node scripts/reset-ba-password.mjs <email> <new-password>');
    process.exit(1);
  }
  
  console.log(`\n🔐 Resetting password for: ${email}\n`);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    // Find user
    const userResult = await pool.query(
      'SELECT id, email, name FROM ba_users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (userResult.rows.length === 0) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }
    
    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.name} (${user.id})`);
    
    // Hash new password
    console.log('🔄 Hashing new password...');
    const hashedPassword = await hashPassword(newPassword);
    console.log(`✅ Password hashed (length: ${hashedPassword.length})`);
    
    // Update password in ba_accounts
    const updateResult = await pool.query(
      `UPDATE ba_accounts 
       SET password = $1, updated_at = NOW() 
       WHERE user_id = $2 AND provider_id = 'credential'
       RETURNING id`,
      [hashedPassword, user.id]
    );
    
    if (updateResult.rowCount === 0) {
      console.error('❌ No credential account found for user');
      process.exit(1);
    }
    
    console.log(`\n✅ Password updated successfully!`);
    console.log(`\n📧 Email: ${email}`);
    console.log(`🔑 New password: ${newPassword}`);
    console.log(`\nYou can now log in with Better Auth.`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
