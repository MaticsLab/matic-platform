/**
 * Diagnostic script to check a specific user's password reset status
 * Usage: npx tsx scripts/diagnose-password-issue.ts <email>
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function diagnoseUser(email: string) {
  console.log('\n' + '='.repeat(80));
  console.log(`Password Reset Diagnostic for: ${email}`);
  console.log('='.repeat(80) + '\n');

  // Find user
  const { data: user, error: userError } = await supabase
    .from('ba_users')
    .select('*')
    .eq('email', email)
    .single();

  if (userError || !user) {
    console.log(`❌ User not found: ${email}`);
    return;
  }

  console.log(`✅ User found:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Name: ${user.name || '(no name)'}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Type: ${user.user_type}`);
  console.log(`   Email verified: ${user.email_verified ? 'Yes' : 'No'}`);
  console.log(`   Created: ${user.created_at}`);

  // Check account
  const { data: accounts } = await supabase
    .from('ba_accounts')
    .select('*')
    .eq('user_id', user.id);

  console.log(`\n📋 Accounts:`);
  if (!accounts || accounts.length === 0) {
    console.log(`   ❌ No accounts found! User cannot log in.`);
    return;
  }

  accounts.forEach((account, index) => {
    console.log(`\n   Account ${index + 1}:`);
    console.log(`     Provider: ${account.provider_id}`);
    console.log(`     Account ID: ${account.account_id}`);
    
    if (account.provider_id === 'credential' && account.password) {
      const hash = account.password;
      const isScrypt = hash.includes(':');
      const parts = hash.split(':');
      
      console.log(`     Password hash:`);
      console.log(`       Format: ${isScrypt ? 'scrypt (salt:key) ✅' : 'bcrypt or other ❌'}`);
      console.log(`       Length: ${hash.length} chars ${hash.length === 161 ? '✅' : '❌ (expected 161)'}`);
      
      if (isScrypt) {
        console.log(`       Salt: ${parts[0].length} chars ${parts[0].length === 32 ? '✅' : '❌ (expected 32)'}`);
        console.log(`       Key: ${parts[1]?.length || 0} chars ${parts[1]?.length === 128 ? '✅' : '❌ (expected 128)'}`);
        console.log(`       First 50 chars: ${hash.substring(0, 50)}...`);
      } else {
        console.log(`       ⚠️  This password hash is NOT in Better Auth scrypt format!`);
        console.log(`       First 50 chars: ${hash.substring(0, 50)}...`);
      }
      
      console.log(`     Updated: ${account.updated_at}`);
      
      // Check if recently updated
      const updatedAt = new Date(account.updated_at);
      const now = new Date();
      const hoursSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceUpdate < 1) {
        console.log(`     🕐 Updated ${Math.round(hoursSinceUpdate * 60)} minutes ago (RECENT)`);
      } else if (hoursSinceUpdate < 24) {
        console.log(`     🕐 Updated ${Math.round(hoursSinceUpdate)} hours ago`);
      } else {
        console.log(`     🕐 Updated ${Math.round(hoursSinceUpdate / 24)} days ago`);
      }
    }
  });

  // Check portal applicants
  const { data: portalApplicants } = await supabase
    .from('portal_applicants')
    .select('*')
    .eq('ba_user_id', user.id);

  console.log(`\n📝 Portal Applications:`);
  if (!portalApplicants || portalApplicants.length === 0) {
    console.log(`   No portal applications found`);
  } else {
    console.log(`   ${portalApplicants.length} application(s)`);
    portalApplicants.forEach((app, index) => {
      console.log(`     ${index + 1}. Form ID: ${app.form_id} | Row ID: ${app.row_id}`);
    });
  }

  // Summary and recommendations
  console.log(`\n` + '='.repeat(80));
  console.log('Summary & Recommendations');
  console.log('='.repeat(80));

  const credentialAccount = accounts.find(a => a.provider_id === 'credential');
  if (!credentialAccount) {
    console.log(`❌ ISSUE: No credential account found`);
    console.log(`   → User cannot log in with email/password`);
    console.log(`   → Create an account using the CRM password reset feature`);
  } else if (credentialAccount.password) {
    const isCorrectFormat = credentialAccount.password.length === 161 && credentialAccount.password.includes(':');
    if (isCorrectFormat) {
      console.log(`✅ Password hash format is correct (scrypt)`);
      console.log(`   → User should be able to log in with their password`);
      console.log(`   → If login fails, the password they're using might be wrong`);
    } else {
      console.log(`❌ ISSUE: Password hash format is INCORRECT`);
      console.log(`   → Current format: ${credentialAccount.password.substring(0, 20)}...`);
      console.log(`   → Expected: scrypt format (salt:key, 161 chars total)`);
      console.log(`   → ACTION NEEDED: Reset password via CRM to generate correct format`);
    }
  }

  console.log('='.repeat(80) + '\n');
}

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.log(`Usage: npx tsx scripts/diagnose-password-issue.ts <email>`);
    console.log(`Example: npx tsx scripts/diagnose-password-issue.ts jasanchez85@cps.edu`);
    process.exit(1);
  }

  await diagnoseUser(email);
}

main().catch(console.error);
