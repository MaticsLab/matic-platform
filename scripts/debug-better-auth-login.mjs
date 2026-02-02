#!/usr/bin/env node

/**
 * Debug Better Auth login - simulates what the frontend does
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

async function debugLogin(email, password) {
  console.log(`\n🔍 Debugging Better Auth Login`);
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Attempting via: /api/portal-auth/sign-in/email\n`);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    // Step 1: Find user
    console.log('Step 1: Finding user...');
    const userResult = await pool.query(
      `SELECT id, email, name, email_verified FROM ba_users WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found in ba_users');
      return { success: false, error: 'User not found' };
    }
    
    const user = userResult.rows[0];
    console.log(`✅ User found: ${user.name} (${user.id})`);
    console.log(`   Email verified: ${user.email_verified}`);
    
    // Step 2: Find credential account
    console.log('\nStep 2: Finding credential account...');
    const accountResult = await pool.query(
      `SELECT id, password, provider_id, account_id FROM ba_accounts 
       WHERE user_id = $1 AND provider_id = 'credential'`,
      [user.id]
    );
    
    if (accountResult.rows.length === 0) {
      console.log('❌ No credential account found for user');
      return { success: false, error: 'No credential account' };
    }
    
    const account = accountResult.rows[0];
    console.log(`✅ Account found: ${account.id}`);
    console.log(`   Password hash: ${account.password.substring(0, 29)}...`);
    console.log(`   Provider: ${account.provider_id}`);
    
    // Step 3: Verify password
    console.log('\nStep 3: Verifying password with bcrypt...');
    const isValid = await bcrypt.compare(password, account.password);
    
    if (!isValid) {
      console.log('❌ Password verification failed');
      console.log('\nTrying to find what password works...');
      
      // Try some common passwords
      const commonPasswords = [
        'QEFYjS45',
        'TL5TdxHr', 
        'password',
        'test123',
        'Password123!',
        email.split('@')[0] // username as password
      ];
      
      for (const pwd of commonPasswords) {
        const valid = await bcrypt.compare(pwd, account.password);
        if (valid) {
          console.log(`✅ Found working password: "${pwd}"`);
          break;
        }
      }
      
      return { success: false, error: 'Invalid password' };
    }
    
    console.log('✅ Password verified successfully!');
    
    // Step 4: Simulate session creation
    console.log('\nStep 4: Would create session...');
    console.log('   Session would be stored in ba_sessions table');
    console.log('   Cookie would be set: matic-portal.session_token');
    console.log('   Domain: .maticsapp.com');
    console.log('   Secure: true (in production)');
    console.log('   SameSite: none (in production)');
    
    return { 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

const email = process.argv[2] || 'jasanchez85@cps.edu';
const password = process.argv[3];

if (!password) {
  console.log('Usage: node scripts/debug-better-auth-login.mjs <email> <password>');
  process.exit(1);
}

debugLogin(email, password).then(result => {
  console.log('\n' + '='.repeat(60));
  if (result.success) {
    console.log('✅ LOGIN WOULD SUCCEED');
    console.log(`   User: ${result.user.name}`);
    console.log(`   Email: ${result.user.email}`);
  } else {
    console.log('❌ LOGIN WOULD FAIL');
    console.log(`   Reason: ${result.error}`);
  }
  console.log('='.repeat(60));
});
