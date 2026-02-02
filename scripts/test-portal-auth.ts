/**
 * Test Portal Auth Setup
 * Checks if portal auth is working and creates a test user if needed
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testPortalAuth() {
  console.log('🔍 Testing Portal Auth Setup...\n');
  
  // Check if ba_users table exists
  const { data: users, error: usersError } = await supabase
    .from('ba_users')
    .select('id, email, email_verified, created_at')
    .limit(5);
  
  if (usersError) {
    console.error('❌ Error querying ba_users:', usersError);
    return;
  }
  
  console.log(`✅ Found ${users?.length || 0} users in ba_users table`);
  
  if (users && users.length > 0) {
    console.log('\n📋 Sample users:');
    users.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.email} (verified: ${user.email_verified ? '✓' : '✗'})`);
    });
  }
  
  // Check ba_accounts for email/password providers
  const { data: accounts, error: accountsError } = await supabase
    .from('ba_accounts')
    .select('user_id, provider_id, account_id')
    .eq('provider_id', 'credential')
    .limit(5);
  
  if (accounts && accounts.length > 0) {
    console.log(`\n✅ Found ${accounts.length} credential (email/password) accounts`);
  } else {
    console.log('\n⚠️  No credential accounts found');
  }
  
  // Check for test portal user
  const testEmail = 'portal-test@example.com';
  const { data: testUser } = await supabase
    .from('ba_users')
    .select('*')
    .eq('email', testEmail)
    .single();
  
  if (testUser) {
    console.log(`\n✅ Test portal user exists: ${testEmail}`);
  } else {
    console.log(`\n⚠️  Test portal user not found: ${testEmail}`);
    console.log('   To create one, you need to sign up through the portal UI');
  }
  
  // Test portal auth endpoint
  console.log('\n🔗 Testing portal auth endpoint...');
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  try {
    const response = await fetch(`${portalUrl}/api/portal-auth/get-session`);
    console.log(`   GET /api/portal-auth/get-session: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('   ✅ Portal auth endpoint is accessible');
    }
  } catch (error) {
    console.log('   ❌ Failed to reach portal auth endpoint:', error);
  }
  
  console.log('\n📝 Portal Auth Status:');
  console.log('   - Endpoint: /api/portal-auth');
  console.log('   - Database tables: ba_users, ba_sessions');
  console.log('   - Cookie name: matic-portal.session_token');
  console.log('   - Auth type: Email/Password only');
  console.log('\n💡 To test sign-in:');
  console.log('   1. Visit http://localhost:3000/apply/[your-form-slug]');
  console.log('   2. Use the sign-in form on the portal');
  console.log('   3. Check browser console for auth logs');
}

testPortalAuth().catch(console.error);
