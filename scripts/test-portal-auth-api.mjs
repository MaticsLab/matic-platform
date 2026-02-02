#!/usr/bin/env node

/**
 * Test actual Better Auth API endpoint
 */

import fetch from 'node-fetch';
import * as fs from 'fs';
import { resolve } from 'path';

// Load environment
const envPath = resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
}

async function testPortalAuthAPI(email, password) {
  // For local testing, use localhost. For production testing, use the actual domain
  const baseURL = process.argv[4] || 'http://localhost:3000';
  const apiURL = `${baseURL}/api/portal-auth/sign-in/email`;
  
  console.log(`\n🧪 Testing Portal Auth API`);
  console.log(`   URL: ${apiURL}`);
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}\n`);
  
  try {
    console.log('📤 Sending POST request...');
    const response = await fetch(apiURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
    
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      console.log(`\n📦 Response body:`, JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log(`\n📦 Response body (text):`, text.substring(0, 500));
    }
    
    if (response.ok) {
      console.log('\n✅ API REQUEST SUCCESSFUL');
      if (data?.user) {
        console.log(`   User ID: ${data.user.id}`);
        console.log(`   Email: ${data.user.email}`);
        console.log(`   Name: ${data.user.name}`);
      }
    } else {
      console.log('\n❌ API REQUEST FAILED');
      if (data?.error) {
        console.log(`   Error: ${data.error}`);
      }
    }
    
    // Check for Set-Cookie headers
    const setCookieHeaders = response.headers.raw()['set-cookie'];
    if (setCookieHeaders && setCookieHeaders.length > 0) {
      console.log('\n🍪 Cookies set:');
      setCookieHeaders.forEach((cookie, i) => {
        console.log(`   ${i + 1}. ${cookie.substring(0, 100)}...`);
      });
    } else {
      console.log('\n⚠️  No cookies set in response');
    }
    
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the Next.js dev server is running:');
      console.log('   npm run dev');
    }
  }
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node scripts/test-portal-auth-api.mjs <email> <password> [baseURL]');
  console.log('Example: node scripts/test-portal-auth-api.mjs user@example.com password123');
  console.log('         node scripts/test-portal-auth-api.mjs user@example.com password123 https://bpnc.maticsapp.com');
  process.exit(1);
}

testPortalAuthAPI(email, password);
