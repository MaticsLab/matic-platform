/**
 * Reset Password Using Better Auth's Hash Function
 * This properly hashes passwords using scrypt like Better Auth does
 */

import { createClient } from '@supabase/supabase-js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function generatePassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const password: string[] = [];
  
  password.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]);
  password.push('abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]);
  password.push('0123456789'[Math.floor(Math.random() * 10)]);
  password.push('!@#$%^&*'[Math.floor(Math.random() * 8)]);
  
  for (let i = password.length; i < length; i++) {
    password.push(charset[Math.floor(Math.random() * charset.length)]);
  }
  
  return password.sort(() => Math.random() - 0.5).join('');
}

// Better Auth's password hashing function
async function hashPassword(password: string): Promise<string> {
  const saltBytes = crypto.randomBytes(16);
  const salt = Buffer.from(saltBytes).toString('hex');
  
  const key = await scryptAsync(password.normalize('NFKC'), salt, {
    N: 16384,
    r: 16,
    p: 1,
    dkLen: 64,
    maxmem: 128 * 16384 * 16 * 2,
  });
  
  const keyHex = Buffer.from(key).toString('hex');
  return `${salt}:${keyHex}`;
}

async function resetUserPassword(email: string) {
  console.log(`\n🔄 Resetting password for: ${email}\n`);
  
  // Get user
  const { data: user, error: userError } = await supabase
    .from('ba_users')
    .select('id, email')
    .eq('email', email)
    .single();
  
  if (userError || !user) {
    console.log('❌ User not found');
    return null;
  }
  
  console.log('✅ User found:', user.email);
  
  // Generate new password
  const password = generatePassword(12);
  
  console.log('\n📝 Generated credentials:');
  console.log('   Email:', email);
  console.log('   Password:', password);
  
  // Hash password using Better Auth's scrypt function
  console.log('\n⏳ Hashing password...');
  const passwordHash = await hashPassword(password);
  console.log('✅ Password hashed');
  
  // Check if account exists
  const { data: existingAccount } = await supabase
    .from('ba_accounts')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider_id', 'credential')
    .single();
  
  if (existingAccount) {
    // Update existing account
    const { error: updateError } = await supabase
      .from('ba_accounts')
      .update({
        password: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('provider_id', 'credential');
    
    if (updateError) {
      console.log('❌ Password update failed:', updateError);
      return null;
    }
    
    console.log('✅ Password updated in database');
  } else {
    // Insert new account
    const { error: insertError } = await supabase
      .from('ba_accounts')
      .insert({
        id: crypto.randomUUID(),
        user_id: user.id,
        account_id: user.id,
        provider_id: 'credential',
        password: passwordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    
    if (insertError) {
      console.log('❌ Password insert failed:', insertError);
      return null;
    }
    
    console.log('✅ Password created in database');
  }
  
  return { email, password };
}

async function resetMultipleUsers(emails: string[]) {
  console.log('🔐 Password Reset Tool - Using Better Auth Scrypt');
  console.log('==================================================\n');
  
  const results: Array<{ email: string; password: string }> = [];
  
  for (const email of emails) {
    const result = await resetUserPassword(email);
    if (result) {
      results.push(result);
    }
    console.log('\n' + '─'.repeat(60) + '\n');
  }
  
  if (results.length > 0) {
    console.log('\n✅ PASSWORD RESET COMPLETE');
    console.log('==========================\n');
    console.log('📧 Send these credentials to your users:\n');
    
    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.email}`);
      console.log(`   Password: ${r.password}\n`);
    });
    
    console.log('⚠️  Important:');
    console.log('   - Passwords are properly hashed using scrypt (Better Auth compatible)');
    console.log('   - Users can now sign in to the portal');
    console.log('   - Send passwords through secure channel');
    console.log('   - Users should change passwords after first login\n');
  }
}

// Get emails from command line or use default
const emails = process.argv.slice(2);

if (emails.length === 0) {
  resetMultipleUsers(['jasanchez85@cps.edu']);
} else {
  resetMultipleUsers(emails);
}
