#!/usr/bin/env node

/**
 * Test password verification against database
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
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
  const testPassword = process.argv[3] || 'QEFYjS45';
  
  console.log(`\n🔐 Testing login for: ${email}`);
  console.log(`   Password: ${testPassword}\n`);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    // Find user and password
    const result = await pool.query(
      `SELECT 
        ba_users.id as user_id,
        ba_users.email,
        ba_users.name,
        ba_accounts.password
      FROM ba_users 
      JOIN ba_accounts ON ba_users.id = ba_accounts.user_id
      WHERE LOWER(ba_users.email) = LOWER($1)
      AND ba_accounts.provider_id = 'credential'`,
      [email]
    );
    
    if (result.rows.length === 0) {
      console.error(`❌ User not found or no credential account`);
      process.exit(1);
    }
    
    const user = result.rows[0];
    console.log(`✅ Found user: ${user.name} (${user.user_id})`);
    console.log(`   Password hash: ${user.password.substring(0, 29)}...`);
    
    // Test password
    console.log(`\n🔄 Comparing password...`);
    const isValid = await bcrypt.compare(testPassword, user.password);
    
    if (isValid) {
      console.log(`\n✅ PASSWORD VALID - Login should work!`);
    } else {
      console.log(`\n❌ PASSWORD INVALID - Login will fail`);
      
      // Try other common passwords
      const commonPasswords = ['TL5TdxHr', 'QEFYjS45', 'password', 'test123'];
      console.log(`\n🔍 Testing common passwords...`);
      for (const pwd of commonPasswords) {
        if (pwd === testPassword) continue;
        const valid = await bcrypt.compare(pwd, user.password);
        if (valid) {
          console.log(`   ✅ Found working password: ${pwd}`);
          break;
        }
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
