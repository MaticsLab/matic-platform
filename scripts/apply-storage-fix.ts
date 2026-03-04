/**
 * Apply the storage bucket fix via Supabase client
 * Run with: npx tsx scripts/apply-storage-fix.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY not found in .env.local')
  console.log('\n📋 You need to add your service role key to .env.local:')
  console.log('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')
  console.log('\n   Find it at: Supabase Dashboard > Settings > API > service_role key')
  console.log('\n   OR run the SQL directly in Supabase Dashboard > SQL Editor:')
  console.log('\n   UPDATE storage.buckets SET public = true WHERE id = \'workspace-assets\';')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyFix() {
  console.log('🔧 Applying storage bucket fix...\n')
  
  // Run the SQL to make bucket public
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      UPDATE storage.buckets 
      SET public = true 
      WHERE id = 'workspace-assets';
      
      SELECT id, name, public, file_size_limit 
      FROM storage.buckets 
      WHERE id = 'workspace-assets';
    `
  })
  
  if (error) {
    console.error('❌ Failed to run SQL via RPC:', error.message)
    console.log('\n📋 Please run this SQL manually in Supabase Dashboard > SQL Editor:')
    console.log('\n   UPDATE storage.buckets SET public = true WHERE id = \'workspace-assets\';')
    process.exit(1)
  }
  
  console.log('✅ Bucket updated!')
  console.log('📊 Result:', data)
  
  // Test upload
  console.log('\n🧪 Testing upload...')
  const testFile = new Blob(['test content'], { type: 'text/plain' })
  const testPath = `test-uploads/test-${Date.now()}.txt`
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('workspace-assets')
    .upload(testPath, testFile)
  
  if (uploadError) {
    console.log('❌ Upload still failing:', uploadError.message)
    process.exit(1)
  }
  
  console.log('✅ Upload successful!')
  
  // Clean up
  await supabase.storage.from('workspace-assets').remove([testPath])
  console.log('🗑️  Test file cleaned up')
  console.log('\n✅ All fixed! File uploads should now work.')
}

applyFix().catch(console.error)
