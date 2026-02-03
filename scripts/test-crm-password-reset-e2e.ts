/**
 * End-to-end test for CRM password reset
 * 
 * This test:
 * 1. Creates a test applicant (or uses existing)
 * 2. Resets their password via the CRM endpoint
 * 3. Verifies the password hash format
 * 4. Attempts to sign in with the new password via Better Auth
 */

import { createClient } from '@supabase/supabase-js';

const GO_API_URL = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface TestApplicant {
  id: string;
  email: string;
  workspaceId: string;
}

async function getAuthToken(): Promise<string> {
  // You'll need to provide a valid auth token
  // For testing, you can get this from your browser's localStorage or cookies
  const token = process.env.TEST_AUTH_TOKEN;
  if (!token) {
    throw new Error('TEST_AUTH_TOKEN environment variable not set');
  }
  return token;
}

async function findOrCreateTestApplicant(): Promise<TestApplicant> {
  // Find existing test applicant
  const { data: users } = await supabase
    .from('ba_users')
    .select('id, email')
    .eq('email', 'test-crm-reset@example.com')
    .eq('user_type', 'applicant')
    .single();

  if (users) {
    console.log(`✅ Found existing test applicant: ${users.email}`);
    
    // Get their workspace (any workspace they have access to)
    const { data: workspaces } = await supabase
      .from('workspace_users')
      .select('workspace_id')
      .eq('user_id', users.id)
      .limit(1)
      .single();
    
    return {
      id: users.id,
      email: users.email,
      workspaceId: workspaces?.workspace_id || '',
    };
  }

  console.log('Creating new test applicant...');
  
  // Create test applicant
  const { data: newUser, error: userError } = await supabase
    .from('ba_users')
    .insert({
      email: 'test-crm-reset@example.com',
      name: 'Test CRM Reset',
      user_type: 'applicant',
      email_verified: true,
    })
    .select()
    .single();

  if (userError) {
    throw new Error(`Failed to create test user: ${userError.message}`);
  }

  console.log(`✅ Created test applicant: ${newUser.email}`);

  // Create credential account
  const { error: accountError } = await supabase
    .from('ba_accounts')
    .insert({
      user_id: newUser.id,
      provider_id: 'credential',
      account_id: newUser.email,
      password: 'initial_password_hash',  // Will be replaced by CRM reset
    });

  if (accountError) {
    throw new Error(`Failed to create account: ${accountError.message}`);
  }

  // Get a workspace
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id')
    .limit(1)
    .single();

  return {
    id: newUser.id,
    email: newUser.email,
    workspaceId: workspaces?.id || '',
  };
}

async function resetPasswordViaCRM(applicantId: string, workspaceId: string, authToken: string) {
  console.log(`\n📞 Calling CRM reset password endpoint...`);
  
  const response = await fetch(`${GO_API_URL}/api/v1/crm/applicants/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      applicant_id: applicantId,
      workspace_id: workspaceId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`CRM reset failed (${response.status}): ${error}`);
  }

  const result = await response.json();
  console.log(`✅ Password reset successful`);
  console.log(`   Email: ${result.email}`);
  console.log(`   Temporary password: ${result.temporary_password}`);
  
  return result.temporary_password;
}

async function verifyPasswordHash(userId: string) {
  console.log(`\n🔍 Verifying password hash format...`);
  
  const { data: account } = await supabase
    .from('ba_accounts')
    .select('password')
    .eq('user_id', userId)
    .eq('provider_id', 'credential')
    .single();

  if (!account) {
    throw new Error('No credential account found');
  }

  const hash = account.password;
  const parts = hash.split(':');
  
  console.log(`   Full hash length: ${hash.length} characters`);
  console.log(`   Format: ${parts.length === 2 ? 'salt:key ✅' : 'INVALID ❌'}`);
  
  if (parts.length === 2) {
    console.log(`   Salt length: ${parts[0].length} chars (expected: 32)`);
    console.log(`   Key length: ${parts[1].length} chars (expected: 128)`);
    console.log(`   Total length: ${hash.length} (expected: 161)`);
    
    if (hash.length === 161 && parts[0].length === 32 && parts[1].length === 128) {
      console.log(`✅ Password hash format is CORRECT`);
      return true;
    }
  }
  
  console.log(`❌ Password hash format is INCORRECT`);
  return false;
}

async function testLogin(email: string, password: string) {
  console.log(`\n🔐 Testing login with Better Auth...`);
  
  try {
    const response = await fetch(`${GO_API_URL}/api/v1/portal/v2/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Login SUCCESSFUL`);
      console.log(`   User ID: ${result.user?.id}`);
      console.log(`   Email: ${result.user?.email}`);
      return true;
    } else {
      const error = await response.text();
      console.log(`❌ Login FAILED: ${error}`);
      return false;
    }
  } catch (err: any) {
    console.log(`❌ Login ERROR: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('CRM Password Reset End-to-End Test');
  console.log('='.repeat(80));

  try {
    // Get auth token
    const authToken = await getAuthToken();
    
    // Find or create test applicant
    const applicant = await findOrCreateTestApplicant();
    console.log(`Test applicant ID: ${applicant.id}`);
    console.log(`Workspace ID: ${applicant.workspaceId}`);

    // Reset password via CRM
    const newPassword = await resetPasswordViaCRM(applicant.id, applicant.workspaceId, authToken);

    // Verify hash format
    const hashValid = await verifyPasswordHash(applicant.id);

    // Test login
    const loginSuccess = await testLogin(applicant.email, newPassword);

    // Summary
    console.log(`\n` + '='.repeat(80));
    console.log('Test Results Summary');
    console.log('='.repeat(80));
    console.log(`Password hash format: ${hashValid ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Login with new password: ${loginSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log('='.repeat(80) + '\n');

    if (hashValid && loginSuccess) {
      console.log('🎉 All tests PASSED! CRM password reset is working correctly.');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests FAILED. Please review the output above.');
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`\n❌ Test failed with error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
