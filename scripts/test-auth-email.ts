/**
 * Test Authentication Email
 * 
 * Sends a test magic link email to verify the authentication email system
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { generateAuthEmail } from '../src/lib/auth-email-helper';
import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY not found in environment');
  console.log('   Make sure .env.local exists with RESEND_API_KEY');
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

async function testAuthEmail() {
  const testEmail = 'jasanchez85@cps.edu';
  
  console.log('🧪 Testing authentication email system...\n');
  console.log(`📧 Sending test email to: ${testEmail}\n`);

  try {
    // Generate professional email template
    const { html, plainText, subject } = await generateAuthEmail({
      type: 'magic-link',
      email: testEmail,
      userName: 'Jesus Sanchez',
      actionUrl: 'https://maticsapp.com/verify?token=test_token_123456',
      expiryMinutes: 15,
      companyName: 'Matic Platform',
      brandColor: '#2563eb',
      // Include device info
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    console.log(`✅ Email template generated successfully`);
    console.log(`📝 Subject: ${subject}\n`);

    // Send email via Resend
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Matics <hello@notifications.maticsapp.com>',
      reply_to: 'support@maticsapp.com',
      to: testEmail,
      subject,
      html,
      text: plainText,
      // Add tags for tracking
      tags: [
        { name: 'category', value: 'test' },
        { name: 'type', value: 'magic-link' },
        { name: 'environment', value: 'development' },
      ],
      headers: {
        'X-Entity-Ref-ID': `test-${Date.now()}`,
        'X-Priority': '1',
      },
    });

    console.log('✅ Email sent successfully!');
    console.log(`📬 Email ID: ${result.data?.id}`);
    console.log(`\n🎉 Check your inbox at ${testEmail}`);
    console.log(`\n💡 View in Resend Dashboard: https://resend.com/emails/${result.data?.id}`);
    
  } catch (error: any) {
    console.error('❌ Error sending email:', error.message);
    
    if (error.message.includes('RESEND_API_KEY')) {
      console.log('\n⚠️  Make sure RESEND_API_KEY is set in your environment');
      console.log('   Add it to .env.local: RESEND_API_KEY=your_key_here');
    }
    
    process.exit(1);
  }
}

// Run the test
testAuthEmail();
