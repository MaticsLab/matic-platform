#!/usr/bin/env node
/**
 * Test the rebuilt Better Auth setup
 */

const testLogin = async () => {
  console.log('\n🧪 Testing Rebuilt Better Auth...\n')
  
  const credentials = {
    email: 'jasanchez85@cps.edu',
    password: 'TestPass123'
  }
  
  console.log('📧 Credentials:', credentials.email)
  console.log('🔐 Password:', credentials.password)
  console.log('\n🌐 Testing: http://localhost:3000/api/portal-auth/sign-in/email\n')
  
  try {
    const response = await fetch('http://localhost:3000/api/portal-auth/sign-in/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })
    
    console.log('📊 Response Status:', response.status, response.statusText)
    console.log('📋 Response Headers:', Object.fromEntries(response.headers.entries()))
    
    const text = await response.text()
    console.log('\n📄 Response Body:', text || '(empty)')
    
    if (text) {
      try {
        const json = JSON.parse(text)
        console.log('\n✅ Parsed JSON:', JSON.stringify(json, null, 2))
        
        if (json.user) {
          console.log('\n🎉 LOGIN SUCCESSFUL!')
          console.log('👤 User:', json.user.email)
        } else if (json.error) {
          console.log('\n❌ LOGIN FAILED:', json.error)
        }
      } catch (e) {
        console.log('\n⚠️ Response is not JSON')
      }
    }
    
  } catch (error) {
    console.error('\n💥 Request failed:', error.message)
  }
}

testLogin()
