/**
 * Test file upload withfresh Supabase client
 * Run with: npx tsx scripts/test-upload-fresh.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log('🔑 Anon key (first 20 chars):', supabaseAnonKey.substring(0, 20) + '...')
console.log('🌐 Supabase URL:', supabaseUrl)

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Don't use any cached session
    autoRefreshToken: false,
  }
})

async function testUpload() {
  console.log('\n🧪 Testing upload with fresh client (no Better Auth)...\n')
  
  const testFile = new Blob(['test content from script'], { type: 'text/plain' })
  const testPath = `uploads/test-${Date.now()}.txt`
  
  console.log('📤 Uploading to:', testPath)
  
  const { data, error } = await supabase.storage
    .from('workspace-assets')
    .upload(testPath, testFile, {
      cacheControl: '3600',
      upsert: false
    })
  
  if (error) {
    console.log('❌ Upload failed:', error.message)
    console.log('   Full error:', JSON.stringify(error, null, 2))
    process.exit(1)
  }
  
  console.log('✅ Upload successful!')
  console.log('   Path:', data.path)
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('workspace-assets')
    .getPublicUrl(testPath)
  
  console.log('   Public URL:', publicUrl)
  
  // Clean up
  await supabase.storage.from('workspace-assets').remove([testPath])
  console.log('🗑️  Test file cleaned up')
  console.log('\n✅ All tests passed! File uploads should work in the portal.')
}

testUpload().catch(console.error)
