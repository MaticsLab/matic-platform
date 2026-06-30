/**
 * Check the current state of the workspace-assets bucket in Supabase
 * Run with: npx tsx scripts/check-storage-bucket.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkBucket() {
  console.log('🔍 Checking workspace-assets bucket configuration...\n')
  
  // Try to get bucket details (this requires service_role key usually)
  // With anon key, we'll just try an upload to see what happens
  
  // Check storage RLS policies by querying the database
  const { data: policies, error: policiesError } = await supabase
    .from('pg_policies')
    .select('*')
    .ilike('tablename', 'objects')
    .ilike('policyname', '%workspace-assets%')
  
  if (policiesError) {
    console.log('❌ Could not query policies (expected with anon key):', policiesError.message)
  } else {
    console.log('📋 Current policies:', JSON.stringify(policies, null, 2))
  }
  
  // Try a test upload to see what error we get
  console.log('\n🧪 Testing upload with anon key...')
  const testFile = new Blob(['test content'], { type: 'text/plain' })
  const testPath = `test-uploads/test-${Date.now()}.txt`
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('workspace-assets')
    .upload(testPath, testFile)
  
  if (uploadError) {
    console.log('❌ Upload failed:', uploadError.message)
    console.log('   Error details:', uploadError)
  } else {
    console.log('✅ Upload succeeded!')
    console.log('   Path:', uploadData.path)
    
    // Clean up test file
    await supabase.storage.from('workspace-assets').remove([testPath])
    console.log('🗑️  Test file cleaned up')
  }
  
  // Get public URL to see if bucket is public
  console.log('\n🔗 Testing public URL generation...')
  const { data: urlData } = supabase.storage
    .from('workspace-assets')
    .getPublicUrl('test-path.txt')
  
  console.log('   Public URL:', urlData.publicUrl)
  console.log('   (Note: URL generation always works, but access depends on bucket being public)')
}

checkBucket().catch(console.error)
