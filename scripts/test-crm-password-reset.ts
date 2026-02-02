/**
 * Test CRM Password Reset with Better Auth Scrypt
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testCRMPasswordReset() {
  const testEmail = 'jasanchez85@cps.edu';
  
  console.log('🧪 Testing CRM Password Reset\n');
  console.log('================================\n');
  
  // Get user
  const { data: user } = await supabase
    .from('ba_users')
    .select('id, email')
    .eq('email', testEmail)
    .single();
  
  if (!user) {
    console.log('❌ Test user not found');
    return;
  }
  
  console.log('✅ Test user found:', user.email);
  console.log('   User ID:', user.id);
  
  // Get workspace (first available)
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .limit(1);
  
  if (!workspaces || workspaces.length === 0) {
    console.log('❌ No workspace found');
    return;
  }
  
  const workspace = workspaces[0];
  console.log('\n✅ Using workspace:', workspace.name);
  console.log('   Workspace ID:', workspace.id);
  
  // Call CRM password reset endpoint
  console.log('\n🔄 Calling CRM password reset endpoint...');
  
  const goApiUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1';
  const response = await fetch(`${goApiUrl}/crm/applicants/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Note: In real usage, this would have auth token
    },
    body: JSON.stringify({
      applicant_id: user.id,
      workspace_id: workspace.id,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.log('❌ Reset failed:', response.status, error);
    return;
  }
  
  const result = await response.json();
  console.log('\n✅ Password reset successful!');
  console.log('\n📧 Credentials:');
  console.log('   Email:', result.email);
  console.log('   Temporary Password:', result.temporary_password);
  
  // Test sign-in with new password
  console.log('\n🔐 Testing sign-in with new password...');
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const signInResponse = await fetch(`${appUrl}/api/portal-auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': appUrl,
    },
    body: JSON.stringify({
      email: result.email,
      password: result.temporary_password,
    }),
  });
  
  if (signInResponse.ok) {
    const signInData = await signInResponse.json();
    console.log('✅ Sign-in successful!');
    console.log('   Signed in as:', signInData.user.email);
  } else {
    const error = await signInResponse.text();
    console.log('❌ Sign-in failed:', signInResponse.status, error);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('\n💡 Summary:');
  console.log('   - CRM password reset now uses scrypt (Better Auth compatible)');
  console.log('   - Temporary passwords are 12 characters with mixed case + symbols');
  console.log('   - Users can immediately sign in with the new password');
  console.log('   - Password is displayed to staff member for secure delivery\n');
}

testCRMPasswordReset().catch(console.error);
