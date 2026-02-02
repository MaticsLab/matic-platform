/**
 * Check User Password Hash Format
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkPasswordHash() {
  const email = 'jasanchez85@cps.edu';
  
  console.log(`🔍 Checking password hash for: ${email}\n`);
  
  // Get user
  const { data: user } = await supabase
    .from('ba_users')
    .select('id, email, email_verified')
    .eq('email', email)
    .single();
  
  if (!user) {
    console.log('❌ User not found');
    return;
  }
  
  console.log('✅ User found:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Verified: ${user.email_verified ? 'Yes' : 'No'}\n`);
  
  // Get account info
  const { data: accounts } = await supabase
    .from('ba_accounts')
    .select('*')
    .eq('user_id', user.id);
  
  if (!accounts || accounts.length === 0) {
    console.log('❌ No accounts found for this user');
    console.log('   User exists but has no authentication method configured');
    return;
  }
  
  console.log(`📋 Found ${accounts.length} account(s):\n`);
  
  accounts.forEach((account, i) => {
    console.log(`Account ${i + 1}:`);
    console.log(`   Provider: ${account.provider_id}`);
    console.log(`   Account ID: ${account.account_id}`);
    
    if (account.provider_id === 'credential') {
      // This is the email/password account
      // Better Auth stores password hash in 'password' field of ba_accounts
      const passwordHash = account.password;
      
      if (passwordHash) {
        console.log(`   Password Hash: ${passwordHash.substring(0, 20)}... (${passwordHash.length} chars)`);
        
        // Check hash format
        if (passwordHash.startsWith('$2a$') || passwordHash.startsWith('$2b$')) {
          console.log('   ✅ Format: bcrypt');
        } else if (passwordHash.startsWith('$argon2')) {
          console.log('   ✅ Format: argon2');
        } else if (passwordHash.startsWith('scrypt:')) {
          console.log('   ✅ Format: scrypt');
        } else {
          console.log(`   ⚠️  Format: Unknown (might be incompatible)`);
        }
      } else {
        console.log('   ❌ No password hash found');
      }
    }
    console.log();
  });
  
  console.log('\n💡 Possible Solutions:');
  console.log('   1. If password hash format is incompatible, user needs to reset password');
  console.log('   2. Create a new test user through portal sign-up');
  console.log('   3. Check if Better Auth expects password in different field');
}

checkPasswordHash().catch(console.error);
