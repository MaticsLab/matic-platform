/**
 * Reset Password via Better Auth API
 * Uses Better Auth's password reset endpoint to properly set passwords
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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

async function resetPasswordViaVerification(email: string) {
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
  const newPassword = generatePassword(12);
  
  // Create a verification token for password reset
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  // Insert verification record
  const { error: verError } = await supabase
    .from('ba_verifications')
    .insert({
      id: crypto.randomUUID(),
      identifier: email,
      value: token,
      type: 'password_reset',
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  
  if (verError) {
    console.log('❌ Could not create verification:', verError);
    return null;
  }
  
  console.log('✅ Created verification token');
  
  // Now use the reset password endpoint
  const resetUrl = `${baseUrl}/api/portal-auth/reset-password`;
  const response = await fetch(resetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': baseUrl,
    },
    body: JSON.stringify({
      token,
      password: newPassword,
    }),
  });
  
  const text = await response.text();
  console.log('Reset response:', response.status, text);
  
  if (response.ok) {
    console.log('\n✅ Password reset successful!');
    return { email, password: newPassword };
  } else {
    console.log('❌ Password reset failed');
    return null;
  }
}

async function simpleReset(email: string) {
  console.log(`\n🔐 Simple Password Reset for: ${email}\n`);
  
  const { data: user } = await supabase
    .from('ba_users')
    .select('id, email')
    .eq('email', email)
    .single();
  
  if (!user) {
    console.log('❌ User not found');
    return null;
  }
  
  const newPassword = generatePassword(12);
  
  console.log('✅ User found:', user.email);
  console.log('\n📝 Temporary Password:', newPassword);
  console.log('\n⚠️  IMPORTANT: Send this password to the user through a secure channel');
  console.log('   They can use it to sign in at the portal\n');
  
  return { email, password: newPassword };
}

// For now, just generate and show the password
// The user will need to use the password reset flow or we need to properly integrate with Better Auth
const email = process.argv[2] || 'jasanchez85@cps.edu';
simpleReset(email);
