import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkUser() {
  const email = 'jsanchez5710s@gmail.com';
  
  console.log('\n=== Checking User Signup ===\n');
  console.log(`Email: ${email}\n`);

  // Check user
  const { data: user, error: userError } = await supabase
    .from('ba_users')
    .select('*')
    .eq('email', email)
    .single();

  if (userError) {
    console.log('❌ User NOT FOUND in ba_users');
    console.log('Error:', userError.message);
    return;
  }

  console.log('✅ User found in ba_users:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name || '(no name)'}`);
  console.log(`   Type: ${user.user_type}`);
  console.log(`   Email verified: ${user.email_verified}`);
  console.log(`   Created: ${user.created_at}`);

  // Check accounts
  const { data: accounts } = await supabase
    .from('ba_accounts')
    .select('*')
    .eq('user_id', user.id);

  console.log(`\n📋 Accounts: ${accounts?.length || 0}`);
  
  if (!accounts || accounts.length === 0) {
    console.log('❌ NO ACCOUNTS FOUND - User cannot log in!');
    console.log('   This is the problem! Signup should create a ba_accounts record.');
    return;
  }

  accounts.forEach((acc, index) => {
    console.log(`\n   Account ${index + 1}:`);
    console.log(`     Provider: ${acc.provider_id}`);
    console.log(`     Account ID: ${acc.account_id}`);
    
    if (acc.provider_id === 'credential') {
      if (acc.password) {
        const isScrypt = acc.password.includes(':');
        const parts = acc.password.split(':');
        
        console.log(`     Password hash:`);
        console.log(`       Format: ${isScrypt ? 'scrypt (salt:key) ✅' : 'other format ❌'}`);
        console.log(`       Length: ${acc.password.length} chars ${acc.password.length === 161 ? '✅' : '❌ (expected 161)'}`);
        
        if (isScrypt && parts.length === 2) {
          console.log(`       Salt: ${parts[0].length} chars ${parts[0].length === 32 ? '✅' : '❌'}`);
          console.log(`       Key: ${parts[1].length} chars ${parts[1].length === 128 ? '✅' : '❌'}`);
        }
        
        console.log(`       First 50: ${acc.password.substring(0, 50)}...`);
        console.log(`     Updated: ${acc.updated_at}`);
      } else {
        console.log(`     ❌ NO PASSWORD - Cannot log in with credentials!`);
      }
    }
  });

  // Check sessions
  const { data: sessions } = await supabase
    .from('ba_sessions')
    .select('*')
    .eq('user_id', user.id);

  console.log(`\n🔐 Sessions: ${sessions?.length || 0}`);
  if (sessions && sessions.length > 0) {
    sessions.forEach((session, index) => {
      console.log(`   Session ${index + 1}: expires ${session.expires_at}`);
    });
  }

  // Check portal_applicants
  const { data: portalApps } = await supabase
    .from('portal_applicants')
    .select('*')
    .eq('ba_user_id', user.id);

  console.log(`\n📝 Portal Applications: ${portalApps?.length || 0}`);
  if (!portalApps || portalApps.length === 0) {
    console.log('   No applications - This explains "Unknown Form" in CRM');
  }

  console.log('\n=== Diagnosis ===\n');
  
  const hasCredentialAccount = accounts?.some(a => a.provider_id === 'credential');
  const hasPassword = accounts?.some(a => a.provider_id === 'credential' && a.password);
  const passwordCorrectFormat = accounts?.some(a => 
    a.provider_id === 'credential' && 
    a.password && 
    a.password.length === 161 && 
    a.password.includes(':')
  );

  if (!hasCredentialAccount) {
    console.log('❌ CRITICAL: No credential account exists');
    console.log('   → Signup did not create ba_accounts record');
    console.log('   → Check the signup handler');
  } else if (!hasPassword) {
    console.log('❌ CRITICAL: Credential account exists but has no password');
    console.log('   → Check the signup handler password hashing');
  } else if (!passwordCorrectFormat) {
    console.log('❌ ERROR: Password hash format is incorrect');
    console.log('   → Should be scrypt format (salt:key, 161 chars)');
    console.log('   → Check hashPasswordScrypt implementation');
  } else {
    console.log('✅ User account looks correct');
    console.log('   If login still fails, possible causes:');
    console.log('   1. Wrong password being entered');
    console.log('   2. Login endpoint not verifying correctly');
    console.log('   3. Session creation failing');
  }

  console.log('\n');
}

checkUser().catch(console.error);
