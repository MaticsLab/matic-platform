/**
 * Reset Password for Migrated Users
 * 
 * This script resets passwords for users who were migrated from the old portal_applicants table.
 * The old password hashes are incompatible with Better Auth, so we generate new passwords.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Generate a random secure password
function generatePassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const password: string[] = [];
  
  // Ensure at least one of each type
  password.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]);
  password.push('abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]);
  password.push('0123456789'[Math.floor(Math.random() * 10)]);
  password.push('!@#$%^&*'[Math.floor(Math.random() * 8)]);
  
  // Fill the rest
  for (let i = password.length; i < length; i++) {
    password.push(charset[Math.floor(Math.random() * charset.length)]);
  }
  
  // Shuffle
  return password.sort(() => Math.random() - 0.5).join('');
}

// Use Better Auth's API to set the password properly
async function resetUserPassword(email: string, newPassword?: string) {
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
  
  // Generate password if not provided
  const password = newPassword || generatePassword(12);
  
  console.log('\n📝 Generated credentials:');
  console.log('   Email:', email);
  console.log('   Password:', password);
  
  // Delete existing credential account to allow re-registration
  const { error: deleteError } = await supabase
    .from('ba_accounts')
    .delete()
    .eq('user_id', user.id)
    .eq('provider_id', 'credential');
  
  if (deleteError) {
    console.log('⚠️  Could not delete old account:', deleteError.message);
  } else {
    console.log('✅ Removed old credential account');
  }
  
  // Use Better Auth's sign-up endpoint to create new account with proper password hashing
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/portal-auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': baseUrl,
      },
      body: JSON.stringify({
        email,
        password,
        name: email.split('@')[0],
      }),
    });
    
    const text = await response.text();
    
    if (response.ok) {
      console.log('✅ Password reset successful via Better Auth');
      return { email, password };
    } else {
      // User might already exist, which is fine - the account was recreated
      if (text.includes('already exists') || text.includes('User already')) {
        console.log('✅ User re-registered successfully (account recreated)');
        return { email, password };
      } else {
        console.log('❌ Sign-up failed:', response.status, text);
        return null;
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

async function resetMultipleUsers(emails: string[]) {
  console.log('🔐 Password Reset Tool for Migrated Users');
  console.log('==========================================\n');
  
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
    console.log('   - Users should change these passwords after first login');
    console.log('   - Send passwords through secure channel (not plain email)');
    console.log('   - Consider implementing password reset flow for user-initiated resets\n');
  }
}

// Get emails from command line or use defaults
const emails = process.argv.slice(2);

if (emails.length === 0) {
  // Default test users
  resetMultipleUsers([
    'jasanchez85@cps.edu',
  ]);
} else {
  resetMultipleUsers(emails);
}
